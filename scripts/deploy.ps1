# Build the web app and deploy it (static site + the /api/claude proxy function) to Vercel production.
# Requires: vercel CLI logged in, and the ANTHROPIC_API_KEY environment variable set in the Vercel project.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location "$root\web"
# the build writes notices (e.g. plugin timings) to stderr: judge it by its exit code, not by stderr
$ErrorActionPreference = "Continue"
npm run build
if ($LASTEXITCODE -ne 0) { throw "web build failed (exit $LASTEXITCODE)" }
$ErrorActionPreference = "Stop"
$dst = "$root\deploy\outofspec-trend-detective"
New-Item -ItemType Directory -Force $dst | Out-Null
Get-ChildItem $dst -Exclude ".vercel" | Remove-Item -Recurse -Force -Confirm:$false
Copy-Item "$root\web\dist\*" $dst -Recurse
Copy-Item "$root\web\api" "$dst\api" -Recurse
Copy-Item "$root\web\vercel.json" "$dst\vercel.json"
Set-Location $dst
$ErrorActionPreference = "Continue"  # the CLI writes hints to stderr
vercel deploy --prod --yes
