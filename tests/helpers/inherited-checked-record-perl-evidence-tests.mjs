/**
 * Test the hosted inherited checked-record Perl evidence boundary.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkInheritedCheckedRecordPerlEvidence
	, inheritedCheckedRecordPerlEvidence
	, inheritedCheckedRecordPerlEvidenceSha256
} from "./inherited-checked-record-perl-evidence.mjs";
import {
	inheritedCheckedRecordPerlArchiver
	, inheritedCheckedRecordPerlChecker
	, inheritedCheckedRecordPerlPinnedRevisions
	, inheritedCheckedRecordPerlProducer
} from "./inherited-checked-record-perl-provenance.mjs";

const revisions = [
	inheritedCheckedRecordPerlProducer, inheritedCheckedRecordPerlChecker
	, inheritedCheckedRecordPerlArchiver
];
const pinned = revisions.every(revision => revision !== null)
	&& inheritedCheckedRecordPerlEvidenceSha256 !== null;
const script = "scripts/archive-inherited-checked-record-perl-evidence.mjs";

test("inherited checked-record Perl evidence fails closed until every pin exists", {
	skip: pinned && "Pinned hosted archive is authenticated below"
}, async () => {
	assert.throws(() => inheritedCheckedRecordPerlPinnedRevisions()
		, /Pin the inherited checked-record Perl/u);
	await assert.rejects(checkInheritedCheckedRecordPerlEvidence()
		, /Pin the inherited checked-record Perl/u);
	await assert.rejects(access(inheritedCheckedRecordPerlEvidence)
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
			, /Usage: archive-inherited-checked-record-perl-evidence/u);
	}
});

test("inherited checked-record Perl evidence authenticates every hosted selection", {
	skip: !pinned && "Runs once hosted revisions and the archive index are pinned"
	, timeout: 900_000
}, async () => {
	const checked = await checkInheritedCheckedRecordPerlEvidence();
	assert.equal(checked.selections.length, 4);
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.controls, "representative");
	assert.equal(checked.interpreters.length, 4);
	assert.ok(checked.files.length > 500);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	for(const selection of checked.selections)
	{
		assert.equal(selection.builds, 2);
		assert.equal(selection.executions, 16);
		assert.equal(selection.configurations.length, 4);
		assert.deepEqual(selection.installModes, ["prebuilt-only", "build-xs"]);
	}
	for(const target of [
		"index.json", "ordinary-full/run.tap"
		, "reviewed-full/records/report.json"
		, "ordinary-result-only/verification.json"
		, "reviewed-result-only/controls.json"
		, "sources/archiver/scripts/archive-inherited-checked-record-perl-evidence.mjs"
	]) await assert.rejects(checkInheritedCheckedRecordPerlEvidence(
		async path => {
			const bytes = await readFile(path);
			return path === `${inheritedCheckedRecordPerlEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}, { controls: "none" }
	), undefined, target);
});
