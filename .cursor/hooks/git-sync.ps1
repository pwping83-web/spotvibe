# Cursor hook: 에이전트 작업 완료 후 변경사항 자동 커밋 & 푸시
# stdin JSON 소비 (hooks 프로토콜 필수)
$null = $input | Out-String

Set-Location $PSScriptRoot\..\..

$status = git status --porcelain 2>$null
if (-not $status) {
    # 변경 없음 — 정상 종료
    Write-Output '{}'
    exit 0
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git add -A
git commit -m "auto: cursor agent sync $timestamp" --quiet
git push --quiet

Write-Output '{}'
exit 0
