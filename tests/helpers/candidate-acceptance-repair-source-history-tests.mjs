/**
 * Verify the complete candidate repair, pin refresh and history integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	assertCandidateAcceptanceRepair
	, beforeCandidateAcceptanceRepairSource
	, candidateAcceptanceRepairBehavior
	, candidateAcceptanceRepairHistoryAdditions
	, candidateAcceptanceRepairHistoryPath
	, candidateAcceptanceRepairImplementation
	, candidateAcceptanceRepairImplementationPaths
	, candidateAcceptanceRepairIntegrationPaths
	, candidateAcceptanceRepairPredecessor
	, reverseCandidateAcceptanceRepairUpdate
} from "./candidate-acceptance-repair-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	candidateAcceptanceRepairHistoryPath, "utf8"
));

test("candidate acceptance repair authenticates its complete lineage and hub", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "candidate-acceptance-repair-source-v1");
	assert.equal(record.predecessorCommit, candidateAcceptanceRepairPredecessor);
	assert.equal(record.implementationCommit
		, candidateAcceptanceRepairImplementation);
	assert.deepEqual(record.implementationCommits, git([
		"rev-list", "--reverse"
		, `${candidateAcceptanceRepairPredecessor}..${candidateAcceptanceRepairImplementation}`
	]).trim().split("\n"));
	for(const [index, revision] of record.implementationCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? candidateAcceptanceRepairPredecessor
				: record.implementationCommits[index - 1]);
	assert.deepEqual(record.updates.map(update => update.path)
		, candidateAcceptanceRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, candidateAcceptanceRepairIntegrationPaths);
	assert.deepEqual(record.historyAdditions.map(addition => addition.path)
		, candidateAcceptanceRepairHistoryAdditions);
	for(const update of record.updates)
	{
		const current = blob(candidateAcceptanceRepairImplementation, update.path);
		const previous = blob(candidateAcceptanceRepairPredecessor, update.path);
		assert.equal(reverseCandidateAcceptanceRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCandidateAcceptanceRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(candidateAcceptanceRepairImplementation, update.path);
		assert.equal(reverseCandidateAcceptanceRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256
			, addition.path);
});

test("candidate acceptance repair preserves the exact model and refreshes only 165 live pins", async () => {
	const record = await read();
	assert.deepEqual(record.behavior, candidateAcceptanceRepairBehavior);
	assert.equal(record.changedSupportCells, 0);
	assert.equal(record.runtimeSemanticChanges, 1);
	const sources = Object.fromEntries(
		candidateAcceptanceRepairImplementationPaths.map(path => [
			path, blob(candidateAcceptanceRepairImplementation, path)
		])
	);
	assert.deepEqual(assertCandidateAcceptanceRepair(sources)
		, candidateAcceptanceRepairBehavior);
	const exactPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
	const previousExact = blob(candidateAcceptanceRepairPredecessor, exactPath);
	const currentExact = blob(candidateAcceptanceRepairImplementation, exactPath);
	assert.equal(currentExact, previousExact);
	assert.equal(record.exactModel.sha256, sha256(currentExact));
	const previous = JSON.parse(blob(
		candidateAcceptanceRepairImplementation, "docs/type-surface.v1.json"
	));
	const currentSource = await sourceAtFinHistoryMilestone(
		"docs/type-surface.v1.json", record.inventorySha256.after);
	const current = JSON.parse(currentSource);
	assert.equal(record.inventorySha256.before, sha256(
		blob(candidateAcceptanceRepairImplementation, "docs/type-surface.v1.json")
	));
	assert.equal(record.inventorySha256.after, sha256(currentSource));
	const pins = new Map(record.currentSourcePins.map(pin => [pin.path, pin]));
	assert.equal(pins.size, candidateAcceptanceRepairBehavior.currentSourcePaths);
	assert.equal(record.currentSourcePins.reduce((sum, pin) => sum + pin.count, 0)
		, candidateAcceptanceRepairBehavior.refreshedPins);
	const counts = new Map();
	for(const evidence of current.evidence)
		for(const file of evidence.files)
		{
			const pin = pins.get(file.path);
			if(pin === undefined) continue;
			assert.equal(file.sha256, pin.current, file.path);
			file.sha256 = pin.previous;
			counts.set(file.path, (counts.get(file.path) ?? 0) + 1);
		}
	assert.deepEqual(current, previous
		, "Only the exact named current-source pins may change");
	for(const pin of pins.values())
	{
		assert.equal(counts.get(pin.path), pin.count, pin.path);
		assert.equal(pin.current, sha256(blob(
			candidateAcceptanceRepairImplementation, pin.path)), pin.path);
		assert.equal(pin.previous, sha256(blob(
			candidateAcceptanceRepairPredecessor, pin.path)), pin.path);
	}
});

test("candidate acceptance repair rejects unknown and forged transitions", async () => {
	const update = (await read()).updates[0];
	const current = blob(candidateAcceptanceRepairImplementation, update.path);
	assert.equal(beforeCandidateAcceptanceRepairSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeCandidateAcceptanceRepairSource(update.path, unknown)
		, unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }
		, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseCandidateAcceptanceRepairUpdate(
			current, forged));
	assert.equal(beforeCandidateAcceptanceRepairSource(
		"unrelated.mjs", current), current);
});

test("candidate acceptance repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-candidate-acceptance-guard-"
	));
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
		"scripts/update-candidate-acceptance-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /candidateAcceptanceRepairImplementation|Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
