#!/usr/bin/env node
/**
 * Record exact hosted-signature producer bindings and replay registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	reverseSignatureSpecializationHostedProducerBindingUpdate
	, signatureSpecializationHostedProducerBindingAddedPaths
	, signatureSpecializationHostedProducerBindingHistoryPath
	, signatureSpecializationHostedProducerBindingImplementation
	, signatureSpecializationHostedProducerBindingPaths
	, signatureSpecializationHostedProducerBindingPredecessor
} from "../tests/helpers/signature-specialization-hosted-producer-binding-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = signatureSpecializationHostedProducerBindingPredecessor;
const implementation = signatureSpecializationHostedProducerBindingImplementation;
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor", implementation
	, "HEAD"], { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...signatureSpecializationHostedProducerBindingPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `HEAD:${signatureSpecializationHostedProducerBindingHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationHostedProducerBindingAddedPaths])
, [...signatureSpecializationHostedProducerBindingAddedPaths].sort());

const updates = [];
for(const path of signatureSpecializationHostedProducerBindingPaths)
{
	const update = await gitSourceHistoryTransition(
		path, predecessor, implementation);
	assert.equal(reverseSignatureSpecializationHostedProducerBindingUpdate(
		git(["show", `${implementation}:${path}`]), update)
	, git(["show", `${predecessor}:${path}`]), path);
	updates.push(update);
}
const additions = [];
for(const path of signatureSpecializationHostedProducerBindingAddedPaths)
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
await writeFile(signatureSpecializationHostedProducerBindingHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "signature-specialization-hosted-producer-binding-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, scope: "Bind each hosted specialization lane to the exact successful producer commit: eight previously accepted lanes remain at 6e0d941, while repaired Perl and PHP-Wasm lanes use d37bcc0. Retain collision-free source closures for both immutable producers, validate each report against its lane producer, and use the dedicated BigInteger PHP-Wasm consumer. Register the pre-existing hosted-retention history in the central reversible hub and Core partition. Change no type-surface support claim."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} producer-binding transitions.\n`);
