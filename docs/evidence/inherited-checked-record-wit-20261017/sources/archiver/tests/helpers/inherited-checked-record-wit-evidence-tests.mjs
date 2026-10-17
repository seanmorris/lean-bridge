/**
 * Test the hosted inherited checked-record WIT evidence boundary. Before all
 * revisions and the index are pinned, every acceptance claim must refuse.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkInheritedCheckedRecordWitEvidence
	, inheritedCheckedRecordWitEvidence
	, inheritedCheckedRecordWitEvidenceSha256
} from "./inherited-checked-record-wit-evidence.mjs";
import {
	inheritedCheckedRecordWitArchiver
	, inheritedCheckedRecordWitChecker
	, inheritedCheckedRecordWitPinnedRevisions
	, inheritedCheckedRecordWitProducer
} from "./inherited-checked-record-wit-provenance.mjs";

const revisions = [
	inheritedCheckedRecordWitProducer, inheritedCheckedRecordWitChecker
	, inheritedCheckedRecordWitArchiver
];
const pinned = revisions.every(revision => revision !== null)
	&& inheritedCheckedRecordWitEvidenceSha256 !== null;
const script = "scripts/archive-inherited-checked-record-wit-evidence.mjs";

test("inherited checked-record WIT evidence fails closed until every pin exists", {
	skip: pinned && "Pinned hosted archive is authenticated below"
}, async () => {
	assert.throws(() => inheritedCheckedRecordWitPinnedRevisions()
		, /Pin the inherited checked-record WIT/u);
	await assert.rejects(checkInheritedCheckedRecordWitEvidence()
		, /Pin the inherited checked-record WIT/u);
	await assert.rejects(access(inheritedCheckedRecordWitEvidence)
		, { code: "ENOENT" });
	for(const args of [
		[], ["--root", "relative"], ["--root", "/absolute"]
		, ["--root", "/absolute", "--producer", "HEAD"
			, "--checker", "a".repeat(40), "--run-id", "1"]
	]) {
		const run = spawnSync(process.execPath, [script, ...args], {
			encoding: "utf8", env: { PATH: process.env.PATH }
		});
		assert.notEqual(run.status, 0);
		assert.match(run.stderr
			, /Usage: archive-inherited-checked-record-wit-evidence/u);
	}
});

test("inherited checked-record WIT evidence authenticates every hosted selection", {
	skip: !pinned && "Runs once hosted revisions and the archive index are pinned"
	, timeout: 900_000
}, async () => {
	const checked = await checkInheritedCheckedRecordWitEvidence();
	assert.equal(checked.selections.length, 4);
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	for(const selection of checked.selections)
	{
		assert.equal(selection.executions, 2);
		assert.equal(selection.nativeHostRequired, true);
		assert.equal(selection.standaloneWasi, false);
	}
	for(const target of [
		"index.json", "ordinary-full/run.tap"
		, "reviewed-full/records/report.json"
		, "ordinary-result-only/verification.json"
		, "sources/producer/tests/helpers/inherited-checked-record-wit-fixture.mjs"
	]) await assert.rejects(checkInheritedCheckedRecordWitEvidence(
		async path => {
			const bytes = await readFile(path);
			return path === `${inheritedCheckedRecordWitEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}
	), undefined, target);
});
