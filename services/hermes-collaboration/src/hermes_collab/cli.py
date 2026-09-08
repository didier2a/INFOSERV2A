import argparse
import json
from pathlib import Path
import platform
import shutil
import sys
from tempfile import TemporaryDirectory

from . import __version__
from .config import Settings, default_data_dir
from .registry import Registry, RegistryError


def emit(value):
    print(json.dumps(value, ensure_ascii=False, indent=2))


def client_config(settings: Settings, client: str) -> dict:
    entry = {
        "command": sys.executable,
        "args": ["-m", "hermes_collab", "--data-dir", str(settings.data_dir),
                 "--workspace", settings.workspace, "--actor", client, "mcp"],
    }
    # JSON is also valid YAML: the Hermes object can be merged into config.yaml.
    return {"mcpServers" if client == "cursor" else "mcp_servers": {"infoserv2a_registry": entry}}


def demo() -> dict:
    # The demo never seeds the user's real business database.
    with TemporaryDirectory(prefix="hermes-collab-demo-") as folder:
        settings = Settings(Path(folder), "demo", "demo-cli")
        registry = Registry(settings)
        mission = registry.create_mission("site-temoin", "Préparer une fiche projet",
                                          "Écrire puis relire un artefact synthétique.", "demo-mission-1")
        for state in ("ready", "running"):
            mission = registry.transition_mission(mission["id"], mission["version"], state, "Démonstration locale.")
        artifact = Path(folder) / "fiche-projet.txt"
        artifact.write_text("Projet témoin : site vitrine fictif.\n", encoding="utf-8")
        import hashlib
        digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
        mission = registry.transition_mission(mission["id"], mission["version"], "completed",
            "Fiche synthétique écrite et relue.", [f"sha256:{digest}"])
        registry.record_observation("site-temoin", "La fiche projet du pilote est terminée.",
                                    f"mission:{mission['id']}", "demo-observation-1")
        reopened = Registry(settings).get_mission(mission["id"])
        backup = registry.backup()
        return {"demo": "passed", "mission": reopened, "backup_created": backup.is_file(),
                "temporary_data_removed_on_exit": True, "external_actions": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Socle local Hermès / InfoServ2A")
    parser.add_argument("--data-dir", type=Path, default=default_data_dir())
    parser.add_argument("--workspace", default="infoserv2a")
    parser.add_argument("--actor", default="local-cli")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("init", "doctor", "demo", "mcp", "backup"):
        sub.add_parser(name)
    config = sub.add_parser("config")
    config.add_argument("client", choices=("cursor", "hermes"))
    args = parser.parse_args(argv)
    try:
        settings = Settings(args.data_dir, args.workspace, args.actor)
        if args.command == "config":
            emit(client_config(settings, args.client))
        elif args.command == "doctor":
            emit({"version": __version__, "system": platform.system(),
                  "python": platform.python_version(), "workspace": settings.workspace,
                  "database_exists": settings.database.is_file(),
                  "commands_on_path": {name: shutil.which(name) is not None for name in ("hermes", "codex", "git", "wsl")},
                  "connections": {name: "not_checked" for name in ("hermes", "cursor", "pc_remote", "nas", "ovh", "abby")},
                  "note": "Présence d'une commande uniquement ; aucune authentification vérifiée."})
        elif args.command == "demo":
            emit(demo())
        else:
            registry = Registry(settings)
            if args.command == "mcp":
                from .server import make_server
                make_server(registry).run(transport="stdio")
            elif args.command == "init":
                emit({"initialized": True, "database": str(settings.database), "workspace": settings.workspace})
            elif args.command == "backup":
                emit({"backup": str(registry.backup()), "integrity_check": "ok"})
    except (RegistryError, ValueError, OSError) as exc:
        print(f"Hermès : {exc}", file=sys.stderr)
        return 1
    return 0
