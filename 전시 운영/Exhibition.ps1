param([switch]$Stop)

$ErrorActionPreference = 'Stop'
$hash = [Security.Cryptography.SHA256]::Create()
$key = [BitConverter]::ToString($hash.ComputeHash(
    [Text.Encoding]::UTF8.GetBytes($PSScriptRoot.ToUpperInvariant())
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

        $profile = Join-Path $env:LOCALAPPDATA "LanternExhibition\$key"
        $browser = Start-Process -FilePath $chromePath -ArgumentList @(
            ('--user-data-dir="{0}"' -f $profile)
            '--no-first-run'
            '--no-default-browser-check'
            '--start-maximized'
            '--new-window'
            'https://heykrodi.github.io/fairy-forest/'
        ) -PassThru
        while (-not $browser.HasExited) {
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
            $signal.Dispose()
        }
    }
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    $null = [Windows.Forms.MessageBox]::Show($_.Exception.Message, '전시 운영')
    exit 1
}

