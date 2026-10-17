#!/usr/bin/env node
/**
 * Record the current contract-suite repair without rewriting older ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	mkdtemp, readFile, rm, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";

const predecessor = "cfb5534b43e62a6459f65638edd55af415b27263";
const historyPath
	= "docs/evidence/ci-contract-repair-source-history-20261017.json";
const inventoryPath = "docs/type-surface.v1.json";
const hubPath = "tests/helpers/fin-refinement-source-history.mjs";
const extractorPath = "src/analyze/NativeExports.lean";
const extractorHistoryPath
	= "docs/evidence/closed-generic-checked-record-source-history-20261017.json";
const testProfileHistoryPath
	= "docs/evidence/test-profile-backlog-repair-source-history-20261017.json";
const inventoryBeforeSha256
	= "7c3415ed82b1b311e243899f758b07de7c5995882c47cf0b37ba3258bfe9708e";
const hubBeforeSha256
	= "cc8a4d0a62a97d0b33badd799cd0ed74f4f5956bc615fe7151c52655a9e2a9c9";
const excluded = new Set([
	"src/adoption/test-profiles.mjs"
	, extractorPath
]);
const hubInsertions = [
	'import { beforeCiContractRepairSource, ciContractRepairChangedPaths } from "./ci-contract-repair-source-history.mjs";\n'
	, "\tsource = beforeCiContractRepairSource(path, source, expected);\n\tif(sha256(source) === expected) return source;\n"
	, "\t...ciContractRepairChangedPaths\n\t, "
];
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const applyReplacements = (source, update) => {
	assert.equal(sha256(source), update.previousSha256, update.path);
	assert.ok(Array.isArray(update.replacements)
		&& update.replacements.length > 0);
	for(const replacement of update.replacements)
	{
		assert.equal(source.split(replacement.previous).length - 1
			, replacement.count, update.path);
		source = source.replaceAll(replacement.previous, replacement.current);
	}
	assert.equal(sha256(source), update.currentSha256, update.path);
	return source;
};
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessor
	, "Contract repair must stay on its exact predecessor");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", historyPath]).trim()
	, "Never rewrite a committed contract-repair ledger");
const draft = await readFile(historyPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone, "ci-contract-repair-source-v1");
	assert.equal(draft.predecessorCommit, predecessor);
}
const testProfileHistory = JSON.parse(await readFile(
	testProfileHistoryPath, "utf8"
));
assert.equal(testProfileHistory.schemaVersion, 1);
assert.equal(testProfileHistory.predecessorCommit, predecessor);
const testProfileInventoryUpdate = testProfileHistory.updates.find(
	update => update.path === inventoryPath
);
assert.ok(testProfileInventoryUpdate);
const extractorHistory = JSON.parse(await readFile(extractorHistoryPath, "utf8"));
assert.equal(extractorHistory.schemaVersion, 1);
assert.equal(extractorHistory.predecessorCommit, predecessor);
const extractorSourceUpdate = extractorHistory.updates.find(
	update => update.path === extractorPath
);
const extractorInventoryUpdate = extractorHistory.updates.find(
	update => update.path === inventoryPath
);
assert.ok(extractorSourceUpdate);
assert.ok(extractorInventoryUpdate);
assert.equal(sha256(await readFile(extractorPath, "utf8"))
	, extractorSourceUpdate.currentSha256);

const modified = git(["diff", "--name-only", "--diff-filter=M"])
	.trim().split("\n").filter(Boolean)
	.filter(path => !excluded.has(path)).sort();
assert.ok(modified.includes(inventoryPath));
assert.ok(modified.includes(hubPath));
const sources = new Map();
for(const path of modified)
{
	const current = await readFile(path, "utf8");
	let previous;
	if(path === inventoryPath)
	{
		previous = git(["show", `${predecessor}:${path}`]);
		previous = applyReplacements(previous, testProfileInventoryUpdate);
		previous = applyReplacements(previous, extractorInventoryUpdate);
		assert.equal(sha256(previous), inventoryBeforeSha256
			, "Type-surface has unrecorded changes before repair pin refresh");
	}
	else if(path === hubPath)
	{
		previous = current;
		for(const insertion of hubInsertions)
		{
			assert.equal(previous.split(insertion).length, 2, insertion);
			previous = previous.replace(insertion, insertion.endsWith(", ") ? "\t" : "");
		}
		assert.equal(sha256(previous), hubBeforeSha256);
	}
	else previous = git(["show", `${predecessor}:${path}`]);
	if(path !== inventoryPath) assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}

const inventory = JSON.parse(sources.get(inventoryPath).previous);
let pinCount = 0;
const pinUpdates = [];
for(const [path, source] of sources)
{
	if(path === inventoryPath) continue;
	const previousSha256 = sha256(source.previous);
	const currentSha256 = sha256(source.current);
	let count = 0;
	for(const entry of inventory.evidence) for(const file of entry.files)
	{
		if(file.path === path && file.sha256 === previousSha256)
		{
			file.sha256 = currentSha256;
			count++;
		}
	}
	if(count > 0)
	{
		pinCount += count;
		pinUpdates.push({ path, previousSha256, currentSha256, count });
	}
}
assert.ok(pinCount > 0, "Repair must refresh current-source pins");
const inventoryAfter = JSON.stringify(inventory, null, 2) + "\n";
assert.notEqual(inventoryAfter, sources.get(inventoryPath).previous);
sources.get(inventoryPath).current = inventoryAfter;

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-ci-contract-repair-history-"
));
try
{
	const transition = async path => {
		const { previous, current } = sources.get(path);
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
		const currentLines = current.split(/(?<=\n)/u);
		const previousLines = previous.split(/(?<=\n)/u);
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
	const updates = [];
	for(const path of modified) updates.push(await transition(path));
	const pathsSha256 = sha256(JSON.stringify(modified));
	const record = JSON.stringify({
		schemaVersion: 1, milestone: "ci-contract-repair-source-v1"
		, predecessorCommit: predecessor, pathsSha256, pinCount, pinUpdates
		, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryAfter);
	await writeFile(historyPath, record, draft ? undefined : { flag: "wx" });
	process.stdout.write(
		`Recorded ${updates.length} transitions, refreshed ${pinCount} pins, path digest ${pathsSha256}.\n`
	);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
