#!/usr/bin/env node
/**
 * Record one reversible source layer for every dependent checked-record
 * hosted-archiver preparation commit.
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
	dependentCheckedRecordHostedArchiversAddedPaths
	, dependentCheckedRecordHostedArchiversChangedPaths
	, dependentCheckedRecordHostedArchiversHistoryPath
	, dependentCheckedRecordHostedArchiversImplementation
	, dependentCheckedRecordHostedArchiversIntegrationPaths
	, dependentCheckedRecordHostedArchiversPredecessor
	, reverseDependentCheckedRecordHostedArchiversUpdate
} from "../tests/helpers/dependent-checked-record-hosted-archivers-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const lines = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean);
const committed = (revision, path) => git(["show", `${revision}:${path}`]);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentCheckedRecordHostedArchiversImplementation
	, "Hosted-archiver history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentCheckedRecordHostedArchiversHistoryPath]).trim(), ""
, "Never rewrite committed hosted-archiver history");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, dependentCheckedRecordHostedArchiversPredecessor
	, dependentCheckedRecordHostedArchiversImplementation])
, [...dependentCheckedRecordHostedArchiversChangedPaths]);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, dependentCheckedRecordHostedArchiversPredecessor
	, dependentCheckedRecordHostedArchiversImplementation])
, [...dependentCheckedRecordHostedArchiversAddedPaths]);

const historyAdditions = Object.freeze([
	"scripts/update-dependent-checked-record-hosted-archivers-source-history.mjs"
	, "tests/helpers/dependent-checked-record-hosted-archivers-source-history.mjs"
	, "tests/helpers/dependent-checked-record-hosted-archivers-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const typeSurfacePaths = [
	...dependentCheckedRecordHostedArchiversChangedPaths
	, ...dependentCheckedRecordHostedArchiversIntegrationPaths
];
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
	, "Type-surface reconciliation must advance hosted-archiver sources");
await writeFile(typeSurfacePath
	, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-hosted-archivers-history-"
));
const transition = async (path, revision) => {
	const previous = committed(revision, path);
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
	assert.equal(reverseDependentCheckedRecordHostedArchiversUpdate(
		current, update
	), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of dependentCheckedRecordHostedArchiversChangedPaths)
		updates.push(await transition(
			path, dependentCheckedRecordHostedArchiversPredecessor
		));
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordHostedArchiversIntegrationPaths)
		integrationUpdates.push(await transition(
			path, dependentCheckedRecordHostedArchiversImplementation
		));
	const additions = [];
	for(const path of dependentCheckedRecordHostedArchiversAddedPaths)
		additions.push({
			path
			, currentSha256: sha256(committed(
				dependentCheckedRecordHostedArchiversImplementation, path
			))
		});
	for(const path of historyAdditions)
		additions.push({
			path, currentSha256: sha256(await readFile(path))
		});
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, dependentCheckedRecordHostedArchiversImplementation, "--"])
	, [typeSurfacePath
		, ...dependentCheckedRecordHostedArchiversIntegrationPaths].sort());
	const commits = lines(["rev-list", "--reverse"
		, `${dependentCheckedRecordHostedArchiversPredecessor}..${dependentCheckedRecordHostedArchiversImplementation}`]);
	assert.equal(commits.length, 7);
	await writeFile(dependentCheckedRecordHostedArchiversHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-checked-record-hosted-archivers-source-v1"
			, predecessorCommit:
				dependentCheckedRecordHostedArchiversPredecessor
			, implementationCommit:
				dependentCheckedRecordHostedArchiversImplementation
			, commits, reconciledTypeSurfacePointers: advanced
			, scope: "One reversible layer authenticates the .NET, JVM, native PHP, WIT, PHP-Wasm, npm/browser and C/C++ dependent checked-record archive preparation commits, including the two post-run checkers."
			, updates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${commits.length} commits, `
		+ `${updates.length} updates, ${integrationUpdates.length} `
		+ `integrations, ${additions.length} additions and ${advanced} `
		+ "type-surface pointers.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
