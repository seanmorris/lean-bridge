#!/usr/bin/env node
/**
 * Record the hosted refinement validator and native-PHP verifier repair.
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
	hostedRefinementVerifierRepairChangedPaths
	, hostedRefinementVerifierRepairHistoryPath
	, hostedRefinementVerifierRepairImplementation
	, hostedRefinementVerifierRepairIntegrationBase
	, hostedRefinementVerifierRepairIntegrationPaths
	, hostedRefinementVerifierRepairPredecessor
	, reverseHostedRefinementVerifierRepairUpdate
} from "../tests/helpers/hosted-refinement-verifier-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const integrationBase = hostedRefinementVerifierRepairIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Hosted refinement verifier repair history is draft-only at its integration base commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, hostedRefinementVerifierRepairHistoryPath]).trim(), "");

const additions = Object.freeze([
	"scripts/update-hosted-refinement-verifier-repair-source-history.mjs"
	, "tests/helpers/hosted-refinement-verifier-repair-source-history.mjs"
	, "tests/helpers/hosted-refinement-verifier-repair-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "hosted-refinement-verifier-repair-history-"));
const transition = async (path, revision) => {
	const previous = git(["show", `${revision}:${path}`]);
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
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseHostedRefinementVerifierRepairUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of hostedRefinementVerifierRepairChangedPaths)
	{
		const current = await readFile(path, "utf8");
		assert.equal(current, git(["show"
			, `${hostedRefinementVerifierRepairImplementation}:${path}`])
		, `Later work changed ${path}; record a composed transition instead`);
		updates.push(await transition(
			path, hostedRefinementVerifierRepairPredecessor));
	}
	const integrationUpdates = [];
	for(const path of hostedRefinementVerifierRepairIntegrationPaths)
		integrationUpdates.push(await transition(path, integrationBase));
	const added = [];
	for(const path of additions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, integrationBase, "--", path]).trim(), "", path);
		added.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, integrationBase, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...hostedRefinementVerifierRepairIntegrationPaths].sort());
	await writeFile(hostedRefinementVerifierRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "hosted-refinement-verifier-repair-source-v1"
		, predecessorCommit: hostedRefinementVerifierRepairPredecessor
		, implementationCommit: hostedRefinementVerifierRepairImplementation
		, integrationBaseCommit: integrationBase
		, scope: "Recursive copied-value validators derive carriers from authenticated signatures and fail closed when a type is absent; hosted native-PHP reports authenticate the one retained caller path used by producers."
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
