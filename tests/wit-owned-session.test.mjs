/**
 * Independent public consumers, including reentrant callbacks, through real WIT.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateOwnedCValues } from "../src/backends/c/owned-values.mjs";
import { compileOwnedWitGraphModel } from "../src/backends/wit/owned-graph-model.mjs";
import { generateOwnedWitPackage, ownedWitPublicPrefix } from "../src/backends/wit/owned-package.mjs";
import { renderOwnedWitSession } from "../src/backends/wit/owned-session.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedHostCallbackReviewedIr } from "./helpers/owned-host-callback-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned WIT sessions keep semantic values and use isolated stores for reentry", () => {
	const ir = ownedAggregateReviewedIr(), prefix = ownedWitPublicPrefix(ir);
	const original = generateOwnedCValues(ir), values = generateOwnedCValues(ir, { publicPrefix: prefix });
	assert.equal(prefix, "owned_aggregates_wasmtime");
	assert.equal(values.header, original.header.replaceAll("owned_aggregates", prefix).replaceAll("OWNED_AGGREGATES", prefix.toUpperCase()));
	assert.doesNotMatch(values.header, /wasmtime_component|lean_object|uint64_t token/u);
	for(const name of ["", "two words", "PascalCase", "int", "gmp", "two__underscores"])
		assert.throws(() => generateOwnedCValues(ir, { publicPrefix: name }), /invalid package name/u);
	const model = compileOwnedWitGraphModel(ir), session = renderOwnedWitSession(model, new Uint8Array([0, 97, 115, 109]));
	assert.equal(session.symbols.size, model.functions.length);
	assert.match(session.source, /frame->store = wasmtime_store_new/u);
	assert.match(session.source, /wasmtime_component_func_call\(&function/u);
	assert.match(session.source, /ow_native_call_end\(&frame->call, false\)/u);
	assert.match(session.source, /status = ov_commit\(&transaction, owner\)/u);
});

const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
const output = result => result.stdout.trim().split("\n").map(line => JSON.parse(line));

for(const fixture of ["values", "host callbacks", "scalars"]) for(const reviewed of [false, true])
	test(`owned WIT public ${fixture} execute ${reviewed ? "reviewed" : "ordinary"} Lean`, {
		skip: process.env.LEAN_BRIDGE_WIT_OWNED_SESSION_TEST !== "1", timeout: 600000
	}, async t => {
		const callbacks = fixture === "host callbacks", scalars = fixture === "scalars";
		const review = scalars ? ownedPythonScalarsReviewedIr : callbacks ? ownedHostCallbackReviewedIr : ownedAggregateReviewedIr;
		const compiled = await compileOwnedAggregateFixture(t, {
			hostCallbacks: callbacks
			, ...callbacks ? { fixture: "owned-host-callbacks" } : {}
			, ...scalars ? { fixture: "owned-scalars", witness: "import Owned\n" } : {}
			, ...reviewed ? { reviewedIr: review() } : {}
		});
		const model = compileOwnedWitGraphModel(compiled.model.bindingIr);
		await saveLakeFile(compiled.directory, "component.wat", model.wat);
		await runCopied("wasm-tools", ["parse", "component.wat", "-o", "component.wasm"], compiled.directory, process.env);
		await runCopied("wasm-tools", ["validate", "component.wasm"], compiled.directory, process.env);
		const component = await readFile(join(compiled.directory, "component.wasm"));
		const generated = generateOwnedWitPackage({ metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component
			, hostCallbacks: callbacks }, component);
		assert.equal(generated.carriers.leanSource, compiled.leanSource);
		assert.equal(generated.carriers.header, compiled.header);
		assert.equal(generated.model.wat, model.wat);
		const sdk = join(compiled.directory, "wasmtime");
		await snapshotWasmtimeCapi(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? resolve(".toolchains/wasmtime42"), sdk);
		let observed = generated.source;
		const invoke = "wasmtime_error_t *error = wasmtime_component_func_call(";
		assert.equal(observed.split(invoke).length, 2);
		observed = observed.replace(invoke, "++test_component_calls; " + invoke);
		const entry = "wasmtime_component_val_t *results, size_t result_count) {\n  (void)type;";
		assert.equal(observed.split(entry).length, generated.model.functions.length + 1);
		observed = observed.replaceAll(entry, entry + " ++test_native_imports;");
		for(const fn of [...generated.layout.functions, ...generated.layout.callbacks])
		{
			const call = `status = ${fn.symbol}(host->native, `;
			assert.equal(observed.split(call).length, 2);
			observed = observed.replace(call, "++test_lean_calls; " + call);
			assert.ok(!observed.includes(`status = ${fn.symbol}(&active->native, `), "Public export bypassed WIT");
		}
		let direct = "";
		if(scalars)
		{
			const symbol = name => generated.carriers.symbols.exports[generated.layout.functions.find(fn => fn.name === name).id];
			direct = `void owned_test_direct(unsigned count) {
  if (!lean_bridge_native_component_initialize(${JSON.stringify(compiled.model.component.id)}, oc_initialize)) abort();
  for (unsigned i = 0; i < count; ++i) {
    lean_object *ticket = ${symbol("newTicket")}(ov_carry(lean_box(42)), ov_carry(lean_mk_string("ticket")));
    lean_object *packet = ${symbol("makePacket")}(ticket);
    lean_object *correct = ${symbol("inspect")}(packet);
    if (!ov_carrier(correct) || lean_unbox(lean_array_get_core(correct, 0)) != 1) abort();
    lean_dec(correct);
  }
}
`;
		}
		const implementation = `#include <stddef.h>
extern void *owned_test_allocate(size_t);
extern void owned_test_free(void *);
#define LB_OWNED_ALLOC owned_test_allocate
#define LB_OWNED_FREE owned_test_free
static size_t test_component_calls, test_native_imports, test_lean_calls;
${observed}
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
size_t owned_test_component_calls(void) { return test_component_calls; }
size_t owned_test_native_imports(void) { return test_native_imports; }
size_t owned_test_lean_calls(void) { return test_lean_calls; }
void owned_test_retire(void) { lean_bridge_native_runtime_retire(); }
${direct}
`;
		for(const [path, source] of Object.entries(generated.files))
			await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1)
				, path.startsWith("src/") ? implementation : source);
		const probe = scalars ? "owned-public-scalars" : callbacks ? "owned-host-callbacks" : "owned-public-values";
		let source = await readFile(`tests/fixtures/structured-types/${probe}.c`, "utf8");
		source = source.replaceAll("owned_aggregates", generated.values.prefix).replaceAll("OWNED_AGGREGATES", generated.values.prefix.toUpperCase());
		source = source.replace("int main(void)", "static int consumer_main(void)") + `
extern size_t owned_test_component_calls(void);
extern size_t owned_test_native_imports(void);
extern size_t owned_test_lean_calls(void);
int main(void) {
  int status = consumer_main();
  printf("{\\"componentCalls\\":%zu,\\"nativeImports\\":%zu,\\"leanCalls\\":%zu}\\n",
    owned_test_component_calls(), owned_test_native_imports(), owned_test_lean_calls());
  return status;
}
`;
		const extra = ["public-api.c", "-lgmp", "-I", join(sdk, "include"), "-L", join(sdk, "lib"), `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime"];
		const run = await compiled.compile("owned-wit-public", source, false, extra);
		const normal = await run(); assert.equal(normal.stderr, "");
		const [report, counts] = output(normal);
		assert.ok(report.checks > 100); assert.ok(report.failures > 10);
		assert.equal(report.live, 0); assert.equal(report.identities, 0);
		assert.ok(counts.componentCalls > (scalars ? 20 : 100)); assert.equal(counts.componentCalls, counts.nativeImports);
		assert.ok(counts.leanCalls > (scalars ? 10 : 100) && counts.leanCalls <= counts.nativeImports);
		if(scalars) assert.equal(report.primitives, 19);
		t.diagnostic(JSON.stringify({ fixture, reviewed, ...report, ...counts }));
		const sanitized = await compiled.compile("owned-wit-public-sanitized", source, true, extra);
		const cold = await sanitized([], { LSAN_OPTIONS: "exitcode=0", LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
		const exercised = await sanitized([], { LSAN_OPTIONS: "exitcode=0" });
		assert.deepEqual(output(cold), [{ cold: true }, { componentCalls: 0, nativeImports: 0, leanCalls: 0 }]);
		assert.deepEqual(output(exercised), output(normal));
		let baseline = cold;
		if(scalars)
		{
			baseline = await sanitized([], { LSAN_OPTIONS: "exitcode=0", LEAN_BRIDGE_OWNED_LEAN_ONLY: "1" });
			const repeated = await sanitized([], { LSAN_OPTIONS: "exitcode=0", LEAN_BRIDGE_OWNED_LEAN_ONLY: "100" });
			assert.deepEqual(output(baseline), [{ direct: true }, { componentCalls: 0, nativeImports: 0, leanCalls: 0 }]);
			assert.deepEqual(output(repeated), output(baseline));
			assert.equal(normalize(repeated.stderr), normalize(baseline.stderr), "Direct Lean calls added per-call leaks");
		}
		assert.equal(normalize(exercised.stderr), normalize(baseline.stderr), "Public WIT sessions changed the independent Lean leak baseline");
		assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
		if(fixture === "values" && !reviewed)
		{
			const ticket = generated.layout.nodes.find(node => node.id === "lean:Owned.Ticket");
			for(const [name, before, after] of [
				["missing-store-lease-cleanup"
					, "if (frame->host.self && !ow_native_host_close(&frame->host) && !status) status = LB_OWNED_RUNTIME;"
					, "(void)frame->host;"]
				, ["missing-independent-result-owner"
					, `if (!status) status = ${ticket.walker}_out(&converted, value, 0, &transaction);`
					, "if (!status) { lean_dec(value); converted = decoded; }"]
			]) {
				assert.ok(implementation.includes(before));
				await saveLakeFile(compiled.directory, "public-api.c", implementation.replaceAll(before, after));
				const changed = await compiled.compile(name, source, false, extra);
				await assert.rejects(() => changed(), /public C check failed/u);
				t.diagnostic(`rejected mutation: ${name}`);
			}
		}
	});
