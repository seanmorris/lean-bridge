/** Authenticate the complete accepted archive and control bundle in Git. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeArtifactPaths } from "../../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../../src/capsule/node.mjs";
import { checkPhpWasmEntryCommittedBytes } from "../../../tests/helpers/php-wasm-refinement-entry-publication.mjs";

const root = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
assert.equal(process.cwd(), root);
const args = process.argv.slice(2);
assert.equal(args.length, 2); assert.equal(args[0], "--revision");
const revision = args[1]; assert.match(revision, /^[a-f0-9]{40}$/u);
const git = parameters => execFileSync("git", parameters, { maxBuffer: 16 * 1024 ** 2 });
assert.equal(git(["rev-parse", "HEAD"]).toString().trim(), revision);
assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]).toString(), "");
const archive = "docs/evidence/php-wasm-entry-hosted-20261025";
const bundle = "docs/evidence/php-wasm-entry-hosted-acceptance-20261025";
const read = async name => JSON.parse(await readFile(join(root, bundle, name), "utf8"));
const acceptance = await read("r1/acceptance.json"), positive = await read("r1/positive.json");
assert.equal(acceptance.kind, "php-wasm-entry-real-archive-controls-v1");
assert.equal(acceptance.negativeControls, 17); assert.equal(acceptance.originalBytesUnchanged, true);
assert.equal(positive.runId, 40144947516); assert.equal(positive.replayedRoutes, 30);
const manifestBytes = await readFile(join(root, bundle, "r1", acceptance.originalManifest.path));
assert.equal(manifestBytes.length, acceptance.originalManifest.bytes);
assert.equal(sha256(manifestBytes), acceptance.originalManifest.sha256);
const archiveAudit = await checkPhpWasmEntryCommittedBytes(revision, archive, JSON.parse(manifestBytes));
const members = await nativeArtifactPaths(join(root, bundle));
assert.ok(!members.includes("git-byte-audit.json"));
const entries = git(["ls-tree", "-rz", "--full-tree", revision, "--", bundle])
  .toString().split("\0").filter(Boolean).map(line => {
    const match = /^100(?:644|755) blob ([a-f0-9]{40})\t(.+)$/u.exec(line);
    assert.ok(match); return { object: match[1], path: match[2] };
  });
assert.deepEqual(entries.map(entry => entry.path).sort(), members.map(path => bundle + "/" + path).sort());
const files = [];
for(const entry of entries) {
  const current = await readFile(join(root, entry.path)), committed = git(["cat-file", "blob", entry.object]);
  assert.deepEqual(current, committed, entry.path);
  files.push({ path: entry.path, bytes: current.length, sha256: sha256(current) });
}
const source = files.find(file => file.path === acceptance.source.path);
assert.ok(source); assert.equal(source.sha256, acceptance.source.sha256);
assert.equal(source.bytes, acceptance.source.bytes);
assert.equal(files.find(file => file.path === bundle + "/r1/runner.mjs").sha256, source.sha256);
const execution = await read("capture-execution.json");
assert.equal(files.find(file => file.path === bundle + "/capture-runner.mjs").sha256, execution.runnerSha256);
assert.equal(git(["rev-parse", "HEAD"]).toString().trim(), revision);
assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]).toString(), "");
const report = { schemaVersion: 1, kind: "php-wasm-entry-committed-acceptance-audit-v1"
  , scope: "committed-original-archive-and-control-bytes", revision, archive: archiveAudit
  , controls: { files, negativeControls: 17, replayedRoutes: 30 }
  , source: { path: bundle + "/audit-committed.mjs", sha256: sha256(await readFile(fileURLToPath(import.meta.url))) } };
const bytes = canonicalJson(report);
await writeFile(join(root, bundle, "git-byte-audit.json"), bytes, { flag: "wx" });
console.log(JSON.stringify({ revision, archiveFiles: archiveAudit.files, archiveBytes: archiveAudit.bytes
  , controlFiles: files.length, receiptBytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }));
