/**
 * Test the hosted value-index checked-record .NET evidence boundary. Until
 * every immutable revision and index digest is pinned, acceptance fails shut.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkCheckedRecordValueIndexDotnetEvidence
	, checkedRecordValueIndexDotnetEvidence
	, checkedRecordValueIndexDotnetEvidenceSha256
} from "./checked-record-value-index-dotnet-evidence.mjs";
import {
	checkedRecordValueIndexDotnetArchiver
	, checkedRecordValueIndexDotnetChecker
	, checkedRecordValueIndexDotnetConsumer
	, checkedRecordValueIndexDotnetPinnedRevisions
	, checkedRecordValueIndexDotnetProducer
} from "./checked-record-value-index-dotnet-provenance.mjs";

const revisions = [
	checkedRecordValueIndexDotnetProducer
	, checkedRecordValueIndexDotnetConsumer
	, checkedRecordValueIndexDotnetChecker
	, checkedRecordValueIndexDotnetArchiver
];
const pinned = revisions.every(revision => revision !== null)
	&& checkedRecordValueIndexDotnetEvidenceSha256 !== null;
const script
	= "scripts/archive-checked-record-value-index-dotnet-evidence.mjs";

test("value-index checked-record .NET evidence fails closed until every pin exists", {
	skip: pinned && "Pinned hosted archive is authenticated below"
}, async () => {
	assert.throws(() => checkedRecordValueIndexDotnetPinnedRevisions()
		, /Pin the value-index checked-record \.NET/u);
	await assert.rejects(checkCheckedRecordValueIndexDotnetEvidence()
		, /Pin the value-index checked-record \.NET/u);
	await assert.rejects(access(checkedRecordValueIndexDotnetEvidence)
		, { code: "ENOENT" });
	for(const args of [
		[], ["--root", "relative"], ["--root", "/absolute"]
		, ["--root", "/absolute", "--producer", "HEAD"
			, "--consumer", "a".repeat(40), "--checker", "a".repeat(40)
			, "--run-id", "1", "--artifact-id", "1"
			, "--artifact-name", "invalid", "--artifact-bytes", "1"]
	]) {
		const run = spawnSync(process.execPath, [script, ...args], {
			encoding: "utf8", env: { PATH: process.env.PATH }
		});
		assert.notEqual(run.status, 0);
		assert.match(run.stderr
			, /Usage: archive-checked-record-value-index-dotnet-evidence/u);
	}
});

test("value-index checked-record .NET evidence authenticates every hosted route", {
	skip: !pinned && "Runs once hosted revisions and the archive index are pinned"
	, timeout: 900_000
}, async () => {
	const checked = await checkCheckedRecordValueIndexDotnetEvidence();
	assert.equal(checked.selections.length, 4);
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.controls, "representative");
	assert.deepEqual(checked.installedProfiles, ["dotnet"]);
	assert.ok(checked.files.length > 100);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode]), [
		["ordinary-source", "full"], ["reviewed-ir", "full"]
		, ["result-only-ordinary-source", "result-only"]
		, ["result-only-reviewed-ir", "result-only"]
	]);
	for(const selection of checked.selections)
	{
		const full = selection.mode === "full";
		assert.deepEqual(selection.counts, full ? {
			calls: 30, checks: 31, recoveries: 7, rejections: 7
		} : {
			calls: 8, checks: 9, recoveries: 0, rejections: 0
		});
		assert.equal(selection.executions, 3);
		assert.equal(selection.dispatchObserved, false);
	}
	for(const target of [
		"index.json", "ordinary-source/run.tap"
		, "reviewed-ir/records/report.json"
		, "result-only-ordinary-source/verification.json"
		, "result-only-reviewed-ir/records/handoff/archives/Checkedrecordvalueindices.Api.1.0.0.nupkg"
		, "sources/archiver/scripts/archive-checked-record-value-index-dotnet-evidence.mjs"
	]) await assert.rejects(checkCheckedRecordValueIndexDotnetEvidence(
		async path => {
			const bytes = await readFile(path);
			return path === `${checkedRecordValueIndexDotnetEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}, { controls: "none" }
	), undefined, target);
	await assert.rejects(checkCheckedRecordValueIndexDotnetEvidence(
		path => path.endsWith("ordinary-source/records/report.json")
			? Promise.reject(new Error("missing retained report"))
			: readFile(path)
		, { controls: "none" }
	));
});
