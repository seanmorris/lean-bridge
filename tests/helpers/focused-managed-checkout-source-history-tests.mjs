/**
 * Authenticate the focused managed-lane sparse checkout repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeFocusedManagedCheckoutSource
	, focusedManagedCheckoutHistoryAdditions
	, focusedManagedCheckoutHistoryPath
	, focusedManagedCheckoutImplementation
	, focusedManagedCheckoutImplementationPaths
	, focusedManagedCheckoutIntegrationPaths
	, focusedManagedCheckoutPredecessor
	, reverseFocusedManagedCheckoutUpdate
} from "./focused-managed-checkout-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	focusedManagedCheckoutHistoryPath, "utf8"));

test("focused managed checkout records one exact implementation", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "focused-managed-checkout-source-v1");
	assert.equal(history.predecessorCommit, focusedManagedCheckoutPredecessor);
	assert.equal(history.implementationCommit
		, focusedManagedCheckoutImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, [...focusedManagedCheckoutImplementationPaths]);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, [...focusedManagedCheckoutIntegrationPaths]);
	assert.equal(history.focusedFetchDepth, 1);
	assert.equal(history.standaloneFetchDepth, 0);
	assert.equal(history.excludedPattern, "!/docs/evidence/");
	assert.equal(history.sparseCheckoutConeMode, false);
});

test("focused managed checkout reverses implementation and registration"
	, async () => {
		const history = await record();
		for(const update of history.updates)
		{
			const current = git(["show"
				, `${focusedManagedCheckoutImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${focusedManagedCheckoutPredecessor}:${update.path}`]);
			assert.equal(reverseFocusedManagedCheckoutUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeFocusedManagedCheckoutSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${focusedManagedCheckoutImplementation}:${update.path}`]);
			assert.equal(reverseFocusedManagedCheckoutUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeFocusedManagedCheckoutSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("focused managed checkout authenticates additions and semantics"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, [...focusedManagedCheckoutHistoryAdditions]);
		for(const addition of history.historyAdditions)
		{
			const source = await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256);
			assert.equal(sha256(source), addition.sha256, addition.path);
		}
		const managed = git(["show"
			, `${focusedManagedCheckoutImplementation}`
			+ ":.github/workflows/generic-subtype-managed-wit.yml"]);
		const dotnet = managed.slice(managed.indexOf("  dotnet:\n")
			, managed.indexOf("  jvm:\n"));
		assert.match(dotnet, /Check out the focused package revision/u);
		assert.match(dotnet, /fetch-depth: 1/u);
		assert.match(dotnet, /!\/docs\/evidence\//u);
		assert.match(dotnet, /sparse-checkout-cone-mode: false/u);
		assert.match(dotnet, /Check out the exact revision/u);
		assert.match(dotnet, /fetch-depth: 0/u);
	}
);

test("focused managed checkout rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${focusedManagedCheckoutImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.yml" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseFocusedManagedCheckoutUpdate(
		current, forged));
});

test("focused managed checkout writer refuses another checkout", () => {
	const result = spawnSync(process.execPath, [
		"scripts/update-focused-managed-checkout-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(result.status, 0);
	assert.match(`${result.stdout}${result.stderr}`
		, /focused-managed-checkout-source-history-20261029\.json/u);
});
