/**
 * Returned Lean closures that refuse a checked argument locate the first refused position
 * through one private, one-shot thread-local accessor. The compiled controls run the real
 * generated lease calls against stand-in Lean exports and runtime services; they are
 * transport evidence, not an installed-package claim.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { generateNativeCallableGraphCalls } from "../src/backends/c/native-callable-graph-calls.mjs";
import { generateCallableCGraphPackage } from "../src/backends/c/callable-graph-package.mjs";
import { brokerHeader } from "../src/backends/native/runtime-broker.mjs";
import { nativeCallbackHeader } from "../src/backends/native/callback-broker.mjs";
import { compileCallableWitGraphModel } from "../src/backends/wit/callable-graph-model.mjs";
import { renderWitGraphCallableHostSource } from "../src/backends/wit/callable-graph-host.mjs";
import { componentStructuredCallbackDirection } from "../src/abi/component-structured-callables.mjs";
import {
	componentStructuredCallableLeanSource, componentStructuredCallablePrefix, componentStructuredClosureRefusals
} from "../src/build/component-structured-callable-lean.mjs";
import { createNativeCallableGraphDescriptor, nativeCallableGraphCarrierAbi } from "../src/build/native-callable-graph.mjs";
import {
	structuredCallableDirectionalCheckedRecordIr, structuredCallableDirectionalSubtypeIr, structuredCallableReviewedIr
} from "./helpers/structured-callable-fixture.mjs";
import "./helpers/callable-closure-refusal-source-history-tests.mjs";

const run = promisify(execFile);
const initializer = "initialize_LeanBridgeNative0123456789abcdef";
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const refinements = (closure, value) => { closure.source.extensions["lean-lang.org/refinements"] = value; };
// Two checked arguments: the closure converts value0 before value1.
const twoArguments = () => {
	const fixture = structuredCallableDirectionalSubtypeIr();
	fixture.closure.callable.parameters[0].type = { kind: "primitive", name: "nat" };
	const subtype = constructor => ({ kind: "subtype", constructor });
	refinements(fixture.closure, {
		parameters: [subtype("Structured.firstClosureArgument"), subtype("Structured.checkedClosureArgument")]
		, result: subtype(null)
	});
	return fixture;
};
// A checked record whose fields carry a Subtype and a Fin bound. Every site shares that field
// layout; only sites where Lean consumes the record select the field constructor.
const nestedRecord = () => {
	const fixture = structuredCallableDirectionalCheckedRecordIr();
	const fields = constructor => [{ name: "lo", refinement: { kind: "subtype", constructor } }
		, { name: "hi", refinement: { kind: "fin", bound: "100" } }];
	const host = fixture.host.source.extensions["lean-lang.org/refinements"];
	const closure = fixture.closure.source.extensions["lean-lang.org/refinements"];
	host.parameters[0] = { ...host.parameters[0], fields: fields(null) };
	host.result = { ...host.result, fields: fields("Structured.checkedLow") };
	closure.parameters[1] = { ...closure.parameters[1], fields: fields("Structured.checkedLow") };
	return fixture;
};
// A closure whose only check is a Fin bound; only a backend that recovers Fin roles leases it.
const pureFin = () => {
	const fixture = structuredCallableDirectionalSubtypeIr();
	refinements(fixture.closure, { parameters: [null, { kind: "fin", bound: "10" }], result: null });
	return fixture;
};
const generate = (ir, options = {}) => {
	const descriptor = createNativeCallableGraphDescriptor(ir);
	const abi = nativeCallableGraphCarrierAbi(descriptor, ir);
	const exports = abi.exports.map((item, index) => ({
		bindingId: item.bindingId, symbol: item.symbol, wrapper: `export${index}`
		, sourceDeclaration: ir.declarations.find(declaration => declaration.id === item.bindingId).source.declaration
		, parameters: item.parameters.map(() => ({ leanType: "" }))
	}));
	return { abi
		, native: generateNativeCallableGraphCalls(ir, descriptor, { initializer, ...options })
		, lean: componentStructuredCallableLeanSource(abi, exports, options).join("\n") };
};
const occurrences = (text, pattern) => text.split(pattern).length - 1;
const exported = lean => new Set([...lean.matchAll(/@\[export (\w+_closure_graph_refinement_\w+)\]/gu)].map(match => match[1]));
const referenced = source => new Set([...source.matchAll(/extern uint8_t (\w+_closure_graph_refinement_\w+)\(lean_object \*\);/gu)].map(match => match[1]));
// The validator each located refusal calls, with the constructor its message names.
const validators = source => new Map([...source.matchAll(/if \(!(\w+)\(ng_\w+_in\(value\)\)\)\n {4}return ng_refinement_reject\(" was rejected by ([\w.]+)"\);/gu)]
	.map(match => [match[1], match[2]]));

test("Lean leaf checks and native walkers share one tree, one leaf identity and the closure's conversion order", () => {
	for(const fixture of [twoArguments(), nestedRecord()])
	{
		const { native, lean } = generate(fixture.ir);
		assert.deepEqual(referenced(native.source), exported(lean));
		assert.ok(exported(lean).size > 0);
	}
	const { native: two } = generate(twoArguments().ir);
	const refusal = two.source.slice(two.source.indexOf("static uint32_t ng_closure_refusal_"));
	// value0 is located before value1, each in one ordered pass over its whole tree.
	assert.ok(refusal.indexOf('"value0"') < refusal.indexOf('"value1"'));
	assert.equal(occurrences(refusal.slice(0, refusal.indexOf("\n}\n")), "refinement_nodes = "), 1);
	assert.deepEqual([...validators(two.source).values()].sort(), ["Structured.checkedClosureArgument", "Structured.firstClosureArgument"]);
	const { native: nested } = generate(nestedRecord().ir);
	// The record's own walker checks .lo, then the .hi bound, then its constructor.
	const record = nested.source.slice(nested.source.lastIndexOf("static uint32_t ng_refinement_", nested.source.indexOf("was rejected by Structured.mkInterval")));
	const low = record.indexOf('ng_refinement_text(".lo"'), high = record.indexOf('ng_refinement_text(".hi"');
	assert.ok(low > 0 && low < high && high < record.indexOf("Structured.mkInterval"));
	assert.match(nested.source, /return ng_refinement_reject\(" is not below its Fin 100 bound"\);/u);
	assert.match(nested.source, /return ng_refinement_reject\(" was rejected by Structured\.checkedLow"\);/u);
});

test("refusing components clear the diagnostic on every call and keep it only after a located refusal", () => {
	const { abi, native } = generate(twoArguments().ir);
	const p = native.layout.prefix, closure = abi.callbacks.find(signature => componentStructuredCallbackDirection(abi, signature) === "closure");
	assert.equal(occurrences(native.header, `const char *${p}_callable_graph_error(void);`), 1);
	const call = native.source.slice(native.source.indexOf(`uint32_t ${p}_callback_${closure.key}_lease_call(`));
	const body = call.slice(0, call.indexOf("\n}\n"));
	assert.match(body, /^uint32_t [^{]+\{\n {2}ng_refinement_reset\(\);\n {2}int refused = 0;\n/u);
	assert.match(body, new RegExp(`lean_array_size\\(value\\) == 0\\) \\{\\n {4}refused = ng_closure_refusal_${closure.key}\\(a0, a1\\) == NG_INVALID;\\n {4}lean_dec\\(value\\);`, "u"));
	assert.match(body, /uint32_t status = ng_call_leave\(call\);\n {2}if \(status != NG_INVALID \|\| !refused\) ng_refinement_reset\(\);\n/u);
	// Every other generated call clears on entry and after leaving.
	const calls = native.source.split(/\n(?=uint32_t \w+\()/u).filter(text => /^uint32_t \w+\(/u.test(text) && !text.includes("int refused"));
	assert.ok(calls.length > 1);
	for(const text of calls)
	{
		assert.match(text, /^uint32_t [^{]+\{\n {2}ng_refinement_reset\(\);\n/u);
		assert.match(text, /uint32_t status = ng_call_leave\(call\);\n {2}ng_refinement_reset\(\);\n/u);
	}
});

test("components without a refusing closure keep their exact sources; a pure Fin closure is located only where its role is recovered", () => {
	const plain = generate(structuredCallableReviewedIr());
	for(const text of [plain.native.header, plain.native.source, plain.lean])
		assert.doesNotMatch(text, /callable_graph_error|ng_refinement_|_closure_graph_refinement_/u);
	// Native hosts do not recover Fin-only roles: such a callback is neither leased nor located.
	const fin = pureFin(), descriptor = createNativeCallableGraphDescriptor(fin.ir);
	const abi = nativeCallableGraphCarrierAbi(descriptor, fin.ir), signature = abi.callbacks.find(item => item.id === fin.closure.id);
	assert.equal(componentStructuredCallbackDirection(abi, signature), null);
	assert.equal(componentStructuredClosureRefusals(abi), null);
	assert.doesNotMatch(generate(fin.ir).native.source, /callable_graph_error/u);
	// A backend that recovers the closure role locates the bound in C, with no Lean leaf check.
	assert.equal(componentStructuredCallbackDirection(abi, signature, true), "closure");
	const recovered = generate(fin.ir, { finDirections: true });
	assert.match(recovered.native.source, /return ng_refinement_reject\(" is not below its Fin 10 bound"\);/u);
	assert.equal(exported(recovered.lean).size, 0);
	assert.equal(referenced(recovered.native.source).size, 0);
});

test("WIT reads the accessor once, only after a refusing closure's invalid status; public C projections never name it", () => {
	const { ir } = twoArguments(), { native } = generate(ir);
	const accessor = `${native.layout.prefix}_callable_graph_error`;
	const wit = renderWitGraphCallableHostSource(compileCallableWitGraphModel(ir), new Uint8Array([0]));
	assert.equal(occurrences(wit, `${accessor}()`), 1);
	assert.match(wit, new RegExp(`if \\(status\\) \\{ const char \\*refusal = status == 1 \\? ${accessor}\\(\\) : NULL;\\n {6}if \\(refusal\\) lb_record_text\\(session, refusal, strlen\\(refusal\\)\\);\\n {6}else lb_record_text\\(session, "Native Lean closure call failed"`, "u"));
	const plain = renderWitGraphCallableHostSource(compileCallableWitGraphModel(structuredCallableReviewedIr()), new Uint8Array([0]));
	assert.doesNotMatch(plain, /callable_graph_error/u);
	for(const [path, text] of Object.entries(generateCallableCGraphPackage(ir).files))
		assert.doesNotMatch(String(text), /callable_graph_error/u, path);
});

const harness = async (t, label, ir, { finDirections = false, ok, refused, both = null }) => {
	try
	{ await access(join(leanPrefix, "include/lean/lean.h")); }
	catch
	{ t.skip(`Lean toolchain unavailable at ${leanPrefix}`); return null; }
	const directory = await mkdtemp(join(tmpdir(), `lean-closure-refusal-${label}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const descriptor = createNativeCallableGraphDescriptor(ir);
	const abi = nativeCallableGraphCarrierAbi(descriptor, ir);
	const native = generateNativeCallableGraphCalls(ir, descriptor, { initializer, finDirections });
	const p = native.layout.prefix;
	const closure = abi.callbacks.find(signature => componentStructuredCallbackDirection(abi, signature, finDirections) === "closure");
	const lease = `${p}_callback_${closure.key}_lease`, kind = `${ir.component.id}:graph-callback:${closure.key}`;
	const apply = `${componentStructuredCallablePrefix(abi, closure)}_apply`;
	// The Lean constructor helper behind the Interval walker, when the fixture passes one.
	const interval = native.source.match(/static inline lean_object \*(ng_\w+)_in\(const structured_interval_t \*value\) \{/u)?.[1];
	const make = interval && native.source.match(new RegExp(`static lean_object \\*${interval}_make\\(lean_object \\*items\\) \\{[^}]*return (\\w+)\\(a0, a1\\);`, "u"))[1];
	// Stand-in constructors: firstClosureArgument < 50, checkedClosureArgument < 100,
	// checkedLow < 10 and mkInterval lo <= hi. Apply refuses exactly when its closure's
	// in-order conversion would, unless forced to refuse an accepted call.
	const checks = {
		"Structured.firstClosureArgument": "nat(carrier) < 50"
		, "Structured.checkedClosureArgument": "nat(carrier) < 100"
		, "Structured.checkedLow": "nat(carrier) < 10"
		, "Structured.mkInterval": "interval_lo(carrier) <= interval_hi(carrier)"
	};
	const located = [...validators(native.source)];
	const accepts = { twoArguments: "nat(a0) < 50 && nat(a1) < 100"
		, nestedRecord: "interval_lo(a1) < 10 && interval_hi(a1) < 100 && interval_lo(a1) <= interval_hi(a1)"
		, pureFin: "nat(a1) < 10" }[label];
	const stubs = `#include <lean/lean.h>
#include <stdlib.h>
#include "lean_bridge_native_runtime.h"
unsigned long stub_validations;
int stub_force_refusal;
static uint64_t next_identity = 1;
int lean_bridge_native_component_initialize(const char *id, lean_bridge_native_initializer init) { (void)id; (void)init; return 1; }
int lean_bridge_native_component_ready(const char *id) { (void)id; return 1; }
void lean_bridge_native_runtime_retire(void) { abort(); }
uint64_t lean_bridge_native_identity_acquire(const char *kind, const void *pointer) { (void)kind; (void)pointer; return next_identity++; }
int lean_bridge_native_identity_release(uint64_t token, const char *kind, const void *pointer) { (void)token; (void)kind; (void)pointer; return 1; }
/* These leases borrow no host callbacks, so the registry is never asked to register one. */
${nativeCallbackHeader}
uint64_t lb_native_callback_register(void (*invoke)(void), void *context) { (void)invoke; (void)context; abort(); }
void lb_native_callback_release(uint64_t token) { (void)token; abort(); }
lb_native_callback lb_native_callback_lookup(uint64_t token) { (void)token; abort(); }
int lb_native_callback_wrong_thread(uint64_t token) { (void)token; return 0; }
int lb_native_callback_take_error(void) { return 0; }
static inline size_t nat(lean_object *carrier) { return lean_unbox(lean_array_get_core(carrier, 0)); }
static inline size_t interval_lo(lean_object *carrier) { return lean_unbox(lean_ctor_get(lean_array_get_core(carrier, 0), 0)); }
static inline size_t interval_hi(lean_object *carrier) { return lean_unbox(lean_ctor_get(lean_array_get_core(carrier, 0), 1)); }
${make ? `lean_object *${make}(lean_object *lo, lean_object *hi) {
  lean_object *value = lean_alloc_ctor(0, 2, 0);
  lean_ctor_set(value, 0, lean_box(nat(lo))); lean_ctor_set(value, 1, lean_box(nat(hi)));
  lean_dec(lo); lean_dec(hi);
  lean_object *carrier = lean_alloc_array(1, 1); lean_array_set_core(carrier, 0, value); return carrier;
}` : ""}
${located.map(([symbol, constructor]) => `uint8_t ${symbol}(lean_object *carrier) {
  ++stub_validations; uint8_t accepted = ${checks[constructor]}; lean_dec(carrier); return accepted;
}`).join("\n")}
lean_object *${apply}(lean_object *closure, lean_object *a0, lean_object *a1) {
  int accepted = !stub_force_refusal && ${accepts};
  lean_dec(closure); lean_dec(a0); lean_dec(a1);
  if (!accepted) return lean_alloc_array(0, 0);
  lean_object *carrier = lean_alloc_array(1, 1); lean_array_set_core(carrier, 0, lean_box(7)); return carrier;
}
`;
	const argument = label === "nestedRecord" ? "bool a0 = true; uint32_t lo = x, hi = y; structured_interval_t a1 = { .lo = { .data = &lo, .length = 1 }, .hi = { .data = &hi, .length = 1 } };"
		: label === "pureFin" ? "bool a0 = x != 0; uint32_t limb = y; structured_scalar_nat_t a1 = { .data = &limb, .length = 1 };"
			: "uint32_t first = x, second = y; structured_scalar_nat_t a0 = { .data = &first, .length = 1 }, a1 = { .data = &second, .length = 1 };";
	const lines = [];
	const report = (name, expression) => lines.push(`  report(${JSON.stringify(name)}, ${expression});`);
	const quiet = expression => lines.push(`  quiet(${expression});`);
	report("accepted", `call(a, ${ok})`);
	for(const [name, args] of refused)
	{
		report(name, `call(a, ${args})`);
		report("read-again", "0");
	}
	if(both) report("both-refused", `call(a, ${both})`);
	quiet(`call(a, ${refused[0][1]})`); report("after-success", `call(a, ${ok})`);
	quiet(`call(a, ${refused[0][1]})`); report("after-invalid-token", `call(UINT64_MAX, ${ok})`);
	quiet(`call(a, ${refused[0][1]})`); report("after-structural", `call_without_out(a, ${ok})`);
	quiet(`call(a, ${refused[0][1]})`); report("other-closure-accepted", `call(b, ${ok})`);
	report("other-closure-refused", `call(b, ${refused[0][1]})`);
	report("recovered", `call(a, ${ok})`); report("refused-again", `call(a, ${refused[0][1]})`);
	lines.push(`  ${lease}_dispose(a);`);
	quiet(`call(b, ${refused[0][1]})`); report("disposed", `call(a, ${ok})`);
	lines.push("  stub_force_refusal = 1;"); report("unlocated", `call(b, ${ok})`); lines.push("  stub_force_refusal = 0;");
	report("final", `call(b, ${ok})`);
	const program = `#include <stdint.h>
${nativeCallbackHeader}
${native.source}
#include <stdio.h>
void lean_initialize_runtime_module(void);
extern unsigned long stub_validations;
extern int stub_force_refusal;
static unsigned long seen;
static uint32_t call_into(uint64_t token, uint32_t x, uint32_t y, int with_out) {
  ${argument}
  structured_scalar_nat_t out = {0};
  uint32_t status = ${lease}_call(token, &a0, &a1, with_out ? &out : NULL);
  if (!status && out._bridge_release) out._bridge_release(out._bridge_owner);
  return status;
}
static uint32_t call(uint64_t token, uint32_t x, uint32_t y) { return call_into(token, x, y, 1); }
static uint32_t call_without_out(uint64_t token, uint32_t x, uint32_t y) { return call_into(token, x, y, 0); }
static void quiet(uint32_t status) { (void)status; seen = stub_validations; }
static void report(const char *name, uint32_t status) {
  const char *message = ${p}_callable_graph_error();
  printf("%s %u %s %lu\\n", name, status, message ? message : "-", stub_validations - seen);
  seen = stub_validations;
}
int main(void) {
  lean_initialize_runtime_module();
  const char *kind = ${JSON.stringify(kind)};
  uint64_t a = ng_closure_store(lean_mk_string("a"), kind), b = ng_closure_store(lean_mk_string("b"), kind);
  if (!a || !b) return 2;
${lines.join("\n")}
  return 0;
}
`;
	const files = {
		"include/structured-graph-types.h": native.typesHeader
		, "include/structured-callable-borrows.h": native.borrowsHeader
		, "include/structured-graph.h": native.header
		, "include/lean_bridge_native_runtime.h": brokerHeader
		, "program.c": program, "stubs.c": stubs };
	await mkdir(join(directory, "include"));
	for(const [path, text] of Object.entries(files)) await writeFile(join(directory, path), text);
	const flags = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-Iinclude", "-I", join(leanPrefix, "include")];
	for(const name of ["program", "stubs"]) await run("/usr/bin/cc", [...flags, "-c", `${name}.c`, "-o", `${name}.o`], { cwd: directory });
	// Every other Lean export of the component is unreachable from these leases and aborts if called.
	const symbols = async (...args) => (await run("/usr/bin/nm", args, { cwd: directory })).stdout.split("\n")
		.map(line => line.trim().split(/\s+/u).at(-1)).filter(name => /^(?:lean_bridge_|initialize_LeanBridgeNative)/u.test(name));
	const defined = new Set(await symbols("--defined-only", "stubs.o"));
	await writeFile(join(directory, "unreachable.c"), `#include <stdlib.h>\n${(await symbols("-u", "program.o"))
		.filter(name => !defined.has(name)).map(name => `void ${name}(void) { abort(); }`).join("\n")}\n`);
	await run("/usr/bin/cc", ["-c", "unreachable.c", "-o", "unreachable.o"], { cwd: directory });
	const library = join(leanPrefix, "lib/lean");
	const link = ["-L", library, "-lleanshared", `-Wl,-rpath,${library}`, "-lpthread"];
	await run("/usr/bin/cc", ["-o", "program", "program.o", "stubs.o", "unreachable.o", ...link], { cwd: directory });
	const { stdout } = await run("./program", [], { cwd: directory });
	return stdout.trim().split("\n");
};
// Each row: step, status, accessor text after the call, validator calls since the previous row.
const located = (message, validations) => `1 ${message} ${validations}`;
const stale = (refusal, validations) => [
	"after-success 0 - 0"
	, "after-invalid-token 1 - 0"
	, "after-structural 1 - 0"
	, "other-closure-accepted 0 - 0"
	, `other-closure-refused ${located(refusal, validations)}`
	, "recovered 0 - 0"
	, `refused-again ${located(refusal, validations)}`
	, "disposed 1 - 0"
	// A forced refusal of accepted arguments runs every check, finds none refused and names nothing.
	, `unlocated 1 - ${validations === 0 ? 0 : 2}`
	, "final 0 - 0"];

test("compiled lease calls locate the first refusal once and never leak it across later calls", { timeout: 180_000 }, async t => {
	const rows = await harness(t, "twoArguments", twoArguments().ir, { ok: "10, 10", refused: [["second-refused", "10, 150"]], both: "60, 150" });
	if(!rows) return;
	const refusal = "value1 was rejected by Structured.checkedClosureArgument";
	assert.deepEqual(rows, [
		"accepted 0 - 0"
		, `second-refused ${located(refusal, 2)}`, "read-again 0 - 0"
		// value0 refuses first, so value1's check never runs.
		, `both-refused ${located("value0 was rejected by Structured.firstClosureArgument", 1)}`
		, ...stale(refusal, 2)]);
});

test("compiled nested record refusals name the exact field path, bound or selected constructor", { timeout: 180_000 }, async t => {
	const refused = [["low-refused", "20, 50"], ["high-refused", "5, 150"], ["constructor-refused", "5, 3"]];
	const rows = await harness(t, "nestedRecord", nestedRecord().ir, { ok: "5, 50", refused, both: "20, 150" });
	if(!rows) return;
	assert.deepEqual(rows, [
		"accepted 0 - 0"
		, `low-refused ${located("value1.lo was rejected by Structured.checkedLow", 1)}`
		, "read-again 0 - 0"
		, `high-refused ${located("value1.hi is not below its Fin 100 bound", 1)}`
		, "read-again 0 - 0"
		, `constructor-refused ${located("value1 was rejected by Structured.mkInterval", 2)}`
		, "read-again 0 - 0"
		, `both-refused ${located("value1.lo was rejected by Structured.checkedLow", 1)}`
		, ...stale("value1.lo was rejected by Structured.checkedLow", 1)]);
});

test("compiled pure Fin closures are located in C where their role is recovered", { timeout: 180_000 }, async t => {
	const rows = await harness(t, "pureFin", pureFin().ir, { finDirections: true, ok: "1, 5", refused: [["bound-refused", "1, 12"]] });
	if(!rows) return;
	const refusal = "value1 is not below its Fin 10 bound";
	assert.deepEqual(rows, ["accepted 0 - 0", `bound-refused ${located(refusal, 0)}`, "read-again 0 - 0", ...stale(refusal, 0)]);
});
