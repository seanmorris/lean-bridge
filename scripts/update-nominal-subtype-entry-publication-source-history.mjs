#!/usr/bin/env node
/**
 * Prepare and record the nominal Subtype entry publication source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { reconcileDependentCheckedRecordSourcePins }
	from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	nominalSubtypeEntryPublicationArchiveRoots
	, nominalSubtypeEntryPublicationCommit
	, nominalSubtypeEntryPublicationCommits
	, nominalSubtypeEntryPublicationHistoryPath
	, nominalSubtypeEntryPublicationIntroductions
	, nominalSubtypeEntryPublicationPredecessor
	, nominalSubtypeEntryPublicationTransitions
} from "../tests/helpers/nominal-subtype-entry-publication-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

assert.ok(process.argv.length === 3
	&& ["--prepare", "--record"].includes(process.argv[2])
, "Use --prepare before the integration commit or --record after it");
const mode = process.argv[2];
const inventoryPath = "docs/type-surface.v1.json";
const integrationModified = Object.freeze([
	inventoryPath, "tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
const historyModule
	= "tests/helpers/nominal-subtype-entry-publication-source-history.mjs";
const historyAdded = Object.freeze([
	"scripts/update-nominal-subtype-entry-publication-source-history.mjs"
	, historyModule
	, "tests/helpers/nominal-subtype-entry-publication-source-history-tests.mjs"
]);
const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const head = git(["rev-parse", "HEAD"]).trim();

if(mode === "--prepare")
{
	assert.equal(head, nominalSubtypeEntryPublicationCommit
		, "Preparation requires the exact publication commit");
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", "HEAD", "--"])
		, integrationModified.filter(path => path !== inventoryPath).sort());
	const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
	const observations = structuredClone(inventory.observations);
	const live = new Map();
	for(const path of integrationModified.filter(path => path !== inventoryPath))
		live.set(path, sha256(await readFile(path)));
	const pinned = reconcileDependentCheckedRecordSourcePins(inventory, live);
	assert.ok(pinned.refreshed > 0, "Integration must refresh live source pins");
	assert.deepEqual(pinned.inventory.observations, observations
		, "Source-pin preparation cannot change support observations");
	await writeFile(inventoryPath
		, JSON.stringify(pinned.inventory, null, 2) + "\n");
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", "HEAD", "--"])
		, [...integrationModified].sort());
	process.stdout.write(`Refreshed ${pinned.refreshed} live source pins.\n`);
	process.exit(0);
}

assert.equal(git(["show", "-s", "--format=%P", head]).trim()
	, nominalSubtypeEntryPublicationCommit
	, "Recording requires the exact integration child of the publication commit");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, nominalSubtypeEntryPublicationCommit, head])
, [...integrationModified].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, nominalSubtypeEntryPublicationCommit, head]), [historyModule]);
assert.equal(git(["ls-tree", "--name-only", head, "--"
	, nominalSubtypeEntryPublicationHistoryPath]).trim(), "");
const commits = git(["rev-list", "--reverse", "--first-parent"
	, `${nominalSubtypeEntryPublicationPredecessor}..${nominalSubtypeEntryPublicationCommit}`])
	.trim().split("\n");
assert.deepEqual(commits, nominalSubtypeEntryPublicationCommits);
for(const [index, revision] of commits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? nominalSubtypeEntryPublicationPredecessor : commits[index - 1]);

const updates = [];
for(const transition of nominalSubtypeEntryPublicationTransitions)
	updates.push(await gitSourceHistoryTransition(
		transition.path, transition.previous, transition.current));
const integrationUpdates = [];
for(const path of integrationModified)
	integrationUpdates.push(await gitSourceHistoryTransition(
		path, nominalSubtypeEntryPublicationCommit, head));

const additions = [];
for(const introduction of nominalSubtypeEntryPublicationIntroductions)
{
	const parent = git(["show", "-s", "--format=%P", introduction.commit]).trim();
	assert.equal(git(["ls-tree", "--name-only", parent, "--", introduction.path])
		.trim(), "", introduction.path);
	const bytes = git(["show", `${head}:${introduction.path}`]);
	additions.push({ ...introduction, currentSha256: sha256(bytes) });
}
for(const path of historyAdded)
{
	assert.equal(git(["ls-tree", "--name-only"
		, nominalSubtypeEntryPublicationCommit, "--", path]).trim(), "", path);
	const bytes = path === historyModule
		? git(["show", `${head}:${path}`]) : await readFile(path);
	additions.push({ path, currentSha256: sha256(bytes) });
}

const archives = [];
for(
	const [lane, contract] of Object.entries(
		nominalSubtypeEntryPublicationArchiveRoots)
) {
	const parent = git(["show", "-s", "--format=%P", contract.commit]).trim();
	const changed = names(["diff", "--name-only", parent, contract.commit]);
	assert.ok(changed.length > 0 && changed.every(path =>
		path.startsWith(`${contract.root}/`)), lane);
	assert.equal(changed.length, contract.committedFiles, lane);
	const indexBytes = await readFile(`${contract.root}/index.json`);
	assert.equal(sha256(indexBytes), contract.indexSha256, lane);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length, contract.manifestFiles, lane);
	assert.equal(index.files.reduce((sum, file) => sum + file.bytes, indexBytes.length)
		, contract.committedBytes, lane);
	archives.push({ lane, ...contract, producerCommit: index.producerCommit });
}

await writeFile(nominalSubtypeEntryPublicationHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "nominal-subtype-entry-publication-source-v1"
	, predecessorCommit: nominalSubtypeEntryPublicationPredecessor
	, publicationCommit: nominalSubtypeEntryPublicationCommit
	, integrationCommit: head
	, commits: nominalSubtypeEntryPublicationCommits
	, scope: "Retain and independently replay the original native and browser nominal Subtype constructor/source-entry measurements, publish exactly two test-only evidence records without changing any support observation, document the instrumented/unmodified and C/C++ measurement boundaries, and authenticate every source, archive, publication and live-pin transition."
	, archives, additions, updates, integrationUpdates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} committed and `
	+ `${integrationUpdates.length} integration transitions.\n`);
