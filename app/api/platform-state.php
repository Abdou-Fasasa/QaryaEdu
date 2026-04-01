<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$dataDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'platform-runtime.json';

function default_settings(): array {
    return [
        'examMode' => 'default',
        'examModeMessage' => '',
        'updatedAt' => ''
    ];
}

function default_state(): array {
    return [
        'applications' => [],
        'examHistory' => [],
        'examClears' => [],
        'notifications' => [],
        'settings' => default_settings()
    ];
}

function respond($payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function normalize_request_id($value): string {
    return strtoupper(trim((string) $value));
}

function timestamp_from_values(...$values): int {
    foreach ($values as $value) {
        if (!is_scalar($value)) {
            continue;
        }

        $trimmed = trim((string) $value);
        if ($trimmed === '') {
            continue;
        }

        $timestamp = strtotime($trimmed);
        if ($timestamp !== false) {
            return $timestamp;
        }
    }

    return 0;
}

function normalize_state($state): array {
    if (!is_array($state)) {
        return default_state();
    }

    return [
        'applications' => isset($state['applications']) && is_array($state['applications']) ? array_values($state['applications']) : [],
        'examHistory' => isset($state['examHistory']) && is_array($state['examHistory']) ? array_values($state['examHistory']) : [],
        'examClears' => isset($state['examClears']) && is_array($state['examClears']) ? array_values($state['examClears']) : [],
        'notifications' => isset($state['notifications']) && is_array($state['notifications']) ? array_values($state['notifications']) : [],
        'settings' => isset($state['settings']) && is_array($state['settings']) ? array_merge(default_settings(), $state['settings']) : default_settings()
    ];
}

function read_state(string $file): array {
    $raw = @file_get_contents($file);
    $decoded = json_decode($raw ?: '', true);
    return normalize_state($decoded);
}

function merge_applications(array $current, array $incoming): array {
    $records = [];
    $timestamps = [];

    foreach ([$current, $incoming] as $items) {
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $requestId = normalize_request_id($item['requestId'] ?? '');
            if ($requestId === '') {
                continue;
            }

            $item['requestId'] = $requestId;
            $timestamp = timestamp_from_values($item['updatedAt'] ?? '', $item['createdAt'] ?? '');
            $currentTimestamp = $timestamps[$requestId] ?? PHP_INT_MIN;

            if (!isset($records[$requestId]) || $timestamp >= $currentTimestamp) {
                $records[$requestId] = $item;
                $timestamps[$requestId] = $timestamp;
            }
        }
    }

    $result = array_values($records);
    usort($result, function ($first, $second) {
        return timestamp_from_values($second['updatedAt'] ?? '', $second['createdAt'] ?? '')
            <=> timestamp_from_values($first['updatedAt'] ?? '', $first['createdAt'] ?? '');
    });

    return $result;
}

function merge_exam_clears(array $current, array $incoming): array {
    $records = [];
    $timestamps = [];

    foreach ([$current, $incoming] as $items) {
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $requestId = normalize_request_id($item['requestId'] ?? '');
            if ($requestId === '') {
                continue;
            }

            $normalized = [
                'requestId' => $requestId,
                'clearedAt' => (string) ($item['clearedAt'] ?? '')
            ];

            $timestamp = timestamp_from_values($normalized['clearedAt']);
            $currentTimestamp = $timestamps[$requestId] ?? PHP_INT_MIN;

            if (!isset($records[$requestId]) || $timestamp >= $currentTimestamp) {
                $records[$requestId] = $normalized;
                $timestamps[$requestId] = $timestamp;
            }
        }
    }

    $result = array_values($records);
    usort($result, function ($first, $second) {
        return timestamp_from_values($second['clearedAt'] ?? '') <=> timestamp_from_values($first['clearedAt'] ?? '');
    });

    return $result;
}

function build_exam_clear_map(array $examClears): array {
    $map = [];

    foreach ($examClears as $clearRecord) {
        if (!is_array($clearRecord)) {
            continue;
        }

        $requestId = normalize_request_id($clearRecord['requestId'] ?? '');
        if ($requestId === '') {
            continue;
        }

        $timestamp = timestamp_from_values($clearRecord['clearedAt'] ?? '');
        $currentTimestamp = $map[$requestId] ?? PHP_INT_MIN;
        if ($timestamp >= $currentTimestamp) {
            $map[$requestId] = $timestamp;
        }
    }

    return $map;
}

function merge_exam_history(array $current, array $incoming, array $clearMap): array {
    $records = [];

    foreach ([$current, $incoming] as $items) {
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $requestId = normalize_request_id($item['requestId'] ?? '');
            if ($requestId === '') {
                continue;
            }

            $item['requestId'] = $requestId;
            $key = implode('|', [
                $requestId,
                (string) ($item['date'] ?? ''),
                (string) ($item['examLevel'] ?? ''),
                (string) ($item['score'] ?? ''),
                (string) ($item['total'] ?? ''),
                (string) ($item['percentage'] ?? '')
            ]);

            $records[$key] = $item;
        }
    }

    $result = array_values(array_filter($records, function ($attempt) use ($clearMap) {
        $requestId = normalize_request_id($attempt['requestId'] ?? '');
        $clearTimestamp = $clearMap[$requestId] ?? 0;
        if ($clearTimestamp <= 0) {
            return true;
        }

        $attemptTimestamp = timestamp_from_values($attempt['date'] ?? '');
        return $attemptTimestamp > $clearTimestamp;
    }));

    usort($result, function ($first, $second) {
        return timestamp_from_values($second['date'] ?? '') <=> timestamp_from_values($first['date'] ?? '');
    });

    return $result;
}

function merge_notifications(array $current, array $incoming): array {
    $records = [];

    foreach ([$current, $incoming] as $items) {
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $id = trim((string) ($item['id'] ?? ''));
            if ($id === '') {
                continue;
            }

            $item['id'] = $id;
            $records[$id] = $item;
        }
    }

    $result = array_values($records);
    usort($result, function ($first, $second) {
        return timestamp_from_values($second['createdAt'] ?? '') <=> timestamp_from_values($first['createdAt'] ?? '');
    });

    return $result;
}

function merge_settings(array $current, array $incoming): array {
    $normalizedCurrent = array_merge(default_settings(), $current);
    $normalizedIncoming = array_merge(default_settings(), $incoming);

    $currentTimestamp = timestamp_from_values($normalizedCurrent['updatedAt'] ?? '');
    $incomingTimestamp = timestamp_from_values($normalizedIncoming['updatedAt'] ?? '');

    if ($incomingTimestamp >= $currentTimestamp) {
        return $normalizedIncoming;
    }

    return $normalizedCurrent;
}

if (!is_dir($dataDir)) {
    mkdir($dataDir, 0777, true);
}

if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode(default_state(), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

if ($method === 'GET') {
    respond([
        'ok' => true,
        'state' => read_state($dataFile)
    ]);
}

if ($method !== 'POST') {
    respond([
        'ok' => false,
        'message' => 'Unsupported method.'
    ], 405);
}

$input = json_decode(file_get_contents('php://input') ?: '', true);
$incomingState = normalize_state($input['state'] ?? null);

$handle = fopen($dataFile, 'c+');
if ($handle === false) {
    respond([
        'ok' => false,
        'message' => 'Cannot open storage file.'
    ], 500);
}

if (!flock($handle, LOCK_EX)) {
    fclose($handle);
    respond([
        'ok' => false,
        'message' => 'Cannot lock storage file.'
    ], 500);
}

$currentState = read_state($dataFile);
$mergedExamClears = merge_exam_clears($currentState['examClears'], $incomingState['examClears']);
$mergedState = [
    'applications' => merge_applications($currentState['applications'], $incomingState['applications']),
    'examHistory' => merge_exam_history(
        $currentState['examHistory'],
        $incomingState['examHistory'],
        build_exam_clear_map($mergedExamClears)
    ),
    'examClears' => $mergedExamClears,
    'notifications' => merge_notifications($currentState['notifications'], $incomingState['notifications']),
    'settings' => merge_settings($currentState['settings'], $incomingState['settings'])
];

ftruncate($handle, 0);
rewind($handle);
fwrite($handle, json_encode($mergedState, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
fflush($handle);
flock($handle, LOCK_UN);
fclose($handle);

respond([
    'ok' => true,
    'state' => $mergedState,
    'updatedAt' => date(DATE_ATOM)
]);
