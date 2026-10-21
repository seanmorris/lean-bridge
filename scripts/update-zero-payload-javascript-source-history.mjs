#!/usr/bin/env node
/**
 * Record the exact zero-payload JavaScript surface milestone.
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
	reverseZeroPayloadJavaScriptUpdate
	, zeroPayloadJavaScriptChangedPaths
	, zeroPayloadJavaScriptHistoryPath
	, zeroPayloadJavaScriptImplementation
	, zeroPayloadJavaScriptIntegrationPaths
	, zeroPayloadJavaScriptPredecessor
} from "../tests/helpers/zero-payload-javascript-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), zeroPayloadJavaScriptImplementation
	, "Zero-payload JavaScript history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadJavaScriptHistoryPath]).trim(), ""
, "Never rewrite committed zero-payload JavaScript history");

const applicationAdditions = Object.freeze([
	"tests/fixtures/zero-payload-checked-record-browser/full.mts"
	, "tests/fixtures/zero-payload-checked-record-browser/javascript.mjs"
	, "tests/fixtures/zero-payload-checked-record-browser/result-only.mts"
	, "tests/helpers/zero-payload-checked-record-browser-fixture.mjs"
	, "tests/zero-payload-checked-record-javascript.test.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-javascript-source-history.mjs"
	, "tests/helpers/zero-payload-javascript-source-history.mjs"
	, "tests/helpers/zero-payload-javascript-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const implementationTypeSurface = JSON.parse(git(["show"
	, `${zeroPayloadJavaScriptImplementation}:${typeSurfacePath}`]));
const actualHashes = new Map();
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		let actual = actualHashes.get(file.path);
		if(actual === undefined)
		{
			actual = sha256(await readFile(file.path));
			actualHashes.set(file.path, actual);
		}
		if(file.sha256 !== actual) file.sha256 = actual;
	}
const implementationHashes = new Map();
for(const evidence of implementationTypeSurface.evidence)
	for(const file of evidence.files)
		implementationHashes.set(`${evidence.id}\0${file.path}`, file.sha256);
const advanced = typeSurface.evidence.reduce((count, evidence) => count
	+ evidence.files.filter(file => implementationHashes.get(
		`${evidence.id}\0${file.path}`) !== file.sha256).length, 0);
assert.ok(advanced > 0, "Type-surface reconciliation must advance the implementation snapshot");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-js-history-"));
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
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("") };
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current), edits
	};
	assert.equal(reverseZeroPayloadJavaScriptUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadJavaScriptChangedPaths)
		updates.push(await transition(path, zeroPayloadJavaScriptPredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadJavaScriptIntegrationPaths)
		integrationUpdates.push(await transition(path, zeroPayloadJavaScriptImplementation));
	const additions = [];
	for(const path of applicationAdditions)
	{
		const entry = git(["ls-tree", "--name-only"
			, zeroPayloadJavaScriptPredecessor, "--", path]).trim();
		assert.equal(entry, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		const entry = git(["ls-tree", "--name-only"
			, zeroPayloadJavaScriptImplementation, "--", path]).trim();
		assert.equal(entry, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadJavaScriptImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [typeSurfacePath
		, ...zeroPayloadJavaScriptIntegrationPaths].sort());
	const record = {
		schemaVersion: 1
		, milestone: "zero-payload-javascript-source-v1"
		, predecessorCommit: zeroPayloadJavaScriptPredecessor
		, implementationCommit: zeroPayloadJavaScriptImplementation
		, reconciledTypeSurfacePointers: advanced
		, scope: "JavaScript and strict TypeScript preserve exact proof-only empty records across full and result-only packages."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadJavaScriptHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${integrationUpdates.length} integrations, ${additions.length} additions and ${advanced} type-surface pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
