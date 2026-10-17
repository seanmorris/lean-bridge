#!/usr/bin/env node
/**
 * Record late checked-record test registrations and refresh only their current-
 * source inventory pins. Older evidence ledgers remain byte-for-byte intact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";

const predecessor = "1f3664ccd4b9d102ab0222061853ac90c72e0985";
const historyPath
	= "docs/evidence/late-checked-record-test-registration-source-history-20261017.json";
const inventoryPath = "docs/type-surface.v1.json";
const profilePath = "src/adoption/test-profiles.mjs";
const hubPath = "tests/helpers/fin-refinement-source-history.mjs";
const paths = [inventoryPath, profilePath, hubPath];
const addedTests = [
	"late-checked-record-test-registration-history"
	, "php-graph-refinement-diagnostics"
	, "recursive-checked-record-php-ci"
	, "recursive-checked-record-php"
	, "recursive-checked-record-php-wasm"
	, "wit-graph-refinement-diagnostics"
];
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessor
	, "Registration history must stay on its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", historyPath]).trim(), ""
	, "Never rewrite a committed registration ledger");
await assert.rejects(readFile(historyPath), { code: "ENOENT" });

const sources = new Map();
for(const path of [profilePath, hubPath]) sources.set(path, {
	previous: git(["show", `${predecessor}:${path}`])
	, current: await readFile(path, "utf8")
});
for(const [path, source] of sources)
	assert.notEqual(source.current, source.previous, path);
for(const name of addedTests)
	assert.equal(sources.get(profilePath).current.split(`\t\t, "${name}"\n`).length
		, 2, name);

const inventoryPrevious = git(["show", `${predecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
const pinUpdates = [];
let pinCount = 0;
for(const [path, source] of sources)
{
	const previousSha256 = sha256(source.previous);
	const currentSha256 = sha256(source.current);
	let count = 0;
	for(const entry of inventory.evidence) for(const file of entry.files)
		if(file.path === path && file.sha256 === previousSha256)
		{
			file.sha256 = currentSha256;
			count++;
		}
	if(count > 0)
	{
		pinCount += count;
		pinUpdates.push({ path, previousSha256, currentSha256, count });
	}
}
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-late-test-registration-"
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
	for(const path of paths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
		};
		if(path === inventoryPath) update.replacements = pinUpdates.map(pin => ({
			previous: pin.previousSha256, current: pin.currentSha256
			, count: pin.count
		}));
		else update.edits = await edits(source.previous, source.current);
		if(path === profilePath) update.addedTests = addedTests;
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "late-checked-record-test-registration-source-v1"
		, predecessorCommit: predecessor, pinCount, pinUpdates, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(historyPath, record, { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} transitions and refreshed ${pinCount} pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
