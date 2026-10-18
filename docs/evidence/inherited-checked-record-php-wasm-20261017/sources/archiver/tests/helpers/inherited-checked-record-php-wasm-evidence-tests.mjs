/**
 * Test the hosted inherited checked-record PHP-Wasm evidence boundary. Before
 * every revision and the index are pinned, all acceptance claims must refuse.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkInheritedCheckedRecordPhpWasmEvidence
	, inheritedCheckedRecordPhpWasmEvidence
	, inheritedCheckedRecordPhpWasmEvidenceSha256
} from "./inherited-checked-record-php-wasm-evidence.mjs";
import {
	inheritedCheckedRecordPhpWasmExpected
} from "./inherited-checked-record-php-wasm-fixture.mjs";
import {
	inheritedCheckedRecordPhpWasmArchiver
	, inheritedCheckedRecordPhpWasmChecker
	, inheritedCheckedRecordPhpWasmPinnedRevisions
	, inheritedCheckedRecordPhpWasmProducer
} from "./inherited-checked-record-php-wasm-provenance.mjs";

const revisions = [
	inheritedCheckedRecordPhpWasmProducer
	, inheritedCheckedRecordPhpWasmChecker
	, inheritedCheckedRecordPhpWasmArchiver
];
const pinned = revisions.every(revision => revision !== null)
	&& inheritedCheckedRecordPhpWasmEvidenceSha256 !== null;
const script = "scripts/archive-inherited-checked-record-php-wasm-evidence.mjs";

test("inherited checked-record PHP-Wasm evidence fails closed until every pin exists", {
	skip: pinned && "Pinned hosted archive is authenticated below"
}, async () => {
	assert.throws(() => inheritedCheckedRecordPhpWasmPinnedRevisions()
		, /Pin the inherited checked-record PHP-Wasm/u);
	await assert.rejects(checkInheritedCheckedRecordPhpWasmEvidence()
		, /Pin the inherited checked-record PHP-Wasm/u);
	await assert.rejects(access(inheritedCheckedRecordPhpWasmEvidence)
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
			, /Usage: archive-inherited-checked-record-php-wasm-evidence/u);
	}
});

test("inherited checked-record PHP-Wasm evidence authenticates every hosted selection", {
	skip: !pinned && "Runs once hosted revisions and the archive index are pinned"
	, timeout: 900_000
}, async () => {
	const checked = await checkInheritedCheckedRecordPhpWasmEvidence();
	assert.equal(checked.selections.length, 4);
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.deepEqual(checked.installedProfiles, ["php-wasm"]);
	for(const selection of checked.selections)
	{
		assert.deepEqual(selection.counts
			, inheritedCheckedRecordPhpWasmExpected(selection.mode));
		assert.equal(selection.executions, 12);
		assert.equal(selection.dispatchObserved, false);
		assert.deepEqual(Object.keys(selection.packageFiles).sort()
			, ["api", "component", "runtime"]);
	}
	for(const target of [
		"index.json", "ordinary-full/run.tap"
		, "reviewed-full/records/report.json"
		, "ordinary-result-only/verification.json"
		, "reviewed-result-only/runtime-before.json"
		, "sources/producer/tests/helpers/inherited-checked-record-php-wasm-fixture.mjs"
	]) await assert.rejects(checkInheritedCheckedRecordPhpWasmEvidence(
		async path => {
			const bytes = await readFile(path);
			return path === `${inheritedCheckedRecordPhpWasmEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}, { controls: "none" }
	), undefined, target);
});

test("inherited checked-record PHP-Wasm evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkInheritedCheckedRecordPhpWasmEvidence(readFile, {
		controls: "some"
	}));
});
