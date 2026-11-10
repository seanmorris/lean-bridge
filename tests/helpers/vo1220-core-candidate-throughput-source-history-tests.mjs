/**
 * Authenticate the Core candidate throughput repair for VO #1220.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	collectCoreContractTestPaths, coreContractCosts, coreContractShardLabels
	, planCostBalancedShards
} from "../../scripts/core-contract-shards.mjs";
import { classifyRepositoryTest } from "../../src/adoption/test-profiles.mjs";
import { typeSurfaceEvidenceFiles }
	from "../../src/adoption/type-surface-evidence-receipt.mjs";
import {
	beforeVo1220CoreCandidateThroughputSource
	, reverseVo1220CoreCandidateThroughputUpdate
	, vo1220CoreCandidateThroughputCommits
	, vo1220CoreCandidateThroughputHistoryAdditions
	, vo1220CoreCandidateThroughputHistoryPath
	, vo1220CoreCandidateThroughputImplementation
	, vo1220CoreCandidateThroughputImplementationAdditions
	, vo1220CoreCandidateThroughputImplementationPaths
	, vo1220CoreCandidateThroughputIntegrationPaths
	, vo1220CoreCandidateThroughputPredecessor
} from "./vo1220-core-candidate-throughput-source-history.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const history = async () => JSON.parse(await readFile(
	vo1220CoreCandidateThroughputHistoryPath, "utf8"));
const implementationSource = path => git(["show"
	, `${vo1220CoreCandidateThroughputImplementation}:${path}`]);
const implementationCostManifest = () => JSON.parse(implementationSource(
	"scripts/core-contract-costs.json"));

test("Core candidate throughput records its exact six-commit boundary"
	, async () => {
		const record = await history();
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "vo1220-core-candidate-throughput-source-v1");
		assert.equal(record.predecessorCommit
			, vo1220CoreCandidateThroughputPredecessor);
		assert.equal(record.implementationCommit
			, vo1220CoreCandidateThroughputImplementation);
		assert.deepEqual(record.implementationCommits
			, vo1220CoreCandidateThroughputCommits);
		assert.deepEqual(record.updates.map(item => item.path)
			, vo1220CoreCandidateThroughputImplementationPaths);
		assert.deepEqual(record.implementationAdditions.map(item => item.path)
			, vo1220CoreCandidateThroughputImplementationAdditions);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, vo1220CoreCandidateThroughputIntegrationPaths);
		assert.deepEqual(record.behavior, {
			modifiedFiles: 11, addedFiles: 4, splitRoots: 4
			, priorRoots: 1120, currentRoots: 1123, refreshedPins: 133
			, changedSupportCells: 0, runtimeSemanticChanges: 0
			, maxParallel: 12
		});
	}
);

test("Core candidate throughput reverses every authenticated source"
	, async () => {
		const record = await history();
		for(const update of record.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				vo1220CoreCandidateThroughputImplementation, update.path), update)
				, true, update.path);
		for(const update of record.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = implementationSource(update.path);
			assert.equal(reverseVo1220CoreCandidateThroughputUpdate(
				current, update), previous, update.path);
			assert.equal(beforeVo1220CoreCandidateThroughputSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("Core candidate throughput authenticates additions and source pins"
	, async () => {
		const record = await history();
		for(const addition of record.implementationAdditions)
			assert.equal(sha256(implementationSource(addition.path))
				, addition.sha256, addition.path);
		assert.deepEqual(record.historyAdditions.map(item => item.path)
			, vo1220CoreCandidateThroughputHistoryAdditions);
		for(const addition of record.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		assert.deepEqual(record.pinTransitions.map(item => ({
			path: item.path, count: item.count
		})), [
			{ path: ".github/workflows/quality.yml", count: 1 }
			, { path: "src/adoption/test-profiles.mjs", count: 98 }
			, { path: "tests/fin-scalar-dispatch-inventory.test.mjs", count: 12 }
			, { path: "tests/helpers/fin-scalar-dispatch-inventory.mjs", count: 12 }
			, { path: "tests/helpers/hosted-container-inventory.mjs", count: 4 }
			, { path: "tests/helpers/perl-scalar-promotion.mjs", count: 2 }
			, { path: "tests/perl-relocated-promotion.test.mjs", count: 4 }
		]);
		assert.equal(record.pinTransitions.reduce(
			(sum, item) => sum + item.count, 0), 133);
		assert.deepEqual(record.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("Core candidate throughput closes and balances all 1,123 roots"
	, async () => {
		const paths = await collectCoreContractTestPaths();
		assert.equal(paths.length, 1123);
		// Authenticate the cost model sealed by this milestone, not whichever
		// newer measurements happen to be live in the current checkout.
		const costManifest = implementationCostManifest();
		const plan = planCostBalancedShards(
			coreContractCosts(paths, costManifest), coreContractShardLabels.length);
		const loads = plan.map(item => item.centiminutes / 100);
		assert.equal(plan.length, 12);
		assert.ok(Math.max(...loads) - Math.min(...loads) < 0.02);
		assert.equal(Object.values(costManifest.costs)
			.filter(item => item.measured).length, 337);
		assert.equal(Object.values(costManifest.costs)
			.filter(item => !item.measured).length, 786);
		for(const path of [
			"tests/component-refinement-mirrors.test.mjs"
			, "tests/component-nominal-subtype.test.mjs"
			, "tests/component-nominal-subtype-history.test.mjs"
			, "tests/nominal-primitive-subtype.test.mjs"
		]) assert.equal(classifyRepositoryTest(path), "contract", path);
		const workflow = implementationSource(".github/workflows/quality.yml");
		assert.match(workflow, /max-parallel: 12/u);
		assert.match(workflow
			, /shard: \[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12\]/u);
		assert.deepEqual((await history()).costModel, {
			kind: "core-contract-costs", partition: "cost-balanced-lpt-v1"
			, roots: 1123, shards: 12, measuredRoots: 337, floorRoots: 786
			, minimumLoadMinutes: Math.min(...loads)
			, maximumLoadMinutes: Math.max(...loads)
			, provenance: costManifest.provenance
		});
	}
);

test("Core candidate throughput retains bounded exact-revision reads", async () => {
	const reader = implementationSource(
		"tests/helpers/source-at-fin-history-milestone.mjs");
	const replay = implementationSource(
		"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs");
	assert.match(reader, /"cat-file", "--batch"/u);
	assert.match(reader, /core\.deltaBaseCacheLimit=512m/u);
	assert.match(reader, /export const sourceAtFinHistoryRevision = async/u);
	assert.match(reader, /export const sourceAtFinHistoryRecordSource = async/u);
	assert.match(replay, /sourceAtFinHistoryRevision/u);
	assert.match(replay, /sourceAtFinHistoryRecordSource/u);
	const record = await history();
	assert.deepEqual(record.measurements.componentArrayHistoryPartition03, {
		recordedCostMinutes: 82.62, optimizedDurationMs: 1129342.603212
		, tests: 159, passed: 159, failed: 0
	});
	assert.deepEqual(record.measurements.hostedWallModel, {
		beforeMinutes: 357, afterMinutes: 140, savedMinutes: 217
		, savedPercent: 60.78431372549019
	});
});

test("Core candidate throughput leaves every current source pin exact"
	, async () => {
		const document = JSON.parse(await readFile(
			"docs/type-surface.v1.json", "utf8"));
		const files = typeSurfaceEvidenceFiles(document).filter(file =>
			!file.path.startsWith("docs/evidence/"));
		const mismatches = [];
		for(let offset = 0; offset < files.length; offset += 32)
		{
			const batch = files.slice(offset, offset + 32);
			const actual = await Promise.all(batch.map(async file =>
				createHash("sha256").update(await readFile(file.path)).digest("hex")));
			for(const [index, file] of batch.entries())
				if(actual[index] !== file.sha256)
					mismatches.push({ path: file.path, expected: file.sha256
						, actual: actual[index] });
		}
		assert.equal(files.length, 2661);
		assert.deepEqual(mismatches, []);
	}
);

test("Core candidate throughput rejects forgeries and another writer"
	, async () => {
		const record = await history();
		const update = record.updates.find(item => item.edits.length > 0);
		const current = implementationSource(update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseVo1220CoreCandidateThroughputUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-vo1220-core-candidate-throughput-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(`${copy.stdout}${copy.stderr}`
			, /already exists|implementation/u);
	}
);
