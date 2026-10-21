#!/usr/bin/env node
/**
 * Record the clean-clone hosted acceptance handoff repairs.
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
	hostedAcceptanceHandoffRepairAdditions
	, hostedAcceptanceHandoffRepairChangedPaths
	, hostedAcceptanceHandoffRepairHistoryPath
	, hostedAcceptanceHandoffRepairImplementation
	, hostedAcceptanceHandoffRepairIntegrationPaths
	, hostedAcceptanceHandoffRepairPredecessor
	, reverseHostedAcceptanceHandoffRepairUpdate
} from "../tests/helpers/hosted-acceptance-handoff-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, hostedAcceptanceHandoffRepairImplementation
	, "Hosted acceptance handoff repair history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, hostedAcceptanceHandoffRepairHistoryPath]).trim(), "");

const historyAdditions = Object.freeze([
	"scripts/update-hosted-acceptance-handoff-repair-source-history.mjs"
	, "tests/helpers/hosted-acceptance-handoff-repair-source-history.mjs"
	, "tests/helpers/hosted-acceptance-handoff-repair-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(tmpdir(), "hosted-handoff-repair-history-"));
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
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseHostedAcceptanceHandoffRepairUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of hostedAcceptanceHandoffRepairChangedPaths)
		updates.push(await transition(path, hostedAcceptanceHandoffRepairPredecessor));
	const integrationUpdates = [];
	for(const path of hostedAcceptanceHandoffRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, hostedAcceptanceHandoffRepairImplementation));
	const additions = [];
	for(const path of [...hostedAcceptanceHandoffRepairAdditions, ...historyAdditions])
	{
		const baseline = hostedAcceptanceHandoffRepairAdditions.includes(path)
			? hostedAcceptanceHandoffRepairPredecessor
			: hostedAcceptanceHandoffRepairImplementation;
		assert.equal(git(["ls-tree", "--name-only", baseline, "--", path]).trim()
			, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, hostedAcceptanceHandoffRepairImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...hostedAcceptanceHandoffRepairIntegrationPaths].sort());
	const record = {
		schemaVersion: 1
		, milestone: "hosted-acceptance-handoff-repair-source-v1"
		, predecessorCommit: hostedAcceptanceHandoffRepairPredecessor
		, implementationCommit: hostedAcceptanceHandoffRepairImplementation
		, scope: "Hosted acceptance uses an arity-sensitive PHP-Wasm result-only probe, reconstructs each Perl consumer from authenticated archive bytes after deleting the shared handoff, and retains every hosted log named by an immutable evidence index in Git."
		, updates, integrationUpdates, additions
	};
	await writeFile(hostedAcceptanceHandoffRepairHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
