#!/usr/bin/env node
/**
 * Record the complete optional-parameter implementation, pin refresh, and
 * central history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";

const predecessor = "ddc31428d44e92eeabcf8d301bf765c826b8bc0b";
const feature = "8983447e75753eed71bb07980cebecc00b966ff8";
const implementation = "3d92ee3f3a9d7d4c34dca7a80540a7364392ab5d";
const historyPath
	= "docs/evidence/optional-parameter-source-history-20261028.json";
const integrationPaths = [
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
];
const historyAdditions = [
	"scripts/update-optional-parameter-source-history.mjs"
	, "tests/helpers/optional-parameter-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-source-history.mjs"
];
const commits = [
	"66c64fd844e1b912fa47dd235bf2f0f13bba2b74"
	, "d02a1fd40c583f30dec7997501b0aa53c4326304"
	, "5e89f6ac199a21c08807ab98a13dc83fbc5a88b4"
	, "36fe61602ddc9107eabae7f0acfa395008d8ca54"
	, "966a747a4f962ebcdf6622ec413bd6f9d9d30163"
	, "1fb89e5fcfedb24a49d81ec674d5431fba8306c5"
	, "95204673d0f52b9d8935b1e57345f6fcb58453d1"
	, "c9f38e5bad5396135c1f6ffe0b194ad373606671"
	, "37872750fde8a248b67b5565c7c634643fe30983"
	, "b52e738c44fb1c314651f8cc28205f5df574710c"
	, "a25d1a6d30af804d06766ec5cc36291cda4a3928"
	, "3387e1329363fc9a3fa7c4d3df36bfc572d3869a"
	, "2d467e633fb242b2f309c2b2b86cb1b55a79249c"
	, "c7682d9a1028a89ae8a303d6fbb4cde12afa908e"
	, "ae88b750461bf4138f2d5b3c079d2865725d8fde"
	, "635dbfb394a140717861d1a61d4e64e1a85ef446"
	, "6f44ff56d66880b27959214759cbdd74696aacd5"
	, "78615fd1a6bdf1f24dc7bdd668930c30a9f23fe6"
	, "a7492cce3e40920fb8a99b3a61e801a48c1c68c3"
	, "5faab47ff3b4da05f9af7ebe71c17e1df0f03229"
	, feature, implementation
];
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Optional-parameter history requires its exact pin-refresh head");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n"), commits);
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), feature);
assert.deepEqual(names(["diff", "--name-only", feature, implementation]), [
	"docs/type-surface.v1.json", "scripts/refresh-optional-parameter-pins.mjs"
]);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const updates = [];
for(const path of names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, feature]))
	updates.push({
		...await gitSourceHistoryTransition(path, predecessor, feature)
		, previousCommit: predecessor, currentCommit: feature
	});
updates.push({
	...await gitSourceHistoryTransition(
		"docs/type-surface.v1.json", feature, implementation
	)
	, previousCommit: feature, currentCommit: implementation
});
const implementationAddition = path => {
	assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
		.trim(), "", path);
	return {
		path, currentSha256: sha256(git(["show", `${implementation}:${path}`]))
	};
};
const implementationAdditions = names([
	"diff", "--name-only", "--diff-filter=A", predecessor, implementation
]).map(implementationAddition);

const directory = await mkdtemp(join(
	tmpdir(), "lean-optional-parameter-history-"));
const lineOffsets = (source, boundaries) => {
	const offsets = new Map();
	let line = 0, offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		while(line < boundary)
		{
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1;
			++line;
		}
		offsets.set(boundary, offset);
	}
	return offsets;
};
const workingTreeTransition = async (path, previous, current) => {
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
	const hunks = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { previousStart, previousEnd: previousStart + previousCount
			, currentStart, currentEnd: currentStart + currentCount };
	});
	const previousOffsets = lineOffsets(previous, hunks.flatMap(hunk =>
		[hunk.previousStart, hunk.previousEnd]));
	const currentOffsets = lineOffsets(current, hunks.flatMap(hunk =>
		[hunk.currentStart, hunk.currentEnd]));
	const edits = hunks.map(hunk => ({
		start: currentOffsets.get(hunk.currentStart)
		, previous: previous.slice(previousOffsets.get(hunk.previousStart)
			, previousOffsets.get(hunk.previousEnd))
		, current: current.slice(currentOffsets.get(hunk.currentStart)
			, currentOffsets.get(hunk.currentEnd))
	}));
	assert.ok(edits.length > 0, path);
	return {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, previousCommit: implementation, currentCommit: "working-tree"
		, edits
	};
};

try
{
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await workingTreeTransition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1, milestone: "optional-parameter-source-v1"
		, predecessorCommit: predecessor, featureCommit: feature
		, implementationCommit: implementation, implementationCommits: commits
		, scope: "Authenticate Lean-declared defaults and idiomatic omission across all seventeen prepared-package profiles and both ordinary-source and reviewed-IR author routes. Distinguish omission from explicit values, Option.none, Unit and explicit host null; retain full-arity ABI symbols, exact errors, reproducible offline packages and relocated execution. Reconcile all 34 cells into one same-run receipt. Refresh exactly 960 existing live source pins across 40 changed sources without changing support observations. Register the complete transition newest-first; hosted execution, immutable receipt retention, promotion, documentation and recurring replay remain required."
		, updates, implementationAdditions
		, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${implementationAdditions.length} implementation additions, `
		+ `${integrationUpdates.length} integration updates and `
		+ `${additions.length} history additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
