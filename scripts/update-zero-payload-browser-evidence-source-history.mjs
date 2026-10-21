#!/usr/bin/env node
/**
 * Record the hosted zero-payload browser evidence verifier milestone.
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
	reverseZeroPayloadBrowserEvidenceUpdate
	, zeroPayloadBrowserEvidenceChangedPaths
	, zeroPayloadBrowserEvidenceHistoryPath
	, zeroPayloadBrowserEvidenceImplementation
	, zeroPayloadBrowserEvidenceIntegrationPaths
	, zeroPayloadBrowserEvidencePredecessor
} from "../tests/helpers/zero-payload-browser-evidence-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, zeroPayloadBrowserEvidenceImplementation
	, "Zero-payload browser evidence history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadBrowserEvidenceHistoryPath]).trim(), ""
, "Never rewrite committed zero-payload browser evidence history");

const applicationAdditions = Object.freeze([
	"tests/helpers/zero-payload-checked-record-browser-evidence.mjs"
	, "tests/zero-payload-checked-record-browser-evidence.test.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-browser-evidence-source-history.mjs"
	, "tests/helpers/zero-payload-browser-evidence-source-history.mjs"
	, "tests/helpers/zero-payload-browser-evidence-source-history-tests.mjs"
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
	, "Browser evidence history must reconcile source pointers");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-zero-payload-browser-evidence-history-"
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
	assert.equal(reverseZeroPayloadBrowserEvidenceUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadBrowserEvidenceChangedPaths)
		updates.push(await transition(path, zeroPayloadBrowserEvidencePredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadBrowserEvidenceIntegrationPaths)
		integrationUpdates.push(await transition(
			path, zeroPayloadBrowserEvidenceImplementation
		));
	const additions = [];
	for(const path of applicationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadBrowserEvidencePredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadBrowserEvidenceImplementation, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadBrowserEvidenceImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...zeroPayloadBrowserEvidenceIntegrationPaths].sort());
	const record = {
		schemaVersion: 1, milestone: "zero-payload-browser-evidence-source-v1"
		, predecessorCommit: zeroPayloadBrowserEvidencePredecessor
		, implementationCommit: zeroPayloadBrowserEvidenceImplementation
		, reconciledTypeSurfacePointers
		, scope: "The retained npm/browser archive is independently authenticated against fixed run, job, artifact, source, route, browser and original ZIP identities, with negative tamper controls."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadBrowserEvidenceHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
