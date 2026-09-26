/**
 * Run the original primitive WIT oracle beside recursive callable payloads.
 * Only interface names and the explicit recursive error contract are adapted.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { jvmRecursiveMixedFixture } from "./jvm-recursive-callable-mixed.mjs";
import { callableReviewedIr } from "./callable-fixture.mjs";
import { witCallableSignatures } from "./wit-callable-fixture.mjs";
import { witCallableConsumer } from "./wit-callable-consumer.mjs";

const change = (source, before, after) => {
	assert.equal(source.split(before).length, 2, `Review changed WIT primitive oracle: ${before}`);
	return source.replace(before, after);
};

/**
 * Add the original mixed, indirectly lowered primitive callback call.
 *
 * @param baseSource - Optional verbatim documentation definitions and fixture.
 */
export const witRecursiveMixedFixture = async baseSource => {
	const fixture = await jvmRecursiveMixedFixture(baseSource);
	const signature = { ...witCallableSignatures.find(item => item.name === "Callables.mixed"), name: "Structured.mixed" };
	const extra = callableReviewedIr([signature]);
	for(const type of extra.types) assert.ok(fixture.ir.types.some(previous => canonicalJson(previous) === canonicalJson(type)));
	fixture.ir.declarations.push(...extra.declarations); fixture.exports.push(signature.name);
	const source = change(await readFile("tests/fixtures/callable-consumers/Wit.lean", "utf8"), "def makeAdder (capture value : UInt32) : UInt32 := capture + value\n", "");
	fixture.source += source.replaceAll("namespace Callables", "namespace Structured").replaceAll("end Callables", "end Structured");
	return fixture;
};

/**
 * Preserve all primitive values and lifecycle assertions across nominal names.
 *
 * @param model - Compiler-authenticated mixed package model.
 */
export const witRecursivePrimitiveConsumer = async model => {
	const p = model.prefix;
	const primitive = [...model.callbacks.values()].filter(callback => [...callback.parameters, callback.result].every(node => node.kind === "primitive"));
	const mapping = primitive.map(callback => ({
		name: `function-${callback.parameters.map(node => node.ref.name).join("-")}-to-${callback.result.ref.name}`
		, target: callback.resource.witName
	}));
	assert.equal(new Set(mapping.map(item => item.name)).size, mapping.length);
	assert.ok(mapping.length >= 40);
	let source = (await witCallableConsumer()).replaceAll("callables_", `${p}_`)
		.replaceAll(`${p}_wasmtime_invoke(`, "fixture_invoke(")
		.replaceAll(`${p}_wasmtime_callback_create(`, "fixture_create(");
	const wrappers = `
static const struct { const char *signature, *resource, *invoke, *target; } fixture_names[] = {
${mapping.map(item => `  {${[item.name, item.target, `invoke-${item.name}`, `invoke-${item.target}`].map(JSON.stringify).join(", ")}}`).join(",\n")}
};
static const char *fixture_name(const char *name, bool invoke) {
  for (size_t i = 0; i < sizeof(fixture_names)/sizeof(fixture_names[0]); ++i)
    if (!strcmp(name, invoke ? fixture_names[i].invoke : fixture_names[i].signature))
      return invoke ? fixture_names[i].target : fixture_names[i].resource;
  return name;
}
static wasmtime_error_t *fixture_invoke(${p}_wasmtime *session, const char *name, const ${p}_wasmtime_value *args, size_t count, ${p}_wasmtime_value *out) {
  return ${p}_wasmtime_invoke(session, fixture_name(name, true), args, count, out);
}
static wasmtime_error_t *fixture_create(${p}_wasmtime *session, const char *signature, ${p}_wasmtime_callback callback, void *data, void (*release)(void *), ${p}_wasmtime_function *out) {
  return ${p}_wasmtime_callback_create(session, fixture_name(signature, false), callback, data, release, out);
}
`;
	source = change(source, "#define clone copied_clone", "#define clone copied_clone\n" + wrappers);
	// The native graph ABI reports invalid/expired closure invocation as one
	// status. Verify failure and that the expired host callback did not execute.
	source = change(source, '  rejects(call("invoke-function-uint32-to-uint32", args, 2, &result), "Expired"); clear(&expired);',
		'  size_t retained_calls = callbacks;\n  rejects(call("invoke-function-uint32-to-uint32", args, 2, &result), "Native Lean closure call failed"); assert(callbacks == retained_calls); clear(&expired);');
	// Recursive registration requires a fresh output. Check both occupied output
	// rejection and true capacity exhaustion with an empty slot.
	source = change(source, '  rejects(fixture_create(session, "function-uint32-to-uint32", callback, &finalized, release, &unchanged), "capacity"); assert(unchanged == 991);',
		'  rejects(fixture_create(session, "function-uint32-to-uint32", callback, &finalized, release, &unchanged), "Invalid WIT callback"); assert(unchanged == 991);\n  unchanged = 0;\n  rejects(fixture_create(session, "function-uint32-to-uint32", callback, &finalized, release, &unchanged), "capacity"); assert(!unchanged);');
	const unit = model.functions.find(fn => fn.declaration.name === "wideUnit"), makeUnit = model.functions.find(fn => fn.declaration.name === "makeWideUnit");
	const callback = unit.parameters[0], owned = makeUnit.result;
	const field = callback => callback.publicName.slice(p.length + 1);
	const args = Array.from({ length: 16 }, (_, index) => `a${index}`);
	const wide = `static unsigned fixture_wide_calls;
static wasmtime_error_t *fixture_wide_unit(void *data, ${args.map(name => `const uint32_t *${name}`).join(", ")}, uint8_t *out) {
  assert(!data); ${args.map((name, index) => `assert(*${name} == ${index + 1});`).join(" ")}
  ++fixture_wide_calls; *out = 0; return NULL;
}
`;
	source = change(source, "int main(void) {", wide + "\nint main(void) {");
	source = change(source, `  ok(${p}_wasmtime_open(&session)); size_t baseline = identities();`,
		`  ok(${p}_wasmtime_open(&session)); size_t baseline = identities();
  if (getenv("LEAN_BRIDGE_WIT_PROBE_COLD_ONLY")) { ${p}_wasmtime_close(session); puts("{\\"cold\\":true}"); return 0; }`);
	source = change(source, "  current = create(\"function-uint32-to-uint32\"); args[0] = seed; args[1] = callable(current); behavior = CLOSE_SESSION;", `  {
    function unit_host = 0, unit_owned = 0;
    uint8_t unit_value = 0, unit_result = 9; uint32_t zero = 0;
    ok(${p}_wasmtime_callback_${field(callback)}_create(session, fixture_wide_unit, NULL, NULL, &unit_host));
    ok(${p}_wasmtime_value_${unit.field}(session, unit_host, &unit_result)); assert(!unit_result && fixture_wide_calls == 1);
    ok(${p}_wasmtime_value_${makeUnit.field}(session, &unit_value, &unit_owned)); assert(unit_owned);
    unit_result = 9;
    ok(${p}_wasmtime_function_${field(owned)}_call(session, unit_owned, ${args.map(() => "&zero").join(", ")}, &unit_result)); assert(!unit_result);
    ok(${p}_wasmtime_function_close(session, &unit_owned));
    ok(${p}_wasmtime_function_close(session, &unit_host)); assert(identities() == baseline);
  }
  current = create("function-uint32-to-uint32"); args[0] = seed; args[1] = callable(current); behavior = CLOSE_SESSION;`);
	source = change(source, '  printf("callable-wit-ok:%zu\\n", calls);', '  printf("{\\"primitives\\":19,\\"variants\\":114,\\"calls\\":%zu,\\"callbacks\\":%zu,\\"finalized\\":%zu,\\"wideUnit\\":%u,\\"nativeIdentities\\":%zu}\\n", calls, callbacks, finalized, fixture_wide_calls, identities());');
	return source;
};
