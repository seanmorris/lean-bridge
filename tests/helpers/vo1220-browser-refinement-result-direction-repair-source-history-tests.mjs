/**
 * Verify the browser-refinement result-direction repair and source-history seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	assertVo1220BrowserRefinementResultDirectionRepair
	, beforeVo1220BrowserRefinementResultDirectionRepairSource
	, reverseVo1220BrowserRefinementResultDirectionRepairUpdate
	, vo1220BrowserRefinementResultDirectionRepairBehavior
	, vo1220BrowserRefinementResultDirectionRepairHistoryAdditions
	, vo1220BrowserRefinementResultDirectionRepairHistoryPath
	, vo1220BrowserRefinementResultDirectionRepairImplementation
	, vo1220BrowserRefinementResultDirectionRepairImplementationPaths
	, vo1220BrowserRefinementResultDirectionRepairIntegrationPaths
	, vo1220BrowserRefinementResultDirectionRepairNormalizationPaths
	, vo1220BrowserRefinementResultDirectionRepairPredecessor
} from "./vo1220-browser-refinement-result-direction-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220BrowserRefinementResultDirectionRepairHistoryPath, "utf8"
));

test("browser-refinement result-direction repair authenticates every transition"
	, async () => {
		const record = await read();
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "vo1220-browser-refinement-result-direction-repair-source-v1");
		assert.equal(record.predecessorCommit
			, vo1220BrowserRefinementResultDirectionRepairPredecessor);
		assert.equal(record.implementationCommit
			, vo1220BrowserRefinementResultDirectionRepairImplementation);
		assert.deepEqual(record.updates.map(update => update.path)
			, vo1220BrowserRefinementResultDirectionRepairImplementationPaths);
		assert.deepEqual(record.integrationUpdates.map(update => update.path)
			, vo1220BrowserRefinementResultDirectionRepairIntegrationPaths);
		assert.deepEqual(record.historyAdditions.map(addition => addition.path)
			, vo1220BrowserRefinementResultDirectionRepairHistoryAdditions);
		for(const addition of record.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		for(const update of record.updates)
		{
			const current = blob(
				vo1220BrowserRefinementResultDirectionRepairImplementation, update.path);
			const previous = blob(
				vo1220BrowserRefinementResultDirectionRepairPredecessor, update.path);
			assert.equal(reverseVo1220BrowserRefinementResultDirectionRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const update of record.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = blob(
				vo1220BrowserRefinementResultDirectionRepairImplementation, update.path);
			assert.equal(reverseVo1220BrowserRefinementResultDirectionRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("browser-refinement repair changes no support or runtime semantics"
	, async () => {
		const record = await read();
		assert.deepEqual(record.behavior
			, vo1220BrowserRefinementResultDirectionRepairBehavior);
		assert.equal(record.changedSupportCells, 0);
		assert.equal(record.runtimeSemanticChanges, 0);
		const sources = Object.fromEntries(
			vo1220BrowserRefinementResultDirectionRepairImplementationPaths.map(
				path => [
					path
					, blob(vo1220BrowserRefinementResultDirectionRepairImplementation
						, path)
				]
			)
		);
		assert.deepEqual(assertVo1220BrowserRefinementResultDirectionRepair(sources)
			, vo1220BrowserRefinementResultDirectionRepairBehavior);
		const exactPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
		const previousExact = blob(
			vo1220BrowserRefinementResultDirectionRepairPredecessor, exactPath);
		const currentExact = blob(
			vo1220BrowserRefinementResultDirectionRepairImplementation, exactPath);
		assert.equal(currentExact, previousExact);
		assert.equal(record.exactModel.sha256, sha256(currentExact));
		const before = JSON.parse(blob(
			vo1220BrowserRefinementResultDirectionRepairImplementation
			, "docs/type-surface.v1.json"));
		const afterSource = await sourceAtFinHistoryMilestone(
			"docs/type-surface.v1.json", record.inventorySha256.after);
		const after = JSON.parse(afterSource);
		assert.deepEqual(record.currentSourcePins, [{
			path: "tests/helpers/browser-refinement-packages.mjs", count: 1
			, previous: record.currentSourcePins[0].previous
			, current: record.currentSourcePins[0].current
		}]);
		const pin = record.currentSourcePins[0];
		for(const evidence of after.evidence) for(const file of evidence.files)
			if(file.path === pin.path) file.sha256 = pin.previous;
		assert.deepEqual(after, before, "Only the named current-source pin may change");
	}
);

test("browser-refinement repair rejects unknown and forged transitions"
	, async () => {
		const update = (await read()).updates[0];
		const current = blob(
			vo1220BrowserRefinementResultDirectionRepairImplementation, update.path);
		assert.equal(beforeVo1220BrowserRefinementResultDirectionRepairSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeVo1220BrowserRefinementResultDirectionRepairSource(
			update.path, current + "unknown"), current + "unknown");
		for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
			assert.throws(() =>
				reverseVo1220BrowserRefinementResultDirectionRepairUpdate(
					current, forged));
		assert.ok(vo1220BrowserRefinementResultDirectionRepairNormalizationPaths
			.includes(update.path));
	}
);

test("browser-refinement repair writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-browser-direction-guard-`);
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-browser-refinement-result-direction-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
