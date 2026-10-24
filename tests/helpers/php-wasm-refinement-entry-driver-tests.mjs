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

test("graph refinement entry driver compares canonical plan objects independent of key order", async () => {
	const canonicalPlan = { ...plan, cases: [{ ...plan.cases[0], call: { ...call
		, counts: { adapter: 1, constructor: 0, source: 1, validator: 1 } } }] };
	const { value } = await driver({ plan: canonicalPlan });
	assert.equal(value.entryProbe.calls, 1);
	assert.deepEqual(value.entryProbe.counts, call.counts);
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

test("entry driver admits owned native/Lean layers while preserving refusal boundary", async () => {
	const ownedSelected = [
		{ symbol: "lgo_call0", kind: "public", label: "echoClaim" }
		, { symbol: "native", kind: "adapter", label: "echoClaim:native" }
		, { symbol: "guard", kind: "validator", label: "owned:guard" }
		, { symbol: "constructor", kind: "constructor", label: "Owned.mkClaim" }
		, { symbol: "lean", kind: "adapter", label: "echoClaim:lean" }
		, { symbol: "source", kind: "source", label: "Owned.echoClaim" }
	];
	const entries = ownedSelected.slice(1).map(({ kind, label }) => ({ kind, label }));
	const ownedCall = { publicName: "echoClaim", entries
		, counts: { validator: 1, constructor: 1, adapter: 2, source: 1 } };
	const ownedPlan = {
		scope: "separate-instrumented-probe", family: "owned-checked-record"
		, selected: ownedSelected
		, cases: [{ control: "accepted", outcome: "accepted", call: ownedCall }] };
	const ownedTrace = "LB_SUBTYPE_ENTRY_V1 begin public echoClaim\n"
		+ entries.map(entry => `LB_SUBTYPE_ENTRY_V1 enter ${entry.kind} ${entry.label}\n`).join("")
		+ "LB_SUBTYPE_ENTRY_V1 end public echoClaim\n";
	const { value } = await driver({ plan: ownedPlan, trace: ownedTrace });
	assert.equal(value.entryProbe.calls, 1);
	assert.deepEqual(value.entryProbe.counts, ownedCall.counts);
	const refusedEntries = entries.slice(0, 3);
	const refused = { ...ownedPlan, cases: [{
		control: "refused", outcome: "refused"
		, call: { publicName: "echoClaim", entries: refusedEntries
			, counts: { validator: 1, constructor: 1, adapter: 1, source: 0 } } }] };
	const refusedTrace = "LB_SUBTYPE_ENTRY_V1 begin public echoClaim\n"
		+ refusedEntries.map(entry => `LB_SUBTYPE_ENTRY_V1 enter ${entry.kind} ${entry.label}\n`).join("")
		+ "LB_SUBTYPE_ENTRY_V1 end public echoClaim\n";
	assert.equal((await driver({ plan: refused, trace: refusedTrace })).value.entryProbe.calls, 1);
	await assert.rejects(driver({ plan: { ...ownedPlan, cases: [{ ...ownedPlan.cases[0]
		, outcome: "refused" }] }
		, trace: ownedTrace }));
});

test("entry driver admits only declared unmarked sources and refuses their markers", async () => {
	const unmarkedSelected = [...selected
		, { symbol: "value", kind: "source", label: "Probe.value" }
		, { symbol: "redirected", kind: "source", label: "Probe.redirected" }];
	const sourceless = { publicName: "first"
		, entries: call.entries.slice(0, 2)
		, counts: { validator: 1, constructor: 0, adapter: 1, source: 0 } };
	const sourcelessTrace = trace.replace("LB_SUBTYPE_ENTRY_V1 enter source Probe.first\n", "");
	const globals = [unmarkedSelected[4]];
	const reducedArity = [{ ...unmarkedSelected[5], target: "l_Probe_redirected___redArg" }];
	const base = { ...plan, selected: unmarkedSelected, globals, reducedArity };
	for(const [key, label] of [["moduleInitialized", "Probe.value"], ["reducedArity", "Probe.redirected"]])
	{
		const other = key === "moduleInitialized" ? "reducedArity" : "globals";
		const direct = { control: "direct", outcome: "accepted", call: sourceless, [key]: [label] };
		const accepted = { ...base, cases: [direct] };
		delete accepted[other];
		const { value } = await driver({ plan: accepted, trace: sourcelessTrace });
		assert.equal(value.entryProbe.counts.source, 0, key);
		for(const faults of [
			{ plan: { ...accepted, cases: [{ ...accepted.cases[0], [key]: undefined }] } }
			, { plan: { ...accepted, cases: [{ control: "direct", outcome: "accepted", call: sourceless }] } }
			, { plan: { ...accepted, cases: [{ ...accepted.cases[0], [key]: ["Probe.first"] }] } }
			, { plan: { ...accepted, cases: [{ ...accepted.cases[0], [key]: [label, label] }] } }
			, { plan: { ...accepted, cases: [{ ...accepted.cases[0], outcome: "refused" }] } }
			, { plan: { ...accepted, cases: [{ ...accepted.cases[0], call: { publicName: "first"
				, entries: [...sourceless.entries, { kind: "source", label }]
				, counts: { ...sourceless.counts, source: 1 } } }] }
			, trace: sourcelessTrace.replace("LB_SUBTYPE_ENTRY_V1 end", `LB_SUBTYPE_ENTRY_V1 enter source ${label}\nLB_SUBTYPE_ENTRY_V1 end`) }
		]) await assert.rejects(driver({ trace: sourcelessTrace, ...faults }), key);
	}
	const declared = { control: "direct", outcome: "accepted", call: sourceless, moduleInitialized: ["Probe.value"] };
	const second = { control: "second", outcome: "accepted", call: sourceless, reducedArity: ["Probe.redirected"] };
	const both = { ...base, cases: [declared, second] };
	assert.equal((await driver({ plan: both, trace: sourcelessTrace + sourcelessTrace })).value.entryProbe.calls, 2);
	await assert.rejects(driver({ plan: { ...base, cases: [declared] }, trace: sourcelessTrace })
		, /Probe\.redirected classification is exercised/u);
	const onlyGlobals = { ...plan, selected: unmarkedSelected, globals, cases: [declared] };
	assert.equal((await driver({ plan: onlyGlobals, trace: sourcelessTrace })).value.entryProbe.calls, 1);
	const redirected = { control: "direct", outcome: "accepted", call: sourceless, reducedArity: ["Probe.redirected"] };
	const onlyReduced = { ...plan, selected: unmarkedSelected, reducedArity, cases: [redirected] };
	assert.equal((await driver({ plan: onlyReduced, trace: sourcelessTrace })).value.entryProbe.calls, 1);
	for(const value of [
		{ ...onlyGlobals, globals: [] }
		, { ...onlyGlobals, globals: [{ symbol: "missing", kind: "source", label: "Probe.value" }] }
		, { ...onlyGlobals, globals: [{ ...globals[0], kind: "adapter" }] }
		, { ...onlyGlobals, globals: [globals[0], globals[0]] }
		, { ...onlyReduced, reducedArity: [{ ...reducedArity[0], target: "l_Probe_redirected" }] }
		, { ...onlyReduced, reducedArity: [{ ...reducedArity[0], target: undefined }] }
	]) await assert.rejects(driver({ plan: value, trace: sourcelessTrace }));
});
