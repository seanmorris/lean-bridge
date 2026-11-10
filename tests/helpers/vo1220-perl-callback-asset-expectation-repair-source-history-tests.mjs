/**
 * Verify the legacy Perl callback asset-expectation repair and seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedPerlCallbackResultCi }
	from "./owned-perl-callback-result-ci.mjs";
import { ownedPerlCallbackProducer }
	from "./owned-perl-callback-result-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import {
	assertVo1220PerlCallbackAssetExpectationRepair
	, beforeVo1220PerlCallbackAssetExpectationRepairSource
	, reverseVo1220PerlCallbackAssetExpectationRepairUpdate
	, vo1220PerlCallbackAssetExpectationRepairBehavior
	, vo1220PerlCallbackAssetExpectationRepairHistoryAdditions
	, vo1220PerlCallbackAssetExpectationRepairHistoryPath
	, vo1220PerlCallbackAssetExpectationRepairImplementation
	, vo1220PerlCallbackAssetExpectationRepairImplementationPaths
	, vo1220PerlCallbackAssetExpectationRepairIntegrationPaths
	, vo1220PerlCallbackAssetExpectationRepairPredecessor
} from "./vo1220-perl-callback-asset-expectation-repair-source-history.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const history = async () => JSON.parse(await readFile(
	vo1220PerlCallbackAssetExpectationRepairHistoryPath, "utf8"));

test("Perl callback asset expectations record one exact implementation boundary"
	, async () => {
		const value = await history();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "vo1220-perl-callback-asset-expectation-repair-source-v1");
		assert.equal(value.predecessorCommit
			, vo1220PerlCallbackAssetExpectationRepairPredecessor);
		assert.equal(value.implementationCommit
			, vo1220PerlCallbackAssetExpectationRepairImplementation);
		assert.deepEqual(value.updates.map(item => item.path)
			, vo1220PerlCallbackAssetExpectationRepairImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, vo1220PerlCallbackAssetExpectationRepairIntegrationPaths);
		assert.deepEqual(value.behavior
			, vo1220PerlCallbackAssetExpectationRepairBehavior);
	}
);

test("Perl callback asset expectations reverse every authenticated source"
	, async () => {
		const value = await history();
		for(const update of value.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				vo1220PerlCallbackAssetExpectationRepairImplementation
				, update.path), update), true, update.path);
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = blob(
				vo1220PerlCallbackAssetExpectationRepairImplementation
				, update.path);
			assert.equal(
				reverseVo1220PerlCallbackAssetExpectationRepairUpdate(
					current, update), previous, update.path);
			assert.equal(
				beforeVo1220PerlCallbackAssetExpectationRepairSource(
					update.path, current, update.previousSha256)
				, previous, update.path);
		}
	}
);

test("Perl callback CI distinguishes current and immutable asset contracts"
	, async () => {
		const currentWorkflow = await readFile(
			".github/workflows/consumer-matrix.yml", "utf8");
		const currentManifest = JSON.parse(await readFile("package.json", "utf8"));
		assert.deepEqual(assertOwnedPerlCallbackResultCi(
			currentWorkflow, currentManifest), {
			tests: 41, evidenceTests: 16, reports: 22, perls: 4
			, failurePropagated: true
			}
		);
		const legacyWorkflow = blob(ownedPerlCallbackProducer
			, ".github/workflows/consumer-matrix.yml");
		const legacyManifest = JSON.parse(blob(
			ownedPerlCallbackProducer, "package.json"));
		assert.deepEqual(assertOwnedPerlCallbackResultCi(
			legacyWorkflow, legacyManifest, true), {
			tests: 37, evidenceTests: 14, reports: 18, perls: 4
			, failurePropagated: true
			}
		);
	}
);

test("Perl callback asset expectation seal authenticates additions and rejects forgeries"
	, async () => {
		const value = await history();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, vo1220PerlCallbackAssetExpectationRepairHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const sources = Object.fromEntries(
			vo1220PerlCallbackAssetExpectationRepairImplementationPaths
				.map(path => [
					path
					, blob(vo1220PerlCallbackAssetExpectationRepairImplementation
						, path)
				])
		);
		assert.deepEqual(assertVo1220PerlCallbackAssetExpectationRepair(
			sources), vo1220PerlCallbackAssetExpectationRepairBehavior);
		const update = value.updates[0];
		const current = sources[update.path];
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseVo1220PerlCallbackAssetExpectationRepairUpdate(
				current, forged));
		const writer = spawnSync(process.execPath, [
			"scripts/update-vo1220-perl-callback-asset-expectation-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(writer.status, 0);
		assert.match(`${writer.stdout}${writer.stderr}`
			, /already exists|implementation/u);
	}
);
