import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "/app/build/worktrees/codex-vo1824-dispatch/src/capsule/node.mjs";
const root = "/app/build/worktrees/codex-vo1824-dispatch";
const output = join(root, "docs/evidence/php-wasm-entry-hosted-acceptance-20261025");
const args = ["--max-old-space-size=512", join(root, "scripts/archive-php-wasm-refinement-entry-hosted.mjs")
  , "--selection", "/tmp/vo2061-complete-inputs-i5l6vC/selection.json"
  , "--output", join(root, "docs/evidence/php-wasm-entry-hosted-20261025")
  , "--producer-checkout", "/app/build/worktrees/vo2061-producer-kreTbG"];
const started = new Date().toISOString();
console.log(JSON.stringify({ phase: "capture-started", started, output: args[5] }));
try {
  const result = await promisify(execFile)(process.execPath, args, {
    cwd: root, encoding: "utf8", timeout: 600000, maxBuffer: 16 * 1024 ** 2
  });
  const value = JSON.parse(result.stdout);
  assert.equal(result.stdout, canonicalJson(value));
  assert.equal(value.kind, "php-wasm-entry-hosted-archive-acceptance-v1");
  assert.equal(value.runId, 40144947516); assert.equal(value.replayedRoutes, 30);
  await writeFile(join(output, "capture.json"), result.stdout, { flag: "wx" });
  const record = { schemaVersion: 1, scope: "complete-capture-execution"
    , started, completed: new Date().toISOString(), nodeVersion: process.versions.node
    , command: [process.execPath, ...args], cwd: root
    , runnerSha256: sha256(await readFile(new URL(import.meta.url)))
    , result: { path: "capture.json", bytes: Buffer.byteLength(result.stdout), sha256: sha256(result.stdout) }
    , stderr: result.stderr };
  await writeFile(join(output, "capture-execution.json"), canonicalJson(record), { flag: "wx" });
  console.log(JSON.stringify({ phase: "capture-complete", ...value }));
} catch(error) {
  await writeFile(join(output, "capture-failure.json"), canonicalJson({
    schemaVersion: 1, scope: "failed-capture-diagnostic-only", started
    , completed: new Date().toISOString(), command: [process.execPath, ...args]
    , message: error.message, stdout: error.stdout ?? "", stderr: error.stderr ?? ""
  }), { flag: "wx" });
  throw error;
}
