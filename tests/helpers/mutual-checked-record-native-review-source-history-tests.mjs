/**
 * Preserve and exercise independent-review corrections for recursive native
 * checked-record evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	assertMutualCheckedRecordNativeCurrentReplay
} from "./mutual-checked-record-native-controls.mjs";
import {
	mutualCheckedRecordNativeReviewAddedPaths
	, mutualCheckedRecordNativeReviewChangedPaths
	, mutualCheckedRecordNativeReviewDraftParent
	, mutualCheckedRecordNativeReviewHistoryPath
	, mutualCheckedRecordNativeReviewPredecessor
	, reverseMutualCheckedRecordNativeReviewUpdate
} from "./mutual-checked-record-native-review-source-history.mjs";
import {
	checkMutualCheckedRecordNativeHistoricalControls
} from "./mutual-checked-record-native-report.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});

test("recursive native review corrections have one exact reversible lineage"
	, async () => {
		const record = JSON.parse(await readFile(
			mutualCheckedRecordNativeReviewHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "mutual-checked-record-native-review-source-v1");
		assert.equal(record.predecessorCommit
			, mutualCheckedRecordNativeReviewPredecessor);
		assert.equal(record.draftParentCommit
			, mutualCheckedRecordNativeReviewDraftParent);
		assert.deepEqual(record.updates.map(update => update.path)
			, mutualCheckedRecordNativeReviewChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, mutualCheckedRecordNativeReviewAddedPaths);
		assert.equal(record.pathsSha256, sha256(JSON.stringify(
			mutualCheckedRecordNativeReviewChangedPaths)));
		assert.equal(record.pinCount, 0);
		assert.deepEqual(record.pinUpdates, []);
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${mutualCheckedRecordNativeReviewPredecessor}:${update.path}`]);
			assert.equal(sha256(current), update.currentSha256, update.path);
			assert.equal(sha256(previous), update.previousSha256, update.path);
			assert.equal(reverseMutualCheckedRecordNativeReviewUpdate(
				current, update), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			for(const mutate of [
				item => { item.path = "unknown"; }
				, item => { item.previousSha256 = "0".repeat(64); }
				, item => { item.currentSha256 = "0".repeat(64); }
				, item => { item.edits = []; }
				, item => { item.edits[0].start = -1; }
				, item => { item.edits[0].current += "unknown"; }
			]) {
				const changed = structuredClone(update);
				mutate(changed);
				assert.throws(() => reverseMutualCheckedRecordNativeReviewUpdate(
					current, changed));
			}
		}
	}
);

test("recursive native review corrections authenticate every added source"
	, async () => {
		const record = JSON.parse(await readFile(
			mutualCheckedRecordNativeReviewHistoryPath, "utf8"));
		for(const addition of record.additions)
		{
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256))
				, addition.currentSha256, addition.path);
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${mutualCheckedRecordNativeReviewPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		}
	}
);

test("recursive native current replay permits stronger controls only", () => {
	const archived = {
		route: "ordinary", producerCommit: "a".repeat(40)
		, runtime: { platform: "linux", arch: "x64", glibc: "2.39" }
		, floor: "2.38", reportSha256: "b".repeat(64)
		, bindingIrSha256: "c".repeat(64), recordPaths: ["report.json"]
		, independentBuilds: 2, profiles: [{ profile: "c", checks: 1 }]
		, artifacts: [{ profile: "c", path: "component.tar.gz" }]
		, controls: { record: 1, report: 2 }
	};
	const stronger = structuredClone(archived);
	stronger.controls.record++;
	stronger.controls.newClass = 1;
	stronger.newSummary = true;
	assertMutualCheckedRecordNativeCurrentReplay(archived, stronger);
	for(const change of [
		value => { value.route = "reviewed"; }
		, value => { value.controls.record = 0; }
		, value => { delete value.controls.report; }
	]) {
		const changed = structuredClone(stronger);
		change(changed);
		assert.throws(() => assertMutualCheckedRecordNativeCurrentReplay(
			archived, changed));
	}
});

test("recursive native historical controls load the producer closure", async () => {
	const expected = new Error("historical controls reader sentinel");
	await assert.rejects(checkMutualCheckedRecordNativeHistoricalControls(
		async () => { throw expected; }, {
			route: "ordinary"
			, producerCommit: mutualCheckedRecordNativeReviewPredecessor
			, runtime: { platform: "linux", arch: "x64", glibc: "2.39" }
			, floor: "2.38"
		}
	), error => error === expected);
});

test("recursive native review corrections close all seven findings", async () => {
	const report = await readFile(
		"tests/helpers/mutual-checked-record-native-report.mjs", "utf8");
	assert.match(report, /assert\.equal\(item\.mode, 0o100644/u);
	assert.match(report, /author-inputs-after\.json/u);
	assert.match(report, /Missing native record/u);
	assert.match(report, /checkMutualCheckedRecordNativeHistoricalControls/u);
	const installed = await readFile(
		"tests/helpers/mutual-checked-record-native-installed-tests.mjs", "utf8");
	assert.match(installed, /isDeepStrictEqual/u);
	assert.match(installed, /authorInputsUnchanged &&= unchanged/u);
	assert.doesNotMatch(installed, /authorInputsUnchanged: true/u);
	const controls = await readFile(
		"tests/helpers/mutual-checked-record-native-controls.mjs", "utf8");
	assert.match(controls, /Missing native record: configuration/u);
	assert.match(controls, /include\\\/mutualcheckedrecords\\\.h/u);
	const evidence = await readFile(
		"tests/helpers/mutual-checked-record-native-evidence.mjs", "utf8");
	for(const source of [
		"mutual-checked-record-fixture.mjs"
		, "mutual-checked-record-native-controls.mjs"
		, "src/backends/c/generate.mjs", "src/backends/c/gmp-projection.mjs"
		, "src/backends/cpp/generate.mjs", "src/backends/cpp/boost.mjs"
		, "assertMutualCheckedRecordNativeCiTap"
	]) assert.ok(evidence.includes(source), source);
	const archive = await readFile(
		"scripts/archive-mutual-checked-record-native.mjs", "utf8");
	assert.match(archive, /"\/usr\/bin\/unzip"/u);
	assert.match(archive, /canonicalJson\(archived\)/u);
});

test("recursive native review history writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-recursive-native-review-guard-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const environment = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const localGit = args => execFileSync("git", args, {
			cwd: root, env: environment, stdio: "pipe"
		});
		localGit(["init", "--quiet"]);
		localGit(["-c", "user.name=Test", "-c"
			, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
			, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-mutual-checked-record-native-review-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /must stay on its exact draft parent/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
