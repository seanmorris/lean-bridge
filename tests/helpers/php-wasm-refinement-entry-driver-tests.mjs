/**
 * Browser-safe controls for the graph refinement entry driver.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const selected = [
	{ symbol: "lg_call0", kind: "public", label: "first" }
	, { symbol: "guard", kind: "validator", label: "Probe.first:fin_guard_0" }
	, { symbol: "adapter", kind: "adapter", label: "Probe.first" }
	, { symbol: "source", kind: "source", label: "Probe.first" }
];
const call = { publicName: "first"
	, entries: [
		{ kind: "validator", label: "Probe.first:fin_guard_0" }
		, { kind: "adapter", label: "Probe.first" }
		, { kind: "source", label: "Probe.first" }
	]
	, counts: { validator: 1, constructor: 0, adapter: 1, source: 1 } };
const plan = { scope: "separate-instrumented-probe", family: "recursive-subtype"
	, selected
	, cases: [{ control: "direct", outcome: "accepted", call }] };
const trace = "LB_SUBTYPE_ENTRY_V1 begin public first\n"
	+ "LB_SUBTYPE_ENTRY_V1 enter validator Probe.first:fin_guard_0\n"
	+ "LB_SUBTYPE_ENTRY_V1 enter adapter Probe.first\n"
	+ "LB_SUBTYPE_ENTRY_V1 enter source Probe.first\n"
	+ "LB_SUBTYPE_ENTRY_V1 end public first\n";

const driver = async faults => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-refinement-entry-driver-"));
	await cp("tests/fixtures/php-wasm-refinement-entry/driver.mjs", join(root, "driver.mjs"));
	await cp("tests/helpers/php-wasm-subtype-entry-trace.mjs", join(root, "entry-trace.mjs"));
	const module = await import(pathToFileURL(join(root, "driver.mjs")) + `?${Date.now()}-${Math.random()}`);
	let output = () => {}, error = () => {}, calls = 0;
	/** An inert host exposing selected transcript faults, not a PHP evaluator. */
	class Php
	{
		/**
		 * Construct an inert PHP host.
		 *
		 * @param options - Driver-selected descriptors and library callback.
		 */
		constructor(options)
		{
			options.locateFile("component.so"); this.binary = Promise.resolve();
		}

		/**
		 * Register one driver output consumer.
		 *
		 * @param name - Output or error channel.
		 * @param accept - Callback invoked with transcript bytes.
		 */
		addEventListener(name, accept)
		{
			if(name === "output") output = accept; else error = accept;
		}

		/** Accept an in-memory file without evaluating it. */
		async writeFile() {}

		/**
		 * Return the selected synthetic PHP result and transcript.
		 *
		 * @param code - Driver-selected PHP expression.
		 */
		async run(code)
		{
			calls++;
			if(code.includes("require '/weak.php'"))
			{
				output({ detail: [JSON.stringify({ checks: 1 })] });
				error({ detail: [faults?.trace ?? trace] });
			}
			return faults?.status ?? 0;
		}
	}
	const request = JSON.stringify({ module: "Probe"
		, operations: { probe: "first" }
		, autoload: "vendor/autoload.php", entryProbe: faults?.plan ?? plan });
	try
	{
		const value = await module.executePhpWasmCorpus({ Php
			, api: { extensions: "component" }
			, loading: "startup", mode: "weak", request, source: "<?php" });
		return { value, calls };
	}
	finally
	{
		await rm(root, { recursive: true });
	}
};

test("graph refinement entry driver authenticates the complete planned trace", async () => {
	const { value, calls } = await driver();
	assert.equal(calls, 3); assert.deepEqual(value.observation, { checks: 1 });
	assert.equal(value.entryProbe.trace, trace); assert.equal(value.entryProbe.calls, 1);
	assert.deepEqual(value.entryProbe.controls, ["direct"]);
	assert.deepEqual(value.entryProbe.counts, { validator: 1, constructor: 0, adapter: 1, source: 1 });
});

test("graph refinement entry driver refuses trace and plan drift", async () => {
	for(const faults of [
		{ trace: trace.replace("enter source Probe.first\n", "") }
		, { trace: trace + "unexpected\n" }
		, { plan: { ...plan, extra: true } }
		, { plan: { ...plan, cases: [{ ...plan.cases[0], outcome: "refused" }] } }
		, { plan: { ...plan, cases: [{ ...plan.cases[0], call: { ...call, counts: { ...call.counts, source: 0 } } }] } }
		, { status: 1 }
	]) await assert.rejects(driver(faults));
});
