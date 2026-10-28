#!/usr/bin/env node
/**
 * Record the PHP-Wasm specialization consumer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	reverseSignatureSpecializationPhpWasmConsumerRepairUpdate
	, signatureSpecializationPhpWasmConsumerRepairAddedPaths
	, signatureSpecializationPhpWasmConsumerRepairHistoryPath
	, signatureSpecializationPhpWasmConsumerRepairImplementation
	, signatureSpecializationPhpWasmConsumerRepairPaths
	, signatureSpecializationPhpWasmConsumerRepairPredecessor
} from "../tests/helpers/signature-specialization-php-wasm-consumer-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 32 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = signatureSpecializationPhpWasmConsumerRepairPredecessor;
const implementation = signatureSpecializationPhpWasmConsumerRepairImplementation;
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor", implementation
	, "HEAD"], { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...signatureSpecializationPhpWasmConsumerRepairPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, ["tests/fixtures/specialization-consumers/php-wasm.php"]);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `HEAD:${signatureSpecializationPhpWasmConsumerRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationPhpWasmConsumerRepairAddedPaths.filter(
		path => path !== "tests/fixtures/specialization-consumers/php-wasm.php")])
, signatureSpecializationPhpWasmConsumerRepairAddedPaths.filter(
	path => path !== "tests/fixtures/specialization-consumers/php-wasm.php")
	.sort());

const updates = [];
for(const path of signatureSpecializationPhpWasmConsumerRepairPaths)
{
	const update = await gitSourceHistoryTransition(
		path, predecessor, implementation);
	assert.equal(reverseSignatureSpecializationPhpWasmConsumerRepairUpdate(
		git(["show", `${implementation}:${path}`]), update)
	, git(["show", `${predecessor}:${path}`]), path);
	updates.push(update);
}
const additions = [];
for(const path of signatureSpecializationPhpWasmConsumerRepairAddedPaths)
	additions.push({
		path
		, currentSha256: sha256(path.startsWith("tests/fixtures/")
			? git(["show", `${implementation}:${path}`]) : await readFile(path))
	});
await writeFile(signatureSpecializationPhpWasmConsumerRepairHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "signature-specialization-php-wasm-consumer-repair-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, scope: "Use a dedicated installed PHP-Wasm specialization consumer whose UInt32 and Word values are exact Brick Math BigInteger instances in weak and strict callers. The pre-load overflow probe now supplies the correct carrier and still requires ValueError before lazy code loads. Preserve all 2,020 checks, both author routes, twelve loading arrangements, selected dictionaries, source-free installation and reproducibility."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} PHP-Wasm consumer transition.\n`);
