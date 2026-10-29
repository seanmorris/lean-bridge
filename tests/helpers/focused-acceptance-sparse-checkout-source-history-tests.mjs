/**
 * Authenticate focused producer sparse checkouts and standalone history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeFocusedAcceptanceSparseCheckoutSource
	, focusedAcceptanceSparseCheckoutHistoryAdditions
	, focusedAcceptanceSparseCheckoutHistoryPath
	, focusedAcceptanceSparseCheckoutImplementation
	, focusedAcceptanceSparseCheckoutImplementationPaths
	, focusedAcceptanceSparseCheckoutIntegrationPaths
	, focusedAcceptanceSparseCheckoutPredecessor
	, reverseFocusedAcceptanceSparseCheckoutUpdate
} from "./focused-acceptance-sparse-checkout-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	focusedAcceptanceSparseCheckoutHistoryPath, "utf8"));

test("focused acceptance sparse checkouts record their exact transaction"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "focused-acceptance-sparse-checkout-source-v1");
		assert.equal(history.predecessorCommit
			, focusedAcceptanceSparseCheckoutPredecessor);
		assert.equal(history.implementationCommit
			, focusedAcceptanceSparseCheckoutImplementation);
		assert.deepEqual(history.updates.map(item => item.path)
			, focusedAcceptanceSparseCheckoutImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, focusedAcceptanceSparseCheckoutIntegrationPaths);
		assert.equal(history.workflowCount, 5);
		assert.equal(history.focusedProducerCount, 10);
		assert.equal(history.focusedFetchDepth, 1);
		assert.equal(history.standaloneFetchDepth, 0);
		assert.equal(history.excludedPattern, "!/docs/evidence/");
		assert.equal(history.sparseCheckoutConeMode, false);
		assert.deepEqual(history.currentSourcePaths, []);
	}
);

test("focused acceptance sparse checkouts reverse every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			focusedAcceptanceSparseCheckoutImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${focusedAcceptanceSparseCheckoutImplementation}:${update.path}`]);
		assert.equal(reverseFocusedAcceptanceSparseCheckoutUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFocusedAcceptanceSparseCheckoutSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("focused producers exclude evidence while standalone jobs retain history"
	, async () => {
		const expected = new Map([
			["generic-subtype-npm-browser.yml", 1]
			, ["generic-subtype-native-perl.yml", 2]
			, ["generic-subtype-languages.yml", 3]
			, ["generic-subtype-managed-wit.yml", 3]
			, ["nominal-subtype-php-wasm.yml", 1]
		]);
		let count = 0;
		for(const [name, lanes] of expected)
		{
			const path = `.github/workflows/${name}`;
			const source = git(["show"
				, `${focusedAcceptanceSparseCheckoutImplementation}:${path}`]);
			assert.equal(source.match(
				/^- name: Check out the focused package revision$/gmu)?.length ?? 0
				, 0, "checkout steps remain indented YAML");
			assert.equal(source.match(
				/^ {6}- name: Check out the focused package revision$/gmu)?.length
				, lanes, path);
			assert.equal(source.match(/^ {12}!\/docs\/evidence\/$/gmu)?.length
				, lanes, path);
			assert.equal(source.match(/^ {10}fetch-depth: 1$/gmu)?.length
				, lanes, path);
			assert.ok((source.match(/^ {10}fetch-depth: 0$/gmu)?.length ?? 0)
				>= lanes, path);
			count += lanes;
		}
		assert.equal(count, 10);
	}
);

test("focused acceptance sparse checkouts authenticate history controls"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, focusedAcceptanceSparseCheckoutHistoryAdditions);
		for(const addition of history.historyAdditions)
		{
			const source = await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256);
			assert.equal(sha256(source), addition.sha256, addition.path);
		}
	}
);

test("focused acceptance sparse checkouts reject forged transitions"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${focusedAcceptanceSparseCheckoutImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }
			, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseFocusedAcceptanceSparseCheckoutUpdate(current, forged));
	}
);

test("focused acceptance sparse-checkout writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-focused-acceptance-sparse-checkout-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /focused-acceptance-sparse-checkout-source-history-20261029\.json/u);
});
