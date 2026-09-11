import { spawnSync } from "node:child_process";

const PREVIEW_BRANCH = "cursor/allege-chrome-claire-mobile-ecdc";
const PREPROD_WORKER = "infoserv2a-claire-v3-preproduction";

if (process.env.WORKERS_CI_BRANCH !== PREVIEW_BRANCH) {
  console.log("Preproduction deploy skipped outside PR #16 branch.");
  process.exit(0);
}

console.log(`Deploying ${PREVIEW_BRANCH} to non-production Worker ${PREPROD_WORKER}.`);
const result = spawnSync(
  "npx",
  [
    "wrangler@latest",
    "deploy",
    "--config",
    "wrangler.preview.jsonc",
    "--name",
    PREPROD_WORKER,
    "--keep-vars"
  ],
  { stdio: "inherit", shell: false }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
