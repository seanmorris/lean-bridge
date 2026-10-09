/**
 * Preserve the local native fresh-Lean refusal run and its fourteen selected producer sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { assertNativeRefusalArchive, nativeRefusalDirectory, nativeRefusalOriginals, nativeRefusalReceipt, nativeRefusalRevision, nativeRefusalSnapshot, nativeRefusalSources, writeNativeRefusalArtifact } from "../tests/helpers/reviewed-fin-native-refusal-evidence.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<producing checkout> are accepted");
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const pending = new Map(), artifacts = [];
const add = (path, bytes, originalPath) => {
	pending.set(path, bytes);
	artifacts.push({ path, originalPath, sha256: sha256(bytes), bytes: bytes.length });
};
for(const [name, file] of Object.entries(nativeRefusalOriginals))
{
	const bytes = await readFile(join(from, file.original));
	assert.equal(sha256(bytes), file.sha256, file.original);
	add(`${nativeRefusalDirectory}/${name}`, bytes, file.original);
}
for(const [path, digest] of Object.entries(nativeRefusalSources))
{
	const bytes = execFileSync("git", ["show", `${nativeRefusalRevision}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
	assert.equal(sha256(bytes), digest, path);
	add(nativeRefusalSnapshot(path), bytes, `git:${nativeRefusalRevision}:${path}`);
}
const receipt = nativeRefusalReceipt(artifacts);
// The current sources are checked against their producer digests by the archive tests.
await assertNativeRefusalArchive(receipt, async path => pending.get(path), { currentSources: false });
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!options.includes("--check"))
{
	for(const [path, content] of pending) await writeNativeRefusalArtifact(path, content);
	await writeNativeRefusalArtifact(`${nativeRefusalDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${options.includes("--check") ? "Validated" : "Archived"} ${artifacts.length} files for the native fresh-Lean refusal run. Receipt SHA-256 ${sha256(bytes)}\n`);
