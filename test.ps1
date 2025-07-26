while ($true) {
    $response = Invoke-WebRequest -Uri "https://8ttpqyq23e.eu-central-1.awsapprunner.com/health" -UseBasicParsing -ErrorAction SilentlyContinue
    $status = if ($response) { $response.StatusCode } else { 0 }
    if ($status -ne 200) {
        Write-Output "$(Get-Date): FEHLER! Statuscode: $status"
    }
    Start-Sleep -Seconds 2
}