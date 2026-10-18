/**
 * Test the hosted inherited checked-record Python evidence boundary. Before all
 * revisions and the index are pinned, every acceptance claim must refuse.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkInheritedCheckedRecordPythonEvidence
	, inheritedCheckedRecordPythonEvidence
	, inheritedCheckedRecordPythonEvidenceSha256
} from "./inherited-checked-record-python-evidence.mjs";
import {
	inheritedCheckedRecordPythonArchiver
	, inheritedCheckedRecordPythonChecker
	, inheritedCheckedRecordPythonPinnedRevisions
	, inheritedCheckedRecordPythonProducer
} from "./inherited-checked-record-python-provenance.mjs";

const revisions = [
	inheritedCheckedRecordPythonProducer, inheritedCheckedRecordPythonChecker
	, inheritedCheckedRecordPythonArchiver
];
const pinned = revisions.every(revision => revision !== null)
	&& inheritedCheckedRecordPythonEvidenceSha256 !== null;
const script = "scripts/archive-inherited-checked-record-python-evidence.mjs";

test("inherited checked-record Python evidence fails closed until every pin exists", {
	skip: pinned && "Pinned hosted archive is authenticated below"
}, async () => {
	assert.throws(() => inheritedCheckedRecordPythonPinnedRevisions()
		, /Pin the inherited checked-record Python/u);
	await assert.rejects(checkInheritedCheckedRecordPythonEvidence()
		, /Pin the inherited checked-record Python/u);
	await assert.rejects(access(inheritedCheckedRecordPythonEvidence)
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
			, /Usage: archive-inherited-checked-record-python-evidence/u);
	}
});

test("inherited checked-record Python evidence authenticates every hosted selection", {
	skip: !pinned && "Runs once hosted revisions and the archive index are pinned"
	, timeout: 900_000
}, async () => {
	const checked = await checkInheritedCheckedRecordPythonEvidence();
	assert.equal(checked.selections.length, 4);
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.controls, "representative");
	assert.deepEqual(checked.interpreters.map(item => item.minor), [
		"3.11", "3.12"
	]);
	assert.ok(checked.files.length > 100);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["reviewed", "full"]
		, ["ordinary", "result-only"], ["reviewed", "result-only"]
	]);
	for(const selection of checked.selections)
	{
		const full = selection.mode === "full";
		assert.deepEqual(selection.counts, full ? {
			checks: 7240, rejections: 1288, hostRejections: 7
			, calls: 3355, recoveries: 256, snapshots: 3355
			, snapshotControls: 8, rounds: 256
		} : {
			checks: 1570, rejections: 0, hostRejections: 4
			, calls: 522, recoveries: 0, snapshots: 522
			, snapshotControls: 6, rounds: 256
		});
		assert.equal(selection.executions, 4);
	}
	for(const target of [
		"index.json", "ordinary-full/run.tap"
		, "reviewed-full/records/report.json"
		, "ordinary-result-only/verification.json"
		, "reviewed-result-only/controls.json"
		, "sources/archiver/scripts/archive-inherited-checked-record-python-evidence.mjs"
		, "ordinary-full/records/handoff/archives/inheritedcheckedrecords-1.0.0-py3-none-manylinux_2_38_x86_64.whl"
	]) await assert.rejects(checkInheritedCheckedRecordPythonEvidence(
		async path => {
			const bytes = await readFile(path);
			return path === `${inheritedCheckedRecordPythonEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}, { controls: "none" }
	), undefined, target);
	await assert.rejects(checkInheritedCheckedRecordPythonEvidence(
		path => path.endsWith("ordinary-full/records/report.json")
			? Promise.reject(new Error("missing retained report"))
			: readFile(path)
		, { controls: "none" }
	));
});
