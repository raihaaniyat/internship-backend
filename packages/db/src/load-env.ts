/**
 * Loads the repo-root `.env` into process.env, regardless of which
 * sub-package invoked the script. Bun and Node only auto-load .env
 * from cwd; in a workspace, scripts often run from a sub-package
 * directory, so we walk up to find the closest .env above us.
 *
 * Idempotent: existing process.env keys are NOT overwritten, so a
 * value already passed in (e.g. by docker compose) wins.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function findRootEnv(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function parseDotenv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadRootEnv(): void {
  const path = findRootEnv(process.cwd());
  if (!path) return;
  const parsed = parseDotenv(readFileSync(path, "utf8"));
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) {
      process.env[k] = v;
    }
  }
}

// Side effect: run on import so that downstream modules (which read env
// at top-level) see the values. ESM hoists imports, so importing this
// module FIRST in your entrypoint is sufficient.
loadRootEnv();
