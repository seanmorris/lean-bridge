/**
 * Authenticate the systems HostNull type-surface lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeHostNullSystemsTypeSurfaceIntegrationSource
	, beforeHostNullSystemsTypeSurfaceSource
	, hostNullSystemsTypeSurfaceAddedPaths
	, hostNullSystemsTypeSurfaceAnchorSha256
	, hostNullSystemsTypeSurfaceHistoryPath
	, hostNullSystemsTypeSurfaceIntegrationPaths
	, hostNullSystemsTypeSurfacePath
	, hostNullSystemsTypeSurfacePinCount
	, hostNullSystemsTypeSurfacePinDefinition
	, hostNullSystemsTypeSurfacePinRefresh
	, hostNullSystemsTypeSurfacePredecessor
	, hostNullSystemsTypeSurfaceTargetSha256
	, reverseHostNullSystemsTypeSurfaceUpdate
} from "./host-null-systems-type-surface-lineage-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullSystemsTypeSurfaceHistoryPath, "utf8"));
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const blobDigest = (commit, path) => execFileSync("sh"
	, ["-c", "git show \"$1\" | sha256sum", "sh", `${commit}:${path}`]
	, { encoding: "utf8" }).slice(0, 64);
const digestPattern = /[0-9a-f]{64}/gu;

test("systems HostNull type-surface lineage records the exact transition", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "host-null-systems-type-surface-lineage-source-v1");
	assert.equal(value.predecessorCommit, hostNullSystemsTypeSurfacePredecessor);
	assert.equal(value.anchorSha256, hostNullSystemsTypeSurfaceAnchorSha256);
	assert.equal(value.targetSha256, hostNullSystemsTypeSurfaceTargetSha256);
	assert.equal(value.updates.length, 1);
	const update = value.updates[0];
	assert.equal(update.path, hostNullSystemsTypeSurfacePath);
	assert.equal(update.parent, hostNullSystemsTypeSurfacePinDefinition);
	assert.equal(update.commit, hostNullSystemsTypeSurfacePinRefresh);
	assert.equal(blobDigest(update.parent, update.path), update.previousSha256);
	assert.equal(blobDigest(update.commit, update.path), update.currentSha256);
});

test("systems HostNull type-surface transition streams and occupies the newest slot", async () => {
	const update = (await record()).updates[0];
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
		update.commit, update.path), update), true);
	assert.ok(finRefinementNormalizationPaths.includes(update.path));
	const hub = await readFile("tests/helpers/fin-refinement-source-history.mjs", "utf8");
	const order = [
		"beforeHostNullSystemsTypeSurfaceIntegrationSource(path"
		, "beforeHostNullSystemsIntegrationSource(path"
		, "beforeHostNullSystemsTypeSurfaceSource(path"
		, "beforeHostNullSystemsSource(path"
		, "beforeGeneratedOutputControlRepairTypeSurfaceIntegrationSource("
	].map(name => hub.indexOf(name));
	assert.ok(order.every(index => index > 0), String(order));
	assert.deepEqual([...order].sort((left, right) => left - right), order);
});

test("systems HostNull type-surface edits only 308 digests", async () => {
	const update = (await record()).updates[0];
	let pins = 0;
	for(const edit of update.edits)
	{
		assert.equal(edit.current.replace(digestPattern, "")
			, edit.previous.replace(digestPattern, ""));
		pins += edit.current.match(digestPattern).length;
	}
	assert.equal(pins, hostNullSystemsTypeSurfacePinCount);
});

test("systems HostNull type-surface additions and registration are exact", async () => {
	const value = await record();
	assert.deepEqual(value.additions.map(item => item.path)
		, hostNullSystemsTypeSurfaceAddedPaths);
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, hostNullSystemsTypeSurfaceIntegrationPaths);
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const previous = sourceAt(hostNullSystemsTypeSurfacePredecessor, update.path);
		assert.equal(reverseHostNullSystemsTypeSurfaceUpdate(current, update), previous);
		assert.equal(beforeHostNullSystemsTypeSurfaceIntegrationSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
});

test("systems HostNull type-surface rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHostNullSystemsTypeSurfaceUpdate("unknown\n", forged));
	assert.equal(beforeHostNullSystemsTypeSurfaceSource(
		update.path, "unknown\n"), "unknown\n");
});
