#!/usr/bin/env node
/**
 * Record integration of hosted-signature producer bindings.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	reverseSignatureSpecializationHostedProducerBindingIntegrationUpdate
	, signatureSpecializationHostedProducerBindingIntegrationAddedPaths
	, signatureSpecializationHostedProducerBindingIntegrationBase
	, signatureSpecializationHostedProducerBindingIntegrationHistoryPath
	, signatureSpecializationHostedProducerBindingIntegrationImplementation
	, signatureSpecializationHostedProducerBindingIntegrationPaths
} from "../tests/helpers/signature-specialization-hosted-producer-binding-integration-source-history.mjs";
import { signatureSpecializationHostedProducerBindingHistoryPath } from "../tests/helpers/signature-specialization-hosted-producer-binding-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = signatureSpecializationHostedProducerBindingIntegrationBase;
const implementation
	= signatureSpecializationHostedProducerBindingIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...signatureSpecializationHostedProducerBindingIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${signatureSpecializationHostedProducerBindingIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationHostedProducerBindingIntegrationAddedPaths])
, [...signatureSpecializationHostedProducerBindingIntegrationAddedPaths]
	.sort());

const updates = [];
for(const path of signatureSpecializationHostedProducerBindingIntegrationPaths)
{
	const update = await gitSourceHistoryTransition(path, base, implementation);
	assert.equal(
		reverseSignatureSpecializationHostedProducerBindingIntegrationUpdate(
			git(["show", `${implementation}:${path}`]), update)
		, git(["show", `${base}:${path}`]), path);
	updates.push(update);
}
const additions = [];
for(const path of signatureSpecializationHostedProducerBindingIntegrationAddedPaths)
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
await writeFile(
	signatureSpecializationHostedProducerBindingIntegrationHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "signature-specialization-hosted-producer-binding-integration-v1"
		, baseCommit: base, implementationCommit: implementation
		, baseHistory: {
			path: signatureSpecializationHostedProducerBindingHistoryPath
			, sha256: sha256(await readFile(
				signatureSpecializationHostedProducerBindingHistoryPath))
		}
		, scope: "Register the exact lane-producer binding transition newest-first in the reversible Fin history hub and checked-JavaScript partition 10."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration transitions.\n`);
