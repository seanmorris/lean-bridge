/**
 * Test the hosted inherited checked-record JVM evidence boundary. Before all
 * revisions and the index are pinned, every acceptance claim must refuse.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkInheritedCheckedRecordJvmEvidence
	, inheritedCheckedRecordJvmEvidence
	, inheritedCheckedRecordJvmEvidenceSha256
} from "./inherited-checked-record-jvm-evidence.mjs";
import {
	inheritedCheckedRecordJvmArchiver
	, inheritedCheckedRecordJvmChecker
	, inheritedCheckedRecordJvmPinnedRevisions
	, inheritedCheckedRecordJvmProducer
} from "./inherited-checked-record-jvm-provenance.mjs";

const revisions = [
	inheritedCheckedRecordJvmProducer, inheritedCheckedRecordJvmChecker
	, inheritedCheckedRecordJvmArchiver
];
const pinned = revisions.every(revision => revision !== null)
	&& inheritedCheckedRecordJvmEvidenceSha256 !== null;
const script = "scripts/archive-inherited-checked-record-jvm-evidence.mjs";

test("inherited checked-record JVM evidence fails closed until every pin exists", {
	skip: pinned && "Pinned hosted archive is authenticated below"
}, async () => {
	assert.throws(() => inheritedCheckedRecordJvmPinnedRevisions()
		, /Pin the inherited checked-record JVM/u);
	await assert.rejects(checkInheritedCheckedRecordJvmEvidence()
		, /Pin the inherited checked-record JVM/u);
	await assert.rejects(access(inheritedCheckedRecordJvmEvidence)
		, { code: "ENOENT" });
	for(const args of [
		[], ["--root", "relative"], ["--root", "/absolute"]
		, ["--root", "/absolute", "--producer", "HEAD"
			, "--checker", "a".repeat(40), "--run-id", "1"
			, "--artifact-id", "1", "--artifact-name", "invalid"
			, "--artifact-bytes", "1"]
	]) {
		const run = spawnSync(process.execPath, [script, ...args], {
			encoding: "utf8", env: { PATH: process.env.PATH }
		});
		assert.notEqual(run.status, 0);
		assert.match(run.stderr
			, /Usage: archive-inherited-checked-record-jvm-evidence/u);
	}
});

test("inherited checked-record JVM evidence authenticates every hosted selection", {
	skip: !pinned && "Runs once hosted revisions and the archive index are pinned"
	, timeout: 900_000
}, async () => {
	const checked = await checkInheritedCheckedRecordJvmEvidence();
	assert.equal(checked.selections.length, 4);
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.controls, "representative");
	assert.ok(checked.files.length > 100);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["reviewed", "full"]
		, ["ordinary", "result-only"], ["reviewed", "result-only"]
	]);
	for(const selection of checked.selections)
	{
		const full = selection.mode === "full";
		assert.deepEqual({
			checks: selection.checks, rejections: selection.rejections
			, recoveries: selection.recoveries, snapshots: selection.snapshots
			, snapshotControls: selection.snapshotControls
		}, full ? {
			checks: 43224, rejections: 7716, recoveries: 1536
			, snapshots: 20052, snapshotControls: 48
		} : {
			checks: 9276, rejections: 0, recoveries: 0
			, snapshots: 3084, snapshotControls: 36
		});
		assert.equal(selection.executions, 6);
	}
	for(const target of [
		"index.json", "ordinary-full/run.tap"
		, "reviewed-full/records/report.json"
		, "ordinary-result-only/verification.json"
		, "reviewed-result-only/controls.json"
		, "sources/archiver/scripts/archive-inherited-checked-record-jvm-evidence.mjs"
		, "ordinary-full/records/handoff/archives/inheritedcheckedrecords-1.0.0.jar"
	]) await assert.rejects(checkInheritedCheckedRecordJvmEvidence(
		async path => {
			const bytes = await readFile(path);
			return path === `${inheritedCheckedRecordJvmEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}, { controls: "none" }
	), undefined, target);
	await assert.rejects(checkInheritedCheckedRecordJvmEvidence(
		path => path.endsWith("ordinary-full/records/report.json")
			? Promise.reject(new Error("missing retained report"))
			: readFile(path)
		, { controls: "none" }
	));
});
