# 스팟바이브: 기본 브라우저 + Cursor 창 내 Simple Browser 동시에 열기
# 사용: .\scripts\open-app.ps1
#       npm run open:app -- 5174   (Vite가 다른 포트일 때)
param()
$port = if ($args.Count -ge 1 -and $args[0]) { $args[0] } else { '5199' }
$url = "http://localhost:$port/"

$encoded = [System.Uri]::EscapeDataString($url)
$simpleBrowser = "vscode://vscode.simple-browser/show?url=$encoded"

Start-Process $url
if (Get-Command cursor -ErrorAction SilentlyContinue) {
  & cursor $simpleBrowser
} else {
  Write-Warning 'PATH에 cursor CLI가 없습니다. Cursor 설치 시 "Shell Command: Install cursor command"를 실행하세요.'
}
