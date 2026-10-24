#!/usr/bin/env node
/**
 * Record the nominal Subtype entry export-surface repair.
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
	nominalSubtypeEntryExportSurfaceAddedPaths
	, nominalSubtypeEntryExportSurfaceChangedPaths
	, nominalSubtypeEntryExportSurfaceHistoryPath
	, nominalSubtypeEntryExportSurfaceImplementation
	, nominalSubtypeEntryExportSurfaceIntegrationPaths
	, nominalSubtypeEntryExportSurfacePredecessor
	, reverseNominalSubtypeEntryExportSurfaceUpdate
} from "../tests/helpers/nominal-subtype-entry-export-surface-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const implementation = nominalSubtypeEntryExportSurfaceImplementation;
const predecessor = nominalSubtypeEntryExportSurfacePredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Nominal entry export-surface history requires its exact implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...nominalSubtypeEntryExportSurfaceChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, nominalSubtypeEntryExportSurfaceHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...nominalSubtypeEntryExportSurfaceIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...nominalSubtypeEntryExportSurfaceAddedPaths])
, [...nominalSubtypeEntryExportSurfaceAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-nominal-entry-export-surface-history-"
));
const transition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
			, previousPath, currentPath]
		, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const offsets = [0];
	for(const line of currentLines)
		offsets.push(offsets.at(-1) + line.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: offsets[currentStart]
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseNominalSubtypeEntryExportSurfaceUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of nominalSubtypeEntryExportSurfaceChangedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of nominalSubtypeEntryExportSurfaceIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of nominalSubtypeEntryExportSurfaceAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(nominalSubtypeEntryExportSurfaceHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "nominal-subtype-entry-export-surface-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Validate the installed nominal Subtype npm side module against its exact linker-authorized adapter and initializer surface while keeping Lean wrappers and validators private."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
