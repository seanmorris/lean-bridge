/**
 * Authenticate the Core aggregate and native-PHP history-input repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { typeSurfaceEvidenceFiles }
	from "../../src/adoption/type-surface-evidence-receipt.mjs";
import {
	authenticateCorePhpCiInputs
	, beforeCorePhpCiInputRepairSource
	, corePhpCiInputRepairHistoryAdditions
	, corePhpCiInputRepairHistoryPath
	, corePhpCiInputRepairImplementation
	, corePhpCiInputRepairImplementationPaths
	, corePhpCiInputRepairIntegrationPaths
	, corePhpCiInputRepairPredecessor
	, reverseCorePhpCiInputRepairUpdate
} from "./core-php-ci-input-repair-source-history.mjs";
import { beforeFinRefinementSource }
	from "./fin-refinement-source-history.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	corePhpCiInputRepairHistoryPath, "utf8"));

test("Core/PHP CI input repair records both exact failed jobs", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "core-php-ci-input-repair-source-v1");
	assert.equal(history.predecessorCommit, corePhpCiInputRepairPredecessor);
	assert.equal(history.implementationCommit
		, corePhpCiInputRepairImplementation);
	assert.deepEqual(history.failedRuns, [
		{ workflow: 41181273663, job: 124497352329
			, step: "Authenticate the complete contract partition" }
		, { workflow: 41181254244, job: 124481867574
			, step: "Verify frozen native PHP callback acceptance" }
	]);
	assert.deepEqual(history.updates.map(item => item.path)
		, corePhpCiInputRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, corePhpCiInputRepairIntegrationPaths);
});

test("Core/PHP CI input repair reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
	{
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			corePhpCiInputRepairImplementation, update.path), update)
		, true, update.path);
		const current = git(["show"
			, corePhpCiInputRepairImplementation + ":" + update.path]);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), git(["show"
			, corePhpCiInputRepairPredecessor + ":" + update.path]));
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, corePhpCiInputRepairImplementation + ":" + update.path]);
		assert.equal(reverseCorePhpCiInputRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCorePhpCiInputRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("Core/PHP CI inputs preserve archive roots and full history", async () => {
	const consumer = await readFile(
		".github/workflows/consumer-matrix.yml", "utf8");
	const quality = await readFile(".github/workflows/quality.yml", "utf8");
	assert.deepEqual(authenticateCorePhpCiInputs(consumer, quality), {
		phpHistoryDepth: 0, coreArtifactCommonRoot: "build"
		, coreDownloadTarget: "build"
		, coreCheckerTarget: "build/core-shards"
	});
	const phpStart = consumer.indexOf("  owned-php-callback-results:\n");
	const phpDepth = consumer.indexOf("fetch-depth: 0", phpStart);
	assert.notEqual(phpStart, -1);
	assert.notEqual(phpDepth, -1);
	const shallow = consumer.slice(0, phpDepth) + "fetch-depth: 1"
		+ consumer.slice(phpDepth + "fetch-depth: 0".length);
	assert.throws(() => authenticateCorePhpCiInputs(shallow, quality));
	assert.throws(() => authenticateCorePhpCiInputs(consumer
		, quality.replace("          path: build\n          merge-multiple: true"
			, "          path: build/core-shards\n          merge-multiple: true")));
});

test("native PHP frozen evidence resolves every historical input", () => {
	for(const item of [
		["e5f7ae3dbc9ee8e85a5fd65a4fb68743aeccb0ed"
			, "tests/helpers/owned-php-callback-result-runtime-sources.mjs"]
		, ["ad185d927673df87d1e40112ed9ccb41e299dfe3"
			, "docs/type-surface.v1.json"]
		, ["fa51434d712136f38b6b0f88d9361494a32eda3a"
			, "docs/evidence/owned-perl-callback-result-variants-20261003.json"]
	]) assert.doesNotThrow(() => git(["cat-file", "-e"
		, item[0] + ":" + item[1]]));
});

test("Core/PHP CI input repair refreshes all 93 live citations"
	, async () => {
		const history = await record();
		assert.equal(history.liveSourcePins, 93);
		assert.deepEqual(history.currentSourcePins.map(pin => [pin.path, pin.count])
			, [[".github/workflows/consumer-matrix.yml", 92]
				, [".github/workflows/quality.yml", 1]]);
		const document = JSON.parse(await readFile(
			"docs/type-surface.v1.json", "utf8"));
		const citations = document.evidence.flatMap(evidence => evidence.files);
		for(const pin of history.currentSourcePins)
		{
			const matches = citations.filter(file => file.path === pin.path);
			assert.equal(matches.length, pin.count, pin.path);
			assert.deepEqual([...new Set(matches.map(file => file.sha256))]
				, [pin.current], pin.path);
		}
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("Core/PHP CI input repair leaves every live source pin current"
	, async () => {
		const document = JSON.parse(await readFile(
			"docs/type-surface.v1.json", "utf8"));
		const files = typeSurfaceEvidenceFiles(document).filter(file =>
			!file.path.startsWith("docs/evidence/"));
		const mismatches = [];
		for(let offset = 0; offset < files.length; offset += 16)
		{
			const batch = files.slice(offset, offset + 16);
			const actual = await Promise.all(batch.map(async file => {
				try
				{
					return createHash("sha256").update(
						await readFile(file.path)).digest("hex");
				}
				catch(error)
				{ return `missing:${error.code}`; }
			}));
			for(const [index, file] of batch.entries())
				if(actual[index] !== file.sha256)
					mismatches.push({ path: file.path
						, actual: actual[index], expected: file.sha256 });
		}
		assert.equal(files.length, 2661);
		assert.deepEqual(mismatches, []);
	}
);

test("Core/PHP CI input repair authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, corePhpCiInputRepairHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, corePhpCiInputRepairImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseCorePhpCiInputRepairUpdate(current, forged));
	}
);

test("Core/PHP CI input repair writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-core-php-ci-input-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /core-php-ci-input-repair-source-history-20261031\.json/u);
});
