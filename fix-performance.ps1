# تحسين الأداء: استبدال جميع await syncAll و await refreshAll بالإصدارات غير المتزامنة

# leader-admin.js
$leaderAdminContent = Get-Content 'app\js\leader-admin.js' -Raw
$leaderAdminContent = $leaderAdminContent -replace 'await syncAll\(\);', 'backgroundSyncAll();'
$leaderAdminContent = $leaderAdminContent -replace 'await refreshAll\(true\);', 'backgroundRefreshAll(true);'
Set-Content 'app\js\leader-admin.js' $leaderAdminContent -Encoding UTF8

# leader-admin-pro.js
$leaderAdminProContent = Get-Content 'app\js\leader-admin-pro.js' -Raw
$leaderAdminProContent = $leaderAdminProContent -replace 'await syncAll\(\);', 'backgroundSyncAll();'
$leaderAdminProContent = $leaderAdminProContent -replace 'await refreshAll\(true\);', 'backgroundRefreshAll(true);'
$leaderAdminProContent = $leaderAdminProContent -replace 'await syncEverything\(\);', 'backgroundSyncAll();'
$leaderAdminProContent = $leaderAdminProContent -replace 'await refreshEverything\(true\);', 'backgroundRefreshAll(true);'
Set-Content 'app\js\leader-admin-pro.js' $leaderAdminProContent -Encoding UTF8

Write-Host "✓ تم تحسين الأداء بنجاح!"
Write-Host "✓ جميع الأزرار ستستجيب فوراً الآن"
