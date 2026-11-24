param (
    [ValidateSet('Demo', 'Oracle')]
    [string]$Mode
)

$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $PSCommandPath
$appDirectory = Split-Path -Parent $scriptDirectory

function Test-AppReady {
    $request = [System.Net.HttpWebRequest]::Create('http://127.0.0.1:3000/api/stats')
    $request.Timeout = 5000
    try {
        $response = $request.GetResponse()
        try {
            return ([int]$response.StatusCode -eq 200)
        } finally {
            $response.Close()
        }
    } catch [System.Net.WebException] {
        if ($_.Exception.Response) {
            $_.Exception.Response.Close()
        }
        return $false
    }
}

function Start-DockerDemo {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) {
        throw 'Docker is not installed or is not available on PATH. Install and start Docker Desktop.'
    }

    & $docker.Source compose version *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose v2 is unavailable. Update Docker Desktop and try again.'
    }

    & $docker.Source info --format '{{.ServerVersion}}' *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Desktop is not running. Start Docker Desktop and run this launcher again.'
    }

    Push-Location $appDirectory
    try {
        Write-Host 'Starting the local Oracle demo. First startup may take several minutes.'
        & $docker.Source compose up --build -d
        $composeExitCode = $LASTEXITCODE
        if ($composeExitCode -ne 0) {
            & $docker.Source compose ps
            & $docker.Source compose logs --tail 50 oracle app
            throw 'Docker Compose could not start the demo.'
        }

        $ready = $false
        $deadline = (Get-Date).AddMinutes(10)
        while (-not $ready -and (Get-Date) -lt $deadline) {
            $ready = Test-AppReady
            if (-not $ready) {
                Start-Sleep -Seconds 2
            }
        }

        if (-not $ready) {
            & $docker.Source compose ps
            & $docker.Source compose logs --tail 80 oracle app
            throw 'The demo did not become ready within 10 minutes.'
        }

        Start-Process 'http://127.0.0.1:3000'
        Write-Host 'The demo is ready at http://127.0.0.1:3000.'
        Write-Host 'Stop it from this folder with: docker compose down'
    } finally {
        Pop-Location
    }
}

function Start-ExistingOracleApp {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        throw 'Node.js is not installed or is not available on PATH. Install Node.js 22.5 or later.'
    }

    if (-not (Test-Path (Join-Path $appDirectory 'node_modules\oracledb'))) {
        throw 'Dependencies are not installed. Run npm.cmd ci from the project folder first.'
    }

    $portProbe = New-Object System.Net.Sockets.TcpClient
    try {
        $portProbe.Connect('127.0.0.1', 3000)
        throw 'Port 3000 is already in use. Stop the other server and run this launcher again.'
    } catch [System.Net.Sockets.SocketException] {
    } finally {
        $portProbe.Dispose()
    }

    $env:ORACLE_USER = (Read-Host 'Oracle app-schema username').Trim()
    if ([string]::IsNullOrWhiteSpace($env:ORACLE_USER)) {
        throw 'An Oracle app-schema username is required.'
    }

    $connectString = Read-Host 'Oracle connect string [localhost:1521/FREEPDB1]'
    if ([string]::IsNullOrWhiteSpace($connectString)) {
        $connectString = 'localhost:1521/FREEPDB1'
    }
    $env:ORACLE_CONNECT_STRING = $connectString.Trim()

    $securePassword = Read-Host 'Oracle app-schema password' -AsSecureString
    if ($securePassword.Length -eq 0) {
        throw 'An Oracle app-schema password is required.'
    }

    $passwordPointer = [IntPtr]::Zero
    try {
        $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        $env:ORACLE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
        $env:PORT = '3000'
        $serverProcess = Start-Process -FilePath $node.Source `
            -ArgumentList 'src/server.js' `
            -WorkingDirectory $appDirectory `
            -NoNewWindow `
            -PassThru
    } finally {
        Remove-Item Env:ORACLE_PASSWORD -ErrorAction SilentlyContinue
        Remove-Item Env:ORACLE_USER -ErrorAction SilentlyContinue
        Remove-Item Env:ORACLE_CONNECT_STRING -ErrorAction SilentlyContinue
        Remove-Item Env:PORT -ErrorAction SilentlyContinue
        if ($passwordPointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
        }
        $securePassword.Dispose()
    }

    $serverReady = $false
    $deadline = (Get-Date).AddSeconds(45)
    while (-not $serverReady -and (Get-Date) -lt $deadline) {
        $serverProcess.Refresh()
        if ($serverProcess.HasExited) {
            throw 'The server exited during startup. Review the error above.'
        }

        $probe = New-Object System.Net.Sockets.TcpClient
        try {
            $probe.Connect('127.0.0.1', 3000)
            $serverReady = $true
        } catch [System.Net.Sockets.SocketException] {
            Start-Sleep -Seconds 1
        } finally {
            $probe.Dispose()
        }
    }

    if (-not $serverReady) {
        throw 'The app did not start listening on port 3000. Check the server window for the Oracle error.'
    }

    Start-Process 'http://127.0.0.1:3000'
    Write-Host 'The app is running. Keep the server window open while you use it.'
}

if ([string]::IsNullOrWhiteSpace($Mode)) {
    Write-Host 'Start the self-contained Docker demo or connect to your own Oracle database.'
    Write-Host '[1] Docker demo (recommended; press Enter)'
    Write-Host '[2] Existing Oracle database'
    $choice = (Read-Host 'Choice [1]').Trim()
    if ([string]::IsNullOrEmpty($choice) -or $choice -eq '1') {
        $Mode = 'Demo'
    } elseif ($choice -eq '2') {
        $Mode = 'Oracle'
    } else {
        throw 'Choose 1 for the Docker demo or 2 for an existing Oracle database.'
    }
}

if ($Mode -eq 'Demo') {
    Start-DockerDemo
} elseif ($Mode -eq 'Oracle') {
    Start-ExistingOracleApp
}
