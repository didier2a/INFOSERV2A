$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'IDWEB - Codex Doctor'
Set-Location -LiteralPath 'C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026'

Write-Host "== IDWEB Agentic Launcher V0.4.1 CMD/K ==" -ForegroundColor Cyan
Write-Host "Projet : C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026"
Write-Host "Log    : C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026\.idweb\run-20260709-052644.log"
Write-Host ""

try {
    Start-Transcript -LiteralPath 'C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026\.idweb\run-20260709-052644.log' -Append | Out-Null
} catch {
    Write-Host "Transcript impossible : $($_.Exception.Message)" -ForegroundColor Yellow
}

try {
Write-Host "DOSSIER COURANT:"
Get-Location
Write-Host ""
Write-Host "PATH CODEX:"
where.exe codex
Write-Host ""
Write-Host "VERSION CODEX:"
codex --version
Write-Host ""
Write-Host "DOCTOR CODEX:"
codex doctor
Write-Host ""
Write-Host "TEST EXEC LECTURE SEULE:"
codex exec --cd . --sandbox read-only --ask-for-approval never "Analyse rapidement ce projet et donne uniquement le framework detecte. Ne modifie aucun fichier."
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
