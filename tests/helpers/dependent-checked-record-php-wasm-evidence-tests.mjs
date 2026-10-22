/**
 * Test the retained hosted PHP-Wasm dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkDependentCheckedRecordPhpWasmEvidence
	, dependentCheckedRecordPhpWasmEvidence
} from "./dependent-checked-record-php-wasm-evidence.mjs";

test("hosted dependent PHP-Wasm archive authenticates every retained route", {
	timeout: 180_000
}, async () => {
	const result = await checkDependentCheckedRecordPhpWasmEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 2411);
	assert.equal(result.hostedRun.artifact.id, 12464147584);
	assert.equal(result.compiler.observations.length, 4);
});

for(const target of [
	"ordinary-source/records/report.json"
	, "compiler/records/reviewed-ir/generated.c"
	, "sources/producer/src/build/compiler-adapters.mjs"
	, "hosted/artifact.zip.parts/0000.part"
]) test(`hosted dependent PHP-Wasm archive rejects changed ${target}`, {
	timeout: 180_000
}, async () => {
	await assert.rejects(checkDependentCheckedRecordPhpWasmEvidence(
		async path => {
			const bytes = await readFile(path);
			return path === `${dependentCheckedRecordPhpWasmEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}
	));
});
