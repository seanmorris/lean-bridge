/**
 * Preserve reviewed generic-record producers and their original failed and weaker attempts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { assertReviewedInstantiationArchive, reviewedInstantiationEvidenceDirectory, reviewedInstantiationEvidenceReceipt, writeReviewedInstantiationArtifact } from "../tests/helpers/reviewed-instantiation-evidence.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<producing checkout> are accepted");
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const receipt = reviewedInstantiationEvidenceReceipt(), pending = new Map();
for(const file of receipt.artifacts)
{
	const bytes = await readFile(join(from, file.originalPath));
	assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256, file.originalPath);
	pending.set(file.path, bytes);
}
for(const producer of Object.values(receipt.producers)) for(const file of producer.files)
	assert.equal(sha256(execFileSync("git", ["show", `${producer.revision}:${file.path}`], { maxBuffer: 16 * 1024 * 1024 })), file.sha256, file.path);
await assertReviewedInstantiationArchive(receipt, async path => pending.get(path) ?? readFile(path));
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!options.includes("--check"))
{
	for(const [path, content] of pending) await writeReviewedInstantiationArtifact(path, content);
	await writeReviewedInstantiationArtifact(`${reviewedInstantiationEvidenceDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${options.includes("--check") ? "Validated" : "Archived"} ${pending.size} original artifacts. Receipt SHA-256 ${sha256(bytes)}\n`);
