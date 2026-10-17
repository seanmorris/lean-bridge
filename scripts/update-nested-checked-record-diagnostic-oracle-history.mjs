#!/usr/bin/env node
/**
 * Record the nested checked-record diagnostic-oracle correction without
 * rewriting any earlier source-history ledger or the type-surface inventory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	nestedCheckedRecordDiagnosticOraclePredecessor
	, nestedCheckedRecordNativeArchiveHistoricalCommit
	, nestedCheckedRecordNativeArchiveHistoricalParent
	, nestedCheckedRecordNativeArchiveHistoricalPaths
	, reverseNestedCheckedRecordNativeArchiveHistoricalUpdate
} from "../tests/helpers/nested-checked-record-diagnostic-oracle-source-history.mjs";

const predecessor = nestedCheckedRecordDiagnosticOraclePredecessor;
const historyPath
	= "docs/evidence/nested-checked-record-diagnostic-oracle-source-history-20261017.json";
const inventoryPath = "docs/type-surface.v1.json";
const sourcePaths = [
	"tests/fixtures/nested-checked-record-consumers/javascript.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/nested-checked-record-foundation.test.mjs"
].sort();
const additionPaths = [
	"scripts/update-nested-checked-record-diagnostic-oracle-history.mjs"
	, "tests/helpers/nested-checked-record-diagnostic-oracle-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-diagnostic-oracle-source-history.mjs"
].sort();
const unchangedPaths = [inventoryPath, "src/adoption/test-profiles.mjs"].sort();
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessor
	, "Diagnostic-oracle history must stay on its exact predecessor");
const historicalParent = git(["rev-parse"
	, `${nestedCheckedRecordNativeArchiveHistoricalCommit}^`]).trim();
assert.equal(historicalParent, nestedCheckedRecordNativeArchiveHistoricalParent
	, "Historical native archive transition must retain its exact parent");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", historyPath]).trim(), ""
	, "Never rewrite a committed diagnostic-oracle ledger");
const draft = await readFile(historyPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "nested-checked-record-diagnostic-oracle-source-v1");
	assert.equal(draft.predecessorCommit, predecessor);
	assert.equal(draft.historicalCommit
		, nestedCheckedRecordNativeArchiveHistoricalCommit);
	assert.equal(draft.historicalParent
		, nestedCheckedRecordNativeArchiveHistoricalParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"])
	.trim().split("\n").filter(Boolean).sort(), sourcePaths);
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, "docs/evidence", "scripts", "tests"])
	.trim().split("\n").filter(path => path && path !== historyPath).sort()
, additionPaths);

const sources = new Map();
for(const path of sourcePaths)
{
	const previous = git(["show", `${predecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of additionPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${predecessor}:${path}`], { stdio: "ignore" }).status, 0);
	const current = await readFile(path);
	additions.push({ path, currentSha256: sha256(current) });
}
const unchanged = [];
for(const path of unchangedPaths)
{
	const previous = git(["show", `${predecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.equal(current, previous, `${path} must remain outside this layer`);
	unchanged.push({ path, sha256: sha256(current) });
}
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const livePins = inventory.evidence.flatMap(entry => entry.files)
	.filter(file => sourcePaths.includes(file.path));
assert.deepEqual(livePins, [], "Diagnostic-oracle sources must have no live pins");
const historicalSources = new Map();
for(const path of nestedCheckedRecordNativeArchiveHistoricalPaths)
{
	const previous = git(["show"
		, `${nestedCheckedRecordNativeArchiveHistoricalParent}:${path}`]);
	const current = git(["show"
		, `${nestedCheckedRecordNativeArchiveHistoricalCommit}:${path}`]);
	assert.notEqual(current, previous, path);
	historicalSources.set(path, { previous, current });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-nested-checked-record-diagnostic-oracle-"
));
try
{
	const edits = async (previous, current) => {
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous);
		await writeFile(currentPath, current);
		let diff;
		try
		{
			diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
				, previousPath, currentPath]
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		const result = [...diff.matchAll(
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
		assert.ok(result.length > 0);
		return result;
	};
	const updates = [];
	for(const path of sourcePaths)
	{
		const source = sources.get(path);
		updates.push({
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		});
	}
	const historicalUpdates = [];
	for(const path of nestedCheckedRecordNativeArchiveHistoricalPaths)
	{
		const source = historicalSources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseNestedCheckedRecordNativeArchiveHistoricalUpdate(
			source.current, update), source.previous, path);
		historicalUpdates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "nested-checked-record-diagnostic-oracle-source-v1"
		, predecessorCommit: predecessor
		, historicalCommit: nestedCheckedRecordNativeArchiveHistoricalCommit
		, historicalParent: nestedCheckedRecordNativeArchiveHistoricalParent
		, pathsSha256: sha256(JSON.stringify(sourcePaths))
		, pinCount: 0, unchanged, additions, historicalUpdates, updates
	}, null, 2) + "\n";
	await writeFile(historyPath, record, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} transitions, ${historicalUpdates.length} omitted historical transition, ${additions.length} additions, zero pin changes and ${unchanged.length} unchanged boundaries.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
