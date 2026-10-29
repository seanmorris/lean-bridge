/**
 * Qualify the focused producer efficiency history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeFocusedProducerEfficiencySource
	, focusedProducerEfficiencyHistoryAdditions
	, focusedProducerEfficiencyHistoryPath
	, focusedProducerEfficiencyImplementation
	, focusedProducerEfficiencyImplementationPaths
	, focusedProducerEfficiencyIntegrationPaths
	, focusedProducerEfficiencyNormalizationPaths
	, focusedProducerEfficiencyPredecessor
	, reverseFocusedProducerEfficiencyUpdate
} from "./focused-producer-efficiency-source-history.mjs";
import { beforeFinRefinementSource }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	focusedProducerEfficiencyHistoryPath, "utf8"));

test("focused producer efficiency records one exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "focused-producer-efficiency-source-v1");
	assert.equal(value.predecessorCommit, focusedProducerEfficiencyPredecessor);
	assert.equal(value.implementationCommit
		, focusedProducerEfficiencyImplementation);
	assert.deepEqual(value.updates.map(item => item.path)
		, [...focusedProducerEfficiencyImplementationPaths]);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, [...focusedProducerEfficiencyIntegrationPaths]);
	assert.deepEqual(value.currentSourcePaths, []);
	assert.equal(value.refreshedPins, 0);
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=AM"
		, focusedProducerEfficiencyPredecessor
		, focusedProducerEfficiencyImplementation, "--"]).trim().split("\n")
		, [...focusedProducerEfficiencyImplementationPaths]);
});

test("focused producer efficiency reverses implementation and registration"
	, async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${focusedProducerEfficiencyImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${focusedProducerEfficiencyPredecessor}:${update.path}`]);
		assert.equal(reverseFocusedProducerEfficiencyUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFocusedProducerEfficiencySource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${focusedProducerEfficiencyImplementation}:${update.path}`]);
		assert.equal(reverseFocusedProducerEfficiencyUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}}
);

test("focused producer efficiency authenticates additions and semantics"
	, async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, [...focusedProducerEfficiencyHistoryAdditions]);
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${focusedProducerEfficiencyImplementation}:${addition.path}`]
		, { stdio: "ignore" }).status, 0);
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256))
			, addition.sha256, addition.path);
	}
	for(const path of [
		...focusedProducerEfficiencyImplementationPaths
		, ...focusedProducerEfficiencyIntegrationPaths
	]) assert.ok(focusedProducerEfficiencyNormalizationPaths.includes(path)
		, path);
	const npm = git(["show"
	, `${focusedProducerEfficiencyImplementation}`
		+ ":.github/workflows/generic-subtype-npm-browser.yml"]);
	assert.match(npm, /fetch-depth: \$\{\{ .* && 1 \|\| 0 \}\}/u);
	assert.match(npm, /fromJSON\(.*\["reviewed"\].*\)/u);
	assert.match(npm, /!inputs\.optional_parameters && !inputs\.direct_proof_erasure && !inputs\.host_null/u);
	const native = git(["show"
	, `${focusedProducerEfficiencyImplementation}`
		+ ":.github/workflows/generic-subtype-native-perl.yml"]);
	assert.match(native, /^ {2}dependent-foundation:\n {4}name: .+\n {4}if: \$\{\{ !inputs\./mu);
	const managed = git(["show"
	, `${focusedProducerEfficiencyImplementation}`
		+ ":.github/workflows/generic-subtype-managed-wit.yml"]);
		assert.match(managed, /^ {2}php:\n {4}name: .+\n {4}if: \$\{\{ !inputs\./mu);}
);

test("focused producer efficiency rejects forged history and updater misuse"
	, async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${focusedProducerEfficiencyImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.yml" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseFocusedProducerEfficiencyUpdate(
		current, forged));
	const result = spawnSync(process.execPath, [
		"scripts/update-focused-producer-efficiency-source-history.mjs"
	], { encoding: "utf8" });
		assert.notEqual(result.status, 0);}
);
