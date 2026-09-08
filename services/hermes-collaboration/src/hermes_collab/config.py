from dataclasses import dataclass
import os
from pathlib import Path
import re


def identifier(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}", value):
        raise ValueError("Identifiant invalide (1 à 80 lettres, chiffres, points, tirets).")
    return value


def default_data_dir() -> Path:
    configured = os.environ.get("HERMES_COLLAB_DATA_DIR")
    if configured:
        return Path(configured).expanduser().resolve()
    if os.name == "nt":
        root = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData/Local")))
    else:
        root = Path.home() / ".local/share"
    return root / "infoserv2a/hermes-collaboration"


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    workspace: str = "infoserv2a"
    actor: str = "local-cli"

    def __post_init__(self):
        identifier(self.workspace)
        identifier(self.actor)
        object.__setattr__(self, "data_dir", self.data_dir.expanduser().resolve())

    @property
    def database(self) -> Path:
        return self.data_dir / "registry.sqlite3"
