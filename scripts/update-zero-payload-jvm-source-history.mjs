#!/usr/bin/env node
/**
 * Record the zero-payload JVM package foundation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	reverseZeroPayloadJvmUpdate, zeroPayloadJvmChangedPaths
	, zeroPayloadJvmHistoryPath, zeroPayloadJvmImplementation
	, zeroPayloadJvmIntegrationPaths, zeroPayloadJvmPredecessor
} from "../tests/helpers/zero-payload-jvm-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), zeroPayloadJvmImplementation
	, "Zero-payload JVM history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadJvmHistoryPath]).trim(), ""
, "Never rewrite committed zero-payload JVM history");

const applicationAdditions = Object.freeze([
	".github/workflows/zero-payload-checked-record-jvm.yml"
	, "scripts/check-zero-payload-checked-record-jvm-ci.mjs"
	, "scripts/run-zero-payload-checked-record-jvm-ci.sh"
	, "tests/fixtures/zero-payload-checked-record-jvm/java.java"
	, "tests/fixtures/zero-payload-checked-record-jvm/kotlin.kt"
	, "tests/helpers/zero-payload-checked-record-jvm-caller-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-ci-handoff.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-ci-policy-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-ci-report.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-ci-shell-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-ci-workflow-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-ci-workflow.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-fixture-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-fixture.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-installed-static-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-installed-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-package.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-probe.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-report.mjs"
	, "tests/zero-payload-checked-record-jvm.test.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-jvm-source-history.mjs"
	, "tests/helpers/zero-payload-jvm-source-history.mjs"
	, "tests/helpers/zero-payload-jvm-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-zero-payload-jvm-history-"
));
const transition = async (path, revision) => {
	const previous = git(["show", `${revision}:${path}`]);
	const current = await readFile(path, "utf8");
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0"
			, previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount
			).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount
			).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.equal(reverseZeroPayloadJvmUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadJvmChangedPaths)
		updates.push(await transition(path, zeroPayloadJvmImplementation));
	const integrationUpdates = [];
	for(const path of zeroPayloadJvmIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadJvmImplementation
		));
	const additions = [];
	for(const path of applicationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadJvmPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadJvmImplementation, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadJvmImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		...zeroPayloadJvmChangedPaths
		, ...zeroPayloadJvmIntegrationPaths
	].sort());
	const record = {
		schemaVersion: 1, milestone: "zero-payload-jvm-source-v1"
		, predecessorCommit: zeroPayloadJvmPredecessor
		, implementationCommit: zeroPayloadJvmImplementation
		, reconciledTypeSurfacePointers: 0
		, scope: "Generated Java and Kotlin keep proof-only, Unit-bearing and plain empty records nominally distinct across full and result-only Maven package routes."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadJvmHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${integrationUpdates.length} integrations, ${additions.length} additions and 0 type-surface pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
