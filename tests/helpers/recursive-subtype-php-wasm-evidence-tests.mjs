/**
 * Mutation and completeness checks for recursive checked PHP-Wasm evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkRecursiveSubtypePhpWasmEvidence
	, recursiveSubtypePhpWasmEvidence
	, recursiveSubtypePhpWasmProducer
} from "./recursive-subtype-php-wasm-evidence.mjs";

test("recursive checked PHP-Wasm evidence authenticates both installed source routes", async () => {
	const checked = await checkRecursiveSubtypePhpWasmEvidence();
	assert.equal(checked.producerCommit, recursiveSubtypePhpWasmProducer);
	assert.equal(checked.files.length, 26);
	assert.deepEqual(checked.runs.map(run => [run.route, run.sourcePath]), [
		["ordinary", "ordinary-source"], ["reviewed", "reviewed-ir"]
	]);
	for(const run of checked.runs)
	{
		assert.equal(run.report.observation.checks, 24);
		assert.equal(run.report.phpWasm.executions.length, 12);
		assert.equal(run.archives.length, 3);
	}
});

for(const [name, target] of [
	["index", "index.json"]
	, ["report", "ordinary/report.json"]
	, ["archive", "reviewed/packages/php-wasm/archives/lean-bridge-recursive-subtypes-wasm-1.0.0.tgz"]
]) test(`recursive checked PHP-Wasm evidence rejects a changed ${name}`, async () => {
	await assert.rejects(checkRecursiveSubtypePhpWasmEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${recursiveSubtypePhpWasmEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
