import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const REQUIRED_WORKER_NAME = "claire-platform-dev";
const FORBIDDEN_WORKER_NAME = "infoserv2a";

function stripJsonComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

export function assertSafeWorkerConfig(config, configPath = "wrangler.claire-platform.jsonc") {
  const name = String(config?.name || "").trim();
  if (name === FORBIDDEN_WORKER_NAME) {
    throw new Error(`REFUSED: ${configPath} targets forbidden production Worker "${FORBIDDEN_WORKER_NAME}".`);
  }
  if (name !== REQUIRED_WORKER_NAME) {
    throw new Error(`REFUSED: ${configPath} must target exactly "${REQUIRED_WORKER_NAME}", received "${name || "(missing)"}".`);
  }
  if (Array.isArray(config.routes) && config.routes.length) {
    throw new Error(`REFUSED: ${configPath} must not declare routes or custom domains.`);
  }
  if (String(config.main || "") !== "src/worker.js") {
    throw new Error(`REFUSED: ${configPath} must use the isolated entry "src/worker.js".`);
  }
  return true;
}

export async function checkConfigFile(configPath) {
  const source = await readFile(configPath, "utf8");
  let config;
  try {
    config = JSON.parse(stripJsonComments(source));
  } catch (error) {
    throw new Error(`REFUSED: cannot parse ${configPath}: ${error.message}`);
  }
  assertSafeWorkerConfig(config, configPath);
  return config;
}

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === scriptPath) {
  const defaultConfig = fileURLToPath(new URL("../wrangler.claire-platform.jsonc", import.meta.url));
  const configPath = path.resolve(process.argv[2] || defaultConfig);
  try {
    const config = await checkConfigFile(configPath);
    console.log(`Safe Worker target confirmed: ${config.name}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
