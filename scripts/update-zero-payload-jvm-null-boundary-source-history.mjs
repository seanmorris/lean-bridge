#!/usr/bin/env node
/**
 * Record the zero-payload JVM public-carrier null-boundary repair.
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
	reverseZeroPayloadJvmNullBoundaryUpdate
	, zeroPayloadJvmNullBoundaryChangedPaths
	, zeroPayloadJvmNullBoundaryHistoryPath
	, zeroPayloadJvmNullBoundaryImplementation
	, zeroPayloadJvmNullBoundaryIntegrationPaths
	, zeroPayloadJvmNullBoundaryPredecessor
} from "../tests/helpers/zero-payload-jvm-null-boundary-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadJvmNullBoundaryImplementation
	, "Zero-payload JVM null-boundary history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadJvmNullBoundaryHistoryPath]).trim(), "");
const draft = await readFile(
	zeroPayloadJvmNullBoundaryHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});

const typeSurfacePath = "docs/type-surface.v1.json";
const implementationPaths = zeroPayloadJvmNullBoundaryChangedPaths.filter(
	path => path !== typeSurfacePath);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-jvm-null-boundary-source-history.mjs"
	, "tests/helpers/zero-payload-jvm-null-boundary-source-history.mjs"
	, "tests/helpers/zero-payload-jvm-null-boundary-source-history-tests.mjs"
]);

const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const pinUpdates = [];
let advanced = 0;
for(const path of implementationPaths)
{
	const previousSha256 = sha256(git(["show"
		, `${zeroPayloadJvmNullBoundaryPredecessor}:${path}`]));
	const currentSha256 = sha256(await readFile(path));
	let count = 0;
	for(const evidence of typeSurface.evidence) for(const file of evidence.files)
		if(file.path === path
			&& [previousSha256, currentSha256].includes(file.sha256)){
			if(file.sha256 === previousSha256) file.sha256 = currentSha256;
			count++;
			}
	if(count)
	{
		advanced += count;
		pinUpdates.push({ path, previousSha256, currentSha256, count });
	}
}
assert.equal(advanced, 68
	, "JVM null-boundary repair must advance 68 exact source pins");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "zero-payload-jvm-null-boundary-history-"));
const transition = async (path, revision, currentRevision = null) => {
	const previous = git(["show", `${revision}:${path}`]);
	const current = currentRevision === null ? await readFile(path, "utf8")
		: git(["show", `${currentRevision}:${path}`]);
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
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseZeroPayloadJvmNullBoundaryUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadJvmNullBoundaryChangedPaths)
		updates.push(await transition(
			path, zeroPayloadJvmNullBoundaryPredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadJvmNullBoundaryIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadJvmNullBoundaryImplementation));
	const historicalTransitions = [];
	for(const commit of [
		"319891d4d6b9c693d443dfa4a899adab6418db1f"
		, "556bddd612d8562654904920a39b44dc1e569742"
		, "0dcfb0379be5af7128d682d319e2d89472b426f3"
		, "7c12bbf6eb5e0e9d1875e9c438f2ed4478e25de3"
		, "b103cdc1751d57b0ae5621f43a25a11cec80e9e3"
		, "0bcbfabc708b746de492d55409ce1845c081e24b"
		, "09bbcdf19160e1d32f27a1e4dda9463654049378"
		, "b63c176128abed85f895dd9056e72ac4d7e78ec5"
		, "fce86f9eb299073eca8dc0ab4ebeafabdb01381f"
		, "8722c9ee9b25257ea132ed1be7310a833ede9893"
		, "025597da0fdced0d2d1a60e04a78d9d2e502fcc4"
		, "3297fb2507379e0b06e2abcf0d3f048c8eebb447"
		, "526e9642f0facd00a4b6dc49dedb585471cf8a38"
		, "f34d7fe555c63889f7344b6a88ebfc17140c8a32"
	]) {
		const predecessorCommit = git(["rev-parse", `${commit}^`]).trim();
		historicalTransitions.push({
			commit, predecessorCommit
			, updates: [await transition(
				typeSurfacePath, predecessorCommit, commit)]
		});
	}
	for(const commit of [
		"0a6111e8a04c9fd5dbbf8dbd37a1c59a25ee1139"
		, "ac26590b1c4b10e2ea535d0a28899c88e1a4fd9d"
		, "b9762f82ad3997b8330747c49ff75c2b997154b9"
		, "7f778e650ec308f8cca6c6fe9e6dcbfb864acd0b"
		, "9d47c4c31dc77023126596cca276af05bbe02ddd"
		, "5035456fe465a774eaf6597e8659997024c6c7ca"
		, "7794d931167ff3c7f8a809774c930a10dc31d751"
		, "ca305354829f629384b28981fb4ed7979704bb9f"
		, "71c542f8460b05a066885abaa41c60c3e7e0112a"
		, "7eeaa3f6072981b5db29e86605bbb0612ede45fc"
	]) {
		const predecessorCommit = git(["rev-parse", `${commit}^`]).trim();
		historicalTransitions.push({
			commit, predecessorCommit
			, updates: [await transition(
				"src/adoption/test-profiles.mjs", predecessorCommit, commit)]
		});
	}
	const additions = [];
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadJvmNullBoundaryImplementation, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadJvmNullBoundaryImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [typeSurfacePath
		, ...zeroPayloadJvmNullBoundaryIntegrationPaths].sort());
	const record = {
		schemaVersion: 1
		, milestone: "zero-payload-jvm-null-boundary-source-v1"
		, predecessorCommit: zeroPayloadJvmNullBoundaryPredecessor
		, implementationCommit: zeroPayloadJvmNullBoundaryImplementation
		, reconciledTypeSurfacePointers: advanced
		, pinUpdates
		, historicalTransitions
		, scope: "Generated Java and Kotlin copied records and variant cases reject null reference fields at their public constructors while primitive fields remain unboxed and unguarded."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadJvmNullBoundaryHistoryPath
		, canonicalJson(record), draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations, `
		+ `${historicalTransitions.length} historical transitions, `
		+ `${additions.length} additions and ${advanced} source-pin advances.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
