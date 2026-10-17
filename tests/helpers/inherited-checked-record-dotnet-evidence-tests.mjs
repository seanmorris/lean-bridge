/**
 * Test the hosted inherited checked-record .NET evidence boundary. Before all
 * revisions and the index are pinned, every acceptance claim must refuse.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkInheritedCheckedRecordDotnetEvidence
	, inheritedCheckedRecordDotnetEvidence
	, inheritedCheckedRecordDotnetEvidenceSha256
} from "./inherited-checked-record-dotnet-evidence.mjs";
import {
	inheritedCheckedRecordDotnetArchiver
	, inheritedCheckedRecordDotnetChecker
	, inheritedCheckedRecordDotnetPinnedRevisions
	, inheritedCheckedRecordDotnetProducer
} from "./inherited-checked-record-dotnet-provenance.mjs";

const revisions = [
	inheritedCheckedRecordDotnetProducer, inheritedCheckedRecordDotnetChecker
	, inheritedCheckedRecordDotnetArchiver
];
const pinned = revisions.every(revision => revision !== null)
	&& inheritedCheckedRecordDotnetEvidenceSha256 !== null;
const script = "scripts/archive-inherited-checked-record-dotnet-evidence.mjs";

test("inherited checked-record .NET evidence fails closed until every pin exists", {
	skip: pinned && "Pinned hosted archive is authenticated below"
}, async () => {
	assert.throws(() => inheritedCheckedRecordDotnetPinnedRevisions()
		, /Pin the inherited checked-record \.NET/u);
	await assert.rejects(checkInheritedCheckedRecordDotnetEvidence()
		, /Pin the inherited checked-record \.NET/u);
	await assert.rejects(access(inheritedCheckedRecordDotnetEvidence)
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
			, /Usage: archive-inherited-checked-record-dotnet-evidence/u);
	}
});

test("inherited checked-record .NET evidence authenticates every hosted selection", {
	skip: !pinned && "Runs once hosted revisions and the archive index are pinned"
	, timeout: 900_000
}, async () => {
	const checked = await checkInheritedCheckedRecordDotnetEvidence();
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
		assert.deepEqual(selection.counts, full ? {
			checks: 7204, rejections: 1286, recoveries: 256
			, snapshots: 3342, snapshotControls: 8, rounds: 256
		} : {
			checks: 1546, rejections: 0, recoveries: 0
			, snapshots: 514, snapshotControls: 6, rounds: 256
		});
		assert.equal(selection.executions, 3);
		assert.equal(selection.dispatchObserved, false);
	}
	for(const target of [
		"index.json", "ordinary-full/run.tap"
		, "reviewed-full/records/report.json"
		, "ordinary-result-only/verification.json"
		, "reviewed-result-only/controls.json"
		, "sources/archiver/scripts/archive-inherited-checked-record-dotnet-evidence.mjs"
		, "ordinary-full/records/handoff/archives/Inheritedcheckedrecords.Api.1.0.0.nupkg"
	]) await assert.rejects(checkInheritedCheckedRecordDotnetEvidence(
		async path => {
			const bytes = await readFile(path);
			return path === `${inheritedCheckedRecordDotnetEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}, { controls: "none" }
	), undefined, target);
	await assert.rejects(checkInheritedCheckedRecordDotnetEvidence(
		path => path.endsWith("ordinary-full/records/report.json")
			? Promise.reject(new Error("missing retained report"))
			: readFile(path)
		, { controls: "none" }
	));
});
