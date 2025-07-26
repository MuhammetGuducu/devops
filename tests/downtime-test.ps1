$downtimeStart = $null
$lastDowntime = $null
$uptimeThreshold = [TimeSpan]::FromMinutes(10)

while ($true) {
    $response = Invoke-WebRequest -Uri "https://8ttpqyq23e.eu-central-1.awsapprunner.com/health" -UseBasicParsing -ErrorAction SilentlyContinue
    $status = if ($response) { $response.StatusCode } else { 0 }
    
    if ($status -ne 200) {
        $lastDowntime = Get-Date
        if ($null -eq $downtimeStart) {
            $downtimeStart = Get-Date
        }
        $currentDowntime = (Get-Date) - $downtimeStart
        Write-Output "$(Get-Date): FEHLER! Statuscode: $status"
        Write-Output "Ausfallzeit: $($currentDowntime.ToString('hh\:mm\:ss'))"
    }
    else {
        if ($downtimeStart) {
            Write-Output "$(Get-Date): Service wieder verfügbar!"
            $downtimeStart = $null
        }
        
        if ($lastDowntime -and ((Get-Date) - $lastDowntime) -gt $uptimeThreshold) {
            Write-Output "Service war für 10 Minuten stabil. Monitoring wird beendet."
            break
        }
    }
    
    Start-Sleep -Seconds 2
}
