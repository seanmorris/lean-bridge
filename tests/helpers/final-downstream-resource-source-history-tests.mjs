/**
 * Authenticate the final downstream disk and audit-budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeFinalDownstreamResourceSource
	, finalDownstreamResourceHistoryAdditions
	, finalDownstreamResourceHistoryPath
	, finalDownstreamResourceImplementation
	, finalDownstreamResourceImplementationPaths
	, finalDownstreamResourceIntegrationPaths
	, finalDownstreamResourcePins
	, finalDownstreamResourcePredecessor
	, reverseFinalDownstreamResourceUpdate
} from "./final-downstream-resource-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	finalDownstreamResourceHistoryPath, "utf8"));

test("final downstream resources record both exact hosted failures", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "final-downstream-resource-source-v1");
	assert.equal(history.predecessorCommit, finalDownstreamResourcePredecessor);
	assert.equal(history.implementationCommit
		, finalDownstreamResourceImplementation);
	assert.deepEqual(history.failedRun, {
		workflow: 41170510578
		, phpWasmMixedProfileJob: 124447261182
		, reviewedIrAdmissionJob: 124447261198
	});
	assert.equal(history.phpWasmFailure, "hosted runner ENOSPC");
	assert.equal(history.reviewedIrFailure, "180-second Node test timeout");
	assert.deepEqual(history.updates.map(item => item.path)
		, finalDownstreamResourceImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, finalDownstreamResourceIntegrationPaths);
});

test("final downstream resources reverse every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			finalDownstreamResourceImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, finalDownstreamResourceImplementation + ":" + update.path]);
		assert.equal(reverseFinalDownstreamResourceUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinalDownstreamResourceSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("final downstream resources preserve the complete type-surface model"
	, async () => {
		const history = await record();
		assert.equal(history.refreshedCitationCount, 117);
		assert.equal(history.semanticChanges, 0);
		assert.deepEqual(history.typeSurfaceCounts, {
			evidence: 900, observations: 717, paths: 2, positions: 6
			, profiles: 17, stages: 5
		});
		const inventoryPath = "docs/type-surface.v1.json";
		const before = git(["show"
			, finalDownstreamResourcePredecessor + ":" + inventoryPath]);
		const after = git(["show"
			, finalDownstreamResourceImplementation + ":" + inventoryPath]);
		let restored = after;
		for(const pin of finalDownstreamResourcePins)
		{
			restored = restored.replaceAll(pin.current, pin.previous);
			assert.equal(after.split(pin.current).length - 1, pin.count);
			assert.equal(after.includes(pin.previous), false);
		}
		assert.equal(restored, before);
	}
);

test("final downstream resources reclaim disk and retain bounded audit execution"
	, async () => {
		const workflow = await readFile(".github/workflows/consumer-matrix.yml"
			, "utf8");
		const job = workflow.match(
			/^ {2}php-multi-profile:\n[^]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu)?.[0];
		assert.ok(job);
		assert.ok(job.indexOf(
			"Free hosted runner disk before PHP-Wasm and Nix builds")
			< job.indexOf("Check out the exact revision"));
		assert.match(job
			, /sudo rm -rf \/usr\/share\/dotnet \/usr\/local\/lib\/android \/opt\/ghc \/usr\/local\/\.ghcup \/opt\/hostedtoolcache\/CodeQL/u);
		const reviewed = await readFile("tests/type-corpus-reviewed.test.mjs"
			, "utf8");
		assert.match(reviewed
			, /real reviewed-IR corpus records analysis and rejection without installed coverage"[\s\S]*timeout: 600_000/u);
		assert.equal((reviewed.match(/timeout: 600_000/gu) ?? []).length, 1);
	}
);

test("final downstream resources authenticate additions and reject forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, finalDownstreamResourceHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, finalDownstreamResourceImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseFinalDownstreamResourceUpdate(current, forged));
	}
);

test("final downstream resource writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-final-downstream-resource-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /final-downstream-resource-source-history-20261031\.json/u);
});
