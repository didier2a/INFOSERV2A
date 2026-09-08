from concurrent.futures import ThreadPoolExecutor
import shutil

import pytest

from hermes_collab.config import Settings
from hermes_collab.registry import Registry, RegistryError


@pytest.fixture
def registry(tmp_path):
    return Registry(Settings(tmp_path / "data", "infoserv2a", "astra-test"))


def create(registry, key="request-1", project="site-temoin"):
    return registry.create_mission(project, "Préparer le site", "Créer une fiche de cadrage fictive.", key)


def test_persistence_and_event_provenance(registry):
    mission = create(registry)
    reopened = Registry(registry.settings).get_mission(mission["id"])
    assert reopened["objective"] == mission["objective"]
    assert reopened["events"][0]["actor"] == "astra-test"
    assert reopened["state"] == "draft"


def test_concurrent_retry_creates_one_mission_and_event(registry):
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: create(registry), range(16)))
    assert len({r["id"] for r in results}) == 1
    assert len(registry.list_missions()) == 1
    assert len(registry.get_mission(results[0]["id"])["events"]) == 1


def test_idempotency_conflict(registry):
    create(registry)
    with pytest.raises(RegistryError, match="autre demande"):
        registry.create_mission("site-temoin", "Un autre objectif", "Différent", "request-1")


def test_workspace_cannot_read_or_transition_other_mission(registry):
    mission = create(registry)
    other = Registry(Settings(registry.settings.data_dir, "gem", "other"))
    assert other.list_missions() == []
    with pytest.raises(RegistryError, match="introuvable"):
        other.get_mission(mission["id"])
    with pytest.raises(RegistryError, match="introuvable"):
        other.transition_mission(mission["id"], 1, "ready", "Test")
    assert create(other)["id"] != mission["id"]


def test_stale_version_and_invalid_transition_leave_no_event(registry):
    mission = create(registry)
    registry.transition_mission(mission["id"], 1, "ready", "Prête")
    with pytest.raises(RegistryError, match="Conflit"):
        registry.transition_mission(mission["id"], 1, "running", "Ancienne version")
    with pytest.raises(RegistryError, match="interdite"):
        registry.transition_mission(mission["id"], 2, "completed", "Trop tôt", ["test:preuve"])
    assert len(registry.get_mission(mission["id"])["events"]) == 2


def test_complete_requires_evidence_and_preserves_previous_evidence(registry):
    mission = create(registry)
    registry.transition_mission(mission["id"], 1, "ready", "Prête", ["test:cadrage"])
    registry.transition_mission(mission["id"], 2, "running", "En cours")
    with pytest.raises(RegistryError, match="preuve"):
        registry.transition_mission(mission["id"], 3, "completed", "Finie")
    result = registry.transition_mission(mission["id"], 3, "completed", "Artefact vérifié", ["test:resultat"])
    assert result["evidence"] == ["test:cadrage", "test:resultat"]
    with pytest.raises(RegistryError, match="interdite"):
        registry.transition_mission(mission["id"], 4, "running", "Reprendre")


def test_cancel_request_does_not_mean_cancelled(registry):
    mission = create(registry)
    for version, state in enumerate(["ready", "running", "cancel_requested"], 1):
        registry.transition_mission(mission["id"], version, state, "Test")
    assert Registry(registry.settings).get_mission(mission["id"])["state"] == "cancel_requested"


def test_observation_correction_and_project_scope(registry):
    original = registry.record_observation("site-temoin", "Version de la fiche : A", "test:source", "obs-1")
    updated = registry.record_observation("site-temoin", "Version de la fiche : B", "test:correction", "obs-2", original["id"])
    assert [o["id"] for o in registry.search_observations("site-temoin", "fiche")] == [updated["id"]]
    assert registry.search_observations("autre-projet", "fiche") == []
    other = Registry(Settings(registry.settings.data_dir, "gem", "other"))
    assert other.search_observations("site-temoin", "fiche") == []
    with pytest.raises(RegistryError, match="introuvable"):
        other.record_observation("site-temoin", "Modification", "test:source", "obs-3", original["id"])
    with pytest.raises(RegistryError, match="déjà corrigée"):
        registry.record_observation("site-temoin", "Version C", "test:source", "obs-3", original["id"])


def test_observation_retry_and_literal_search(registry):
    args = ("site-temoin", "Progression : 100%_confirmée", "test:source", "obs-1")
    original = registry.record_observation(*args)
    assert registry.record_observation(*args)["id"] == original["id"]
    assert len(registry.search_observations("site-temoin", "%_")) == 1
    assert registry.search_observations("site-temoin", "' OR 1=1 --") == []
    with pytest.raises(RegistryError, match="autre observation"):
        registry.record_observation("site-temoin", "Autre texte", "test:source", "obs-1")


def test_backup_can_be_restored(registry, tmp_path):
    mission = create(registry)
    backup = registry.backup()
    restored_settings = Settings(tmp_path / "restored", "infoserv2a", "restore-test")
    restored_settings.data_dir.mkdir()
    shutil.copyfile(backup, restored_settings.database)
    assert Registry(restored_settings).get_mission(mission["id"])["title"] == mission["title"]


def test_event_failure_rolls_back_mission(registry, monkeypatch):
    def fail(*_):
        raise RuntimeError("injected storage failure")
    monkeypatch.setattr(registry, "_event", fail)
    with pytest.raises(RuntimeError):
        create(registry)
    assert registry.list_missions() == []


@pytest.mark.parametrize("project", ["../client", "", "a" * 81])
def test_invalid_project_rejected(registry, project):
    with pytest.raises(ValueError):
        create(registry, project=project)
