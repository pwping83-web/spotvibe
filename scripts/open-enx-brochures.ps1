# ENX 브로슈어 — 로컬 HTTP (한글 경로·file:// 미리보기 오류 회피)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root "public\enx-brochures"
$port = 8765
$url = "http://127.0.0.1:$port/"

if (-not (Test-Path (Join-Path $dir "index.html"))) {
  Write-Error "public\enx-brochures\index.html 이 없습니다."
}

Write-Host "브로슈어 폴더: $dir"
Write-Host "열 주소: $url"
Write-Host "종료: Ctrl+C"
Write-Host ""

Start-Process $url
Set-Location $dir
npx --yes serve -l $port .
