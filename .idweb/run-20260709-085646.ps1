$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'IDWEB - Preview locale'
Set-Location -LiteralPath 'C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026'

Write-Host "== IDWEB Agentic Launcher V0.4.3 CMD/K ==" -ForegroundColor Cyan
Write-Host "Projet : C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026"
Write-Host "Log    : C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026\.idweb\run-20260709-085646.log"
Write-Host ""

try {
    Start-Transcript -LiteralPath 'C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026\.idweb\run-20260709-085646.log' -Append | Out-Null
} catch {
    Write-Host "Transcript impossible : $($_.Exception.Message)" -ForegroundColor Yellow
}

try {
if (Test-Path -LiteralPath ".\package.json") {
    Write-Host "package.json detecte : lancement dev..."
    npm install
    npm run dev
} else {
    Write-Host "Site statique : http://localhost:5173"
    Start-Process "http://localhost:5173"
    python -m http.server 5173
}
    Write-Host ""
    Write-Host "Commande terminee." -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERREUR CAPTUREE :" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host $_.ScriptStackTrace
} finally {
    try { Stop-Transcript | Out-Null } catch {}
}

Write-Host ""
Write-Host "La fenetre reste ouverte grace a cmd.exe /k." -ForegroundColor Cyan
Write-Host "Tu peux copier-coller l'erreur ici."
