/**
 * Test the hosted inherited checked-record native PHP evidence boundary. Before all
 * revisions and the index are pinned, every acceptance claim must refuse.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkInheritedCheckedRecordPhpEvidence
	, inheritedCheckedRecordPhpEvidence
	, inheritedCheckedRecordPhpEvidenceSha256
} from "./inherited-checked-record-php-evidence.mjs";
import {
	inheritedCheckedRecordPhpArchiver
	, inheritedCheckedRecordPhpChecker
	, inheritedCheckedRecordPhpPinnedRevisions
	, inheritedCheckedRecordPhpProducer
} from "./inherited-checked-record-php-provenance.mjs";

const revisions = [
	inheritedCheckedRecordPhpProducer, inheritedCheckedRecordPhpChecker
	, inheritedCheckedRecordPhpArchiver
];
const pinned = revisions.every(revision => revision !== null)
	&& inheritedCheckedRecordPhpEvidenceSha256 !== null;
const script = "scripts/archive-inherited-checked-record-php-evidence.mjs";

test("inherited checked-record native PHP evidence fails closed until every pin exists", {
	skip: pinned && "Pinned hosted archive is authenticated below"
}, async () => {
	assert.throws(() => inheritedCheckedRecordPhpPinnedRevisions()
		, /Pin the inherited checked-record native PHP/u);
	await assert.rejects(checkInheritedCheckedRecordPhpEvidence()
		, /Pin the inherited checked-record native PHP/u);
	await assert.rejects(access(inheritedCheckedRecordPhpEvidence)
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
			, /Usage: archive-inherited-checked-record-php-evidence/u);
	}
});

test("inherited checked-record native PHP evidence authenticates every hosted selection", {
	skip: !pinned && "Runs once hosted revisions and the archive index are pinned"
	, timeout: 900_000
}, async () => {
	const checked = await checkInheritedCheckedRecordPhpEvidence();
	assert.equal(checked.selections.length, 4);
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.controls, "representative");
	assert.match(checked.tools.selected.phpVersion
		, /^8\.(?:[2-9]|[1-9][0-9]+)\.[0-9]+$/u);
	assert.match(checked.tools.selected.composerVersion, /^2\.[0-9]+\.[0-9]+$/u);
	assert.ok(checked.files.length > 100);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["reviewed", "full"]
		, ["ordinary", "result-only"], ["reviewed", "result-only"]
	]);
	for(const selection of checked.selections)
	{
		const full = selection.mode === "full";
		assert.deepEqual(selection.counts, full ? {
			checks: 5680, rejections: 1291, calls: 2839
			, snapshots: 2839, recoveries: 256, rounds: 256
		} : {
			checks: 1042, rejections: 0, calls: 518
			, snapshots: 518, recoveries: 0, rounds: 256
		});
		assert.equal(selection.executions, 4);
	}
	for(const target of [
		"index.json", "ordinary-full/run.tap"
		, "reviewed-full/records/report.json"
		, "ordinary-result-only/verification.json"
		, "reviewed-result-only/controls.json"
		, "sources/archiver/scripts/archive-inherited-checked-record-php-evidence.mjs"
		, "ordinary-full/records/handoff/archives/example-inheritedcheckedrecords-1.0.0-linux-x86_64.zip"
	]) await assert.rejects(checkInheritedCheckedRecordPhpEvidence(
		async path => {
			const bytes = await readFile(path);
			return path === `${inheritedCheckedRecordPhpEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}, { controls: "none" }
	), undefined, target);
	await assert.rejects(checkInheritedCheckedRecordPhpEvidence(
		path => path.endsWith("ordinary-full/records/report.json")
			? Promise.reject(new Error("missing retained report"))
			: readFile(path)
		, { controls: "none" }
	));
});
