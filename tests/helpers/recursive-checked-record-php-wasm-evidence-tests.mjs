/**
 * Test the recursive checked-record PHP-Wasm evidence boundary. Before the producer revision is
 * pinned the archive and verifier must refuse; afterwards they authenticate all four selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkRecursiveCheckedRecordPhpWasmEvidence, recursiveCheckedRecordPhpWasmEvidence
	, recursiveCheckedRecordPhpWasmEvidenceSha256
} from "./recursive-checked-record-php-wasm-evidence.mjs";
import {
	recursiveCheckedRecordPhpWasmExpectedControls, recursiveCheckedRecordPhpWasmPinnedRevisions
	, recursiveCheckedRecordPhpWasmProducer
} from "./recursive-checked-record-php-wasm-provenance.mjs";

const pinned = recursiveCheckedRecordPhpWasmProducer !== null && recursiveCheckedRecordPhpWasmEvidenceSha256 !== null;
const script = "scripts/archive-recursive-checked-record-php-wasm-evidence.mjs";

test("recursive checked-record PHP-Wasm evidence fails closed until its producer and index are pinned", { skip: pinned && "Pinned archive is authenticated below" }, async () => {
	assert.throws(() => recursiveCheckedRecordPhpWasmPinnedRevisions(), /Pin the recursive PHP-Wasm producer/u);
	await assert.rejects(checkRecursiveCheckedRecordPhpWasmEvidence(readFile, { controls: "none" }), /Pin the recursive PHP-Wasm producer/u);
	for(const args of [[], ["relative/root"], ["/absolute/root", "extra"]])
	{
		const run = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" } });
		assert.notEqual(run.status, 0); assert.match(run.stderr, /Usage: archive-recursive-checked-record-php-wasm-evidence/u);
	}
	// A well-formed root still refuses before creating any evidence directory.
	const run = spawnSync(process.execPath, [script, "/nonexistent/recursive-php-wasm-root"], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" } });
	assert.notEqual(run.status, 0); assert.match(run.stderr, /Pin the recursive PHP-Wasm producer/u);
	assert.deepEqual(recursiveCheckedRecordPhpWasmExpectedControls(90), { recordControls: 186, semanticControls: 63 });
});

test("recursive checked-record PHP-Wasm evidence admits only frozen control scopes", async () => {
	for(const controls of ["some", "", "ALL", "none "])
		await assert.rejects(checkRecursiveCheckedRecordPhpWasmEvidence(readFile, { controls }), undefined, String(controls));
});

test("recursive checked-record PHP-Wasm evidence authenticates four installed selections", { skip: !pinned && "Runs once the producer and archive index are pinned", timeout: 900_000 }, async () => {
	const checked = await checkRecursiveCheckedRecordPhpWasmEvidence();
	assert.deepEqual(checked.installedProfiles, ["php-wasm"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.selections.map(item => [item.route, item.fixture]), [
		["ordinary", "recursive"], ["reviewed", "recursive"]
		, ["ordinary", "mutual"], ["reviewed", "mutual"]
	]);
	for(const item of checked.selections)
		assert.deepEqual(item.controls, recursiveCheckedRecordPhpWasmExpectedControls(item.records.length));
	for(const target of ["index.json", "ordinary-mutual/records/report.json"
		, "reviewed-mutual/run.tap", "ordinary-recursive/verification.json"
		, "reviewed-recursive/runtime-before.json"
		, "sources/producer/tests/fixtures/recursive-checked-record-consumers/php-native.php"])
		await assert.rejects(checkRecursiveCheckedRecordPhpWasmEvidence(async path => {
			const bytes = await readFile(path);
			return path === `${recursiveCheckedRecordPhpWasmEvidence}/${target}` ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}, { controls: "none" }), undefined, target);
});
