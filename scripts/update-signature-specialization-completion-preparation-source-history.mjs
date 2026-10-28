#!/usr/bin/env node
/**
 * Record the hosted-signature completion preparation milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	signatureSpecializationCompletionPreparationAddedPaths
	, signatureSpecializationCompletionPreparationChangedPaths
	, signatureSpecializationCompletionPreparationHistoryPath
	, signatureSpecializationCompletionPreparationImplementation
	, signatureSpecializationCompletionPreparationImplementationAdditions
	, signatureSpecializationCompletionPreparationPredecessor
} from "../tests/helpers/signature-specialization-completion-preparation-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = signatureSpecializationCompletionPreparationPredecessor;
const implementation = signatureSpecializationCompletionPreparationImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Signature completion preparation history requires its exact implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...signatureSpecializationCompletionPreparationChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...signatureSpecializationCompletionPreparationImplementationAdditions]
	.sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${signatureSpecializationCompletionPreparationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Central history integration belongs to its own seal");
assert.deepEqual(names([
	"ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationCompletionPreparationAddedPaths
]), [...signatureSpecializationCompletionPreparationAddedPaths].sort());

const updates = [];
for(const path of signatureSpecializationCompletionPreparationChangedPaths)
	updates.push(await gitSourceHistoryTransition(
		path, predecessor, implementation));
const implementationAdditions = [];
const implementationAdditionPaths
	= signatureSpecializationCompletionPreparationImplementationAdditions;
for(const path of implementationAdditionPaths)
{
	assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
		.trim(), "", path);
	implementationAdditions.push({
		path, currentSha256: sha256(git(["show", `${implementation}:${path}`]))
	});
}
const additions = [];
for(const path of signatureSpecializationCompletionPreparationAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(signatureSpecializationCompletionPreparationHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "signature-specialization-completion-preparation-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Prepare the exact terminal-green Perl and PHP-Wasm producer bindings, all ten hosted input closures, a replay gate, and an exact 45-cell promotion transaction. Authenticate the PHP-Wasm caller after its installed adapter removes the separately supplied Composer autoload line. Make no support claim until the immutable archive is generated, replayed and promoted."
		, implementationAdditions, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} implementation updates, `
	+ `${implementationAdditions.length} implementation additions and `
	+ `${additions.length} history additions.\n`);
