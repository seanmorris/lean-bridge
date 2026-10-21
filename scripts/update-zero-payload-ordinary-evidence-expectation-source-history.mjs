#!/usr/bin/env node
/**
 * Record the exact zero-payload ordinary installed-evidence expectation repair.
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
	zeroPayloadOrdinaryEvidenceExpectationChangedPaths
	, zeroPayloadOrdinaryEvidenceExpectationHistoryPath
	, zeroPayloadOrdinaryEvidenceExpectationImplementation
	, zeroPayloadOrdinaryEvidenceExpectationIntegrationPaths
	, zeroPayloadOrdinaryEvidenceExpectationPredecessor
	, reverseZeroPayloadOrdinaryEvidenceExpectationUpdate
} from "../tests/helpers/zero-payload-ordinary-evidence-expectation-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadOrdinaryEvidenceExpectationImplementation
	, "Zero-payload ordinary evidence expectation history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadOrdinaryEvidenceExpectationHistoryPath]).trim(), ""
, "Never rewrite committed zero-payload ordinary evidence expectation history");

const addedPaths = Object.freeze([
	"scripts/update-zero-payload-ordinary-evidence-expectation-source-history.mjs"
	, "tests/helpers/zero-payload-ordinary-evidence-expectation-source-history.mjs"
	, "tests/helpers/zero-payload-ordinary-evidence-expectation-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const actualHashes = new Map();
let reconciledTypeSurfacePointers = 0;
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		let actual = actualHashes.get(file.path);
		if(actual === undefined)
		{
			actual = sha256(await readFile(file.path));
			actualHashes.set(file.path, actual);
		}
		if(file.sha256 !== actual)
		{
			file.sha256 = actual;
			reconciledTypeSurfacePointers++;
		}
	}
assert.ok(reconciledTypeSurfacePointers > 0
	, "The evidence-expectation history must reconcile source pointers");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");
const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-zero-payload-evidence-expectation-history-"
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
		diff = git(["diff", "--histogram", "--no-index"
			, "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0"
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
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverseZeroPayloadOrdinaryEvidenceExpectationUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadOrdinaryEvidenceExpectationChangedPaths)
		updates.push(await transition(
			path, zeroPayloadOrdinaryEvidenceExpectationPredecessor
		));
	const integrationUpdates = [];
	for(const path of zeroPayloadOrdinaryEvidenceExpectationIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadOrdinaryEvidenceExpectationImplementation
		));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadOrdinaryEvidenceExpectationImplementation, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadOrdinaryEvidenceExpectationImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...zeroPayloadOrdinaryEvidenceExpectationIntegrationPaths].sort());
	const record = {
		schemaVersion: 1
		, milestone: "zero-payload-ordinary-evidence-expectation-source-v1"
		, predecessorCommit: zeroPayloadOrdinaryEvidenceExpectationPredecessor
		, implementationCommit: zeroPayloadOrdinaryEvidenceExpectationImplementation
		, reconciledTypeSurfacePointers
		, scope: "The ordinary copied checked-record expectations include only the exact hosted zero-payload Rust, .NET and JVM receipts already promoted for parameter and result cells."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadOrdinaryEvidenceExpectationHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(
		`Recorded ${updates.length} update, ${integrationUpdates.length} integrations and ${additions.length} additions.\n`
	);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
