/**
 * Source-only controls for compact installed copied-entry callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	phpWasmRefinementEntryCaller, phpWasmRefinementEntryCallerSpec
	, phpWasmRefinementEntryExpected, phpWasmRefinementEntryRequest
} from "./php-wasm-refinement-entry-callers.mjs";
import {
	phpWasmRefinementEntrySourceFamilies
} from "./php-wasm-refinement-entry-source-fixtures.mjs";

const families = phpWasmRefinementEntrySourceFamilies;

test("compact copied-entry callers are syntax-valid and differ only by strictness", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-refinement-entry-callers-"));
	t.after(() => rm(root, { recursive: true }));
	for(const family of families)
	{
		const weak = await phpWasmRefinementEntryCaller(family, "weak");
		const strict = await phpWasmRefinementEntryCaller(family, "strict");
		assert.equal(strict, weak.replace("declare(strict_types=0);", "declare(strict_types=1);"));
		assert.ok(weak.includes(`'family' => '${family}'`));
		for(const [mode, source] of [["weak", weak], ["strict", strict]])
		{
			const path = join(root, `${family}-${mode}.php`); await writeFile(path, source);
			assert.match(execFileSync("php", ["-l", path], { encoding: "utf8" }), /No syntax errors/u);
		}
	}
});

test("compact copied-entry requests close arrangement, operation and call plan", () => {
	for(const family of families)
	{
		const spec = phpWasmRefinementEntryCallerSpec(family);
		const entryProbe = { scope: "separate-instrumented-probe", family
			, selected: [{ symbol: "x", kind: "public", label: "x" }]
			, cases: [{ control: "x" }] };
		for(const arrangement of ["embedded", "composer"])
		{
			const request = JSON.parse(phpWasmRefinementEntryRequest(family, arrangement, entryProbe));
			assert.deepEqual(request.operations, { probe: spec.probe }); assert.equal(request.module, spec.module);
			assert.deepEqual(request.entryProbe, entryProbe);
			assert.equal(request.autoload, arrangement === "composer" ? "vendor/autoload.php"
				: `vendor/${spec.settings.composer.name}/bootstrap.php`);
		}
		assert.deepEqual(phpWasmRefinementEntryExpected(family, entryProbe.cases), {
			checks: 1, family, word_bits: 32, php: "8.4.1"
		});
	}
});

test("compact copied-entry caller selectors reject open choices", async () => {
	for(const family of ["unknown", "", null])
	{
		assert.throws(() => phpWasmRefinementEntryCallerSpec(family));
		await assert.rejects(phpWasmRefinementEntryCaller(family, "weak"));
	}
	await assert.rejects(phpWasmRefinementEntryCaller("recursive-subtype", "other"));
	assert.throws(() => phpWasmRefinementEntryRequest("recursive-subtype", "other", {}));
	assert.throws(() => phpWasmRefinementEntryRequest("recursive-subtype", "embedded", {
		family: "nominal-full", scope: "separate-instrumented-probe"
	}));
});
