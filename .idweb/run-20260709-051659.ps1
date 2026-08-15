$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'IDWEB - Modifier via Codex'
Set-Location -LiteralPath 'C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026'

Write-Host "== IDWEB Agentic Launcher V0.4 CMD/K ==" -ForegroundColor Cyan
Write-Host "Projet : C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026"
Write-Host "Log    : C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026\.idweb\run-20260709-051659.log"
Write-Host ""

try {
    Start-Transcript -LiteralPath 'C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026\.idweb\run-20260709-051659.log' -Append | Out-Null
} catch {
    Write-Host "Transcript impossible : $($_.Exception.Message)" -ForegroundColor Yellow
}

try {
Write-Host "Recherche de codex..." -ForegroundColor Cyan
where.exe codex
if ($LASTEXITCODE -ne 0) {
    throw "codex introuvable dans cette session. Ouvre une nouvelle session Windows/PowerShell."
}

Write-Host ""
Write-Host "Version Codex :" -ForegroundColor Cyan
codex --version

$prompt = Get-Content -LiteralPath 'C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026\.idweb\codex-prompt-20260709-051659.txt' -Raw

Write-Host ""
Write-Host "Lancement de codex exec..." -ForegroundColor Cyan
Write-Host "Fichier prompt : C:\Users\didie\OneDrive\Documents\SITE INFOSERV2A 2026\.idweb\codex-prompt-20260709-051659.txt"
Write-Host ""

codex exec --cd . --sandbox workspace-write $prompt
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
