# Function to check if a command exists
function Test-CommandExists {
    param($command)
    $exists = $null -ne (Get-Command $command -ErrorAction SilentlyContinue)
    return $exists
}

# Check for npm
if (Test-CommandExists "git") {
    Write-Host "Git is installed"
} else {
    Write-Host "Git is not installed"
}

# Check for npm
if (Test-CommandExists "choco") {
    Write-Host "Chocolaty is installed"
} else {
    Write-Host "Chocolaty is not installed"
}

# Check for npm
if (Test-CommandExists "npm") {
    Write-Host "npm is installed"
} else {
    Write-Host "npm is not installed"
}

# Check for mongorestore
if (Test-CommandExists "mongorestore") {
    Write-Host "mongorestore is installed"
} else {
    Write-Host "mongorestore is not installed"
}

# Check for mongorestore
if (Test-CommandExists "mongorestore") {
    Write-Host "mongosh is installed"
} else {
    Write-Host "mongosh is not installed"
}

# Add similar checks for other required commands