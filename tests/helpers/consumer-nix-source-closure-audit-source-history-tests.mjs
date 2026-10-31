/**
 * Authenticate the workflow-wide Nix consumer source-closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeConsumerNixSourceClosureAuditSource
	, consumerNixSourceClosureAuditHistoryAdditions
	, consumerNixSourceClosureAuditHistoryPath
	, consumerNixSourceClosureAuditImplementation
	, consumerNixSourceClosureAuditImplementationAdditions
	, consumerNixSourceClosureAuditImplementationUpdates
	, consumerNixSourceClosureAuditIntegrationPaths
	, consumerNixSourceClosureAuditPredecessor
	, reverseConsumerNixSourceClosureAuditUpdate
} from "./consumer-nix-source-closure-audit-source-history.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	consumerNixSourceClosureAuditHistoryPath, "utf8"));

test("Nix source-closure audit records the independent Browser ENOSPC failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "consumer-nix-source-closure-audit-v1");
		assert.equal(history.predecessorCommit
			, consumerNixSourceClosureAuditPredecessor);
		assert.equal(history.implementationCommit
			, consumerNixSourceClosureAuditImplementation);
		assert.deepEqual(history.failedRun, {
			workflow: 41204400085, job: 124548377113
		});
		assert.deepEqual(history.failure, {
			consumer: "browser-javascript"
			, step: "Install the npm archive and execute real Lean in Chromium"
			, completedAt: "2026-10-31T13:45:27Z"
			, error: "write of 24576 bytes: No space left on device"
			, runnerDiskBeforeCleanupGiB: 86
			, runnerDiskAfterCleanupGiB: 108
			, executedProductBoundary: false
		});
		assert.deepEqual(history.trackedTree, {
			allBytes: 51999721545, allFiles: 228993
			, evidenceBytes: 51797509531, evidenceFiles: 217302
			, nonEvidenceBytes: 202212014, nonEvidenceFiles: 11691
		});
	}
);

test("Nix source-closure audit reverses every modified source"
	, async () => {
		const history = await record();
		assert.deepEqual(history.updates.map(item => item.path)
			, consumerNixSourceClosureAuditImplementationUpdates);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, consumerNixSourceClosureAuditIntegrationPaths);
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				consumerNixSourceClosureAuditImplementation, update.path), update)
				, true, update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, consumerNixSourceClosureAuditImplementation + ":" + update.path]);
			assert.equal(reverseConsumerNixSourceClosureAuditUpdate(
				current, update), previous, update.path);
			assert.equal(beforeConsumerNixSourceClosureAuditSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("Nix source-closure audit covers every Nix job and bounded payload rule"
	, async () => {
		const history = await record();
		assert.equal(history.jobs.totalNix, 18);
		assert.equal(history.jobs.generalMetadataClosures.length, 16);
		assert.deepEqual(history.jobs.dedicatedClosures
			, ["docker-engine", "nix-cache"]);
		assert.equal(new Set([
			...history.jobs.generalMetadataClosures
			, ...history.jobs.dedicatedClosures
		]).size, history.jobs.totalNix);
		assert.deepEqual(history.checkout, {
			coneMode: false, missingBlobFloor: 1000
			, gitKiBCeiling: 2097152, sourceKiBCeiling: 2097152
			, evidenceMetadataKiBCeiling: 1572864
			, evidenceRootFormats: ["json", "md", "xml"]
			, retainedArchiveFile: "index.json"
			, excluded: "all other docs/evidence descendants"
		});
	}
);

test("Nix source-closure audit refreshes only 92 workflow citations"
	, async () => {
		const history = await record();
		assert.equal(history.refreshedCitationCount, 92);
		assert.equal(history.semanticChanges, 0);
		assert.deepEqual(history.currentSourcePins.map(item => ({
			path: item.path, count: item.count
		})), [{
			path: ".github/workflows/consumer-matrix.yml", count: 92
		}]);
		let restored = git(["show"
			, consumerNixSourceClosureAuditImplementation
				+ ":docs/type-surface.v1.json"]);
		for(const pin of history.currentSourcePins)
		{
			assert.equal(restored.split(pin.current).length - 1, pin.count);
			restored = restored.replaceAll(pin.current, pin.previous);
		}
		assert.equal(restored, git(["show"
			, consumerNixSourceClosureAuditPredecessor
				+ ":docs/type-surface.v1.json"]));
	}
);

test("Nix source-closure audit authenticates every addition and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.implementationAdditions.map(item => item.path)
			, consumerNixSourceClosureAuditImplementationAdditions);
		for(const addition of history.implementationAdditions)
			assert.equal(sha256(git(["show"
				, consumerNixSourceClosureAuditImplementation + ":" + addition.path]))
				, addition.sha256, addition.path);
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, consumerNixSourceClosureAuditHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, consumerNixSourceClosureAuditImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseConsumerNixSourceClosureAuditUpdate(current, forged));
	}
);

test("Nix source-closure history writer refuses another record", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-consumer-nix-source-closure-audit-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /consumer-nix-source-closure-audit-source-history-20261031\.json/u);
});
