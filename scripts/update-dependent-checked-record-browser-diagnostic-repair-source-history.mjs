#!/usr/bin/env node
/**
 * Record the dependent checked-record browser diagnostic repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	dependentCheckedRecordBrowserDiagnosticRepairChangedPaths
	, dependentCheckedRecordBrowserDiagnosticRepairHistoryPath
	, dependentCheckedRecordBrowserDiagnosticRepairImplementation
	, dependentCheckedRecordBrowserDiagnosticRepairIntegrationBase
	, dependentCheckedRecordBrowserDiagnosticRepairIntegrationPaths
	, dependentCheckedRecordBrowserDiagnosticRepairPointerPaths
	, dependentCheckedRecordBrowserDiagnosticRepairPredecessor
	, reverseDependentCheckedRecordBrowserDiagnosticRepairIntegration
	, reverseDependentCheckedRecordBrowserDiagnosticRepairUpdate
} from "../tests/helpers/dependent-checked-record-browser-diagnostic-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const integrationBase
	= dependentCheckedRecordBrowserDiagnosticRepairIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Browser diagnostic repair history is draft-only at its integration base commit");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${integrationBase}:${dependentCheckedRecordBrowserDiagnosticRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed browser repair history");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, dependentCheckedRecordBrowserDiagnosticRepairPredecessor
	, dependentCheckedRecordBrowserDiagnosticRepairImplementation])
, [...dependentCheckedRecordBrowserDiagnosticRepairChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=AD"
	, dependentCheckedRecordBrowserDiagnosticRepairPredecessor
	, dependentCheckedRecordBrowserDiagnosticRepairImplementation]), []);

const additions = Object.freeze([
	"scripts/update-dependent-checked-record-browser-diagnostic-repair-source-history.mjs"
	, "tests/helpers/dependent-checked-record-browser-diagnostic-repair-source-history.mjs"
	, "tests/helpers/dependent-checked-record-browser-diagnostic-repair-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const actualHashes = new Map();
for(const path of dependentCheckedRecordBrowserDiagnosticRepairPointerPaths)
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
	, "Type-surface reconciliation must advance browser repair integrations");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-browser-diagnostic-repair-history-"));
const transition = async (path, previous, current) => {
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
	return {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
};

try
{
	const updates = [];
	for(const path of dependentCheckedRecordBrowserDiagnosticRepairChangedPaths)
	{
		const current = await readFile(path, "utf8");
		assert.equal(current, source(
			dependentCheckedRecordBrowserDiagnosticRepairImplementation, path)
		, `Later work changed ${path}; record a composed transition instead`);
		const update = await transition(path, source(
			dependentCheckedRecordBrowserDiagnosticRepairPredecessor, path), current);
		assert.equal(reverseDependentCheckedRecordBrowserDiagnosticRepairUpdate(
			current, update), source(
			dependentCheckedRecordBrowserDiagnosticRepairPredecessor, path));
		updates.push(update);
	}
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordBrowserDiagnosticRepairIntegrationPaths)
	{
		const update = await transition(path, source(integrationBase, path)
			, await readFile(path, "utf8"));
		assert.equal(reverseDependentCheckedRecordBrowserDiagnosticRepairIntegration(
			await readFile(path, "utf8"), update), source(integrationBase, path));
		integrationUpdates.push(update);
	}
	const added = [];
	for(const path of additions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${integrationBase}:${path}`], { stdio: "ignore" }).status, 0, path);
		added.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, integrationBase, "--"])
	, [...dependentCheckedRecordBrowserDiagnosticRepairIntegrationPaths].sort());
	await writeFile(dependentCheckedRecordBrowserDiagnosticRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-checked-record-browser-diagnostic-repair-source-v1"
			, predecessorCommit: dependentCheckedRecordBrowserDiagnosticRepairPredecessor
			, implementationCommit: dependentCheckedRecordBrowserDiagnosticRepairImplementation
			, integrationBaseCommit: integrationBase
			, reconciledTypeSurfacePointers: advanced
			, scope: "Browser dependent checked-record consumers authenticate the runtime's ordinary and reviewed constructor-rejection diagnostics instead of requiring obsolete raw WebAssembly trap text."
			, updates, integrationUpdates, additions: added
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations and `
		+ `${added.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
