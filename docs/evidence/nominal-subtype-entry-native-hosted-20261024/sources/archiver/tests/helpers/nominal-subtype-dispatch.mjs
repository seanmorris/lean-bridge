/**
 * Count public entry, exported validator, selected constructor, adapter and Lean source dispatch for
 * the nominal Subtype C package. Columns are classified from the installed component library's dynamic
 * symbol table, never assumed: a constructor Lean specialized away is counted under its specialization
 * and named as such, and an absent column fails classification instead of reading as zero.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

// The compiler names the component from the fixture's Lake package (`nominalsubtypes`), so the
// adapter symbols in the installed library hash this identity, not the onboarding directory name.
export const nominalSubtypeDispatchComponent = "nominalsubtypes@1.0.0";
export const nominalSubtypeDispatchRoles = Object.freeze(["public", "validator", "constructor", "adapter", "source"]);
export const nominalSubtypeDispatchConstructors = Object.freeze(["plusOne", "plusTwo"]);

/**
 * Name the compiler-emitted Lean adapter that public calls reach through the runtime table.
 *
 * @param name - Export name inside the NominalSubtypes namespace.
 */
export const nominalSubtypeAdapterSymbol = name => `lb_${sha256(`${nominalSubtypeDispatchComponent}\0NominalSubtypes.${name}`).slice(0, 24)}`;

/**
 * The measured exports: each with its public C entry and, per checked parameter, the constructor
 * leaves of its selection (nominal-subtype-installed-fixture.mjs) in walk order. A leaf's suffix is
 * the structural path constructorRefinementLeaves assigns (record field, variant case and field,
 * container argument indices), and names the exported validator `<adapter>_refinement_<i><suffix>`.
 */
export const nominalSubtypeDispatchExports = Object.freeze([
	{ name: "first", entry: "nominalsubtypes_first", parameters: [[["_0", "plusOne"]]] }
	, { name: "second", entry: "nominalsubtypes_second", parameters: [[["_0", "plusTwo"]]] }
	, { name: "combine", entry: "nominalsubtypes_combine", parameters: [[["_0", "plusOne"]], [["_0", "plusTwo"]]] }
	, { name: "nested", entry: "nominalsubtypes_nested", parameters: [[["_0_0", "plusOne"], ["_1_0", "plusTwo"]]] }
	, { name: "eventFirst", entry: "nominalsubtypes_event_first", parameters: [[["_1_0_0", "plusOne"], ["_2_0_0_0_0", "plusOne"], ["_2_0_0_0_1", "plusTwo"]]] }
	, { name: "echo", entry: "nominalsubtypes_echo", parameters: [[["_0", "plusOne"]]] }
]);

const symbolPattern = /^[0-9a-f]+ [TtWw] ([A-Za-z_][A-Za-z0-9_]*)$/u;

/**
 * Parse `nm -D --defined-only` output into the set of defined function symbols.
 *
 * @param text - Complete nm output for the installed component library.
 */
export const nominalSubtypeDefinedSymbols = text => {
	assert.equal(typeof text, "string");
	const symbols = new Set();
	for(const line of text.split("\n"))
	{
		if(line === "") continue;
		const match = symbolPattern.exec(line);
		if(match) symbols.add(match[1]);
	}
	assert.ok(symbols.size > 0, "empty dynamic symbol table");
	return symbols;
};

/**
 * Classify every column from the installed component library. Every measured export must expose its
 * adapter, one exported validator per checked leaf and its Lean source; each selected constructor must
 * exist as its own symbol or as an explicitly listed specialization.
 *
 * @param text - Complete nm output for the installed component library.
 * @param exports - Measured exports; defaults to the fixed selection above.
 */
export const classifyNominalSubtypeDispatchSymbols = (text, exports = nominalSubtypeDispatchExports) => {
	const symbols = nominalSubtypeDefinedSymbols(text), columns = [];
	const column = (role, label, symbol, arity, result = "lean_object *") => {
		assert.ok(symbols.has(symbol), `${role} ${label}: ${symbol} is not defined by the component library`);
		assert.ok(!columns.some(item => item.symbol === symbol), `duplicate column ${symbol}`);
		columns.push({ role, label, symbol, arity, result });
	};
	for(const item of exports)
	{
		assert.match(item.name, /^[a-z][A-Za-z0-9]*$/u); assert.ok(item.parameters.length > 0);
		const adapter = nominalSubtypeAdapterSymbol(item.name);
		column("adapter", item.name, adapter, item.parameters.length);
		item.parameters.forEach((leaves, index) => leaves.forEach(([suffix, constructor]) => {
			assert.ok(nominalSubtypeDispatchConstructors.includes(constructor), constructor); assert.match(suffix, /^(_[0-9]+)+$/u);
			column("validator", `${item.name}:${index}${suffix}`, `${adapter}_refinement_${index}${suffix}`, 1, "uint8_t");
		}));
		const source = `l_NominalSubtypes_${item.name}`;
		column("source", item.name, symbols.has(source) ? source : `${source}___boxed`, item.parameters.length);
	}
	for(const constructor of nominalSubtypeDispatchConstructors)
	{
		const exact = `l_NominalSubtypes_${constructor}`;
		if(symbols.has(exact))
		{
			column("constructor", constructor, exact, 1); continue;
		}
		const specialized = [...symbols].filter(symbol => symbol.startsWith(`${exact}___at___`) && !symbol.endsWith("___boxed")).sort();
		assert.ok(specialized.length > 0, `constructor ${constructor} is neither defined nor specialized in the component library`);
		for(const symbol of specialized) column("constructor", `${constructor} specialized into ${symbol}`, symbol, 1);
	}
	for(const role of nominalSubtypeDispatchRoles.filter(role => role !== "public"))
		assert.ok(columns.some(item => item.role === role), `no ${role} column`);
	return Object.freeze(columns);
};

const wrapper = ({ symbol, arity, result }, index) => {
	const parameters = Array.from({ length: arity }, (_, i) => `lean_object *a${i}`).join(", ");
	const values = Array.from({ length: arity }, (_, i) => `a${i}`).join(", ");
	return `${result} ${symbol}(${parameters}) {
  static ${result} (*next)(${Array(arity).fill("lean_object *").join(", ")});
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbol}"); if (!next) abort(); }
  ++counts[${index}];
  return next(${values});
}`;
};

/**
 * Test-only LD_PRELOAD interposer over the classified columns; each wrapper resolves its target on
 * first use and forwards every argument unchanged.
 *
 * @param columns - Classified columns for the installed library.
 */
export const nominalSubtypeDispatchInterposer = columns => `#define _GNU_SOURCE
#include <lean/lean.h>
#include <stdint.h>
#include <dlfcn.h>
#include <stdlib.h>
static unsigned long counts[${columns.length}];
unsigned long nominal_subtype_dispatch_count(unsigned index) { return index < ${columns.length} ? counts[index] : 0; }
${columns.map(wrapper).join("\n")}
`;

/**
 * Probe steps over the public C entries. Payloads: 40 is accepted by both constructors, 95 only by
 * plusOne (plusTwo requires value < 90), 100 by neither; digits stay within Fin 3. `entered` lists,
 * per parameter, the index of each constructor leaf whose validator runs, in walk order (an array
 * element re-enters its leaf); a refused call lists nothing after the refusing leaf.
 */
export const nominalSubtypeDispatchSteps = Object.freeze([
	{ step: "start" }
	, { step: "public-valid-first", name: "first", status: 0, entered: [[0]], sources: ["first"] }
	, { step: "public-valid-second", name: "second", status: 0, entered: [[0]], sources: ["second"] }
	, { step: "public-invalid-first", name: "first", status: 1, entered: [[0]] }
	, { step: "public-valid-combine", name: "combine", status: 0, entered: [[0], [0]], sources: ["combine"] }
	, { step: "public-late-combine", name: "combine", status: 1, entered: [[0], [0]] }
	, { step: "public-early-combine", name: "combine", status: 1, entered: [[0], []] }
	, { step: "public-valid-nested", name: "nested", status: 0, entered: [[0, 1]], sources: ["nested", "combine"] }
	, { step: "public-late-nested", name: "nested", status: 1, entered: [[0, 1]] }
	, { step: "public-inactive-event", name: "eventFirst", status: 0, entered: [[]], sources: ["eventFirst"] }
	, { step: "public-active-event-box", name: "eventFirst", status: 0, entered: [[0]], sources: ["eventFirst", "first"] }
	, { step: "public-valid-event-choices", name: "eventFirst", status: 0, entered: [[1, 2]], sources: ["eventFirst"] }
	, { step: "public-invalid-event-choices", name: "eventFirst", status: 1, entered: [[1]] }
	, { step: "public-valid-echo", name: "echo", status: 0, entered: [[0]], sources: ["echo"] }
	, { step: "public-recovery-first", name: "first", status: 0, entered: [[0]], sources: ["first"] }
]);

/**
 * Derive the cumulative counter table from the role model: a public call runs the exported validator
 * of each checked leaf in walk order, each running that leaf's constructor once, and stops at the first
 * refusal; an accepted call then enters the adapter, which runs the constructor of every present leaf
 * again before the source. Only validators reached are counted, so a late refusal leaves earlier
 * leaves counted and an inactive branch reaches the adapter and source without any constructor.
 *
 * @param columns - Classified columns for the installed library.
 * @param exports - Measured exports; defaults to the fixed selection above.
 */
export const nominalSubtypeDispatchExpected = (columns, exports = nominalSubtypeDispatchExports) => {
	const counts = columns.map(() => 0), rows = [];
	const bump = (role, label) => {
		const matches = columns.map((item, index) => [item, index]).filter(([item]) => item.role === role && (role === "constructor" ? item.label === label || item.label.startsWith(`${label} specialized into `) : item.label === label));
		assert.ok(matches.length > 0, `${role} ${label}`);
		for(const [, index] of matches) counts[index]++;
	};
	for(const item of nominalSubtypeDispatchSteps)
	{
		if(item.step !== "start")
		{
			const target = exports.find(entry => entry.name === item.name);
			assert.ok(target, item.name); assert.equal(item.entered.length, target.parameters.length, item.step);
			const accepted = item.status === 0;
			const reached = target.parameters.map((leaves, index) => item.entered[index].map(leaf => {
				assert.ok(Number.isSafeInteger(leaf) && leaf >= 0 && leaf < leaves.length, item.step);
				return leaves[leaf];
			}));
			// A refusal stops the walk: every later parameter is left untouched.
			const last = reached.findLastIndex(leaves => leaves.length > 0);
			if(!accepted) assert.ok(reached.slice(last + 1).every(leaves => leaves.length === 0), item.step);
			reached.forEach((leaves, index) => leaves.forEach(([suffix, constructor]) => { bump("validator", `${target.name}:${index}${suffix}`); bump("constructor", constructor); }));
			if(accepted)
			{
				bump("adapter", target.name);
				for(const leaves of reached) for(const [, constructor] of leaves) bump("constructor", constructor);
				assert.ok(Array.isArray(item.sources) && item.sources.length > 0);
				for(const source of item.sources) bump("source", source);
			}
			else assert.equal(item.sources, undefined);
		}
		rows.push([item.step, item.step === "start" ? 0 : item.status, [...counts]]);
	}
	return Object.freeze(rows);
};

const probeCalls = {
	"public-valid-first": "box(&input, 40); report(\"public-valid-first\", nominalsubtypes_first(&input, result, &error));"
	, "public-valid-second": "report(\"public-valid-second\", nominalsubtypes_second(&input, result, &error));"
	, "public-invalid-first": "box(&input, 100); report(\"public-invalid-first\", nominalsubtypes_first(&input, result, &error));"
	, "public-valid-combine": "box(&input, 40); box(&other, 40); report(\"public-valid-combine\", nominalsubtypes_combine(&input, &other, result, &error));"
	, "public-late-combine": "box(&other, 95); report(\"public-late-combine\", nominalsubtypes_combine(&input, &other, result, &error));"
	, "public-early-combine": "box(&input, 100); box(&other, 40); report(\"public-early-combine\", nominalsubtypes_combine(&input, &other, result, &error));"
	, "public-valid-nested": "box(&pair.left, 40); box(&pair.right, 40); report(\"public-valid-nested\", nominalsubtypes_nested(&pair, result, &error));"
	, "public-late-nested": "box(&pair.right, 95); report(\"public-late-nested\", nominalsubtypes_nested(&pair, result, &error));"
	, "public-inactive-event": "select_case(&event, NOMINALSUBTYPES_EVENT_KIND_EMPTY); report(\"public-inactive-event\", nominalsubtypes_event_first(&event, result, &error));"
	, "public-active-event-box": "select_case(&event, NOMINALSUBTYPES_EVENT_KIND_BOX); box(&event.cases.box.value, 40); report(\"public-active-event-box\", nominalsubtypes_event_first(&event, result, &error));"
	, "public-valid-event-choices": "select_case(&event, NOMINALSUBTYPES_EVENT_KIND_CHOICES); choose(&event, choices, 40); report(\"public-valid-event-choices\", nominalsubtypes_event_first(&event, result, &error));"
	, "public-invalid-event-choices": "choose(&event, choices, 100); report(\"public-invalid-event-choices\", nominalsubtypes_event_first(&event, result, &error));"
	, "public-valid-echo": "box(&input, 40); report(\"public-valid-echo\", nominalsubtypes_echo(&input, &output, &error));"
	, "public-recovery-first": "report(\"public-recovery-first\", nominalsubtypes_first(&input, result, &error));"
};

/**
 * Probe program over the installed public C API; it prints one row per step through the interposer's
 * counter accessor (resolved at run time, so an inert run without the interposer fails loudly) and
 * normalizes status to 0 (accepted), 1 (invalid argument) or 2 (anything else).
 *
 * @param columns - Classified columns for the installed library.
 */
export const nominalSubtypeDispatchProbe = columns => {
	const steps = nominalSubtypeDispatchSteps.filter(item => item.step !== "start").map(item => item.step);
	assert.deepEqual(Object.keys(probeCalls), steps, "probe calls must cover the step list exactly once, in order");
	return `#include <nominalsubtypes.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
static unsigned long (*count)(unsigned);
static void report(const char *step, nominalsubtypes_status status) {
  printf("%s %d", step, status == NOMINALSUBTYPES_STATUS_OK ? 0 : status == NOMINALSUBTYPES_STATUS_INVALID_ARGUMENT ? 1 : 2);
  for (unsigned i = 0; i < ${columns.length}; ++i) printf(" %lu", count(i));
  printf("\\n");
}
static void box(nominalsubtypes_envelope *value, unsigned long payload) { mpz_set_ui(value->payload, payload); mpz_set_ui(value->digit, 2); }
static void select_case(nominalsubtypes_event *event, nominalsubtypes_event_tag kind) {
  if (nominalsubtypes_event_select(event, kind) != NOMINALSUBTYPES_STATUS_OK) { fprintf(stderr, "event case selection failed\\n"); exit(1); }
}
/* [none, some (ok payload), some (error 40)]: the ok leaf is walked first, so an invalid payload refuses there. */
static void choose(nominalsubtypes_event *event, nominalsubtypes_option_result_nat_nat_value *choices, unsigned long payload) {
  event->cases.choices.values = (nominalsubtypes_array_option_result_nat_nat_span){choices, 3, NULL, NULL};
  choices[0].has_value = 0;
  choices[1].has_value = 1; choices[1].value.is_ok = 1; mpz_set_ui(choices[1].value.ok, payload);
  choices[2].has_value = 1; choices[2].value.is_ok = 0; mpz_set_ui(choices[2].value.error, 40);
}
int main(void) {
  *(void **)&count = dlsym(RTLD_DEFAULT, "nominal_subtype_dispatch_count");
  if (!count) { fprintf(stderr, "interposer is not visible\\n"); return 1; }
  nominalsubtypes_error error = {0};
  nominalsubtypes_envelope input, other, output; nominalsubtypes_envelope_init(&input); nominalsubtypes_envelope_init(&other); nominalsubtypes_envelope_init(&output);
  nominalsubtypes_pair pair; nominalsubtypes_pair_init(&pair);
  nominalsubtypes_event event; nominalsubtypes_event_init(&event);
  nominalsubtypes_option_result_nat_nat_value choices[3];
  for (unsigned i = 0; i < 3; ++i) nominalsubtypes_option_result_nat_nat_value_init(&choices[i]);
  mpz_t result; mpz_init(result);
  report("start", NOMINALSUBTYPES_STATUS_OK);
${steps.map(step => `  ${probeCalls[step]}`).join("\n")}
  for (unsigned i = 0; i < 3; ++i) nominalsubtypes_option_result_nat_nat_value_clear(&choices[i]);
  nominalsubtypes_event_clear(&event); nominalsubtypes_pair_clear(&pair);
  nominalsubtypes_envelope_clear(&input); nominalsubtypes_envelope_clear(&other); nominalsubtypes_envelope_clear(&output);
  mpz_clear(result);
  return 0;
}
`;
};

/**
 * Parse probe stdout rows: step, status, then one cumulative counter per column.
 *
 * @param stdout - Complete probe stdout.
 * @param columns - Classified columns for the installed library.
 */
export const parseNominalSubtypeDispatchRows = (stdout, columns) => {
	assert.equal(typeof stdout, "string"); assert.ok(stdout.endsWith("\n"), "incomplete probe output");
	return stdout.slice(0, -1).split("\n").map(line => {
		const [step, status, ...rest] = line.split(" ");
		assert.match(step, /^[a-z][a-z0-9-]*$/u); assert.match(status, /^[01]$/u);
		assert.equal(rest.length, columns.length, `${step}: ${rest.length} counters for ${columns.length} columns`);
		return [step, Number(status), rest.map(value => { assert.match(value, /^(0|[1-9][0-9]*)$/u); return Number(value); })];
	});
};

/**
 * Require every column to be exercised by some accepted step: a column that never moves cannot
 * distinguish an inert interposer from a measured package.
 *
 * @param rows - Cumulative rows, expected or observed.
 * @param columns - Classified columns for the installed library.
 */
export const assertNominalSubtypeDispatchPositiveControls = (rows, columns) => {
	const last = rows.at(-1)[2];
	columns.forEach((item, index) => assert.ok(last[index] > 0, `${item.role} ${item.label} (${item.symbol}) was never entered`));
};

/**
 * Check a selection report's dispatch section: the classified columns, exact expected rows from the
 * same step list, positive controls and the named unmeasured hosts.
 *
 * @param dispatch - The dispatch section of a selection report from the installed native lane.
 * @param text - Complete nm output recorded alongside the report, re-classified here.
 */
export const assertNominalSubtypeDispatchReport = (dispatch, text) => {
	assert.equal(dispatch.interposer, "LD_PRELOAD");
	const columns = classifyNominalSubtypeDispatchSymbols(text);
	assert.deepEqual(dispatch.columns, columns);
	const expected = nominalSubtypeDispatchExpected(columns);
	assert.deepEqual(dispatch.observed, expected);
	assertNominalSubtypeDispatchPositiveControls(dispatch.observed, columns);
	assert.equal(typeof dispatch.positiveControl, "string"); assert.ok(dispatch.positiveControl.length > 0);
	assert.deepEqual(dispatch.unmeasured, ["C++ dispatch (it calls the same C entries)", "resident memory"]);
	return columns;
};
