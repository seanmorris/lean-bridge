#!/usr/bin/env node
/**
 * Record the exact type-surface transitions omitted by the dependent
 * checked-record source, archive and control history layers.
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
	dependentCheckedRecordTypeSurfaceGapAddedPaths
	, dependentCheckedRecordTypeSurfaceGapHistoricalPaths
	, dependentCheckedRecordTypeSurfaceGapHistoryPath
	, dependentCheckedRecordTypeSurfaceGapIntegrationPaths
	, dependentCheckedRecordTypeSurfaceGapPredecessor
	, reverseDependentCheckedRecordTypeSurfaceGapHistorical
	, reverseDependentCheckedRecordTypeSurfaceGapIntegration
} from "../tests/helpers/dependent-checked-record-type-surface-gap-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentCheckedRecordTypeSurfaceGapPredecessor
	, "Dependent checked-record type-surface gap history requires its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentCheckedRecordTypeSurfaceGapHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "dependent-checked-record-type-surface-gap-history-"));
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
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	return {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
};

const omittedCommits = Object.freeze([
	["4286d8499cecb2dd3d17f4600adda72218b51408", "fa28d1e0e55fd96426152db9d4c61699ac61730d"]
	, ["f87e675dbd798332b47cff49bdc8e7b9c948613c", "2cb47d228d63a9db8c2eb5a51c62e275e9536462"]
	, ["2901f265b6c647c0a05324485e8bd3e3c06ee74b", "1a3c423089d21be2fe3a53f9011a25d6cd96b7c1"]
	, ["14d8b6311962db9d7273f609afc30e5561c75f02", "91424a1013a084985384f064e7eb8d53c348f112"]
	, ["e4d0dd347197f3b306c628ac6b9082e719c56039", "3b6501b0da89768a10429d8f31a89765aef112ce"]
	, ["19bfe7dba146a0f6e9f756f734827df595ccf65b", "c915d5d5e97df8435742359d2305dd5413638511"]
	, ["9949ea979f9a3fd4ccf0db4d2fb0006c088cfc29", "318a1d09bbba9dfe9c90a99fa7e7ada7b3924b32"]
	, ["9730864708aae82d60aa64f49f4fe4bdcd36ba05", "1560d6953429b5d0c143165ce55046af7629f7ef"]
	, ["9d593fefce53daabbade9372df208579efb905e5", "9b31632a3d54e053897032686b030a3b8dd99115"]
	, ["1fb370ad0d1a0aaafc55a233e0c847a46d21e82c", "d2f3e5c869d84b77c228b2efebe18d86172d81b1"]
	, ["80ff8b6ac2acade0aec2b953b49b516543540059", "0cecd988aef144c38b98fe9ed7b49ed9b49349a3"]
	, ["d425c218f55797036d4d40aa55381c59668cabe5", "af223878e3f77975cec01cc8bb3995e7d6e83d24"]
	, ["000b80bb20529f668e42ae38468aaeba3166f1b5", "5221f8851e8d5dd5d675d87f7bfd454f7a131781"]
	, ["4f071ae1fd72dabc22840cc8803d7661380ab66c", "39837f66b7634470b1fdcd47b9e375d3ee854ead"]
]);

try
{
	const historicalTransitions = [];
	for(const [previousCommit, currentCommit] of omittedCommits)
		for(const path of dependentCheckedRecordTypeSurfaceGapHistoricalPaths)
		{
			const update = {
				...await transition(path
					, git(["show", `${previousCommit}:${path}`])
					, git(["show", `${currentCommit}:${path}`]))
				, previousCommit, currentCommit
			};
			assert.equal(reverseDependentCheckedRecordTypeSurfaceGapHistorical(
				git(["show", `${currentCommit}:${path}`]), update)
			, git(["show", `${previousCommit}:${path}`]));
			historicalTransitions.push(update);
		}
	const integrationUpdates = [];
	for(const path of dependentCheckedRecordTypeSurfaceGapIntegrationPaths)
	{
		const update = await transition(path
			, git(["show"
				, `${dependentCheckedRecordTypeSurfaceGapPredecessor}:${path}`])
			, await readFile(path, "utf8"));
		assert.equal(reverseDependentCheckedRecordTypeSurfaceGapIntegration(
			await readFile(path, "utf8"), update)
		, git(["show"
			, `${dependentCheckedRecordTypeSurfaceGapPredecessor}:${path}`]));
		integrationUpdates.push(update);
	}
	const additions = [];
	for(const path of dependentCheckedRecordTypeSurfaceGapAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, dependentCheckedRecordTypeSurfaceGapPredecessor, "--", path]).trim(), "");
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, dependentCheckedRecordTypeSurfaceGapPredecessor, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...dependentCheckedRecordTypeSurfaceGapIntegrationPaths].sort());
	const record = {
		schemaVersion: 1
		, milestone: "dependent-checked-record-type-surface-gap-source-v1"
		, predecessorCommit: dependentCheckedRecordTypeSurfaceGapPredecessor
		, scope: "Restore the exact type-surface pointer-inventory transitions omitted by dependent checked-record source, archive and control history layers without changing support claims."
		, historicalPaths: dependentCheckedRecordTypeSurfaceGapHistoricalPaths
		, historicalTransitions, integrationUpdates, additions
	};
	await writeFile(dependentCheckedRecordTypeSurfaceGapHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${historicalTransitions.length} omitted `
		+ `transitions, ${integrationUpdates.length} integrations and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
