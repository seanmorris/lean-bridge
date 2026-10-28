#!/usr/bin/env node
/**
 * Record integration of the PHP-Wasm specialization consumer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	reverseSignatureSpecializationPhpWasmConsumerRepairIntegrationUpdate
	, signatureSpecializationPhpWasmConsumerRepairIntegrationAddedPaths
	, signatureSpecializationPhpWasmConsumerRepairIntegrationBase
	, signatureSpecializationPhpWasmConsumerRepairIntegrationHistoryPath
	, signatureSpecializationPhpWasmConsumerRepairIntegrationImplementation
	, signatureSpecializationPhpWasmConsumerRepairIntegrationPaths
} from "../tests/helpers/signature-specialization-php-wasm-consumer-repair-integration-source-history.mjs";
import { signatureSpecializationPhpWasmConsumerRepairHistoryPath } from "../tests/helpers/signature-specialization-php-wasm-consumer-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 32 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = signatureSpecializationPhpWasmConsumerRepairIntegrationBase;
const implementation
	= signatureSpecializationPhpWasmConsumerRepairIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...signatureSpecializationPhpWasmConsumerRepairIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${signatureSpecializationPhpWasmConsumerRepairIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationPhpWasmConsumerRepairIntegrationAddedPaths])
, [...signatureSpecializationPhpWasmConsumerRepairIntegrationAddedPaths]
	.sort());

const updates = [];
for(const path of signatureSpecializationPhpWasmConsumerRepairIntegrationPaths)
{
	const update = await gitSourceHistoryTransition(path, base, implementation);
	const current = git(["show", `${implementation}:${path}`]);
	const previous = git(["show", `${base}:${path}`]);
	assert.equal(
		reverseSignatureSpecializationPhpWasmConsumerRepairIntegrationUpdate(
			current, update), previous, path);
	updates.push(update);
}
const additions = [];
for(const path of signatureSpecializationPhpWasmConsumerRepairIntegrationAddedPaths)
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
await writeFile(
	signatureSpecializationPhpWasmConsumerRepairIntegrationHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "signature-specialization-php-wasm-consumer-repair-integration-v1"
		, baseCommit: base, implementationCommit: implementation
		, baseHistory: {
			path: signatureSpecializationPhpWasmConsumerRepairHistoryPath
			, sha256: sha256(await readFile(
				signatureSpecializationPhpWasmConsumerRepairHistoryPath))
		}
		, scope: "Register the PHP-Wasm specialization consumer repair newest-first in the reversible Fin history hub and checked-JavaScript partition 10."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration transitions.\n`);
