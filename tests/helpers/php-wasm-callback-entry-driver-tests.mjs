/**
 * Browser-safe controls for the synchronous callback entry driver.
 * These use an inert transcript host and establish no PHP or Lean execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const kinds = [
	"adapter", "validator", "constructor", "recovery", "callback"
	, "rejection", "closure", "cleanup", "source"
];
const counts = entries => Object.fromEntries(kinds.map(kind => [
	kind, entries.filter(entry => entry.kind === kind).length
]));
const selected = [
	{ symbol: "public_call", kind: "public", label: "Probe.call" }
	, { symbol: "native_call", kind: "adapter", label: "Probe.call:native" }
	, { symbol: "lean_call", kind: "adapter", label: "Probe.call:lean" }
	, { symbol: "source_call", kind: "source", label: "Probe.call" }
	, { symbol: "callback_call", kind: "callback", label: "Probe.call:callback:zend" }
	, { symbol: "cleanup_call", kind: "cleanup", label: "Probe.call:cleanup" }
];
const entries = selected.slice(1).map(({ kind, label }) => ({ kind, label }));
const acceptedCall = { publicName: "Probe.call", entries, counts: counts(entries) };
const plan = {
	scope: "separate-instrumented-probe"
	, family: "callback-fin"
	, selected
	, cases: [
		{ control: "accepted", outcome: "accepted", calls: [acceptedCall] }
		, { control: "preflight-refusal", outcome: "refused", calls: [] }
	]
};
const traceOf = calls => calls.map(call => [
	`LB_CALLBACK_ENTRY_V1 begin public ${call.publicName}`
	, ...call.entries.map(entry => `LB_CALLBACK_ENTRY_V1 enter ${entry.kind} ${entry.label}`)
	, `LB_CALLBACK_ENTRY_V1 end public ${call.publicName}`
].join("\n") + "\n").join("");
const acceptedTrace = traceOf([acceptedCall]);

const loadDriver = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-callback-entry-driver-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await cp("tests/fixtures/php-wasm-callback-entry/driver.mjs", join(root, "driver.mjs"));
	await cp("tests/helpers/php-wasm-callback-entry-trace.mjs"
		, join(root, "callback-entry-trace.mjs"));
	return (await import(pathToFileURL(join(root, "driver.mjs"))
		+ `?${Date.now()}-${Math.random()}`)).executePhpWasmCorpus;
};

/**
 * Return one inert transcript host with explicit fault injection.
 *
 * @param faults - Synthetic output and status overrides.
 */
const fakeHost = (faults = {}) => {
	/**
	 * Inert host interface used by the portable driver.
	 *
	 * @param options - Driver-selected loading descriptors.
	 */
	function FakeHost(options)
	{
		const events = new Map();
		const emit = (name, value) => {
			const split = Math.max(1, Math.floor(value.length / 2));
			events.get(name)({ detail: [value.slice(0, split), value.slice(split)] });
		};
		if(options.sharedLibs.length) options.locateFile("probe.so");
		return { binary: Promise.resolve()
			, addEventListener: (name, callback) => { events.set(name, callback); }
			, writeFile: async () => {}
			, run: async code => {
				if(code.includes("require '/weak.php'") || code.includes("require '/strict.php'"))
				{
					if(options.dynamicLibs.length) options.locateFile("probe.so");
					if(faults.earlyStderr) emit("error", faults.earlyStderr);
				}
				const match = /lean_bridge_callback_probe\("([a-z-]+)"\)/u.exec(code);
				if(match)
				{
					const control = match[1];
					const outcome = control === "preflight-refusal" ? "refused" : "accepted";
					const result = faults.result ?? { control, outcome };
					emit("output", (faults.output ?? JSON.stringify(result)) + "\n");
					if(control === "accepted") emit("error", faults.trace ?? acceptedTrace);
					else if(faults.refusalTrace) emit("error", faults.refusalTrace);
				}
				return faults.status ?? 0;
			}
		};
	}
	return FakeHost;
};

const request = changedPlan => JSON.stringify({
	module: "Probe"
	, operations: { probe: "call" }
	, autoload: "vendor/autoload.php", entryProbe: changedPlan ?? plan });

test("callback entry driver authenticates every isolated control and loading phase", async t => {
	const execute = await loadDriver(t);
	for(const loading of ["startup", "lazy"])
	for(const mode of ["weak", "strict"])
	for(const mounted of [false, true])
	{
		let mounts = 0;
		const value = await execute({
			Php: fakeHost()
			, api: { extensions: {}, lazy: { extensions: {} } }
			, loading, mode, request: request(), source: "synthetic caller"
			, mount: mounted ? async () => { mounts++; } : undefined });
		assert.equal(mounts, mounted ? 1 : 0);
		assert.deepEqual(value.observation, { controls: 2, accepted: 1, refused: 1 });
		assert.deepEqual(value.entryProbe.controls, ["accepted", "preflight-refusal"]);
		assert.equal(value.entryProbe.cases[0].trace, acceptedTrace);
		assert.equal(value.entryProbe.cases[1].trace, "");
		assert.deepEqual(value.phases, ["ready", "autoload", "invalid", "complete"].map(stage => ({
			stage
			, libraries: loading === "startup" || stage === "complete" ? ["probe.so"] : []
		})));
	}
});

test("callback entry driver refuses protocol, outcome and trace drift", async t => {
	const execute = await loadDriver(t);
	const options = { api: { extensions: {}, lazy: { extensions: {} } }
		, loading: "startup"
		, mode: "weak"
		, request: request()
		, source: "synthetic caller" };
	for(const faults of [
		{ trace: acceptedTrace.replace("enter source Probe.call\n", "") }
		, { trace: acceptedTrace + "unexpected\n" }
		, { refusalTrace: acceptedTrace }
		, { result: { control: "accepted", outcome: "refused" } }
		, { output: JSON.stringify({ control: "accepted", outcome: "accepted" }) + "\nextra" }
		, { earlyStderr: "unexpected\n" }
		, { status: 1 }
	]) await assert.rejects(() => execute({ ...options, Php: fakeHost(faults) }));
	const malformed = [
		{ ...plan, extra: true }
		, { ...plan, cases: [] }
		, { ...plan, cases: [{ ...plan.cases[0], outcome: "refused" }, plan.cases[1]] }
		, { ...plan, cases: [{ ...plan.cases[0], calls: [{ ...acceptedCall
			, counts: { ...acceptedCall.counts, source: 0 } }] }
			, plan.cases[1]] }
	];
	for(const entryProbe of malformed)
		await assert.rejects(() => execute({ ...options, Php: fakeHost(), request: request(entryProbe) }));
	for(const changed of [
		{ loading: "other" }, { mode: "other" }, { request: "{}" }
		, { request: JSON.stringify({ module: "Probe", operations: { probe: "call" }
			, autoload: "/absolute.php", entryProbe: plan }) }
	]) await assert.rejects(() => execute({ ...options, ...changed, Php: fakeHost() }));
});

test("callback entry trace drift reports the parsed actual and expected calls"
	, async t => {
	const execute = await loadDriver(t);
	const changed = acceptedTrace.replace(
		"LB_CALLBACK_ENTRY_V1 enter source Probe.call\n", ""
	);
	await assert.rejects(() => execute({
		Php: fakeHost({ trace: changed })
		, api: { extensions: {}, lazy: { extensions: {} } }
		, loading: "startup", mode: "weak", request: request()
		, source: "synthetic caller"
	}), error => {
		assert.match(error.message, /callback trace differs: accepted/u);
		const difference = JSON.parse(error.message.slice(
			error.message.indexOf("{")
		));
		assert.equal(difference.actual[0].counts.source, 0);
		assert.equal(difference.expected[0].counts.source, 1);
		return true;
	});
	}
);
