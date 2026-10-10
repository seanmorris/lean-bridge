/**
 * Host-neutral entry counters for the five measured FinContainers entrypoints (VO #1438): Array through the
 * Digits alias, List with a bound wider than 64 bits, Option, nested Array (Option) and a late refined
 * argument. Ten columns count each Lean source function and its exported adapter. Public rows come from an
 * installed host's own public API; raw adapter rows come from a separate C probe that calls the adapters of
 * the same receipt-verified installed bytes and is never attributed to the host language.
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";

export const finContainerEntryKind = "fin-container-entry-v1";
/** The five measured entrypoints, in column order. Other exports are not measured. */
export const finContainerEntrySources = Object.freeze(["mirrorAll", "sumHuge", "orDefault", "present", "label"]);
const arity = Object.freeze({ mirrorAll: 1, sumHuge: 1, orDefault: 1, present: 1, label: 2 });
const width = finContainerEntrySources.length * 2;
const huge = 2n ** 70n;

/**
 * Exported adapter symbol of one Lean declaration, as the native model derives it.
 *
 * @param componentId - Actual component identity, such as fincontainers@1.0.0.
 * @param name - Lean declaration name.
 */
export const finContainerEntryAdapter = (componentId, name) => `lb_${sha256(`${componentId}\0${name}`).slice(0, 24)}`;

/**
 * Module initializer of the compiled native adapters for one component, as native-model.mjs names that
 * module. The Wasm component's LeanBridgeGenerated module is a different artifact.
 *
 * @param componentId - Actual component identity.
 */
export const finContainerEntryInitializer = componentId => `initialize_LeanBridgeNative${sha256(componentId).slice(0, 16)}`;

/**
 * Ten columns: the five Lean sources, then their adapters for this component.
 *
 * @param componentId - Actual component identity.
 */
export const finContainerEntrySymbols = componentId => [
	...finContainerEntrySources.map(name => `l_FinContainers_${name}`)
	, ...finContainerEntrySources.map(name => finContainerEntryAdapter(componentId, `FinContainers.${name}`))
];

/**
 * Derive the columns from an installed model only after checking its component, one export per measured
 * source, each symbol against the component identity and each arity. A package whose own receipt names a
 * different component is refused.
 *
 * @param model - Receipt-verified installed FinContainers model.
 * @param component - The installed package receipt's component, which must equal the model's.
 */
export const finContainerEntryColumns = (model, component) => {
	const id = model?.component?.id;
	if(typeof id !== "string" || !/^[^\0\s]+@[^\0\s]+$/u.test(id)) throw new TypeError("The model has no component identity");
	if(JSON.stringify(component) !== JSON.stringify(model.component)) throw new TypeError("The package receipt names another component");
	for(const name of finContainerEntrySources)
	{
		const matches = model.exports.filter(item => item.name === `FinContainers.${name}`);
		if(matches.length !== 1) throw new TypeError(`FinContainers.${name} must be exported exactly once`);
		if(matches[0].symbol !== finContainerEntryAdapter(id, matches[0].name)) throw new TypeError(`FinContainers.${name} has a symbol from another component`);
		if(matches[0].parameters.length !== arity[name]) throw new TypeError(`FinContainers.${name} has the wrong arity`);
	}
	const columns = finContainerEntrySymbols(id);
	if(new Set(columns).size !== width) throw new TypeError("Counted columns must be distinct");
	return columns;
};

const some = value => ({ some: value });
/**
 * Public steps: [step, method, arguments, outcome]. Arguments use bigint naturals, arrays, null for an
 * absent option, { some } for a present one and strings. Every invalid call, at the first, middle and last
 * Array position, in a nested option and in a late argument, runs before the first valid call; recovery
 * repeats both. An outcome is { ok: value } or { rejected: [parameter, bound] }.
 */
export const finContainerEntrySteps = Object.freeze([
	["start", null, null, { ok: null }]
	, ["invalid-array-first", "mirrorAll", [[10n, 1n, 2n]], { rejected: ["arg0[0]", "10"] }]
	, ["invalid-array-middle", "mirrorAll", [[1n, 10n, 2n]], { rejected: ["arg0[1]", "10"] }]
	, ["invalid-array-last", "mirrorAll", [[1n, 2n, 10n]], { rejected: ["arg0[2]", "10"] }]
	, ["invalid-list-wide", "sumHuge", [[1n, huge]], { rejected: ["arg0[1]", `${huge}`] }]
	, ["invalid-option-present", "orDefault", [some(1n)], { rejected: ["arg0?", "1"] }]
	, ["invalid-nested-present", "present", [[some(1n), null, some(10n)]], { rejected: ["arg0[2]?", "10"] }]
	, ["invalid-label-late", "label", [["a", "b"], [1n, 4n]], { rejected: ["arg1[1]", "4"] }]
	, ["valid-array", "mirrorAll", [[0n, 9n]], { ok: [9n, 0n] }]
	, ["valid-list-wide", "sumHuge", [[huge - 1n, 1n]], { ok: huge }]
	, ["valid-option-absent", "orDefault", [null], { ok: 7n }]
	, ["valid-option-present", "orDefault", [some(0n)], { ok: 0n }]
	, ["valid-nested-present", "present", [[some(1n), null, some(9n)]], { ok: [1n, 9n] }]
	, ["valid-label", "label", [["a", "b"], [1n, 3n]], { ok: "a:1,b:3" }]
	, ["recovery-invalid-array", "mirrorAll", [[9n, 10n, 0n]], { rejected: ["arg0[1]", "10"] }]
	, ["recovery-invalid-list", "sumHuge", [[huge]], { rejected: ["arg0[0]", `${huge}`] }]
	, ["recovery-invalid-option", "orDefault", [some(1n)], { rejected: ["arg0?", "1"] }]
	, ["recovery-invalid-nested", "present", [[null, some(10n)]], { rejected: ["arg0[1]?", "10"] }]
	, ["recovery-invalid-label", "label", [["a"], [4n]], { rejected: ["arg1[0]", "4"] }]
	, ["recovery-valid-array", "mirrorAll", [[]], { ok: [] }]
	, ["recovery-valid-list", "sumHuge", [[]], { ok: 0n }]
	, ["recovery-valid-option", "orDefault", [null], { ok: 7n }]
	, ["recovery-valid-nested", "present", [[null]], { ok: [] }]
	, ["recovery-valid-label", "label", [["a"], [0n]], { ok: "a:0" }]
].map(step => Object.freeze(step)));

/**
 * The one status token every host prints: ok with the exact value, or the rejected parameter and bound.
 * Arrays render as comma-separated decimals, naturals as decimals and strings as themselves.
 *
 * @param outcome - One step's outcome.
 */
export const finContainerEntryStatus = outcome => {
	if(outcome.rejected) return `rejected:${outcome.rejected[0]}:${outcome.rejected[1]}`;
	if(outcome.ok === null) return "ok";
	return `ok:${Array.isArray(outcome.ok) ? outcome.ok.join(",") : String(outcome.ok)}`;
};

const cumulative = (steps, change) => {
	const counts = Array(width).fill(0);
	return steps.map(step => {
		for(const [column, by] of change(step).entries()) counts[column] += by;
		return [step[0], step[3] === null ? null : step[3], [...counts]];
	});
};
const column = method => finContainerEntrySources.indexOf(method);

/** Exact public rows: a valid call enters its source and adapter once; a rejected call enters neither. */
export const finContainerEntryExpected = Object.freeze(cumulative(finContainerEntrySteps, ([, method, , outcome]) => {
	const change = Array(width).fill(0);
	if(method && !outcome.rejected)
	{
		change[column(method)] = 1;
		change[column(method) + 5] = 1;
	}
	return change;
}).map(([step, , counts], index) => Object.freeze([step, finContainerEntryStatus(finContainerEntrySteps[index][3]), counts])));

/**
 * Raw adapter steps for the separate C probe: [step, method, outcome]. Invalid values skip every public
 * check, so typed construction inside the adapter rejects them after the adapter is entered and before the
 * source is. Valid values enter both.
 */
export const finContainerEntryRawSteps = Object.freeze([
	["start", null, null]
	, ...finContainerEntrySources.map(name => [`raw-invalid-${name}`, name, "none"])
	, ...finContainerEntrySources.map(name => [`raw-valid-${name}`, name, "some"])
].map(step => Object.freeze(step)));

/** Exact raw rows: a rejected raw call enters only its adapter. */
export const finContainerEntryRawExpected = Object.freeze(cumulative(finContainerEntryRawSteps.map(([step, method, outcome]) => [step, method, null, outcome]), ([, method, , outcome]) => {
	const change = Array(width).fill(0);
	if(method)
	{
		change[column(method) + 5] = 1;
		if(outcome === "some") change[column(method)] = 1;
	}
	return change;
}).map(([step, outcome, counts]) => Object.freeze([step, outcome ?? "ok", counts])));

const line = new RegExp(`^([a-z]+(?:-[a-zA-Z]+)*) (\\S+)((?: (?:0|[1-9][0-9]{0,14})){${width}})$`, "u");

/**
 * Parse probe output strictly. Rows must have the exact steps, statuses and per-step count changes, so a
 * rejected call that enters Lean fails even when later counts compensate.
 *
 * @param stdout - Complete standard output of one probe run.
 * @param expected - Exact rows: finContainerEntryExpected or finContainerEntryRawExpected.
 */
export const readFinContainerEntry = (stdout, expected) => {
	if(typeof stdout !== "string" || !stdout.endsWith("\n")) throw new TypeError("entry output must be newline-terminated text");
	const rows = stdout.slice(0, -1).split("\n").map((text, index) => {
		const match = line.exec(text);
		if(!match) throw new TypeError(`entry line ${index + 1} is malformed: ${JSON.stringify(text)}`);
		return [match[1], match[2], match[3].slice(1).split(" ").map(Number)];
	});
	const steps = rows.map(([step]) => step).join(",");
	if(steps !== expected.map(([step]) => step).join(",")) throw new TypeError(`entry steps differ: ${steps}`);
	const zero = Array(width).fill(0);
	rows.forEach(([step, status, counts], index) => {
		const [, expectedStatus, expectedCounts] = expected[index];
		const previous = index ? rows[index - 1][2] : zero, expectedPrevious = index ? expected[index - 1][2] : zero;
		const change = counts.map((value, k) => value - previous[k]), expectedChange = expectedCounts.map((value, k) => value - expectedPrevious[k]);
		if(status !== expectedStatus) throw new TypeError(`${step} reported ${status} instead of ${expectedStatus}`);
		if(change.some((value, k) => value !== expectedChange[k])) throw new TypeError(`${step} changed counts by ${change.join(" ")} instead of ${expectedChange.join(" ")}`);
	});
	return rows;
};

/**
 * Outputs the reader must refuse, derived from exact expected rows.
 *
 * @param expected - Exact rows: finContainerEntryExpected or finContainerEntryRawExpected.
 */
export const finContainerEntryMutations = expected => {
	const render = rows => rows.map(([step, status, counts]) => `${step} ${status} ${counts.join(" ")}\n`).join("");
	const copy = () => structuredClone(expected);
	const rejectedAt = expected.findIndex(([, status]) => status.startsWith("rejected:") || status === "none");
	const validAt = expected.findIndex(([, status], index) => index > 0 && (status.startsWith("ok:") || status === "some"));
	const mutations = {
		// A rejected call that entered its source and adapter, compensated by one fewer later valid entry.
		"rejected call entered Lean": (() => { const rows = copy(); rows[rejectedAt][2][0]++; return render(rows); })()
		// A valid call that entered nothing, with every later row shifted to match.
		, "valid call not counted": (() => { const rows = copy(); const k = rows[validAt][2].findIndex((value, i) => value !== rows[validAt - 1][2][i]); for(const row of rows.slice(validAt)) row[2][k]--; return render(rows); })()
		, "status changed": (() => { const rows = copy(); rows[validAt][1] = "ok:wrong"; return render(rows); })()
		, "rows reordered": (() => { const rows = copy(); [rows[1], rows[2]] = [rows[2], rows[1]]; return render(rows); })()
		, "row missing": render(copy().slice(0, -1))
		, "row added": `${render(copy())}${expected.at(-1)[0]} ${expected.at(-1)[1]} ${expected.at(-1)[2].join(" ")}\n`
		, "column missing": render(copy()).replace(/ [0-9]+\n/gu, "\n")
		, "unterminated": render(copy()).slice(0, -1)
	};
	return { valid: render(expected), mutations };
};

const wrapper = (symbol, index) => {
	const count = arity[finContainerEntrySources[index % 5]];
	const parameters = Array.from({ length: count }, (_, i) => `void *a${i}`).join(", ");
	return `void *${symbol}(${parameters}) {
  static void *(*next)(${Array(count).fill("void *").join(", ")});
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbol}"); if (!next) abort(); }
  ++counts[${index}];
  return next(${Array.from({ length: count }, (_, i) => `a${i}`).join(", ")});
}`;
};

/**
 * Test-only LD_PRELOAD interposer over exactly the given ten columns.
 *
 * @param columns - Columns from finContainerEntryColumns.
 */
export const finContainerEntryInterposer = columns => {
	if(columns.length !== width || new Set(columns).size !== width) throw new TypeError("The interposer needs ten distinct columns");
	return `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
static unsigned long counts[${width}];
unsigned long fin_container_entry_count(unsigned index) { return index < ${width} ? counts[index] : 0; }
${columns.map(wrapper).join("\n")}
`;
};

export const finContainerEntryRawMissing = "fin_container_entry_count is not resolvable in the raw adapter probe\n";
const rawValues = {
	mirrorAll: { invalid: "array1(nat(\"10\"))", valid: "array1(nat(\"3\"))" }
	, sumHuge: { invalid: `cons(nat("${huge}"), lean_box(0))`, valid: "cons(nat(\"1\"), lean_box(0))" }
	, orDefault: { invalid: "some(nat(\"1\"))", valid: "lean_box(0)" }
	, present: { invalid: "array1(some(nat(\"10\")))", valid: "array1(some(nat(\"9\")))" }
	, label: { invalid: "array1(lean_mk_string(\"a\")), array1(nat(\"4\"))", valid: "array1(lean_mk_string(\"a\")), array1(nat(\"3\"))" }
};

/**
 * Separate C raw-adapter probe, linked against one installed package's verified libraries. It initializes
 * the component through the runtime's own entry and then calls each exported adapter directly with an
 * invalid and a valid value. These rows are a C caller's observation of those bytes, not the host's.
 *
 * @param componentId - Actual component identity.
 * @param columns - Columns from finContainerEntryColumns for the same component.
 */
export const finContainerEntryRawProbe = (componentId, columns) => {
	if(JSON.stringify(columns) !== JSON.stringify(finContainerEntrySymbols(componentId))) throw new TypeError("Raw probe columns differ from the component's");
	const adapters = columns.slice(5);
	const calls = finContainerEntryRawSteps.slice(1).map(([step, method, outcome]) => {
		const index = column(method), kind = arity[method] === 2 ? "binary" : "unary";
		return `  report("${step}", outcome(((${kind})adapter[${index}])(${rawValues[method][outcome === "some" ? "valid" : "invalid"]}), ${outcome === "some" ? 1 : 0}));`;
	}).join("\n");
	return `#define _GNU_SOURCE
#include <lean/lean.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
typedef int (*initialize_fn)(const char *, void *(*)(uint8_t));
typedef lean_object *(*unary)(lean_object *);
typedef lean_object *(*binary)(lean_object *, lean_object *);
static unsigned long (*count)(unsigned);
static void *adapter[5];
static void report(const char *step, const char *status) {
  printf("%s %s", step, status);
  for (unsigned i = 0; i < ${width}; ++i) printf(" %lu", count(i));
  printf("\\n");
}
static lean_object *nat(const char *text) { return lean_cstr_to_nat(text); }
static lean_object *array1(lean_object *item) {
  lean_object *array = lean_alloc_array(1, 1);
  lean_array_set_core(array, 0, item);
  return array;
}
static lean_object *some(lean_object *value) {
  lean_object *option = lean_alloc_ctor(1, 1, 0);
  lean_ctor_set(option, 0, value);
  return option;
}
static lean_object *cons(lean_object *head, lean_object *tail) {
  lean_object *list = lean_alloc_ctor(1, 2, 0);
  lean_ctor_set(list, 0, head);
  lean_ctor_set(list, 1, tail);
  return list;
}
/* An exported adapter consumes its arguments and returns an owned Option; the result must match. */
static const char *outcome(lean_object *result, int expected) {
  int present = !lean_is_scalar(result);
  lean_dec(result);
  if (present != expected) { fprintf(stderr, "raw adapter outcome differs\\n"); exit(5); }
  return present ? "some" : "none";
}
int main(void) {
  *(void **)&count = dlsym(RTLD_DEFAULT, "fin_container_entry_count");
  if (!count) { fputs(${JSON.stringify(finContainerEntryRawMissing)}, stderr); return 2; }
  initialize_fn initialize = (initialize_fn)dlsym(RTLD_DEFAULT, "lean_bridge_native_component_initialize");
  void *initializer = dlsym(RTLD_DEFAULT, "${finContainerEntryInitializer(componentId)}");
  const char *names[5] = { ${adapters.map(symbol => JSON.stringify(symbol)).join(", ")} };
  for (unsigned i = 0; i < 5; ++i) adapter[i] = dlsym(RTLD_DEFAULT, names[i]);
  for (unsigned i = 0; i < 5; ++i) if (!adapter[i]) { fprintf(stderr, "adapter %s is not visible\\n", names[i]); return 3; }
  if (!initialize || !initializer) { fputs("component initializer is not visible\\n", stderr); return 3; }
  if (!initialize(${JSON.stringify(componentId)}, (void *(*)(uint8_t))initializer)) { fputs("component initialization failed\\n", stderr); return 4; }
  report("start", "ok");
${calls}
  return 0;
}
`;
};

/**
 * The report section that replaces an unobserved dispatch claim for one gated host profile and route.
 *
 * @param root0 - The two separate observations of one installed package.
 * @param root0.publicHost - Rows from the host's own public API, with its instrument and identities.
 * @param root0.rawAdapter - Rows from the separate C raw-adapter probe of the same verified bytes.
 * @param root0.columns - The ten columns both observations count.
 * @param root0.componentId - Actual component identity.
 * @param root0.libraries - Verified installed library identities both observations used.
 */
export const finContainerEntryReport = ({ publicHost, rawAdapter, columns, componentId, libraries }) => {
	const publicRows = readFinContainerEntry(publicHost.stdout, finContainerEntryExpected);
	const rawRows = readFinContainerEntry(rawAdapter.stdout, finContainerEntryRawExpected);
	if(JSON.stringify(columns) !== JSON.stringify(finContainerEntrySymbols(componentId))) throw new TypeError("Columns differ from the component's");
	return { kind: finContainerEntryKind, componentId, columns
		, measuredEntrypoints: finContainerEntrySources.map(name => `FinContainers.${name}`)
		, libraries
		, public: { caller: publicHost.caller, instrument: publicHost.instrument, observed: publicRows, ...publicHost.identities }
		, rawAdapter: { caller: "C raw-adapter probe of the same verified installed libraries; not a host-language call", instrument: "LD_PRELOAD", observed: rawRows, ...rawAdapter.identities } };
};
