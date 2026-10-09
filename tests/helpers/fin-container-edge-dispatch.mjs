/**
 * Additive dispatch probes for the six zero-bound and nested Fin exports. These probes do not replace
 * the historical ten-column observations. A raw C caller is never reported as another host's execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { finContainerEntryAdapter, finContainerEntryInitializer } from "./fin-container-entry-dispatch.mjs";
import { finContainerEdgeConsumer, finContainerEdgeRefinements, insertFinContainerEdgeFragment } from "./fin-container-edges.mjs";

export const finContainerEdgeEntries = Object.freeze(["emptyArray", "emptyList", "emptyOption", "optionalDigits", "present", "flatten"]);
// Fresh codegen controls require these two calls and prove the four identity calls were inlined.
export const finContainerEdgeSourceEntries = Object.freeze(["present", "flatten"]);
const width = 8;
const shapes = ["nat", ["array", 0], ["list", 0], ["option", 0], ["option", 2], ["array", 3], ["list", 1]];
const inputs = [1, 2, 3, 4, 5, 6], outputs = [1, 2, 3, 4, 1, 4];
const some = value => ({ some: value });
const freeze = value => {
	if(value && typeof value === "object")
	{ Object.values(value).forEach(freeze); Object.freeze(value); }
	return value;
};

/**
 * Eight columns from the receipt-verified installed model. Missing, duplicated, retyped or rebound
 * declarations are refused before any instrumentation is generated.
 *
 * @param model - Installed native model.
 * @param component - Component from that installed package's receipt.
 */
export const finContainerEdgeColumns = (model, component) => {
	assert.deepEqual(model.component, component);
	const id = component?.id;
	assert.ok(typeof id === "string" && /^[^\s\0]+@[^\s\0]+$/u.test(id));
	for(const method of finContainerEdgeEntries)
	{
		const name = `FinContainers.${method}`, matches = model.exports.filter(item => item.name === name);
		assert.equal(matches.length, 1, name);
		assert.equal(matches[0].symbol, finContainerEntryAdapter(id, name));
		assert.equal(matches[0].parameters.length, 1);
		assert.deepEqual(matches[0].refinements, finContainerEdgeRefinements[name]);
	}
	return [...finContainerEdgeSourceEntries.map(name => `l_FinContainers_${name}`)
		, ...finContainerEdgeEntries.map(name => finContainerEntryAdapter(id, `FinContainers.${name}`))];
};

/** Fixed cases, including every outer/inner invalid position and distinct absent/present-empty values. */
export const finContainerEdgeRawCases = freeze((() => {
	const cases = [];
	const add = (name, method, argument, outcome) => cases.push({ name, method, argument, outcome });
	for(const [word, value] of [["zero", 0n], ["one", 1n], ["wide", 2n ** 70n]])
		for(const method of finContainerEdgeEntries.slice(0, 3))
			add(`invalid-${method}-${word}`, method, method === "emptyOption" ? some(value) : [value], null);
	for(let row = 0; row < 3; row++)
	{
		const digits = [1n, 2n, 3n]; digits[row] = 10n;
		add(`invalid-present-${row}`, "present", digits.map(some), null);
		add(`invalid-optionalDigits-${row}`, "optionalDigits", some(digits), null);
		for(let column = 0; column < 3; column++)
		{
			const rows = [[1n, 2n, 3n], [4n, 5n, 6n], [7n, 8n, 9n]];
			rows[row][column] = 10n;
			add(`invalid-flatten-${row}-${column}`, "flatten", rows, null);
		}
	}
	add("valid-emptyArray", "emptyArray", [], some([]));
	add("valid-emptyList", "emptyList", [], some([]));
	add("valid-emptyOption", "emptyOption", null, some(null));
	add("valid-optionalDigits-absent", "optionalDigits", null, some(null));
	add("valid-optionalDigits-empty", "optionalDigits", some([]), some(some([])));
	add("valid-optionalDigits-values", "optionalDigits", some([0n, 9n]), some(some([0n, 9n])));
	add("valid-present-absent", "present", [null, null, null], some([]));
	add("valid-present-values", "present", [some(0n), null, some(9n)], some([0n, 9n]));
	add("valid-flatten-absent", "flatten", [], some(null));
	add("valid-flatten-empty", "flatten", [[], [], []], some(some([])));
	add("valid-flatten-values", "flatten", [[0n, 1n], [], [9n]], some(some([0n, 1n, 9n])));
	return cases;
})());

/** Expected raw rows count every call, including 1000 independently checked recovery pairs per export. */
export const finContainerEdgeRawExpected = freeze((() => {
	const counts = Array(width).fill(0), rows = [["start", "ok", [...counts]]];
	const add = (name, method, accepted, repeat = 1) => {
		const index = finContainerEdgeEntries.indexOf(method);
		counts[index + 2] += repeat;
		if(accepted && index >= 4) counts[index - 4] += repeat;
		rows.push([name, accepted ? "some" : "none", [...counts]]);
	};
	for(const row of finContainerEdgeRawCases) add(row.name, row.method, row.outcome !== null);
	for(const method of finContainerEdgeEntries)
	{
		const index = finContainerEdgeEntries.indexOf(method);
		if(index >= 4) counts[index - 4] += 1000;
		counts[index + 2] += 2000;
		rows.push([`recovery-${method}`, "pairs:1000", [...counts]]);
	}
	return rows;
})());

/**
 * Parse only the complete ordered raw transcript, with exact per-row counts and outcomes.
 *
 * @param stdout - Actual process output, not a generated expected transcript.
 */
export const readFinContainerEdgeRaw = stdout => {
	assert.ok(typeof stdout === "string" && stdout.endsWith("\n"));
	const rows = stdout.slice(0, -1).split("\n").map(line => {
		assert.match(line, /^[A-Za-z0-9-]+ (?:ok|some|none|pairs:1000)(?: (?:0|[1-9][0-9]{0,14})){8}$/u);
		const [step, status, ...counts] = line.split(" ");
		return [step, status, counts.map(Number)];
	});
	assert.deepEqual(rows, finContainerEdgeRawExpected);
	return rows;
};

const validatedColumns = (model, component) => finContainerEdgeColumns(model, component);
/**
 * Test-only preload wrappers. Every wrapper resolves and calls the real next definition.
 *
 * @param model - Verified installed native model.
 * @param component - Verified receipt component.
 * @param definitions - Optional absolute defining-library paths. Installed observations must supply these.
 */
export const finContainerEdgeInterposer = (model, component, definitions) => {
	const columns = validatedColumns(model, component);
	if(definitions !== undefined)
	{
		assert.deepEqual(Object.keys(definitions).sort(), [...columns].sort());
		for(const path of Object.values(definitions)) assert.ok(typeof path === "string" && isAbsolute(path) && !path.includes("\0"));
	}
	return `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static unsigned long counts[8];
unsigned long fin_container_edge_count(unsigned index) { if (index >= 8) abort(); return counts[index]; }
${columns.map((symbol, index) => `void *${symbol}(void *argument) {
  static void *(*next)(void *);
  if (!next) {
    *(void **)&next = dlsym(RTLD_NEXT, "${symbol}"); if (!next) abort();
${definitions ? `    Dl_info info;
    char *actual = dladdr((void *)next, &info) ? realpath(info.dli_fname, NULL) : NULL;
    if (!actual || strcmp(actual, ${JSON.stringify(definitions[symbol])})) { fputs("unexpected edge definition: ${symbol}\\n", stderr); exit(6); }
    free(actual);\n` : ""}  }
  ++counts[${index}];
  return next(argument);
}`).join("\n")}
`;
};

const expression = (shape, value) => {
	if(shape === 0) return `lean_cstr_to_nat("${value}")`;
	const [kind, child] = shapes[shape];
	if(kind === "option") return value === null ? "lean_box(0)" : `some(${expression(child, value.some)})`;
	if(kind === "list") return value.reduceRight((tail, item) => `cons(${expression(child, item)}, ${tail})`, "lean_box(0)");
	return value.length ? `array(${value.length}, (lean_object *[]){${value.map(item => expression(child, item)).join(", ")}})` : "array(0, NULL)";
};
const rawCall = row => {
	const index = finContainerEdgeEntries.indexOf(row.method), argument = expression(inputs[index], row.argument);
	const expected = row.outcome === null ? "lean_box(0)" : `some(${expression(outputs[index], row.outcome.some)})`;
	return `check_call(${index}, ${argument}, ${argument}, ${expected}, ${row.outcome === null ? 0 : 1})`;
};

/**
 * Direct adapters receive well-formed erased Lean values constructed only through the pinned Lean API.
 * Malformed foreign carriers belong in the public probe, never in fabricated Lean object layouts.
 *
 * @param model - Verified installed native model.
 * @param component - Verified receipt component.
 */
export const finContainerEdgeRawProbe = (model, component) => {
	const columns = validatedColumns(model, component);
	const calls = finContainerEdgeRawCases.map(row => `  ${rawCall(row)}; report("${row.name}", "${row.outcome === null ? "none" : "some"}");`);
	for(const method of finContainerEdgeEntries)
	{
		const invalid = finContainerEdgeRawCases.find(row => row.method === method && row.outcome === null);
		const valid = finContainerEdgeRawCases.find(row => row.method === method && row.outcome !== null);
		calls.push(`  for (unsigned cycle = 0; cycle < 1000; ++cycle) { ${rawCall(invalid)}; ${rawCall(valid)}; }`, `  report("recovery-${method}", "pairs:1000");`);
	}
	return `#define _GNU_SOURCE
#include <lean/lean.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
typedef lean_object *(*unary)(lean_object *);
typedef int (*initialize_fn)(const char *, void *(*)(uint8_t));
static unsigned long (*counter)(unsigned);
static unary adapters[6];
static const unsigned input_shapes[6] = {${inputs.join(", ")}}, output_shapes[6] = {${outputs.join(", ")}};
static void fail(const char *message) { fprintf(stderr, "edge raw probe: %s\\n", message); exit(5); }
static int ctor(lean_object *value, unsigned objects) {
  return !lean_is_scalar(value) && lean_obj_tag(value) == 1 && lean_ctor_num_objs(value) == objects;
}
static lean_object *some(lean_object *value) {
  lean_object *out = lean_alloc_ctor(1, 1, 0); lean_ctor_set(out, 0, value); return out;
}
static lean_object *cons(lean_object *head, lean_object *tail) {
  lean_object *out = lean_alloc_ctor(1, 2, 0); lean_ctor_set(out, 0, head); lean_ctor_set(out, 1, tail); return out;
}
static lean_object *array(size_t size, lean_object **values) {
  lean_object *out = lean_alloc_array(size, size);
  for (size_t i = 0; i < size; ++i) lean_array_set_core(out, i, values[i]);
  return out;
}
static int same(unsigned shape, lean_object *a, lean_object *b) {
  if (shape == 0) {
    if ((!lean_is_scalar(a) && lean_obj_tag(a) != LeanMPZ) || (!lean_is_scalar(b) && lean_obj_tag(b) != LeanMPZ)) return 0;
    return lean_nat_dec_eq(a, b);
  }
  if (shape == 1 || shape == 5) {
    if (lean_is_scalar(a) || lean_is_scalar(b) || lean_obj_tag(a) != LeanArray || lean_obj_tag(b) != LeanArray || lean_array_size(a) != lean_array_size(b)) return 0;
    for (size_t i = 0; i < lean_array_size(a); ++i) if (!same(shape == 1 ? 0 : 3, lean_array_get_core(a, i), lean_array_get_core(b, i))) return 0;
    return 1;
  }
  if (shape == 2 || shape == 6) {
    while (!lean_is_scalar(a) && !lean_is_scalar(b)) {
      if (!ctor(a, 2) || !ctor(b, 2) || !same(shape == 2 ? 0 : 1, lean_ctor_get(a, 0), lean_ctor_get(b, 0))) return 0;
      a = lean_ctor_get(a, 1); b = lean_ctor_get(b, 1);
    }
    return a == lean_box(0) && b == lean_box(0);
  }
  if (shape == 3 || shape == 4) {
    if (a == lean_box(0) || b == lean_box(0)) return a == b;
    return ctor(a, 1) && ctor(b, 1) && same(shape == 3 ? 0 : 2, lean_ctor_get(a, 0), lean_ctor_get(b, 0));
  }
  fail("unknown shape"); return 0;
}
static void check_call(unsigned index, lean_object *argument, lean_object *snapshot, lean_object *expected, int accepted) {
  unsigned long before[8]; for (unsigned i = 0; i < 8; ++i) before[i] = counter(i);
  lean_inc(argument); /* Keep one owned reference while the adapter consumes the other. */
  lean_object *result = adapters[index](argument);
  if (!same(input_shapes[index], argument, snapshot)) fail("input changed");
  if (accepted) {
    if (!ctor(result, 1) || !ctor(expected, 1) || !same(output_shapes[index], lean_ctor_get(result, 0), lean_ctor_get(expected, 0))) fail("incorrect accepted value");
  } else if (result != lean_box(0)) fail("invalid argument accepted");
  for (unsigned i = 0; i < 8; ++i) {
    unsigned long delta = (i == index + 2 || (accepted && index >= 4 && i == index - 4)) ? 1 : 0;
    if (counter(i) != before[i] + delta) fail("wrong per-call source or adapter count");
  }
  lean_dec(result); lean_dec(argument); lean_dec(snapshot); lean_dec(expected);
}
static void report(const char *step, const char *status) {
  printf("%s %s", step, status);
  for (unsigned i = 0; i < 8; ++i) printf(" %lu", counter(i));
  putchar('\\n');
}
int main(void) {
  *(void **)&counter = dlsym(RTLD_DEFAULT, "fin_container_edge_count");
  if (!counter) { fputs("edge interposer is not loaded\\n", stderr); return 2; }
  initialize_fn initialize; *(void **)&initialize = dlsym(RTLD_DEFAULT, "lean_bridge_native_component_initialize");
  void *initializer = dlsym(RTLD_DEFAULT, "${finContainerEntryInitializer(component.id)}");
  const char *names[6] = {${columns.slice(2).map(JSON.stringify).join(", ")}};
  for (unsigned i = 0; i < 6; ++i) { *(void **)&adapters[i] = dlsym(RTLD_DEFAULT, names[i]); if (!adapters[i]) fail("adapter missing"); }
  if (!initialize || !initializer || !initialize(${JSON.stringify(component.id)}, (void *(*)(uint8_t))initializer)) fail("component initialization failed");
  report("start", "ok");
${calls.join("\n")}
  return 0;
}
`;
};

/**
 * Wrap the existing complete C consumer without changing its value, error, malformed-carrier or recovery
 * assertions. Every measured public call enters its adapter once on success and never on refusal.
 * The two non-inlined sources enter once on success. The four inlined sources have no source counter.
 * No result is accepted merely because its aggregate count matches.
 *
 * @param model - Verified installed native model.
 * @param component - Verified receipt component.
 */
export const finContainerEdgePublicProbe = async (model, component) => {
	validatedColumns(model, component);
	const carriers = ["array_nat_span", "list_nat_span", "option_nat_value", "option_list_nat_value", "array_option_nat_span", "list_array_nat_span"];
	const results = [0, 1, 2, 3, 0, 3];
	const wrappers = finContainerEdgeEntries.map((method, index) => {
		const name = method.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`);
		return `static fincontainers_status edge_audit_${name}(const fincontainers_${carriers[index]} *arg, fincontainers_${carriers[results[index]]} *out, fincontainers_error *error) {
  unsigned long before[8]; for (unsigned i = 0; i < 8; ++i) before[i] = edge_counter(i);
  fincontainers_status status = fincontainers_${name}(arg, out, error);
  for (unsigned i = 0; i < 8; ++i) {
    unsigned long delta = status == FINCONTAINERS_STATUS_OK && (${index >= 4 ? `i == ${index - 4} || ` : ""}i == ${index + 2}) ? 1 : 0;
    if (edge_counter(i) != before[i] + delta) { fputs("wrong public edge dispatch count\\n", stderr); exit(5); }
  }
  return status;
}
#define fincontainers_${name} edge_audit_${name}`;
	});
	const prelude = `#include <dlfcn.h>\n#include <stdlib.h>\nstatic unsigned long (*edge_counter)(unsigned);\n${wrappers.join("\n")}\n`;
	let source = insertFinContainerEdgeFragment(await finContainerEdgeConsumer("c"), "int main(void) {", prelude);
	source = source.replace("int main(void) {", `int main(void) {
  *(void **)&edge_counter = dlsym(RTLD_DEFAULT, "fin_container_edge_count");
  if (!edge_counter) { fputs("edge interposer is not loaded\\n", stderr); return 2; }
  for (unsigned i = 0; i < 8; ++i) if (edge_counter(i)) { fputs("edge counters are not initially zero\\n", stderr); return 3; }`);
	return source;
};
