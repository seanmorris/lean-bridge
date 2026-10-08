/**
 * Preserve the installed WIT/WASI Fin dispatch-counter run (#1425): its original queue, TAP, end record and
 * both reports, and the ten producer sources at dac615e.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { assertWitDispatchArchive, witDispatchArchiveDirectory, witDispatchOriginals, witDispatchReceipt, witDispatchRevision, witDispatchSnapshot, witDispatchSources, writeWitDispatchArtifact } from "../tests/helpers/wit-fin-dispatch-evidence.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<producing checkout> are accepted");
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const pending = new Map(), artifacts = [];
const add = (path, bytes, originalPath) => {
	pending.set(path, bytes);
	artifacts.push({ path, originalPath, sha256: sha256(bytes), bytes: bytes.length });
};
for(const [name, file] of Object.entries(witDispatchOriginals))
{
	const bytes = await readFile(join(from, file.original));
	assert.equal(sha256(bytes), file.sha256, file.original);
	add(`${witDispatchArchiveDirectory}/${name}`, bytes, file.original);
}
for(const [path, digest] of Object.entries(witDispatchSources))
{
	const bytes = execFileSync("git", ["show", `${witDispatchRevision}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
	assert.equal(sha256(bytes), digest, path);
	add(witDispatchSnapshot(path), bytes, `git:${witDispatchRevision}:${path}`);
}
const receipt = witDispatchReceipt(artifacts);
// The current sources are checked against their producer digests by the archive tests.
await assertWitDispatchArchive(receipt, async path => pending.get(path), { currentSources: false });
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!options.includes("--check"))
{
	for(const [path, content] of pending) await writeWitDispatchArtifact(path, content);
	await writeWitDispatchArtifact(`${witDispatchArchiveDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${options.includes("--check") ? "Validated" : "Archived"} ${artifacts.length} files for the installed WIT dispatch-counter run. Receipt SHA-256 ${sha256(bytes)}\n`);
