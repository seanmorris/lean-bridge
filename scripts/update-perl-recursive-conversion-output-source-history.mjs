#!/usr/bin/env node
/**
 * Record the Perl recursive-conversion output repair without rewriting its receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCopiedPerlGraphXs } from "../src/backends/perl/copied-graph-xs.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { nativeRecursiveReviewedIr } from "../tests/helpers/native-recursive-reviewed.mjs";
import {
	perlRecursiveConversionOutputAddedPaths
	, perlRecursiveConversionOutputChangedPaths
	, perlRecursiveConversionOutputDraftParent
	, perlRecursiveConversionOutputHistoryPath
	, perlRecursiveConversionOutputInputPaths
	, perlRecursiveConversionOutputPredecessor
	, reversePerlRecursiveConversionOutputUpdate
} from "../tests/helpers/perl-recursive-conversion-output-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, perlRecursiveConversionOutputDraftParent
	, "Perl conversion output history must stay on its exact draft parent");
assert.equal(perlRecursiveConversionOutputPredecessor
	, perlRecursiveConversionOutputDraftParent);
assert.equal(git(["ls-tree", "--name-only"
	, perlRecursiveConversionOutputDraftParent, "--"
	, perlRecursiveConversionOutputHistoryPath]).trim(), ""
, "Never rewrite committed Perl conversion output history");
const draft = await readFile(
	perlRecursiveConversionOutputHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "perl-recursive-conversion-output-source-v1");
	assert.equal(draft.predecessorCommit
		, perlRecursiveConversionOutputPredecessor);
	assert.equal(draft.draftParentCommit
		, perlRecursiveConversionOutputDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, perlRecursiveConversionOutputPredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [...perlRecursiveConversionOutputChangedPaths].sort());

const sources = new Map();
for(const path of perlRecursiveConversionOutputChangedPaths)
{
	const previous = git(["show"
		, `${perlRecursiveConversionOutputPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of perlRecursiveConversionOutputAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${perlRecursiveConversionOutputPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const receiptPath = "docs/evidence/perl-recursive-conversions-20260923.json";
const receiptBytes = await readFile(receiptPath);
const receipt = JSON.parse(receiptBytes);
const ir = nativeRecursiveReviewedIr();
ir.declarations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const compiled = generateCopiedPerlGraphXs(ir, "LeanBridge::Recursive");
const one = (values, name) => {
	const unique = [...new Set(values)];
	assert.equal(unique.length, 1, name);
	return unique[0];
};
const previousSourceSha256 = one(receipt.native.observations.map(
	item => item.sourceSha256), "historical source");
const stableXsSha256 = one(receipt.native.observations.map(
	item => item.xsSha256), "historical XS");
const stableValuesSha256 = one(receipt.native.observations.map(
	item => item.valuesSha256), "historical values");
assert.equal(sha256(compiled.xs), stableXsSha256);
assert.equal(sha256(compiled.valuesSource), stableValuesSha256);
const currentSourceSha256 = sha256(compiled.source);
assert.notEqual(currentSourceSha256, previousSourceSha256);
const outputTransition = {
	receiptPath, receiptSha256: sha256(receiptBytes)
	, previousSourceSha256, currentSourceSha256
	, stableXsSha256, stableValuesSha256
	, inputs: await Promise.all(perlRecursiveConversionOutputInputPaths.map(
		async path => {
			assert.match(receipt.sourceHashes[path], /^[0-9a-f]{64}$/u, path);
			return { path, previousSha256: receipt.sourceHashes[path]
				, currentSha256: sha256(await readFile(path)) };
		}
	))
};

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-perl-conversion-output-history-"
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
	for(const path of perlRecursiveConversionOutputChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reversePerlRecursiveConversionOutputUpdate(
			source.current, update), source.previous);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "perl-recursive-conversion-output-source-v1"
		, predecessorCommit: perlRecursiveConversionOutputPredecessor
		, draftParentCommit: perlRecursiveConversionOutputDraftParent
		, pathsSha256: sha256(JSON.stringify(
			perlRecursiveConversionOutputChangedPaths))
		, pinCount: 0, pinUpdates: []
		, outputTransition, additions, updates
	}, null, 2) + "\n";
	await writeFile(perlRecursiveConversionOutputHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} Perl conversion output transitions and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
