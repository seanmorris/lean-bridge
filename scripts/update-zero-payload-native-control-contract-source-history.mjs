#!/usr/bin/env node
/**
 * Record the stable zero-payload native control-contract milestone.
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
	reverseZeroPayloadNativeControlContractUpdate
	, zeroPayloadNativeControlContractChangedPaths
	, zeroPayloadNativeControlContractHistoryPath
	, zeroPayloadNativeControlContractImplementation
	, zeroPayloadNativeControlContractIntegrationPaths
	, zeroPayloadNativeControlContractPredecessor
} from "../tests/helpers/zero-payload-native-control-contract-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadNativeControlContractImplementation
	, "Zero-payload native control history is draft-only at its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, zeroPayloadNativeControlContractPredecessor
	, "Zero-payload native control milestone must retain its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadNativeControlContractHistoryPath]).trim(), ""
, "Never rewrite committed zero-payload native control history");

const applicationAdditions = Object.freeze([
	"tests/helpers/zero-payload-checked-record-native-ci-report-tests.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-native-control-contract-source-history.mjs"
	, "tests/helpers/zero-payload-native-control-contract-source-history.mjs"
	, "tests/helpers/zero-payload-native-control-contract-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const typeSurfacePaths = Object.freeze([
	...zeroPayloadNativeControlContractChangedPaths
	, ...zeroPayloadNativeControlContractIntegrationPaths
]);
const actualHashes = new Map();
for(const path of typeSurfacePaths)
	actualHashes.set(path, sha256(await readFile(path)));
let advanced = 0;
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		const actual = actualHashes.get(file.path);
		if(actual !== undefined && file.sha256 !== actual)
		{
			file.sha256 = actual;
			advanced++;
		}
	}
assert.ok(advanced > 0
	, "Type-surface reconciliation must advance native control sources");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-zero-payload-native-control-history-"
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
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.equal(reverseZeroPayloadNativeControlContractUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadNativeControlContractChangedPaths)
		updates.push(await transition(
			path, zeroPayloadNativeControlContractPredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadNativeControlContractIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadNativeControlContractImplementation));
	const additions = [];
	for(const path of applicationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadNativeControlContractPredecessor, "--", path]
		).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadNativeControlContractImplementation, "--", path]
		).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const changed = git(["diff", "--name-only"
		, zeroPayloadNativeControlContractPredecessor
		, zeroPayloadNativeControlContractImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(changed, [
		...zeroPayloadNativeControlContractChangedPaths, ...applicationAdditions
	].sort());
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadNativeControlContractImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		typeSurfacePath, ...zeroPayloadNativeControlContractIntegrationPaths
	].sort());
	await writeFile(zeroPayloadNativeControlContractHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "zero-payload-native-control-contract-source-v1"
			, predecessorCommit: zeroPayloadNativeControlContractPredecessor
			, implementationCommit: zeroPayloadNativeControlContractImplementation
			, reconciledTypeSurfacePointers: advanced
			, scope: "The zero-payload C/C++ hosted checker requires every original semantic control and seven intentional skips while accepting additional authenticated history readers."
			, updates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation updates, `
		+ `${integrationUpdates.length} integrations, ${additions.length} `
		+ `additions and ${advanced} type-surface pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
