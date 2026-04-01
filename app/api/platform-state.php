<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$dataDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'platform-runtime.json';

if (!is_dir($dataDir)) {
    mkdir($dataDir, 0777, true);
}

if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode([
        'applications' => [],
        'examHistory' => [],
        'notifications' => [],
        'settings' => [
            'examMode' => 'default',
            'examModeMessage' => '',
            'updatedAt' => ''
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function respond($payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function readState(string $file): array {
    $raw = @file_get_contents($file);
    $data = json_decode($raw ?: '', true);

    if (!is_array($data)) {
        return [
            'applications' => [],
            'examHistory' => [],
            'notifications' => [],
            'settings' => [
                'examMode' => 'default',
                'examModeMessage' => '',
                'updatedAt' => ''
            ]
        ];
    }

    return [
        'applications' => isset($data['applications']) && is_array($data['applications']) ? array_values($data['applications']) : [],
        'examHistory' => isset($data['examHistory']) && is_array($data['examHistory']) ? array_values($data['examHistory']) : [],
        'notifications' => isset($data['notifications']) && is_array($data['notifications']) ? array_values($data['notifications']) : [],
        'settings' => isset($data['settings']) && is_array($data['settings']) ? $data['settings'] : [
            'examMode' => 'default',
            'examModeMessage' => '',
            'updatedAt' => ''
        ]
    ];
}

if ($method === 'GET') {
    respond([
        'ok' => true,
        'state' => readState($dataFile)
    ]);
}

if ($method !== 'POST') {
    respond([
        'ok' => false,
        'message' => 'Unsupported method.'
    ], 405);
}

$input = json_decode(file_get_contents('php://input') ?: '', true);
$state = $input['state'] ?? null;

if (!is_array($state)) {
    respond([
        'ok' => false,
        'message' => 'Invalid payload.'
    ], 422);
}

$normalized = [
    'applications' => isset($state['applications']) && is_array($state['applications']) ? array_values($state['applications']) : [],
    'examHistory' => isset($state['examHistory']) && is_array($state['examHistory']) ? array_values($state['examHistory']) : [],
    'notifications' => isset($state['notifications']) && is_array($state['notifications']) ? array_values($state['notifications']) : [],
    'settings' => isset($state['settings']) && is_array($state['settings']) ? $state['settings'] : [
        'examMode' => 'default',
        'examModeMessage' => '',
        'updatedAt' => ''
    ]
];

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

ftruncate($handle, 0);
rewind($handle);
fwrite($handle, json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
fflush($handle);
flock($handle, LOCK_UN);
fclose($handle);

respond([
    'ok' => true,
    'state' => $normalized,
    'updatedAt' => date(DATE_ATOM)
]);