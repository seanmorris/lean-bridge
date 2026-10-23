#!/usr/bin/env node
/**
 * Record the exact handwritten generic-Subtype documentation transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { reconcileDependentCheckedRecordSourcePins } from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	genericSubtypeDocumentationAddedPaths
	, genericSubtypeDocumentationHistoryPath
	, genericSubtypeDocumentationImplementation
	, genericSubtypeDocumentationImplementationAddedPaths
	, genericSubtypeDocumentationImplementationPaths
	, genericSubtypeDocumentationIntegrationPaths
	, genericSubtypeDocumentationModifiedPaths
	, genericSubtypeDocumentationPredecessor
	, reverseGenericSubtypeDocumentationUpdate
} from "../tests/helpers/generic-subtype-documentation-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const implementation = genericSubtypeDocumentationImplementation;
const predecessor = genericSubtypeDocumentationPredecessor;
const inventoryPath = "docs/type-surface.v1.json";
const hubPaths = genericSubtypeDocumentationIntegrationPaths
	.filter(path => path !== inventoryPath);

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Generic Subtype documentation history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor
	, "Generic Subtype documentation history requires its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${genericSubtypeDocumentationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed documentation history");
assert.deepEqual(names(["diff", "--name-only"
	, predecessor, implementation])
, [...genericSubtypeDocumentationImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...genericSubtypeDocumentationModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...genericSubtypeDocumentationImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT"
	, predecessor, implementation]), []);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...hubPaths].sort());

// Refresh only existing live source pins. Archived evidence remains immutable.
const inventory = JSON.parse(source(implementation, inventoryPath));
const liveDigests = new Map();
for(const path of genericSubtypeDocumentationModifiedPaths)
	liveDigests.set(path, sha256(source(implementation, path)));
for(const path of hubPaths)
	liveDigests.set(path, sha256(await readFile(path)));
assert.ok([...liveDigests.keys()].every(path =>
	!path.startsWith("docs/evidence/")));
const pinned = reconcileDependentCheckedRecordSourcePins(inventory, liveDigests);
assert.ok(pinned.refreshed > 0
	, "Documentation integration must refresh its live source pins");
await writeFile(inventoryPath
	, JSON.stringify(pinned.inventory, null, 2) + "\n");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...genericSubtypeDocumentationIntegrationPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-generic-subtype-documentation-history-"));
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
	for(const line of currentLines) offsets.push(offsets.at(-1) + line.length);
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
	assert.equal(reverseGenericSubtypeDocumentationUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of genericSubtypeDocumentationModifiedPaths)
		updates.push(await transition(path
			, source(predecessor, path), source(implementation, path)));
	const integrationUpdates = [];
	for(const path of genericSubtypeDocumentationIntegrationPaths)
		integrationUpdates.push(await transition(path
			, source(implementation, path), await readFile(path, "utf8")));
	const additions = [];
	for(const path of genericSubtypeDocumentationAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${predecessor}:${path}`], { stdio: "ignore" }).status, 0, path);
		const bytes = genericSubtypeDocumentationImplementationAddedPaths
			.includes(path) ? source(implementation, path) : await readFile(path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(genericSubtypeDocumentationHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "generic-subtype-documentation-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Add fail-closed manual guide rendering for the closed GenericNat Subtype field promotion across the sixteen non-PHP-Wasm profiles without widening PHP-Wasm or open generic claims."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions; refreshed `
		+ `${pinned.refreshed} live source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
