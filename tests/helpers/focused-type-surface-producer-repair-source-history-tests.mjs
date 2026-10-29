/**
 * Authenticate the focused optional, proof-erasure and HostNull producer
 * repair and its exact live-pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "./dependent-checked-record-promotion.mjs";
import {
	beforeFocusedTypeSurfaceProducerRepairSource
	, focusedTypeSurfaceProducerRepairAddedPaths
	, focusedTypeSurfaceProducerRepairHistoryPath
	, focusedTypeSurfaceProducerRepairImplementation
	, focusedTypeSurfaceProducerRepairImplementationPaths
	, focusedTypeSurfaceProducerRepairIntegrationPaths
	, focusedTypeSurfaceProducerRepairPredecessor
	, reverseFocusedTypeSurfaceProducerRepairUpdate
} from "./focused-type-surface-producer-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	focusedTypeSurfaceProducerRepairHistoryPath, "utf8"));
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);

test("focused producer repair records its exact implementation and registration", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "focused-type-surface-producer-repair-source-v1");
	assert.equal(value.predecessorCommit
		, focusedTypeSurfaceProducerRepairPredecessor);
	assert.equal(value.implementationCommit
		, focusedTypeSurfaceProducerRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, focusedTypeSurfaceProducerRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, focusedTypeSurfaceProducerRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, focusedTypeSurfaceProducerRepairAddedPaths);
	assert.equal(git(["rev-parse"
		, `${focusedTypeSurfaceProducerRepairImplementation}^`]).trim()
		, focusedTypeSurfaceProducerRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, focusedTypeSurfaceProducerRepairPredecessor
		, focusedTypeSurfaceProducerRepairImplementation]).trim().split("\n")
		, [...focusedTypeSurfaceProducerRepairImplementationPaths].sort());
});

test("focused producer repair reverses every implementation and integration source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const current = sourceAt(
			focusedTypeSurfaceProducerRepairImplementation, update.path);
		const previous = sourceAt(
			focusedTypeSurfaceProducerRepairPredecessor, update.path);
		assert.equal(reverseFocusedTypeSurfaceProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(
			focusedTypeSurfaceProducerRepairImplementation, update.path);
		assert.equal(reverseFocusedTypeSurfaceProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("focused producer repair refreshes exactly the affected live source pins", async () => {
	const value = await record();
	const before = JSON.parse(sourceAt(
		focusedTypeSurfaceProducerRepairImplementation
		, "docs/type-surface.v1.json"));
	const changedPaths = [...new Set([
		...focusedTypeSurfaceProducerRepairImplementationPaths
		, ...focusedTypeSurfaceProducerRepairIntegrationPaths
		, ...focusedTypeSurfaceProducerRepairAddedPaths
	])].sort();
	assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
		before, changedPaths).sort(), value.currentSourcePaths);
	const reconciled = reconcileDependentCheckedRecordSourcePins(before
		, new Map(value.currentSourceDigests.map(item =>
			[item.path, item.sha256])));
	assert.equal(reconciled.refreshed, value.refreshedPins);
	const update = value.integrationUpdates.find(item =>
		item.path === "docs/type-surface.v1.json");
	const after = JSON.parse(await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256));
	assert.deepEqual(after, reconciled.inventory);
	assert.deepEqual(after.profiles, before.profiles);
	assert.deepEqual(after.observations, before.observations);
});

test("focused producer repair fixes targets, native defaults and the isolated source closure", () => {
	const implementation = path => sourceAt(
		focusedTypeSurfaceProducerRepairImplementation, path);
	for(const path of [
		"tests/optional-parameter-language-installed.test.mjs"
		, "tests/direct-proof-erasure-language-installed.test.mjs"
	]) assert.match(implementation(path)
		, /targets: \[target\[profile\]\], environment/u, path);
	for(const path of [
		"tests/optional-parameter-managed-installed.test.mjs"
		, "tests/direct-proof-erasure-managed-installed.test.mjs"
	]) assert.match(implementation(path), /targets: \[target\], environment/u
		, path);
	assert.match(implementation("tests/helpers/host-null-managed-installed.mjs")
		, /targets: \[target\], environment/u);
	assert.match(implementation("src/build/native-model.mjs")
		, /parameter\.optional \? \["optional", "default"\] : \[\]/u);
	for(const path of [
		"nix/component-engine-source-boundary.json"
		, "nix/core-source-boundary.json"
	]) assert.ok(JSON.parse(implementation(path)).includedFiles
		.includes("src/binding-ir/default-value.mjs"), path);
});

test("focused producer repair rejects forged transitions and unknown source", async () => {
	const update = (await record()).updates.find(item =>
		item.path === "src/build/native-model.mjs");
	const current = sourceAt(
		focusedTypeSurfaceProducerRepairImplementation, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseFocusedTypeSurfaceProducerRepairUpdate(current, forged));
	assert.equal(beforeFocusedTypeSurfaceProducerRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
