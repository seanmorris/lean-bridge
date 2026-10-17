/**
 * Test the hosted inherited checked-record Rust evidence boundary. Before all
 * revisions and the index are pinned, every acceptance claim must refuse.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkInheritedCheckedRecordRustEvidence
	, inheritedCheckedRecordRustEvidence
	, inheritedCheckedRecordRustEvidenceSha256
} from "./inherited-checked-record-rust-evidence.mjs";
import {
	inheritedCheckedRecordRustArchiver
	, inheritedCheckedRecordRustChecker
	, inheritedCheckedRecordRustPinnedRevisions
	, inheritedCheckedRecordRustProducer
} from "./inherited-checked-record-rust-provenance.mjs";

const revisions = [
	inheritedCheckedRecordRustProducer, inheritedCheckedRecordRustChecker
	, inheritedCheckedRecordRustArchiver
];
const pinned = revisions.every(revision => revision !== null)
	&& inheritedCheckedRecordRustEvidenceSha256 !== null;
const script = "scripts/archive-inherited-checked-record-rust-evidence.mjs";

test("inherited checked-record Rust evidence fails closed until every pin exists", {
	skip: pinned && "Pinned hosted archive is authenticated below"
}, async () => {
	assert.throws(() => inheritedCheckedRecordRustPinnedRevisions()
		, /Pin the inherited checked-record Rust/u);
	await assert.rejects(checkInheritedCheckedRecordRustEvidence()
		, /Pin the inherited checked-record Rust/u);
	await assert.rejects(access(inheritedCheckedRecordRustEvidence)
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
			, /Usage: archive-inherited-checked-record-rust-evidence/u);
	}
});

test("inherited checked-record Rust evidence authenticates every hosted selection", {
	skip: !pinned && "Runs once hosted revisions and the archive index are pinned"
	, timeout: 900_000
}, async () => {
	const checked = await checkInheritedCheckedRecordRustEvidence();
	assert.equal(checked.selections.length, 4);
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.controls, "representative");
	for(const selection of checked.selections)
	{
		assert.equal(selection.executions, 3);
		assert.equal(selection.dispatchObserved, false);
		assert.equal(selection.loadCeiling, 8);
	}
	for(const target of [
		"index.json", "ordinary-full/run.tap"
		, "reviewed-full/records/report.json"
		, "ordinary-result-only/verification.json"
		, "reviewed-result-only/controls.json"
		, "sources/producer/tests/helpers/inherited-checked-record-rust-fixture.mjs"
	]) await assert.rejects(checkInheritedCheckedRecordRustEvidence(
		async path => {
			const bytes = await readFile(path);
			return path === `${inheritedCheckedRecordRustEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}
	), undefined, target);
});
