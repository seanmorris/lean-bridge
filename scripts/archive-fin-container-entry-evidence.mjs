/**
 * Preserve every local installed native Fin container entry-counter attempt and its exact producer sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { assertContainerEntryArchive, containerEntryAttempts, containerEntryDirectory, containerEntryReceipt, containerEntrySnapshot, containerEntrySources, writeContainerEntryArtifact } from "../tests/helpers/fin-container-entry-evidence.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<checkout holding the originals> are accepted");
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const pending = new Map(), artifacts = [];
const add = (path, bytes, originalPath) => {
	assert.ok(!pending.has(path));
	pending.set(path, bytes);
	artifacts.push({ path, originalPath, sha256: sha256(bytes), bytes: bytes.length });
};
for(const attempt of containerEntryAttempts) for(const [name, file] of Object.entries(attempt.files))
{
	const bytes = await readFile(join(from, file.original));
	assert.equal(sha256(bytes), file.sha256, file.original);
	add(`${containerEntryDirectory}/${attempt.id}/${name}`, bytes, file.original);
}
for(const source of containerEntrySources)
{
	const bytes = execFileSync("git", ["show", `${source.revision}:${source.path}`], { maxBuffer: 64 * 1024 * 1024 });
	assert.equal(sha256(bytes), source.sha256, source.path);
	add(containerEntrySnapshot(source.revision, source.path), bytes, `git:${source.revision}:${source.path}`);
}
const receipt = containerEntryReceipt(artifacts);
// Current sources are checked against their producer digests by the archive tests in a full checkout.
await assertContainerEntryArchive(receipt, async path => pending.get(path), { currentSources: false });
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!options.includes("--check"))
{
	for(const [path, content] of pending) await writeContainerEntryArtifact(path, content);
	await writeContainerEntryArtifact(`${containerEntryDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${options.includes("--check") ? "Validated" : "Archived"} ${artifacts.length} files for the native Fin container entry-counter runs. Receipt SHA-256 ${sha256(bytes)}\n`);
