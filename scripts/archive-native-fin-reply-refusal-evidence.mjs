/**
 * Preserve the fresh Lean host-reply refusal run (#1453): its original queue, TAP and end record and the
 * exact producer test at 190c8fd.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { assertRefusalArchive, refusalArchiveDirectory, refusalOriginals, refusalReceipt, refusalRevision, refusalSnapshot, writeRefusalArtifact } from "../tests/helpers/native-fin-reply-refusal-evidence.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<producing checkout> are accepted");
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const pending = new Map(), artifacts = [];
const add = (path, bytes, originalPath) => {
	pending.set(path, bytes);
	artifacts.push({ path, originalPath, sha256: sha256(bytes), bytes: bytes.length });
};
for(const [name, file] of Object.entries(refusalOriginals))
{
	const bytes = await readFile(join(from, file.original));
	assert.equal(sha256(bytes), file.sha256, file.original);
	add(`${refusalArchiveDirectory}/${name}`, bytes, file.original);
}
const testPath = "tests/native-fin-callbacks.test.mjs";
add(refusalSnapshot, execFileSync("git", ["show", `${refusalRevision}:${testPath}`], { maxBuffer: 64 * 1024 * 1024 }), `git:${refusalRevision}:${testPath}`);
const receipt = refusalReceipt(artifacts);
await assertRefusalArchive(receipt, async path => pending.get(path) ?? readFile(path));
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!options.includes("--check"))
{
	for(const [path, content] of pending) await writeRefusalArtifact(path, content);
	await writeRefusalArtifact(`${refusalArchiveDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${options.includes("--check") ? "Validated" : "Archived"} ${artifacts.length} files for the fresh Lean refusal run. Receipt SHA-256 ${sha256(bytes)}\n`);
