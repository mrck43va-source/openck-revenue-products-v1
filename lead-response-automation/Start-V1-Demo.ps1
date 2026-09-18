param([int]$Port = 8780)
$ErrorActionPreference='Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
Write-Host ""
Write-Host "Lead Response Automation V1 Demo"
Write-Host "Serving from: $here"
Write-Host "Open: http://127.0.0.1:$Port/"
Write-Host "Press Ctrl+C to stop."
Write-Host ""
Start-Process "http://127.0.0.1:$Port/"
python -m http.server $Port --bind 127.0.0.1
