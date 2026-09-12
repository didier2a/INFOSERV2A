import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  assertSafeWorkerConfig,
  checkConfigFile,
  REQUIRED_WORKER_NAME
} from "../scripts/assert-safe-worker-config.mjs";

test("platform config targets only claire-platform-dev", async () => {
  const configUrl = new URL("../wrangler.claire-platform.jsonc", import.meta.url);
  const config = await checkConfigFile(configUrl);
  assert.equal(config.name, REQUIRED_WORKER_NAME);
  assert.equal(config.routes, undefined);
});

test("deployment guard explicitly refuses the infoserv2a Worker name", () => {
  assert.throws(
    () => assertSafeWorkerConfig({
      name: "infoserv2a",
      main: "src/worker.js"
    }),
    /REFUSED: .*forbidden production Worker "infoserv2a"/
  );
});

test("InfoServ2A asset upload excludes the complete Claire platform", async () => {
  const assetsIgnore = await readFile(new URL("../../.assetsignore", import.meta.url), "utf8");
  assert.match(assetsIgnore, /^claire-platform\/$/m);
});

test("dogfood pages load only the matching Claire tenant", async () => {
  const fixtures = [
    ["../public/demo-boulangerie.html", "boulangerie-soleil"],
    ["../public/demo-atelier.html", "atelier-lumiere"]
  ];
  for (const [path, tenantId] of fixtures) {
    const html = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(html, /src="\/claire-embed\.js"/);
    assert.match(html, new RegExp(`data-tenant="${tenantId}"`));
  }
});
