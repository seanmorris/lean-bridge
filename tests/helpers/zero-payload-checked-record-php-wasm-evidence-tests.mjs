/**
 * Test the retained hosted zero-payload PHP-Wasm archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkZeroPayloadPhpWasmEvidence, zeroPayloadPhpWasmEvidence
} from "./zero-payload-checked-record-php-wasm-evidence.mjs";

test("hosted zero-payload PHP-Wasm archive authenticates compiler and installed routes", {
	// The cold archive pass authenticates more than one thousand retained files.
	// Core run 41129035795 needed 122.2 seconds while sharing a runner with a
	// second contract file; keep a bounded margin without weakening any check.
	timeout: 300_000
}, async () => {
	const result = await checkZeroPayloadPhpWasmEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.ok(result.files.length > 1000);
});

for(const target of [
	"ordinary-source/records/report.json"
	, "compiler/records/reviewed-ir/model.json"
	, "sources/producer/src/analyze/NativeExports.lean"
	, "hosted/runtime/runtime.json"
	, "hosted/artifact.zip.parts/0000.part"
]) test(`hosted zero-payload PHP-Wasm archive rejects changed ${target}`, {
	timeout: 120_000
}, async () => {
	await assert.rejects(checkZeroPayloadPhpWasmEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${zeroPayloadPhpWasmEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
