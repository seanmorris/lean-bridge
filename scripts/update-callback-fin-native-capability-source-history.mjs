#!/usr/bin/env node
/**
 * Record the native callback Fin capability-gate repair and refresh only the
 * live type-surface pointers whose exact source bytes changed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	callbackFinNativeCapabilityAddedPaths
	, callbackFinNativeCapabilityChangedPaths
	, callbackFinNativeCapabilityHistoryPath
	, callbackFinNativeCapabilityImplementation
	, callbackFinNativeCapabilityIntegrationPaths
	, callbackFinNativeCapabilityPins
	, callbackFinNativeCapabilityPredecessor
	, reverseCallbackFinNativeCapabilityUpdate
} from "../tests/helpers/callback-fin-native-capability-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const predecessor = callbackFinNativeCapabilityPredecessor;
const implementation = callbackFinNativeCapabilityImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Native callback Fin capability history requires its exact implementation commit");
assert.equal(git(["show", "-s", "--format=%P", implementation]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...callbackFinNativeCapabilityChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackFinNativeCapabilityHistoryPath]).trim(), "");

const documentPath = "docs/type-surface.v1.json";
const document = JSON.parse(await readFile(documentPath));
let reconciled = 0;
for(const evidence of document.evidence)
	for(const file of evidence.files)
	{
		const pin = callbackFinNativeCapabilityPins.find(item => item.path === file.path);
		if(pin && file.sha256 === pin.previousSha256)
		{
			file.sha256 = pin.currentSha256;
			reconciled++;
		}
		else if(pin && file.sha256 === pin.currentSha256) reconciled++;
	}
const expectedPins = callbackFinNativeCapabilityPins.reduce((sum, pin) => sum + pin.count, 0);
assert.equal(reconciled, expectedPins);
await writeFile(documentPath, JSON.stringify(document, null, 2) + "\n");

for(const path of callbackFinNativeCapabilityIntegrationPaths)
	assert.notEqual(git(["diff", "HEAD", "--name-only", "--", path]).trim(), "", path);
for(const path of callbackFinNativeCapabilityAddedPaths)
	assert.equal(names(["ls-files", "--others", "--exclude-standard", "--", path]).at(0), path);

const directory = await mkdtemp(join(tmpdir(), "lean-callback-fin-native-capability-history-"));
const lineOffsets = (source, boundaries) => {
	const result = new Map();
	let line = 0, offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		assert.ok(Number.isSafeInteger(boundary) && boundary >= 0);
		while(line < boundary)
		{
			assert.ok(offset < source.length, "Diff line exceeds source");
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1;
			line++;
		}
		result.set(boundary, offset);
	}
	return result;
};
const transition = async (path, previous, current) => {
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
	const hunks = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { previousStart, previousEnd: previousStart + previousCount
			, currentStart, currentEnd: currentStart + currentCount };
	});
	const previousOffsets = lineOffsets(previous, hunks.flatMap(item => [item.previousStart, item.previousEnd]));
	const currentOffsets = lineOffsets(current, hunks.flatMap(item => [item.currentStart, item.currentEnd]));
	const edits = hunks.map(item => ({
		start: currentOffsets.get(item.currentStart)
		, previous: previous.slice(previousOffsets.get(item.previousStart), previousOffsets.get(item.previousEnd))
		, current: current.slice(currentOffsets.get(item.currentStart), currentOffsets.get(item.currentEnd))
	}));
	const update = { path, previousSha256: sha256(previous), currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseCallbackFinNativeCapabilityUpdate(current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackFinNativeCapabilityChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of callbackFinNativeCapabilityIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`]), await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackFinNativeCapabilityAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", implementation, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackFinNativeCapabilityHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "callback-fin-native-capability-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Admit callback Fin refinements at every native package capability gate and artifact re-verifier after the host adapters gained checked callback directions. Refresh only exact live source pointers. This transition does not promote any type-surface cell; installed claims still require authenticated hosted execution and independent replay."
		, repairedTypeSurfacePointers: expectedPins
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation updates, ${integrationUpdates.length} integration updates and ${expectedPins} inventory pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
