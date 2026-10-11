/**
 * Synthetic driver controls. These do not establish PHP, Lean or browser execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { subtypeEntryCall, subtypeEntryCorpusCalls } from "./php-wasm-subtype-entry-cases.mjs";

const traceOf = calls => calls.map(call => [
	`LB_SUBTYPE_ENTRY_V1 begin public ${call.publicName}`
	, ...call.entries.map(item => `LB_SUBTYPE_ENTRY_V1 enter ${item.kind} ${item.label}`)
	, `LB_SUBTYPE_ENTRY_V1 end public ${call.publicName}`
].join("\n") + "\n").join("");
const completeTrace = traceOf(subtypeEntryCorpusCalls());
const controlTrace = traceOf([subtypeEntryCall("unrestricted")]);
const request = JSON.stringify({ module: "LeanSubtypes", operations: { probe: "half" }, autoload: "vendor/autoload.php" });

/**
 * Load the exact portable driver with the same relative helper layout as an installed app.
 *
 * @param t - Test cleanup owner.
 */
const driver = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-subtype-entry-driver-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await cp("tests/fixtures/php-wasm-subtype-entry/driver.mjs", join(root, "driver.mjs"));
	for(const [source, destination] of [["trace", "entry-trace"], ["cases", "entry-cases"]])
		await cp(`tests/helpers/php-wasm-subtype-entry-${source}.mjs`, join(root, destination + ".mjs"));
	return (await import(pathToFileURL(join(root, "driver.mjs")))).executePhpWasmCorpus;
};

/**
 * An inert host exposing selected transcript faults, not a PHP evaluator.
 *
 * @param faults - Explicit fake-host output overrides.
 */
const fakeHost = (faults = {}) => {
	/**
	 * Construct an inert host interface with no PHP evaluation or filesystem access.
	 *
	 * @param options - Driver-selected descriptors and library callback.
	 */
	return function FakeHost(options) {
		const events = new Map(), emit = (name, bytes) => events.get(name)({ detail: [bytes.slice(0, 17), bytes.slice(17)] });
		if(options.sharedLibs.length) options.locateFile("fixture.so");
		return { binary: Promise.resolve()
			, addEventListener: (name, callback) => { events.set(name, callback); }
			, writeFile: async () => {}
			, run: async code => {
				if(/require '\/(weak|strict)\.php'/u.test(code))
				{
					if(options.dynamicLibs.length) options.locateFile("fixture.so");
					emit("output", JSON.stringify({ checks: faults.checks ?? 2024, word_bits: 32, php: "8.4.1" }));
					emit("error", faults.trace ?? completeTrace);
					return faults.status ?? 0;
				}
				if(code.includes("unrestricted"))
				{
					emit("output", JSON.stringify(faults.controlValue ?? "7"));
					emit("error", faults.controlTrace ?? controlTrace);
				}
				else if(faults.earlyStderr) emit("error", faults.earlyStderr);
				return 0;
			}
		};
	};
};

test("probe driver preserves arrangements and validates all synthetic rows across loading modes", async t => {
	const execute = await driver(t);
	for(const loading of ["startup", "lazy"])
	for(const mode of ["weak", "strict"])
	for(const mounted of [false, true])
	{
		let mounts = 0;
		const observed = await execute({ Php: fakeHost()
			, api: { extensions: {}, lazy: { extensions: {} } }
			, loading, mode, request, source: "synthetic source, never evaluated"
			, mount: mounted ? async () => { mounts++; } : undefined });
		assert.equal(mounts, mounted ? 1 : 0);
		assert.equal(observed.entryProbe.calls, 2030);
		assert.equal(observed.entryProbe.trace, completeTrace); assert.equal(observed.entryProbe.controlTrace, controlTrace);
		assert.deepEqual(observed.entryProbe.counts, { validator: 2029, constructor: 3045, adapter: 1017, source: 1016 });
		assert.deepEqual(observed.phases, ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage, libraries: loading === "startup" || stage === "complete" ? ["fixture.so"] : [] })));
	}
});

test("probe driver rejects absent instrumentation, altered call sequences and incorrect positive controls", async t => {
	const execute = await driver(t);
	const options = { api: { extensions: {}, lazy: { extensions: {} } }, loading: "startup", mode: "weak", request, source: "synthetic" };
	for(const faults of [
		{ trace: "" }
		, { trace: completeTrace.replace("LB_SUBTYPE_ENTRY_V1 enter source Subtypes.echo\n", "") }
		, { trace: completeTrace + completeTrace }
		, { trace: "unexpected\n" + completeTrace }
		, { trace: completeTrace.replace("enter constructor", "enter source") }
		, { controlTrace: "" }
		, { controlValue: "8" }
		, { checks: 2023 }
		, { status: 1 }
		, { earlyStderr: "unexpected\n" }
	]) await assert.rejects(() => execute({ ...options, Php: fakeHost(faults) }));
	for(const changed of [{ loading: "unknown" }, { mode: "unknown" }, { request: '{}' }])
		await assert.rejects(() => execute({ ...options, ...changed, Php: fakeHost() }));
});
