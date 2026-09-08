# Lance depuis un terminal PowerShell normal dans Cursor.
# Prépare uniquement le registre local ; ne modifie pas les réglages Cursor/Hermes.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
        throw 'uv est requis. Installation officielle : https://docs.astral.sh/uv/getting-started/installation/'
    }
    & uv sync --frozen
    if ($LASTEXITCODE -ne 0) { throw 'Installation des dépendances échouée.' }
    & uv run --frozen hermes-collab doctor
    if ($LASTEXITCODE -ne 0) { throw 'Diagnostic échoué.' }
    & uv run --frozen hermes-collab demo
    if ($LASTEXITCODE -ne 0) { throw 'Démonstration échouée.' }
    Write-Host 'Socle prêt. Lire README.md pour initialiser les données et connecter le MCP.'
} finally {
    Pop-Location
}
