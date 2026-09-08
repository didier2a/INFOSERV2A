import asyncio
import json
from pathlib import Path
import subprocess
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from hermes_collab.cli import client_config
from hermes_collab.config import Settings


def test_generated_configs_do_not_depend_on_working_directory(tmp_path):
    settings = Settings(tmp_path / "répertoire avec espaces")
    for client, key in (("cursor", "mcpServers"), ("hermes", "mcp_servers")):
        entry = client_config(settings, client)[key]["infoserv2a_registry"]
        assert Path(entry["command"]).is_absolute()
        assert str(settings.data_dir) in entry["args"]
        assert entry["args"][-1] == "mcp"
    assert not settings.data_dir.exists()


def test_demo_is_synthetic_and_does_not_create_business_data(tmp_path):
    target = tmp_path / "business"
    result = subprocess.run([sys.executable, "-m", "hermes_collab", "--data-dir", str(target), "demo"],
                            capture_output=True, text=True, check=True, timeout=20)
    body = json.loads(result.stdout)
    assert body["demo"] == "passed"
    assert body["mission"]["state"] == "completed"
    assert not target.exists()


def test_actual_stdio_protocol_and_restart(tmp_path):
    async def scenario():
        params = StdioServerParameters(command=sys.executable, args=["-m", "hermes_collab",
            "--data-dir", str(tmp_path / "mcp data"), "--actor", "mcp-test", "mcp"])
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                names = {t.name for t in (await session.list_tools()).tools}
                assert "create_mission" in names and "registry_status" in names
                assert len(names) == 7
                result = await session.call_tool("create_mission", {"project": "site-temoin", "title": "Test MCP",
                    "objective": "Retrouver la mission après redémarrage.", "idempotency_key": "mcp-request-1"})
                assert not result.isError
                created = json.loads(result.content[0].text)
                bad = await session.call_tool("transition_mission", {"mission_id": created["id"],
                    "expected_version": 1, "state": "completed", "note": "Sans preuve"})
                assert bad.isError
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool("get_mission", {"mission_id": created["id"]})
                assert not result.isError
                restored = json.loads(result.content[0].text)
                assert restored["state"] == "draft"
                assert restored["events"][0]["actor"] == "mcp-test"
    asyncio.run(asyncio.wait_for(scenario(), timeout=25))
