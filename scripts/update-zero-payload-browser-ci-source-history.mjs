#!/usr/bin/env node
/**
 * Record the exact zero-payload browser CI milestone.
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
	reverseZeroPayloadBrowserCiUpdate
	, zeroPayloadBrowserCiChangedPaths
	, zeroPayloadBrowserCiHistoryPath
	, zeroPayloadBrowserCiImplementation
	, zeroPayloadBrowserCiIntegrationPaths
	, zeroPayloadBrowserCiPredecessor
} from "../tests/helpers/zero-payload-browser-ci-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), zeroPayloadBrowserCiImplementation
	, "Zero-payload browser CI history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, zeroPayloadBrowserCiHistoryPath]).trim(), ""
, "Never rewrite committed zero-payload browser CI history");

const applicationAdditions = Object.freeze([
	".github/workflows/zero-payload-checked-record-browser.yml"
	, "scripts/check-zero-payload-checked-record-browser-ci.mjs"
	, "scripts/run-zero-payload-checked-record-browser-ci.sh"
	, "tests/helpers/zero-payload-checked-record-browser-ci-report.mjs"
	, "tests/helpers/zero-payload-checked-record-browser-controls.mjs"
	, "tests/helpers/zero-payload-checked-record-browser-report.mjs"
]);
const historyAdditions = Object.freeze([
	"scripts/update-zero-payload-browser-ci-source-history.mjs"
	, "tests/helpers/zero-payload-browser-ci-source-history.mjs"
	, "tests/helpers/zero-payload-browser-ci-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const implementationTypeSurface = JSON.parse(git(["show"
	, `${zeroPayloadBrowserCiImplementation}:${typeSurfacePath}`]));
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
assert.equal(advanced, 0
	, "Hosted CI source does not promote type-surface cells before a successful run");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-ci-history-"));
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
	assert.equal(reverseZeroPayloadBrowserCiUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of zeroPayloadBrowserCiChangedPaths)
		updates.push(await transition(path, zeroPayloadBrowserCiPredecessor));
	const integrationUpdates = [];
	for(const path of zeroPayloadBrowserCiIntegrationPaths)
		integrationUpdates.push(await transition(path, zeroPayloadBrowserCiImplementation));
	const additions = [];
	for(const path of applicationAdditions)
	{
		const entry = git(["ls-tree", "--name-only"
			, zeroPayloadBrowserCiPredecessor, "--", path]).trim();
		assert.equal(entry, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	for(const path of historyAdditions)
	{
		const entry = git(["ls-tree", "--name-only"
			, zeroPayloadBrowserCiImplementation, "--", path]).trim();
		assert.equal(entry, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, zeroPayloadBrowserCiImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [...zeroPayloadBrowserCiIntegrationPaths
		, "tests/zero-payload-checked-record-javascript.test.mjs"
	].sort());
	const record = {
		schemaVersion: 1
		, milestone: "zero-payload-browser-ci-source-v1"
		, predecessorCommit: zeroPayloadBrowserCiPredecessor
		, implementationCommit: zeroPayloadBrowserCiImplementation
		, reconciledTypeSurfacePointers: advanced
		, scope: "Hosted CI retains and independently verifies all zero-payload npm/browser routes and their negative controls."
		, updates, integrationUpdates, additions
	};
	await writeFile(zeroPayloadBrowserCiHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${integrationUpdates.length} integrations, ${additions.length} additions and ${advanced} type-surface pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
