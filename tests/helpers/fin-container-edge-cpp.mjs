/**
 * Measure the unchanged full C++ consumer through its generated public wrappers.
 * Four identity sources are inlined; only the six adapters and two surviving sources are counted.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { finContainerEdgeColumns, finContainerEdgeEntries } from "./fin-container-edge-dispatch.mjs";
import { finContainerEdgeConsumer, insertFinContainerEdgeFragment } from "./fin-container-edges.mjs";

export const finContainerEdgeCppSymbols = Object.freeze(finContainerEdgeEntries.map(name => `fincontainers_${name.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`)}`));

/** Independently enumerate the original consumer and additive fragment's complete call order. */
export const finContainerEdgeCppExpected = Object.freeze((() => {
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
	for(let value = 0; value < 3; value++) for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, false);
	for(let value = 0; value < 3; value++) add("optionalDigits", true);
	for(let row = 0; row < 3; row++)
	{
		add("present", false); add("optionalDigits", false);
		for(let column = 0; column < 3; column++) add("flatten", false);
	}
	add("present", true); add("flatten", true);
	for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, false);
	for(let position = 0; position < 3; position++) add("optionalDigits", false);
	for(let cycle = 0; cycle < 1000; cycle++)
		for(const method of ["emptyArray", "emptyList", "emptyOption", "present", "flatten", "optionalDigits"])
		{ add(method, false); add(method, true); }
	return rows;
})());

/**
 * Require the full ordered transcript and the original consumer's complete success line.
 *
 * @param stdout - Actual C++ process output.
 */
export const readFinContainerEdgeCpp = stdout => {
	assert.ok(typeof stdout === "string" && stdout.endsWith("\n"));
	const lines = stdout.slice(0, -1).split("\n");
	assert.equal(lines.pop(), "fin-container-ok:14099", "the complete C++ consumer must finish");
	assert.equal(lines.length, finContainerEdgeCppExpected.length);
	return lines.map((line, index) => {
		assert.match(line, /^edge-cpp [1-9][0-9]* [A-Za-z]+ [01](?: (?:0|[1-9][0-9]{0,14})){8}$/u);
		const [, step, method, status, ...counts] = line.split(" ");
		const row = [Number(step), method, Number(status), counts.map(Number)];
		assert.deepEqual(row, finContainerEdgeCppExpected[index], `C++ edge call ${index + 1}`);
		return row;
	});
};

/**
 * Redirect only the consumer's namespace alias. Every original value/error/recovery assertion stays.
 * Wrappers call the actual generated API, check entry deltas and rethrow its original errors.
 *
 * @param model - Verified native model.
 * @param component - Receipt component identity.
 * @param definitions - Optional absolute defining-library paths of the six C wire entrypoints.
 */
export const finContainerEdgeCppProbe = async (model, component, definitions) => {
	finContainerEdgeColumns(model, component);
	if(definitions !== undefined)
	{
		assert.deepEqual(Object.keys(definitions).sort(), [...finContainerEdgeCppSymbols].sort());
		for(const path of Object.values(definitions)) assert.ok(typeof path === "string" && isAbsolute(path) && !path.includes("\0"));
	}
	const carriers = ["std::vector<Nat>", "std::vector<Nat>", "std::optional<Nat>", "std::optional<std::vector<Nat>>", "std::vector<std::optional<Nat>>", "std::vector<std::vector<Nat>>"];
	const results = [0, 1, 2, 3, 0, 3];
	const wrappers = finContainerEdgeEntries.map((method, index) => {
		const name = method.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`);
		return `static ${carriers[results[index]]} ${name}(const ${carriers[index]}& input) {
  return edge_call(${index}, "${method}", [&] { return lean_bridge::fincontainers::${name}(input); });
}`;
	});
	const prelude = `#include <dlfcn.h>
#include <cstdlib>
#include <cstring>
static unsigned long (*edge_counter)(unsigned);
static unsigned edge_step;
namespace edge_api {
using namespace lean_bridge::fincontainers;
static void edge_record(unsigned index, const char *method, int status, const unsigned long *before) {
  for (unsigned i = 0; i < 8; ++i) {
    unsigned long delta = status == FINCONTAINERS_STATUS_OK && (i == index + 2 || (index >= 4 && i == index - 4)) ? 1 : 0;
    if (edge_counter(i) != before[i] + delta) { std::fputs("wrong C++ edge dispatch count\\n", stderr); std::exit(5); }
  }
  std::printf("edge-cpp %u %s %d", ++edge_step, method, status);
  for (unsigned i = 0; i < 8; ++i) std::printf(" %lu", edge_counter(i));
  std::putchar('\\n');
}
template<class F> static auto edge_call(unsigned index, const char *method, F&& call) {
  unsigned long before[8]; for (unsigned i = 0; i < 8; ++i) before[i] = edge_counter(i);
  try {
    auto result = call();
    edge_record(index, method, FINCONTAINERS_STATUS_OK, before);
    return result;
  } catch (const lean_bridge::fincontainers::Error& error) {
    edge_record(index, method, error.status, before);
    throw;
  }
}
${wrappers.join("\n")}
}`;
	const alias = "namespace api = lean_bridge::fincontainers;";
	let source = insertFinContainerEdgeFragment(await finContainerEdgeConsumer("cpp"), alias, prelude);
	source = source.replace(alias, "namespace api = edge_api;");
	assert.equal(source.split("int main() {").length, 2);
	source = source.replace("int main() {", `int main() {
  edge_counter = reinterpret_cast<unsigned long (*)(unsigned)>(dlsym(RTLD_DEFAULT, "fin_container_edge_count"));
  if (!edge_counter) { std::fputs("edge interposer is not loaded\\n", stderr); return 2; }
  for (unsigned i = 0; i < 8; ++i) if (edge_counter(i)) { std::fputs("edge counters are not initially zero\\n", stderr); return 3; }
${definitions ? finContainerEdgeCppSymbols.map(symbol => `  {
    void *function = dlsym(RTLD_DEFAULT, "${symbol}"); Dl_info info;
    char *actual = function && dladdr(function, &info) ? realpath(info.dli_fname, nullptr) : nullptr;
    if (!actual || std::strcmp(actual, ${JSON.stringify(definitions[symbol])})) { std::fputs("unexpected C++ wire definition: ${symbol}\\n", stderr); return 6; }
    std::free(actual);
  }`).join("\n") : ""}`);
	return source;
};
