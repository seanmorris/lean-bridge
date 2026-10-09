/**
 * Preserve the installed JVM Fin dispatch-counter run (#1425): its original queue, TAP, end record and
 * both reports, and the twelve producer sources at 40fa8a8.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { assertJvmDispatchArchive, jvmDispatchArchiveDirectory, jvmDispatchOriginals, jvmDispatchReceipt, jvmDispatchRevision, jvmDispatchSnapshot, jvmDispatchSources, writeJvmDispatchArtifact } from "../tests/helpers/jvm-fin-dispatch-evidence.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<producing checkout> are accepted");
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const pending = new Map(), artifacts = [];
const add = (path, bytes, originalPath) => {
	pending.set(path, bytes);
	artifacts.push({ path, originalPath, sha256: sha256(bytes), bytes: bytes.length });
};
for(const [name, file] of Object.entries(jvmDispatchOriginals))
{
	const bytes = await readFile(join(from, file.original));
	assert.equal(sha256(bytes), file.sha256, file.original);
	add(`${jvmDispatchArchiveDirectory}/${name}`, bytes, file.original);
}
for(const [path, digest] of Object.entries(jvmDispatchSources))
{
	const bytes = execFileSync("git", ["show", `${jvmDispatchRevision}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
	assert.equal(sha256(bytes), digest, path);
	add(jvmDispatchSnapshot(path), bytes, `git:${jvmDispatchRevision}:${path}`);
}
const receipt = jvmDispatchReceipt(artifacts);
// The current sources are checked against their producer digests by the archive tests.
await assertJvmDispatchArchive(receipt, async path => pending.get(path), { currentSources: false });
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!options.includes("--check"))
{
	for(const [path, content] of pending) await writeJvmDispatchArtifact(path, content);
	await writeJvmDispatchArtifact(`${jvmDispatchArchiveDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${options.includes("--check") ? "Validated" : "Archived"} ${artifacts.length} files for the installed JVM dispatch-counter run. Receipt SHA-256 ${sha256(bytes)}\n`);
