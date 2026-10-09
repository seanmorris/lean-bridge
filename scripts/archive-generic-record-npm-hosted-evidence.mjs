/**
 * Copy the hosted ordinary npm generic-record reports of run 37736101772 and their job provenance without
 * changing their original bytes (#1433).
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { assertGenericNpmArchive, genericNpmDirectory, genericNpmHosted, genericNpmProvenance, genericNpmReceipt, genericNpmRevision, genericNpmRuns, genericNpmSourcePaths, writeGenericNpmArtifact } from "../tests/helpers/generic-record-npm-hosted-evidence.mjs";

const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--check" || option.startsWith("--from=")), "Only --check and --from=<checkout holding the hosted originals> are accepted");
const from = options.find(option => option.startsWith("--from="))?.slice("--from=".length) ?? ".";
const original = path => execFileSync("git", ["show", `${genericNpmRevision}:${path}`], { maxBuffer: 8 * 1024 * 1024 });
const zipPath = join(from, genericNpmHosted.artifactPath);
const zip = await readFile(zipPath);
assert.equal(zip.length, genericNpmHosted.artifactBytes); assert.equal(sha256(zip), genericNpmHosted.artifactSha256);
const fetchedAt = (await readFile(join(from, genericNpmHosted.fetchedAtPath), "utf8")).trim();
const pending = new Map(), artifacts = [];
const keep = (name, bytes, originalPath) => {
	const path = `${genericNpmDirectory}/${name}`;
	pending.set(path, bytes);
	artifacts.push({ path, originalPath, sha256: sha256(bytes), bytes: bytes.length });
};
for(const file of Object.values(genericNpmProvenance))
{
	const bytes = await readFile(join(from, file.originalPath));
	assert.equal(sha256(bytes), file.sha256, file.originalPath);
	keep(file.name, bytes, file.originalPath);
}
for(const run of genericNpmRuns)
{
	// Report bytes come straight from the hash-checked artifact ZIP member.
	const bytes = execFileSync("/usr/bin/unzip", ["-p", zipPath, run.member], { maxBuffer: 8 * 1024 * 1024 });
	assert.equal(sha256(bytes), run.reportSha256, run.member);
	keep(`${run.id}.json`, bytes, `${genericNpmHosted.artifactPath}!${run.member}`);
}
const sourceFiles = genericNpmSourcePaths.map(path => ({ path, sha256: sha256(original(path)) }));
const receipt = genericNpmReceipt({ artifacts, sourceFiles, fetchedAt });
// The current sources reach their hosted digests through the history reader, which the tests check.
await assertGenericNpmArchive(receipt, async path => pending.get(path), { currentSources: false });
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + "\n");
if(!options.includes("--check"))
{
	for(const [path, content] of pending) await writeGenericNpmArtifact(path, content);
	await writeGenericNpmArtifact(`${genericNpmDirectory}/receipt.json`, bytes);
}
process.stdout.write(`${options.includes("--check") ? "Validated" : "Archived"} ${genericNpmRuns.length} hosted reports and ${artifacts.length - genericNpmRuns.length} provenance files. Receipt SHA-256 ${sha256(bytes)}\n`);
