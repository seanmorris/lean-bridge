/**
 * Observe the complete public Wasmtime consumer without replacing its Component Model call.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { finContainerEdgeColumns, finContainerEdgeEntries, finContainerEdgeWireSymbols } from "./fin-container-edge-dispatch.mjs";
import { finContainerEdgeConsumer, insertFinContainerEdgeFragment } from "./fin-container-edges.mjs";

export const finContainerEdgeWitChecks = 14066;
export const finContainerEdgeWitSymbols = Object.freeze([
	"fincontainers_wasmtime_open", "fincontainers_wasmtime_call"
	, "fincontainers_wasmtime_link", "fincontainers_wasmtime_close"
	, "wasmtime_component_val_clone", "wasmtime_component_val_delete"
	, "wasmtime_error_message", "wasmtime_error_delete"
	, ...finContainerEdgeWireSymbols
]);

/** The original and supplementary calls, independently enumerated in their exact order. */
export const finContainerEdgeWitExpected = Object.freeze((() => {
	const rows = [], counts = Array(8).fill(0);
	const add = (method, accepted) => {
		const index = finContainerEdgeEntries.indexOf(method);
		if(accepted)
		{
			counts[index + 2]++;
			if(index >= 4) counts[index - 4]++;
		}
		rows.push(Object.freeze([rows.length + 1, method, accepted ? 0 : 1, Object.freeze([...counts])]));
	};
	for(const accepted of [true, false, true]) add("present", accepted);
	for(const accepted of [true, true, false]) add("flatten", accepted);
	for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, true);
	for(let value = 0; value < 3; value++)
		for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, false);
	for(let value = 0; value < 3; value++) add("optionalDigits", true);
	for(let row = 0; row < 3; row++)
	{
		add("present", false); add("optionalDigits", false);
		for(let column = 0; column < 3; column++) add("flatten", false);
	}
	add("present", true); add("flatten", true);
	for(let cycle = 0; cycle < 1000; cycle++)
		for(const method of ["emptyArray", "emptyList", "emptyOption", "present", "flatten", "optionalDigits"])
		{ add(method, false); add(method, true); }
	return rows;
})());

/**
 * Require each measured call and the complete consumer's assertion total.
 *
 * @param stdout - Actual Wasmtime consumer output.
 */
export const readFinContainerEdgeWit = stdout => {
	assert.ok(typeof stdout === "string" && stdout.endsWith("\n"));
	const lines = stdout.slice(0, -1).split("\n");
	assert.equal(lines.pop(), `fin-container-ok:${finContainerEdgeWitChecks}`);
	assert.equal(lines.length, finContainerEdgeWitExpected.length);
	return lines.map((line, index) => {
		assert.match(line, /^edge-wit [1-9][0-9]* [A-Za-z]+ [01](?: (?:0|[1-9][0-9]{0,14})){8}$/u);
		const [, step, method, status, ...counts] = line.split(" ");
		const row = [Number(step), method, Number(status), counts.map(Number)];
		assert.deepEqual(row, finContainerEdgeWitExpected[index], `WIT edge call ${index + 1}`);
		return row;
	});
};

/**
 * Forward only the consumer's public call and retain the same borrowed inputs and owned error/result.
 *
 * @param model - Receipt-verified native model.
 * @param component - Original component identity.
 * @param definitions - Exact defining libraries for the host, engine and C wire entrypoints.
 */
export const finContainerEdgeWitProbe = async (model, component, definitions) => {
	finContainerEdgeColumns(model, component);
	assert.deepEqual(Object.keys(definitions).sort(), [...finContainerEdgeWitSymbols].sort());
	for(const path of Object.values(definitions)) assert.ok(typeof path === "string" && isAbsolute(path) && !path.includes("\0"));
	const prelude = `#include <dlfcn.h>
static unsigned long (*edge_counter)(unsigned);
static unsigned edge_step;
static wasmtime_error_t *edge_wit_call(fincontainers_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *output) {
  const char *methods[6] = {"empty-array", "empty-list", "empty-option", "optional-digits", "present", "flatten"};
  const char *labels[6] = {${finContainerEdgeEntries.map(JSON.stringify).join(", ")}};
  unsigned index = 0;
  while (index < 6 && strcmp(name, methods[index])) ++index;
  if (index == 6) return fincontainers_wasmtime_call(session, name, args, count, output);
  unsigned long before[8];
  for (unsigned i = 0; i < 8; ++i) {
    before[i] = edge_counter(i);
    if (!edge_step && before[i]) { fputs("nonempty WIT edge counters before first call\\n", stderr); exit(5); }
  }
  wasmtime_error_t *error = fincontainers_wasmtime_call(session, name, args, count, output);
  for (unsigned i = 0; i < 8; ++i) {
    unsigned long delta = !error && (i == index + 2 || (index >= 4 && i == index - 4)) ? 1 : 0;
    if (edge_counter(i) != before[i] + delta) { fputs("wrong WIT edge dispatch count\\n", stderr); exit(5); }
  }
  printf("edge-wit %u %s %d", ++edge_step, labels[index], error ? 1 : 0);
  for (unsigned i = 0; i < 8; ++i) printf(" %lu", edge_counter(i));
  putchar('\\n');
  return error;
}
#define fincontainers_wasmtime_call edge_wit_call
`;
	const initial = `
  *(void **)&edge_counter = dlsym(RTLD_DEFAULT, "fin_container_edge_count");
  if (!edge_counter) { fputs("edge interposer is not loaded\\n", stderr); return 2; }
  for (unsigned i = 0; i < 8; ++i) if (edge_counter(i)) { fputs("edge counters are not initially zero\\n", stderr); return 3; }
${finContainerEdgeWitSymbols.map(symbol => `  {
    void *function = dlsym(RTLD_DEFAULT, "${symbol}"); Dl_info info;
    char *actual = function && dladdr(function, &info) ? realpath(info.dli_fname, NULL) : NULL;
    if (!actual || strcmp(actual, ${JSON.stringify(definitions[symbol])})) { fputs("unexpected WIT public definition: ${symbol}\\n", stderr); return 6; }
    free(actual);
  }`).join("\n")}`;
	let source = insertFinContainerEdgeFragment(await finContainerEdgeConsumer("wit-wasi"), "typedef wasmtime_component_val_t value;", prelude);
	assert.equal(source.split("int main(void) {").length, 2);
	source = "#define _GNU_SOURCE\n" + source.replace("int main(void) {", "int main(void) {" + initial);
	return { source, prelude, initial };
};
