/**
 * Authenticate actual one-root probe transcripts without promoting installed support.
 * Absolute paths in original records are provenance, never CI filesystem dependencies.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { instrumentSubtypeCEntries } from "./php-wasm-subtype-entry-c.mjs";
import { subtypeEntryCall, subtypeEntryCorpusCalls } from "./php-wasm-subtype-entry-cases.mjs";
import { parseSubtypeEntryTrace } from "./php-wasm-subtype-entry-trace.mjs";
import { phpWasmSubtypeFixture } from "./php-wasm-subtype-fixture.mjs";
import { phpWasmFinCaller } from "./php-wasm-fin-fixtures.mjs";

const root = "docs/evidence/php-wasm-subtype-entry-probe-20261010";
const json = async path => JSON.parse(await readFile(join(root, path), "utf8"));

test("PHP-Wasm entry probe archive authenticates all original inputs and preserves failed attempts", async () => {
	const bytes = await readFile(join(root, "index.json"));
	assert.equal(sha256(bytes), "ba04738bd1e155caafdcc4f2101a36258986be5cb166998d91ebe2d9efd7f051");
	const index = JSON.parse(bytes);
	assert.equal(index.files.length, 112);
	assert.equal(index.producer, "6ac0d2bacfb0ff53b4698a5310f3f3e5e45ad5d3");
	assert.equal(new Set(index.files.map(file => file.path)).size, index.files.length);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes(".."));
		const original = await readFile(join(root, file.path));
		const verify = bytes => { assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256, file.path); };
		verify(original);
		assert.throws(() => verify(Buffer.concat([original, Buffer.from("\n")])));
		if(original.length > 0)
		{ const changed = Buffer.from(original); changed[0] ^= 1; assert.throws(() => verify(changed)); }
	}
	assert.equal((await json("attempts/r1/end.json")).status, "failed");
	assert.match(await readFile(join(root, "smoke/r1.log"), "utf8"), /USE_OFFSET_CONVERTER/u);
	assert.equal((await json("smoke/r2.json")).status, "failed");
	assert.equal((await json("corpus/r1-weak.json")).result, "failed");
	assert.match((await json("corpus/r1-weak.json")).stdout, /strict_types/u);
});

test("all 55 selected C definitions reproduce the executed probe inputs byte for byte", async () => {
	const selected = await json("r4/selected.json"), instrumentation = await json("r4/instrumentation.json");
	assert.equal(selected.length, 55); assert.equal(instrumentation.compiled.length, 7);
	const counts = new Map(selected.map(item => [item.symbol, 0]));
	for(const file of instrumentation.compiled)
	{
		const original = await readFile(join(root, "r4/c-inputs", basename(file.original)), "utf8");
		const executed = await readFile(join(root, "r4/c-probes", basename(file.probe)), "utf8");
		const { source, receipt } = instrumentSubtypeCEntries(original, selected);
		assert.equal(source, executed);
		assert.equal(receipt.originalSha256, file.originalSha256); assert.equal(receipt.probeSha256, file.probeSha256);
		assert.deepEqual(receipt.insertions, file.insertions);
		for(const item of receipt.insertions.filter(item => item.kind !== "preamble")) counts.set(item.symbol, counts.get(item.symbol) + 1);
	}
	assert.deepEqual(Object.fromEntries(counts), instrumentation.definitionCounts);
	assert.ok([...counts.values()].every(count => count === 1));
	assert.equal(selected.find(item => item.label === "Subtypes.echo").symbol, "l_Subtypes_echo___redArg");
	assert.ok(!selected.some(item => item.kind === "source" && item.label === "Subtypes.zeroEven"));
	assert.ok((await json("r4/commands.json")).every(item => !item.probeArgs.includes("-finstrument-functions")));
});

test("complete weak and strict PHP callers retain all 2030 measured calls and recovery controls", async t => {
	const selected = await json("r4/selected.json"), expected = subtypeEntryCorpusCalls();
	assert.equal(expected.length, 2030);
	const fixture = await phpWasmSubtypeFixture(t), caller = await phpWasmFinCaller(fixture);
	for(const mode of ["weak", "strict"])
	{
		const report = await json(`corpus/r2-${mode}.json`), source = await readFile(join(root, `corpus/r2-${mode}.php`), "utf8");
		const trace = await readFile(join(root, `corpus/r2-${mode}.stderr`), "utf8");
		assert.equal(source, caller.source(mode)); assert.equal(sha256(source), report.callerSha256);
		assert.equal(sha256(trace), report.stderrSha256);
		assert.equal(report.parserSha256, sha256(await readFile(join(root, "observer/php-wasm-subtype-entry-trace.mjs.txt"))));
		assert.equal(report.runnerSha256, sha256(await readFile(join(root, "corpus/r2-runner.mjs.txt"))));
		assert.equal(report.result, "passed"); assert.equal(report.status, 0); assert.equal(report.calls, 2030);
		assert.deepEqual(report.observation, { checks: 2024, word_bits: 32, php: "8.4.1" });
		assert.deepEqual(JSON.parse(report.stdout), report.observation);
		const calls = parseSubtypeEntryTrace(trace, selected);
		assert.deepEqual(calls, expected);
		assert.deepEqual(report.counts, { validator: 2029, constructor: 3045, adapter: 1017, source: 1016 });
		assert.notDeepEqual(parseSubtypeEntryTrace("", selected), expected);
		assert.notDeepEqual(parseSubtypeEntryTrace(trace.replace("LB_SUBTYPE_ENTRY_V1 enter source Subtypes.echo\n", ""), selected), expected);
	}
});

test("measured smoke controls cover rejection zeros, normalization and every selected entry", async () => {
	const selected = await json("r4/selected.json"), smoke = await json("smoke/r4.json"), measured = new Set();
	assert.equal(smoke.status, "passed"); assert.equal(smoke.results.length, 10);
	const expected = [
		subtypeEntryCall("half", [[0, "checkedEven"]])
		, subtypeEntryCall("half", [[0, "checkedEven"]], "half", false)
		, subtypeEntryCall("mix", [[0, "checkedEven"]], "mix", false, 0)
		, subtypeEntryCall("join", [[0, "checkedWord"], [1, "checkedWord"]], "join", false)
		, subtypeEntryCall("clamp", [[0, "checkedBounded"]])
		, subtypeEntryCall("unrestricted")
		, subtypeEntryCall("byte", [[0, "checkedByte"]])
		, subtypeEntryCall("secondEven", [[0, "normalizedEven"]], "echo")
		, subtypeEntryCall("zeroEven", [], null)
	];
	assert.deepEqual(smoke.startup, { stdout: [], stderr: [] });
	assert.deepEqual(smoke.results[0].stderr, []);
	const calls = smoke.results.slice(1).flatMap(item => {
		assert.equal(item.status, 0); assert.equal(sha256(item.source), item.sourceSha256);
		return parseSubtypeEntryTrace(item.stderr.flat().join(""), selected);
	});
	assert.deepEqual(calls, expected);
	const full = parseSubtypeEntryTrace(await readFile(join(root, "corpus/r2-weak.stderr"), "utf8"), selected);
	for(const call of [...calls, ...full])
	{
		measured.add("public/" + call.publicName);
		for(const item of call.entries) measured.add(item.kind + "/" + item.label);
	}
	assert.deepEqual([...measured].sort(), selected.map(item => item.kind + "/" + item.label).sort());
	const incomplete = await json("smoke/r3.json");
	assert.notDeepEqual(parseSubtypeEntryTrace(incomplete.results.find(item => item.label === "normalized-specialization").stderr.flat().join(""), selected), [expected[7]]);
});
