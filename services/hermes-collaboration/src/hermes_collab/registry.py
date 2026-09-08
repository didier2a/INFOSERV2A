from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
from uuid import uuid4

from .config import Settings, identifier


TRANSITIONS = {
    "draft": {"ready", "cancelled"},
    "ready": {"running", "waiting_access", "cancelled"},
    "running": {"waiting_input", "waiting_decision", "waiting_access", "reconciling",
                "completed", "failed", "cancel_requested"},
    "waiting_input": {"ready", "cancelled"},
    "waiting_decision": {"ready", "cancelled"},
    "waiting_access": {"ready", "cancelled"},
    "reconciling": {"running", "failed", "cancel_requested"},
    "cancel_requested": {"cancelled", "reconciling"},
    "completed": set(), "failed": set(), "cancelled": set(),
}


class RegistryError(ValueError):
    """An expected, user-facing registry error."""


def text_field(value: str, name: str, maximum: int = 12000) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise RegistryError(f"{name}: texte non vide requis, maximum {maximum} caractères.")
    return value.strip()


def canonical(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Registry:
    def __init__(self, settings: Settings):
        self.settings = settings
        settings.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        # User-owned local storage. NTFS ACLs remain the Windows user's responsibility.
        with self.connection() as db:
            db.execute("PRAGMA journal_mode=WAL")
            version = db.execute("PRAGMA user_version").fetchone()[0]
            if version not in (0, 1):
                raise RegistryError("Version de base non prise en charge.")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS missions (
                    id TEXT PRIMARY KEY, workspace TEXT NOT NULL, project TEXT NOT NULL,
                    title TEXT NOT NULL, objective TEXT NOT NULL, state TEXT NOT NULL,
                    version INTEGER NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL, result TEXT NOT NULL, evidence TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL,
                    UNIQUE(workspace, idempotency_key)
                );
                CREATE INDEX IF NOT EXISTS missions_scope ON missions(workspace, project, created_at);
                CREATE TABLE IF NOT EXISTS events (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT, workspace TEXT NOT NULL,
                    mission_id TEXT NOT NULL REFERENCES missions(id), actor TEXT NOT NULL,
                    created_at TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS events_mission ON events(workspace, mission_id, sequence);
                CREATE TABLE IF NOT EXISTS observations (
                    id TEXT PRIMARY KEY, workspace TEXT NOT NULL, project TEXT NOT NULL,
                    content TEXT NOT NULL, source_ref TEXT NOT NULL, actor TEXT NOT NULL,
                    created_at TEXT NOT NULL, supersedes TEXT,
                    idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL,
                    UNIQUE(workspace, idempotency_key), UNIQUE(workspace, supersedes)
                );
                CREATE INDEX IF NOT EXISTS observations_scope ON observations(workspace, project);
                PRAGMA user_version=1;
            """)
        if os.name != "nt":
            settings.database.chmod(0o600)

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.settings.database, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            yield db
        finally:
            db.close()

    @contextmanager
    def transaction(self):
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            try:
                yield db
                db.commit()
            except BaseException:
                db.rollback()
                raise

    def _mission(self, db, mission_id):
        row = db.execute("SELECT * FROM missions WHERE workspace=? AND id=?",
                         (self.settings.workspace, mission_id)).fetchone()
        if row is None:
            raise RegistryError("Mission introuvable dans cet espace.")
        result = dict(row)
        result["evidence"] = json.loads(result["evidence"])
        result.pop("request_hash")
        return result

    def _event(self, db, mission_id, kind, payload):
        db.execute("INSERT INTO events(workspace,mission_id,actor,created_at,kind,payload) VALUES(?,?,?,?,?,?)",
                   (self.settings.workspace, mission_id, self.settings.actor, now(), kind, canonical(payload)))

    def create_mission(self, project: str, title: str, objective: str, idempotency_key: str):
        project = identifier(project)
        title = text_field(title, "title", 240)
        objective = text_field(objective, "objective")
        key = text_field(idempotency_key, "idempotency_key", 160)
        digest = hashlib.sha256(canonical([project, title, objective]).encode()).hexdigest()
        with self.transaction() as db:
            old = db.execute("SELECT id,request_hash FROM missions WHERE workspace=? AND idempotency_key=?",
                             (self.settings.workspace, key)).fetchone()
            if old:
                if old["request_hash"] != digest:
                    raise RegistryError("Clé d'idempotence déjà utilisée avec une autre demande.")
                return self._mission(db, old["id"])
            mid, stamp = str(uuid4()), now()
            db.execute("INSERT INTO missions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                       (mid, self.settings.workspace, project, title, objective, "draft", 1,
                        self.settings.actor, stamp, stamp, "", "[]", key, digest))
            self._event(db, mid, "created", {"state": "draft", "version": 1})
            return self._mission(db, mid)

    def get_mission(self, mission_id: str):
        with self.connection() as db:
            mission = self._mission(db, mission_id)
            rows = db.execute("SELECT sequence,actor,created_at,kind,payload FROM events WHERE workspace=? AND mission_id=? ORDER BY sequence",
                              (self.settings.workspace, mission_id)).fetchall()
            mission["events"] = [dict(row) | {"payload": json.loads(row["payload"])} for row in rows]
            return mission

    def list_missions(self, project: str | None = None, limit: int = 30, offset: int = 0):
        if not 1 <= limit <= 100 or offset < 0:
            raise RegistryError("Pagination invalide (limit: 1 à 100, offset positif).")
        query, args = "SELECT id FROM missions WHERE workspace=?", [self.settings.workspace]
        if project is not None:
            query += " AND project=?"
            args.append(identifier(project))
        with self.connection() as db:
            rows = db.execute(query + " ORDER BY created_at DESC,id LIMIT ? OFFSET ?", args + [limit, offset])
            return [self._mission(db, row["id"]) for row in rows]

    def transition_mission(self, mission_id: str, expected_version: int, state: str,
                           note: str, evidence: list[str] | None = None):
        note = text_field(note, "note")
        if state not in TRANSITIONS:
            raise RegistryError("État inconnu.")
        evidence = evidence or []
        if not isinstance(evidence, list) or len(evidence) > 20:
            raise RegistryError("Au maximum 20 références de preuve.")
        evidence = [text_field(item, "evidence", 2000) for item in evidence]
        if state == "completed" and not evidence:
            raise RegistryError("Une mission terminée exige au moins une référence de preuve.")
        with self.transaction() as db:
            mission = self._mission(db, mission_id)
            if mission["version"] != expected_version:
                raise RegistryError("Conflit de version : relire la mission avant de la modifier.")
            if state not in TRANSITIONS[mission["state"]]:
                raise RegistryError(f"Transition interdite : {mission['state']} vers {state}.")
            version = expected_version + 1
            accumulated = list(dict.fromkeys(mission["evidence"] + evidence))
            db.execute("UPDATE missions SET state=?,version=?,updated_at=?,result=?,evidence=? WHERE workspace=? AND id=?",
                       (state, version, now(), note, canonical(accumulated), self.settings.workspace, mission_id))
            self._event(db, mission_id, "transition", {"from": mission["state"], "to": state,
                        "version": version, "note": note, "evidence": evidence})
            return self._mission(db, mission_id)

    def record_observation(self, project: str, content: str, source_ref: str,
                           idempotency_key: str, supersedes: str | None = None):
        project = identifier(project)
        content = text_field(content, "content")
        source_ref = text_field(source_ref, "source_ref", 2000)
        key = text_field(idempotency_key, "idempotency_key", 160)
        digest = hashlib.sha256(canonical([project, content, source_ref, supersedes]).encode()).hexdigest()
        with self.transaction() as db:
            old = db.execute("SELECT * FROM observations WHERE workspace=? AND idempotency_key=?",
                             (self.settings.workspace, key)).fetchone()
            if old:
                if old["request_hash"] != digest:
                    raise RegistryError("Clé d'idempotence utilisée avec une autre observation.")
                return self._observation(old)
            if supersedes:
                old = db.execute("SELECT id FROM observations WHERE workspace=? AND project=? AND id=?",
                                 (self.settings.workspace, project, supersedes)).fetchone()
                if old is None:
                    raise RegistryError("Observation à corriger introuvable dans ce projet.")
                if db.execute("SELECT id FROM observations WHERE workspace=? AND supersedes=?",
                              (self.settings.workspace, supersedes)).fetchone():
                    raise RegistryError("Observation déjà corrigée : reprendre la dernière version.")
            oid = str(uuid4())
            db.execute("INSERT INTO observations VALUES(?,?,?,?,?,?,?,?,?,?)",
                       (oid, self.settings.workspace, project, content, source_ref, self.settings.actor,
                        now(), supersedes, key, digest))
            return self._observation(db.execute("SELECT * FROM observations WHERE id=?", (oid,)).fetchone())

    @staticmethod
    def _observation(row):
        result = dict(row)
        result.pop("request_hash")
        return result

    def search_observations(self, project: str, query: str, limit: int = 20):
        project = identifier(project)
        query = text_field(query, "query", 300)
        if not 1 <= limit <= 100:
            raise RegistryError("limit doit être compris entre 1 et 100.")
        # Literal substring search, not SQL or an instruction interpreter.
        pattern = "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        with self.connection() as db:
            rows = db.execute(r"""SELECT o.* FROM observations o
                WHERE o.workspace=? AND o.project=? AND o.content LIKE ? ESCAPE '\'
                AND NOT EXISTS(SELECT 1 FROM observations n WHERE n.workspace=o.workspace AND n.supersedes=o.id)
                ORDER BY o.created_at DESC,o.id LIMIT ?""", (self.settings.workspace, project, pattern, limit))
            return [self._observation(row) for row in rows]

    def backup(self) -> Path:
        folder = self.settings.data_dir / "backups"
        folder.mkdir(exist_ok=True, mode=0o700)
        target = folder / f"registry-{uuid4()}.sqlite3"
        # A SQLite snapshot includes committed WAL data; copying the main file would not.
        fd = os.open(target, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(fd)
        with self.connection() as source:
            destination = sqlite3.connect(target)
            try:
                source.backup(destination)
                if destination.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise RegistryError("La vérification de sauvegarde a échoué.")
            finally:
                destination.close()
        return target
