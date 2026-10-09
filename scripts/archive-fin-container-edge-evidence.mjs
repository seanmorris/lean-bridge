/**
 * Preserve the local installed C, C++ and Python Fin container edge run and its exact producer sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { edgeEvidenceDirectory, edgeEvidenceFiles, edgeEvidenceReceipt, edgeEvidenceRevision, edgeEvidenceSnapshot, edgeEvidenceSources, assertEdgeEvidenceArchive, writeEdgeEvidenceArtifact } from "../tests/helpers/fin-container-edge-evidence.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<checkout holding the originals> are accepted");
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const pending = new Map(), artifacts = [];
const add = (path, bytes, originalPath) => {
	assert.ok(!pending.has(path));
	pending.set(path, bytes);
	artifacts.push({ path, originalPath, sha256: sha256(bytes), bytes: bytes.length });
};
for(const [name, file] of Object.entries(edgeEvidenceFiles))
{
	const bytes = await readFile(join(from, file.original));
	assert.deepEqual([sha256(bytes), bytes.length], [file.sha256, file.bytes], file.original);
	add(`${edgeEvidenceDirectory}/${name}`, bytes, file.original);
}
for(const [path, digest] of Object.entries(edgeEvidenceSources))
{
	const bytes = execFileSync("git", ["show", `${edgeEvidenceRevision}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
	assert.equal(sha256(bytes), digest, path);
	add(edgeEvidenceSnapshot(path), bytes, `git:${edgeEvidenceRevision}:${path}`);
}
const receipt = edgeEvidenceReceipt(artifacts);
await assertEdgeEvidenceArchive(receipt, async path => pending.get(path), { currentSources: false });
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!options.includes("--check"))
{
	for(const [path, content] of pending) await writeEdgeEvidenceArtifact(path, content);
	await writeEdgeEvidenceArtifact(`${edgeEvidenceDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${options.includes("--check") ? "Validated" : "Archived"} ${artifacts.length} files for the native Fin container edge run. Receipt SHA-256 ${sha256(bytes)}\n`);
