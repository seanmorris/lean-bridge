#!/usr/bin/env node
/**
 * Record the exact later owned-Subtype package registrations.
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
	ownedSubtypeHostRegistrationAddedPaths
	, ownedSubtypeHostRegistrationChangedPaths
	, ownedSubtypeHostRegistrationDraftParent
	, ownedSubtypeHostRegistrationEpochs
	, ownedSubtypeHostRegistrationHistoryPath
	, ownedSubtypeHostRegistrationPath
	, ownedSubtypeHostRegistrationPredecessor
	, reverseOwnedSubtypeHostRegistrationUpdate
} from "../tests/helpers/owned-subtype-host-registration-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedSubtypeHostRegistrationDraftParent
	, "Owned Subtype host registration history must stay on its exact draft parent");
assert.equal(ownedSubtypeHostRegistrationPredecessor
	, ownedSubtypeHostRegistrationDraftParent);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${ownedSubtypeHostRegistrationDraftParent}:${ownedSubtypeHostRegistrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed host registration history");
const changedPaths = [...ownedSubtypeHostRegistrationChangedPaths].sort();
const addedPaths = [...ownedSubtypeHostRegistrationAddedPaths].sort();
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"
	, ...ownedSubtypeHostRegistrationChangedPaths]), changedPaths);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedSubtypeHostRegistrationAddedPaths]), addedPaths);

const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-host-registration-history-"));
try
{
	const edits = async (previous, current) => {
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous); await writeFile(currentPath, current);
		let diff;
		try
		{
			diff = execFileSync("diff", [
				"--speed-large-files", "--unified=0", previousPath, currentPath
			], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
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
			return { start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart
					, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart
					, currentStart + currentCount).join("") };
		});
		assert.ok(result.length > 0); return result;
	};
	const transition = async (path, previous, current, metadata = {}) => {
		const update = { path
			, previousSha256: sha256(previous)
			, currentSha256: sha256(current)
			, ...metadata
			, edits: await edits(previous, current) };
		assert.equal(reverseOwnedSubtypeHostRegistrationUpdate(current, update), previous);
		return update;
	};
	const registrations = [];
	for(const [fromCommit, toCommit] of ownedSubtypeHostRegistrationEpochs)
	{
		const previous = git(["show", `${fromCommit}:${ownedSubtypeHostRegistrationPath}`]);
		const current = git(["show", `${toCommit}:${ownedSubtypeHostRegistrationPath}`]);
		registrations.push(await transition(ownedSubtypeHostRegistrationPath
			, previous, current, { fromCommit, toCommit }));
	}
	const updates = [];
	for(const path of ownedSubtypeHostRegistrationChangedPaths)
	{
		const previous = git(["show", `${ownedSubtypeHostRegistrationPredecessor}:${path}`]);
		updates.push(await transition(path, previous, await readFile(path, "utf8")));
	}
	const additions = [];
	for(const path of ownedSubtypeHostRegistrationAddedPaths)
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	await writeFile(ownedSubtypeHostRegistrationHistoryPath, JSON.stringify({
		schemaVersion: 1
		, milestone: "owned-subtype-host-registration-source-v1"
		, predecessorCommit: ownedSubtypeHostRegistrationPredecessor
		, draftParentCommit: ownedSubtypeHostRegistrationDraftParent
		, registrationEpochs: ownedSubtypeHostRegistrationEpochs
		, registrations, updates, additions
	}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${registrations.length} registrations, ${updates.length} repair transitions and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
