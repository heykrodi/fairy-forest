param([switch]$Stop)

$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot 'content'
if (-not (Test-Path -LiteralPath $project -PathType Container)) {
    $project = Split-Path -Parent $PSScriptRoot
}
$hash = [Security.Cryptography.SHA256]::Create()
$key = [BitConverter]::ToString($hash.ComputeHash(
    [Text.Encoding]::UTF8.GetBytes($project.ToUpperInvariant())
)).Replace('-', '').Substring(0, 16)
$eventName = "Local\LanternExhibition-$key"

try {
    if ($Stop) {
        try {
            $signal = [Threading.EventWaitHandle]::OpenExisting($eventName)
        } catch [Threading.WaitHandleCannotBeOpenedException] {
            return
        }
        try { $null = $signal.Set() } finally { $signal.Dispose() }
        return
    }

    $created = $false
    $signal = [Threading.EventWaitHandle]::new($false, 'ManualReset', $eventName, [ref]$created)
    try {
        if (-not $created) { return }

        $chromePath = @(
            "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
            "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
        ) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
        if (-not $chromePath) { throw 'Google Chrome을 먼저 설치한 뒤 전시 시작을 다시 열어 주세요.' }

        $python = Join-Path $PSScriptRoot 'runtime\python.exe'
        if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
            throw '실행에 필요한 파일이 없습니다. 전시 패키지의 압축을 모두 풀어 주세요.'
        }
        if (-not (Test-Path -LiteralPath (Join-Path $project 'index.html') -PathType Leaf)) {
            throw '전시 콘텐츠를 찾을 수 없습니다. 전시 패키지의 압축을 모두 풀어 주세요.'
        }
        if ([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port -contains 8765) {
            throw '8765번을 사용하는 프로그램이 이미 실행 중입니다. 그 프로그램을 종료한 뒤 다시 시작해 주세요.'
        }

        $server = Start-Process -FilePath $python -ArgumentList '-m http.server 8765 --bind 127.0.0.1' -WorkingDirectory $project -WindowStyle Hidden -PassThru
        $url = 'http://127.0.0.1:8765/'
        $ready = $false
        for ($attempt = 0; $attempt -lt 50; $attempt++) {
            if ($signal.WaitOne(200)) { return }
            if ($server.HasExited) { throw '전시 웹 서버를 시작할 수 없습니다.' }
            $listener = netstat.exe -ano -p tcp | Select-String "127\.0\.0\.1:8765\s+0\.0\.0\.0:0\s+\S+\s+$($server.Id)\s*$"
            if ($listener) {
                $ready = $true
                break
            }
        }
        if (-not $ready) { throw '전시 웹 서버가 응답하지 않습니다.' }

        $profile = Join-Path $env:LOCALAPPDATA "LanternExhibition\$key"
        $browser = Start-Process -FilePath $chromePath -ArgumentList @(
            ('--user-data-dir="{0}"' -f $profile)
            '--no-first-run'
            '--no-default-browser-check'
            '--start-maximized'
            '--new-window'
            $url
        ) -PassThru
        while (-not $browser.HasExited -and -not $server.HasExited) {
            if ($signal.WaitOne(250)) { break }
        }
    } finally {
        try {
            if ($browser -and -not $browser.HasExited) {
                $browser.Refresh()
                if (-not $browser.CloseMainWindow() -or -not $browser.WaitForExit(5000)) {
                    if (-not $browser.HasExited) { $browser.Kill() }
                }
            }
        } finally {
            if ($server -and -not $server.HasExited) { $server.Kill() }
            $signal.Dispose()
        }
    }
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    $null = [Windows.Forms.MessageBox]::Show($_.Exception.Message, '전시 운영')
    exit 1
}

