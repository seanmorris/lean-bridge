#!/usr/bin/env node
/**
 * Record the zero-payload native retained-evidence milestone.
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
	reverseZeroPayloadNativeEvidenceUpdate
	, zeroPayloadNativeEvidenceChangedPaths
	, zeroPayloadNativeEvidenceHistoryPath
	, zeroPayloadNativeEvidenceImplementation
	, zeroPayloadNativeEvidenceIntegrationPaths
	, zeroPayloadNativeEvidencePredecessor
} from "../tests/helpers/zero-payload-native-evidence-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadNativeEvidenceImplementation
	, "Zero-payload native evidence history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadNativeEvidenceHistoryPath]).trim(), "");

const applicationAdditions = Object.freeze([
	"tests/helpers/zero-payload-checked-record-native-evidence.mjs"
	, "tests/zero-payload-checked-record-native-evidence.test.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-native-evidence-source-history.mjs"
	, "tests/helpers/zero-payload-native-evidence-source-history.mjs"
	, "tests/helpers/zero-payload-native-evidence-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "zero-payload-native-evidence-history-"));
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
	assert.equal(reverseZeroPayloadNativeEvidenceUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadNativeEvidenceChangedPaths)
		updates.push(await transition(path, zeroPayloadNativeEvidencePredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadNativeEvidenceIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadNativeEvidenceImplementation));
	const additions = [];
	for(const path of applicationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadNativeEvidencePredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadNativeEvidenceImplementation, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadNativeEvidenceImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		...zeroPayloadNativeEvidenceIntegrationPaths
		, "tests/zero-payload-checked-record-native-evidence.test.mjs"
	].sort());
	const record = {
		schemaVersion: 1, milestone: "zero-payload-native-evidence-source-v1"
		, predecessorCommit: zeroPayloadNativeEvidencePredecessor
		, implementationCommit: zeroPayloadNativeEvidenceImplementation
		, reconciledTypeSurfacePointers: 0
		, scope: "Hosted zero-payload C and C++ evidence retains four exact installed routes, the original GitHub records and artifact bytes, independent checker output, and complete producer, consumer, checker and archiver source closures."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadNativeEvidenceHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
