#!/usr/bin/env node
/**
 * Record the exact zero-payload C/C++ package milestone.
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
	reverseZeroPayloadNativeUpdate, zeroPayloadNativeChangedPaths
	, zeroPayloadNativeHistoryPath, zeroPayloadNativeImplementation
	, zeroPayloadNativeIntegrationPaths, zeroPayloadNativePredecessor
} from "../tests/helpers/zero-payload-native-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), zeroPayloadNativeImplementation
	, "Zero-payload native history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadNativeHistoryPath]).trim(), ""
, "Never rewrite committed zero-payload native history");

const applicationAdditions = Object.freeze([
	".github/workflows/zero-payload-checked-record-native.yml"
	, "scripts/check-zero-payload-checked-record-native-ci.mjs"
	, "scripts/run-zero-payload-checked-record-native-ci.sh"
	, "tests/fixtures/zero-payload-checked-record-native/c.c"
	, "tests/fixtures/zero-payload-checked-record-native/cpp.cpp"
	, "tests/fixtures/zero-payload-checked-record-native/result-only-c.c"
	, "tests/fixtures/zero-payload-checked-record-native/result-only-cpp.cpp"
	, "tests/helpers/zero-payload-checked-record-native-ci-report.mjs"
	, "tests/helpers/zero-payload-checked-record-native-controls.mjs"
	, "tests/helpers/zero-payload-checked-record-native-fixture-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-native-fixture.mjs"
	, "tests/helpers/zero-payload-checked-record-native-installed-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-native-report.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-native-source-history.mjs"
	, "tests/helpers/zero-payload-native-source-history.mjs"
	, "tests/helpers/zero-payload-native-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-native-history-"));
const transition = async (path, revision) => {
	const previous = git(["show", `${revision}:${path}`]);
	const current = await readFile(path, "utf8");
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous); await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0", previousPath, currentPath]);
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
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current), edits
	};
	assert.equal(reverseZeroPayloadNativeUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadNativeChangedPaths)
		updates.push(await transition(path, zeroPayloadNativePredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadNativeIntegrationPaths)
		integrationUpdates.push(await transition(path, zeroPayloadNativeImplementation));
	const additions = [];
	for(const path of applicationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadNativePredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadNativeImplementation, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadNativeImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		...zeroPayloadNativeIntegrationPaths
		, "tests/helpers/zero-payload-checked-record-native-ci-report.mjs"
		, "tests/zero-payload-checked-records.test.mjs"
	].sort());
	const record = {
		schemaVersion: 1, milestone: "zero-payload-native-source-v1"
		, predecessorCommit: zeroPayloadNativePredecessor
		, implementationCommit: zeroPayloadNativeImplementation
		, reconciledTypeSurfacePointers: 0
		, scope: "Zero-payload checked records install offline and retain their nominal identity without carrying proof payload through C or C++."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadNativeHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${integrationUpdates.length} integrations, ${additions.length} additions and 0 type-surface pointers.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
