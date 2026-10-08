/**
 * Checked top-level Fin sites in installed, relocated WIT/WASI host packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader } from "../src/backends/wit/copied-host.mjs";
import { witFinReadme } from "../src/backends/wit/fin-refinements.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { reviewedScalarHostIr } from "./helpers/reviewed-scalar-host-fixture.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { installedWitCorpus } from "./helpers/type-corpus-wit.mjs";
import { witCompilerOptions } from "./helpers/type-corpus-wit-evidence.mjs";
import { nativeFinAdapterSymbol, nativeFinCountInterposerFor, nativeFinDispatchExpected, nativeFinDispatchMutations, nativeFinDispatchSources, nativeFinDispatchSteps, nativeFinDispatchSymbols, readNativeFinDispatch } from "./helpers/native-fin-dispatch.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import "./helpers/native-fin-dispatch-tests.mjs";

const huge = "1180591620717411303424";
const expectedBounds = {
	"NativeFin.impossible": [["0"], null]
	, "NativeFin.only": [["1"], null]
	, "NativeFin.mirror": [["10"], "10"]
	, "NativeFin.twice": [["300"], null]
	, "NativeFin.succHuge": [[huge], huge]
	, "NativeFin.wrap": [[null], "7"]
	, "NativeFin.label": [[null, "4", null], null]
};
const bounds = refinements => refinements ? [refinements.parameters.map(item => item?.bound ?? null), refinements.result?.bound ?? null] : null;
const sharedLibraries = files => Object.fromEntries(Object.entries(files)
	.filter(([path]) => /\.so(?:\.|$)/.test(path)).map(([path, file]) => [basename(path), file.sha256 ?? file]));
const exportsInOrder = ["impossible", "label", "mirror", "only", "succ-huge", "twice", "wrap"];

/** Public Wasmtime values cross the real component; Nat and Fin are canonical u32 limb lists. */
const witFinConsumer = () => `#define _GNU_SOURCE
#include "nativefin_wasmtime.h"
#include <link.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static size_t checks, rejections;
static nativefin_wasmtime *session;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\\n", __LINE__, #test); exit(1); } checks++; } while (0)
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
static value nat(const uint32_t *limbs, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = limbs[i]};
  return result;
}
static value small(uint32_t number) { return nat(&number, number ? 1 : 0); }
static value text(const char *bytes) {
  value result = {.kind = WASMTIME_COMPONENT_STRING};
  wasm_name_new(&result.of.string, strlen(bytes), bytes);
  return result;
}
static bool is_nat(const value *v, const uint32_t *limbs, size_t count) {
  if (v->kind != WASMTIME_COMPONENT_LIST || v->of.list.size != count) return false;
  for (size_t i = 0; i < count; ++i)
    if (v->of.list.data[i].kind != WASMTIME_COMPONENT_U32 || v->of.list.data[i].of.u32 != limbs[i]) return false;
  return true;
}
static bool is_small(const value *v, uint32_t number) { return is_nat(v, &number, number ? 1 : 0); }
static value call(const char *name, const value *args, size_t count) {
  value result = {0};
  wasmtime_error_t *error = nativefin_wasmtime_call(session, name, args, count, &result);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%s: %.*s\\n", name, (int)message.size, message.data); exit(1);
  }
  return result;
}
/* A rejected call names the parameter and bound and leaves the result slot unchanged. */
static bool rejected(const char *name, const value *args, size_t count, const char *needle) {
  value output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_error_t *error = nativefin_wasmtime_call(session, name, args, count, &output);
  if (!error) return false;
  wasm_name_t message; wasmtime_error_message(error, &message);
  char *copy = calloc(message.size + 1, 1);
  if (!copy) exit(1);
  memcpy(copy, message.data, message.size);
  bool found = strstr(copy, needle) != NULL;
  if (!found) fprintf(stderr, "Expected '%s' in '%s'\\n", needle, copy);
  free(copy); wasm_name_delete(&message); wasmtime_error_delete(error);
  rejections++;
  return found && output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991;
}
static bool unary(const char *name, value input, const uint32_t *limbs, size_t count) {
  value result = call(name, &input, 1);
  bool same = is_nat(&result, limbs, count);
  clear(&input); clear(&result);
  return same;
}
static bool unary_rejected(const char *name, value input, const char *needle) {
  bool result = rejected(name, &input, 1, needle);
  clear(&input);
  return result;
}
static int loaded(struct dl_phdr_info *info, size_t size, void *data) {
  (void)size; bool *comma = data;
  if (!info->dlpi_name[0]) return 0;
  if (*comma) fputc(',', stdout);
  CHECK(!strchr(info->dlpi_name, '"') && !strchr(info->dlpi_name, '\\\\'));
  printf("\\"%s\\"", info->dlpi_name); *comma = true; return 0;
}
int main(void) {
  wasmtime_error_t *opened = nativefin_wasmtime_open(&session);
  if (opened) { fprintf(stderr, "cannot open session\\n"); return 1; }
  const uint32_t word[] = {0, 1}, word_next[] = {1, 1};
  const uint32_t huge[] = {0, 0, 64}, huge_next[] = {1, 0, 64}, wide[] = {0, 0, 0, 0, 1};
  const uint32_t last[] = {UINT32_MAX, UINT32_MAX, 63}, below[] = {UINT32_MAX - 1, UINT32_MAX, 63};
  const uint32_t seven[] = {7}, nine[] = {9}, two[] = {2}, large[] = {598};

  /* Fin 0 is uninhabited: every input is rejected by the native bound check. */
  CHECK(unary_rejected("impossible", small(0), "arg0 is not below its Fin 0 bound"));
  CHECK(unary_rejected("impossible", small(1), "arg0 is not below its Fin 0 bound"));
  /* Fin 1 admits only zero. */
  CHECK(unary("only", small(0), seven, 1));
  CHECK(unary_rejected("only", small(1), "arg0 is not below its Fin 1 bound"));
  /* Fin 10 with a Fin result: endpoints and beyond-bound inputs. */
  CHECK(unary("mirror", small(0), nine, 1));
  CHECK(unary("mirror", small(9), NULL, 0));
  CHECK(unary_rejected("mirror", small(10), "arg0 is not below its Fin 10 bound"));
  CHECK(unary_rejected("mirror", small(11), "arg0 is not below its Fin 10 bound"));
  CHECK(unary_rejected("mirror", nat(word, 2), "arg0 is not below its Fin 10 bound"));
  CHECK(unary_rejected("mirror", nat(huge, 3), "arg0 is not below its Fin 10 bound"));
  /* A transparent alias keeps its exact bound. */
  CHECK(unary("twice", small(299), large, 1));
  CHECK(unary_rejected("twice", small(300), "arg0 is not below its Fin 300 bound"));
  CHECK(unary_rejected("twice", small(301), "arg0 is not below its Fin 300 bound"));
  /* 2^70 exceeds every machine word. */
  CHECK(unary("succ-huge", nat(word, 2), word_next, 2));
  CHECK(unary("succ-huge", nat(below, 3), last, 3));
  CHECK(unary("succ-huge", nat(last, 3), last, 3));
  CHECK(unary_rejected("succ-huge", nat(huge, 3), "arg0 is not below its Fin ${huge} bound"));
  CHECK(unary_rejected("succ-huge", nat(huge_next, 3), "arg0 is not below its Fin ${huge} bound"));
  CHECK(unary_rejected("succ-huge", nat(wide, 5), "arg0 is not below its Fin ${huge} bound"));
  /* A result-only refinement returns limbs below its bound. */
  CHECK(unary("wrap", small(100), two, 1));
  CHECK(unary("wrap", nat(huge, 3), two, 1));
  CHECK(unary("wrap", small(0), NULL, 0));
  /* Multiargument calls reject the Fin argument and leave caller values unchanged. */
  value arguments[3] = {small(5), small(3), text("slot")};
  value labelled = call("label", arguments, 3);
  CHECK(labelled.kind == WASMTIME_COMPONENT_STRING && labelled.of.string.size == 6 && memcmp(labelled.of.string.data, "slot:8", 6) == 0);
  clear(&labelled); clear(&arguments[1]); arguments[1] = small(4);
  CHECK(rejected("label", arguments, 3, "arg1 is not below its Fin 4 bound"));
  CHECK(is_small(&arguments[0], 5) && is_small(&arguments[1], 4));
  CHECK(arguments[2].kind == WASMTIME_COMPONENT_STRING && arguments[2].of.string.size == 4 && memcmp(arguments[2].of.string.data, "slot", 4) == 0);
  clear(&arguments[1]); arguments[1] = small(0);
  labelled = call("label", arguments, 3);
  CHECK(labelled.of.string.size == 6 && memcmp(labelled.of.string.data, "slot:5", 6) == 0);
  clear(&labelled); for (size_t i = 0; i < 3; ++i) clear(&arguments[i]);
  /* Repeated invalid and valid calls recover; each rejection refreshes the store. */
  for (uint32_t i = 0; i < 1000; ++i) {
    if (!unary_rejected("mirror", small(10 + i), "arg0 is not below its Fin 10 bound")) { fprintf(stderr, "invalid call %u accepted\\n", i); return 1; }
    const uint32_t expected = 9 - i % 10;
    if (!unary("mirror", small(i % 10), &expected, expected ? 1 : 0)) { fprintf(stderr, "valid call %u failed\\n", i); return 1; }
  }
  checks += 2000;
  nativefin_wasmtime_close(session); session = NULL;
  printf("{\\"hostVersion\\":\\"%s\\",\\"checks\\":%zu,\\"rejections\\":%zu,\\"results\\":[],\\"loadedLibraries\\":[", WASMTIME_VERSION, checks, rejections);
  bool comma = false; dl_iterate_phdr(loaded, &comma); puts("]}");
  return 0;
}
`;

const witFinDispatchExpected = nativeFinDispatchExpected(outcome => outcome.rejected ? `rejected:${outcome.rejected[0]}<${outcome.rejected[1]}` : `ok:${outcome.ok}`);
const witFinDispatchRoutes = ["public WIT exports mirror, impossible and label through the installed nativefin_wasmtime_call host API, the embedded Wasmtime component and its host imports into the bundled C adapter"];
const missingCounter = "native_fin_dispatch_count is not resolvable in this WIT host process\n";
const limbs = number => {
	const words = [];
	for(let rest = number; rest > 0n; rest >>= 32n) words.push(Number(rest & 0xffffffffn));
	return words;
};
const witArgument = argument => {
	if(typeof argument === "string") return `text(${JSON.stringify(argument)})`;
	const words = limbs(argument);
	return words.length ? `nat((const uint32_t[]){${words.join(", ")}}, ${words.length})` : "nat(NULL, 0)";
};

/**
 * Probe run under the count interposer. It resolves the counter from the process-wide symbol scope
 * before opening a session and exits with status 2 when it is missing, so an absent interposer never
 * reports zeros. It also refuses a host library loaded from outside the relocated deployment.
 */
const witFinDispatchProbe = () => `#define _GNU_SOURCE
#include "nativefin_wasmtime.h"
#include <ctype.h>
#include <dlfcn.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static unsigned long (*counter)(unsigned);
static nativefin_wasmtime *session;
static value nat(const uint32_t *words, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = words[i]};
  return result;
}
static value text(const char *bytes) {
  value result = {.kind = WASMTIME_COMPONENT_STRING};
  wasm_name_new(&result.of.string, strlen(bytes), bytes);
  return result;
}
/* Accept exactly one "argN is not below its Fin B bound" phrase; Wasmtime may add context around it. */
static bool rejection(const char *message, char *status, size_t size) {
  static const char phrase[] = " is not below its Fin ";
  const char *marker = strstr(message, phrase);
  if (!marker || strstr(marker + 1, phrase)) return false;
  const char *index = marker;
  while (index > message && isdigit((unsigned char)index[-1])) --index;
  if (index == marker || index - message < 3 || memcmp(index - 3, "arg", 3) != 0) return false;
  if (index - 3 > message && isalnum((unsigned char)index[-4])) return false;
  const char *bound = marker + sizeof phrase - 1, *end = bound;
  while (isdigit((unsigned char)*end)) ++end;
  if (end == bound || strncmp(end, " bound", 6) != 0 || isalnum((unsigned char)end[6])) return false;
  int written = snprintf(status, size, "rejected:arg%.*s<%.*s", (int)(marker - index), index, (int)(end - bound), bound);
  return written > 0 && (size_t)written < size;
}
static void report(const char *step, const char *status) {
  printf("%s %s", step, status);
  for (unsigned i = 0; i < 6; ++i) printf(" %lu", counter(i));
  putchar('\\n');
}
/* One public call: a rejection must leave the result slot unchanged; results print as decimal or text. */
static void call(const char *step, const char *name, value *args, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  char status[96] = "error";
  wasmtime_error_t *error = nativefin_wasmtime_call(session, name, args, count, &result);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    char *copy = calloc(message.size + 1, 1);
    if (!copy) exit(1);
    memcpy(copy, message.data, message.size);
    if (!rejection(copy, status, sizeof status) || result.kind != WASMTIME_COMPONENT_U32 || result.of.u32 != 991) strcpy(status, "error");
    free(copy); wasm_name_delete(&message); wasmtime_error_delete(error);
  } else {
    const value *data = result.of.list.data;
    if (result.kind == WASMTIME_COMPONENT_LIST && result.of.list.size <= 1 && (!result.of.list.size || data[0].kind == WASMTIME_COMPONENT_U32))
      snprintf(status, sizeof status, "ok:%u", result.of.list.size ? data[0].of.u32 : 0u);
    else if (result.kind == WASMTIME_COMPONENT_STRING && result.of.string.size && result.of.string.size < 64) {
      bool printable = true;
      for (size_t i = 0; i < result.of.string.size; ++i) printable = printable && result.of.string.data[i] > ' ' && result.of.string.data[i] <= '~';
      if (printable) snprintf(status, sizeof status, "ok:%.*s", (int)result.of.string.size, result.of.string.data);
      else strcpy(status, "ok:unprintable");
    } else strcpy(status, "ok:unexpected");
    wasmtime_component_val_delete(&result);
  }
  for (size_t i = 0; i < count; ++i) wasmtime_component_val_delete(&args[i]);
  report(step, status);
}
int main(int argc, char **argv) {
  *(void **)&counter = dlsym(RTLD_DEFAULT, "native_fin_dispatch_count");
  if (!counter) { fputs("native_fin_dispatch_count is not resolvable in this WIT host process\\n", stderr); return 2; }
  if (argc != 2) { fputs("usage: dispatch DEPLOYMENT_ROOT\\n", stderr); return 2; }
  Dl_info host;
  void *entry = dlsym(RTLD_DEFAULT, "nativefin_wasmtime_call");
  size_t length = strlen(argv[1]);
  if (!entry || !dladdr(entry, &host) || !host.dli_fname || strncmp(host.dli_fname, argv[1], length) != 0 || host.dli_fname[length] != '/') {
    fputs("nativefin_wasmtime_call is not loaded from the deployment\\n", stderr); return 3;
  }
  if (nativefin_wasmtime_open(&session)) { fputs("cannot open session\\n", stderr); return 1; }
  report("start", "ok");
${nativeFinDispatchSteps.slice(1).map(([step, name, args]) => `  { value args[] = {${args.map(witArgument).join(", ")}}; call("${step}", "${name}", args, ${args.length}); }`).join("\n")}
  nativefin_wasmtime_close(session);
  return 0;
}
`;

/**
 * Compile the dispatch probe against the installed package headers, then count source and adapter entry
 * in a process that loads only the relocated deployment's libraries.
 *
 * @param root0 - Installed WIT host and its handoff.
 * @param root0.consumer - Task-owned root that receives the probe directory beside the deployment.
 * @param root0.handoff - Copied handoff holding the verified package archive.
 * @param root0.pkg - Package-set entry for the WIT host package.
 * @param root0.wit - Installed WIT facts, including the deployment and its verified libraries.
 * @param root0.componentId - Component identity that names the counted adapters.
 */
const observeWitDispatch = async ({ consumer, handoff, pkg, wit, componentId }) => {
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
	const deployment = wit.deploymentRoot, columns = nativeFinDispatchSymbols(componentId);
	// Each counted symbol must be a defined dynamic symbol of the verified deployment for the preload to interpose it.
	const defined = new Set();
	for(const path of Object.keys(wit.libraries))
	{
		const listed = await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(deployment, path)], deployment, tools);
		for(const line of listed.stdout.split("\n")) defined.add(line.trim().split(/\s+/).at(-1));
	}
	for(const symbol of columns) assert.ok(defined.has(symbol), symbol);
	const probeRoot = join(consumer, "dispatch"), headers = join(probeRoot, "package"), interposer = join(probeRoot, "libdispatch.so");
	await saveLakeFile(headers, ".keep", "");
	await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, pkg.artifacts[0].path), "-C", headers], probeRoot, tools);
	const installed = join(headers, `${pkg.name}-${pkg.version}-wit-wasi`);
	assert.equal(sha256(await readFile(join(installed, "lean-bridge-package.json"))), wit.packageReceiptSha256);
	await verifyNativeFiles(installed, wit.packageReceipt.files);
	await saveLakeFile(probeRoot, "interposer.c", nativeFinCountInterposerFor(componentId));
	await saveLakeFile(probeRoot, "dispatch.c", witFinDispatchProbe());
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], probeRoot, tools);
	assert.match((await runCopied("/usr/bin/nm", ["-D", "--defined-only", interposer], probeRoot, tools)).stdout, /^[0-9a-f]+ T native_fin_dispatch_count$/m);
	const link = ["-L", join(deployment, "lib"), `-l:${wit.compiled.library}`, "-lwasmtime", `-Wl,-rpath,${join(deployment, "lib")}`];
	await runCopied("/usr/bin/cc", [...witCompilerOptions, "dispatch.c", "-I", join(installed, "include"), ...link, "-o", "dispatch"], probeRoot, tools);
	// The headers serve only compilation; the probe runs against the relocated deployment alone.
	await rm(headers, { recursive: true, force: true });
	const command = join(probeRoot, "dispatch");
	// Without the preload the counter is missing and the probe refuses before opening a session.
	await assert.rejects(runCopied(command, [deployment], probeRoot), error => /exited with status 2/.test(error.message)
		&& error.details.stdout === "" && error.details.stderr === missingCounter);
	const run = await runCopied(command, [deployment], probeRoot, { ...copiedCleanEnvironment, LD_PRELOAD: interposer });
	assert.equal(run.stderr, "");
	const observed = readNativeFinDispatch(run.stdout, witFinDispatchExpected);
	assert.deepEqual(observed, witFinDispatchExpected);
	return { columns, observed, interposer: "LD_PRELOAD"
		, routes: witFinDispatchRoutes
		, positiveControl: "valid public WIT calls increment exactly their source and adapter columns; rejected calls, including every Fin 0 call, change no column"
		, probeSha256: sha256(witFinDispatchProbe())
		, interposerSha256: sha256(nativeFinCountInterposerFor(componentId)) };
};

const finIr = () => {
	const ir = corpusReviewedIr({ id: "fins" }, [
		{ name: "Fins.label", parameters: ["nat", "nat", "string"], result: "string" }
		, { name: "Fins.plain", parameters: ["nat"], result: "nat" }]);
	const label = ir.declarations.find(item => item.id === "lean:Fins.label");
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "fin", bound: "4" }, null], result: null };
	return { ir, label };
};

test("WIT/WASI host packages are checked Fin consumers beside the other C-adapter hosts", () => {
	for(const targets of [["wit-wasi"], ["c", "wit-wasi"], ["c", "cpp", "pypi", "cargo", "rubygems", "nuget", "maven", "php-native", "wit-wasi"]])
		assert.equal(supportsNativeRefinementTargets(targets), true, targets.join(","));
	assert.equal(supportsNativeRefinementTargets(["wit-wasi", "cpan"]), true);
});

test("WIT bound docs come only from checked refinement metadata and leave the WIT text unchanged", () => {
	const { ir, label } = finIr();
	const settings = { name: "fins", version: "1.0.0" };
	const projection = compileCopiedWitModel(ir, settings);
	const readme = witFinReadme(projection);
	assert.match(readme, /Lean Fin n parameters and results use the Nat representation, list<u32> little-endian limbs/);
	assert.match(readme, /\n- label: value1 < 4\n/);
	assert.doesNotMatch(readme, /\n- plain:/);
	// Fin shares Nat's transport: removing the constraint changes no WIT or component text.
	const unrefined = structuredClone(ir);
	delete unrefined.declarations.find(item => item.id === "lean:Fins.label").source.extensions["lean-lang.org/refinements"];
	const plain = compileCopiedWitModel(unrefined, settings);
	assert.equal(projection.wit, plain.wit); assert.equal(projection.wat, plain.wat);
	assert.equal(witFinReadme(plain), "");
	// A top-level Subtype documents its checked constructor; one inside a container is refused.
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "subtype", constructor: "Fins.check" }, null], result: null };
	assert.match(witFinReadme(compileCopiedWitModel(ir, settings)), /checked by Fins\.check/);
	assert.match(witFinReadme(compileCopiedWitModel(ir, settings)), /Lean Subtype parameters cross as their base value\./);
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "array", arguments: [{ kind: "subtype", constructor: "Fins.check" }] }, null], result: null };
	assert.throws(() => witFinReadme(compileCopiedWitModel(ir, settings)), TypeError);
});

test("the WIT dispatch rows spell each rejection by parameter and bound and each result by value", () => {
	assert.deepEqual(witFinDispatchExpected.map(([step, status]) => `${step} ${status}`), [
		"start ok"
		, "invalid-mirror-bound rejected:arg0<10"
		, "invalid-mirror-huge rejected:arg0<10"
		, "invalid-impossible-zero rejected:arg0<0"
		, "invalid-label-late rejected:arg1<4"
		, "valid-mirror ok:6"
		, "valid-label ok:slot:8"
		, "recovery-invalid-mirror rejected:arg0<10"
		, "recovery-invalid-impossible rejected:arg0<0"
		, "recovery-invalid-label rejected:arg1<4"
		, "recovery-valid-mirror ok:0"
		, "recovery-valid-label ok:slot:5"
	]);
	const { valid, mutations } = nativeFinDispatchMutations(witFinDispatchExpected);
	assert.deepEqual(readNativeFinDispatch(valid, witFinDispatchExpected), witFinDispatchExpected);
	for(const [name, output] of Object.entries(mutations))
		assert.throws(() => readNativeFinDispatch(output, witFinDispatchExpected), TypeError, name);
	// The probe resolves the counter and checks the host's origin before any session or call.
	const probe = witFinDispatchProbe(), order = ["\"native_fin_dispatch_count\"", "return 2; }", "dladdr(entry, &host)", "nativefin_wasmtime_open(&session)", "report(\"start\", \"ok\")"];
	assert.deepEqual(order.map(item => probe.indexOf(item)), order.map(item => probe.indexOf(item)).toSorted((a, b) => a - b));
	assert.ok(order.every(item => probe.includes(item)));
	assert.match(probe, /value args\[\] = \{nat\(\(const uint32_t\[\]\)\{0, 0, 64\}, 3\)\}; call\("invalid-mirror-huge", "mirror", args, 1\);/);
	assert.match(probe, /call\("invalid-impossible-zero", "impossible", args, 1\);/);
});

const wasmtimeCApi = resolve(".toolchains/wasmtime42");
/**
 * Stand-in Lean sources and exported adapters in one shared library.
 *
 * @param componentId - Component identity that names the adapters.
 */
const fakeComponent = componentId => `#include <stdint.h>
void *l_NativeFin_mirror(void *a0) { return (void *)(9 - (uintptr_t)a0); }
void *l_NativeFin_impossible(void *a0) { return a0; }
void *l_NativeFin_label(void *a0, void *a1, void *a2) { (void)a2; return (void *)((uintptr_t)a0 + (uintptr_t)a1); }
${nativeFinDispatchSources.map(name => `void *${nativeFinAdapterSymbol(componentId, `NativeFin.${name}`)}(${name === "label" ? "void *a0, void *a1, void *a2" : "void *a0"}) { return l_NativeFin_${name}(${name === "label" ? "a0, a1, a2" : "a0"}); }`).join("\n")}
`;
/**
 * A stand-in Wasmtime host with the generated header: it checks bounds in C before its adapters, unless LEAK is defined.
 *
 * @param componentId - Component identity that names the adapters.
 */
const fakeHost = componentId => `#include "nativefin_wasmtime.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
void *${nativeFinAdapterSymbol(componentId, "NativeFin.mirror")}(void *);
void *${nativeFinAdapterSymbol(componentId, "NativeFin.impossible")}(void *);
void *${nativeFinAdapterSymbol(componentId, "NativeFin.label")}(void *, void *, void *);
struct nativefin_wasmtime { int open; };
wasmtime_error_t *nativefin_wasmtime_open(nativefin_wasmtime **out) { *out = calloc(1, sizeof **out); return *out ? NULL : wasmtime_error_new("allocation"); }
wasmtime_error_t *nativefin_wasmtime_link(wasmtime_component_linker_t *linker) { (void)linker; return NULL; }
void nativefin_wasmtime_close(nativefin_wasmtime *session) { free(session); }
static bool word(const wasmtime_component_val_t *v, uintptr_t *out) {
  if (v->kind != WASMTIME_COMPONENT_LIST || v->of.list.size > 1) return false;
  *out = v->of.list.size ? v->of.list.data[0].of.u32 : 0; return true;
}
static wasmtime_error_t *reject(const char *message) {
  /* Wasmtime 42 reports a host import error in this shape. */
  char text[256]; snprintf(text, sizeof text, "error while executing at wasm backtrace:\\n    0:     0x55 - nativefin!<wasm function 1>\\n\\nCaused by:\\n    %s\\n", message);
  return wasmtime_error_new(text);
}
wasmtime_error_t *nativefin_wasmtime_call(nativefin_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  uintptr_t first = 0, second = 0; bool fits = count > 0 && word(&args[0], &first);
  if (!session) return wasmtime_error_new("closed");
  if (strcmp(name, "impossible") == 0) return reject("arg0 is not below its Fin 0 bound");
  if (strcmp(name, "mirror") == 0) {
#ifdef LEAK
    if (!fits || first >= 10) ${nativeFinAdapterSymbol(componentId, "NativeFin.mirror")}((void *)first);
#endif
    if (!fits || first >= 10) return reject("arg0 is not below its Fin 10 bound");
    uintptr_t result = (uintptr_t)${nativeFinAdapterSymbol(componentId, "NativeFin.mirror")}((void *)first);
    *out = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_LIST};
    wasmtime_component_vallist_new_uninit(&out->of.list, result ? 1 : 0);
    if (result) out->of.list.data[0] = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = (uint32_t)result};
    return NULL;
  }
  if (strcmp(name, "label") == 0 && count == 3 && fits && word(&args[1], &second)) {
    if (second >= 4) return reject("arg1 is not below its Fin 4 bound");
    char text[32]; snprintf(text, sizeof text, "%.*s:%lu", (int)args[2].of.string.size, args[2].of.string.data, (unsigned long)(uintptr_t)${nativeFinAdapterSymbol(componentId, "NativeFin.label")}((void *)first, (void *)second, NULL));
    *out = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_STRING};
    wasm_name_new(&out->of.string, strlen(text), text);
    return NULL;
  }
  (void)${nativeFinAdapterSymbol(componentId, "NativeFin.impossible")};
  return wasmtime_error_new("unexpected call");
}
`;

test("the WIT dispatch probe counts a stand-in C-adapter host exactly and refuses a missing counter, a foreign host and a leaking host", { skip: !existsSync(join(wasmtimeCApi, "lib/libwasmtime.so")) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-fin-probe-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" }, componentId = "nativefin@1.0.0";
	const cc = (args, cwd = root) => runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", ...args], cwd, tools);
	await saveLakeFile(root, "include/nativefin_wasmtime.h", renderWitHostHeader({ surface: { prefix: "nativefin", callbacks: new Set() } }));
	await saveLakeFile(root, "component.c", fakeComponent(componentId));
	await saveLakeFile(root, "host.c", fakeHost(componentId));
	await saveLakeFile(root, "dispatch.c", witFinDispatchProbe());
	await saveLakeFile(root, "interposer.c", nativeFinCountInterposerFor(componentId));
	const include = ["-I", join(root, "include"), "-I", join(wasmtimeCApi, "include")];
	await cc(["-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"]);
	for(const [deployment, flags] of [["deployment", []], ["leaking", ["-DLEAK"]]])
	{
		await saveLakeFile(join(root, deployment, "lib"), ".keep", "");
		const lib = join(root, deployment, "lib");
		await cc(["-shared", "-fPIC", "component.c", "-o", join(lib, "libnativefin.so")]);
		await cc(["-shared", "-fPIC", ...flags, ...include, "host.c", "-L", lib, "-lnativefin", "-L", join(wasmtimeCApi, "lib"), "-lwasmtime", "-Wl,-rpath,$ORIGIN", "-o", join(lib, "libnativefin_wasmtime.so")]);
		const link = ["-L", lib, "-l:libnativefin_wasmtime.so", "-L", join(wasmtimeCApi, "lib"), "-lwasmtime", `-Wl,-rpath,${lib}:${join(wasmtimeCApi, "lib")}`];
		await cc([...witCompilerOptions.slice(1), ...include, "dispatch.c", ...link, "-o", join(root, deployment, "dispatch")]);
	}
	const preload = { ...copiedCleanEnvironment, LD_PRELOAD: join(root, "libdispatch.so") };
	const probe = join(root, "deployment", "dispatch"), deployment = join(root, "deployment");
	await assert.rejects(runCopied(probe, [deployment], root), error => /exited with status 2/.test(error.message)
		&& error.details.stdout === "" && error.details.stderr === missingCounter);
	await assert.rejects(runCopied(probe, [join(root, "leaking")], root, preload), error => /exited with status 3/.test(error.message)
		&& error.details.stdout === "" && error.details.stderr === "nativefin_wasmtime_call is not loaded from the deployment\n");
	const run = await runCopied(probe, [deployment], root, preload);
	assert.equal(run.stderr, "");
	assert.deepEqual(readNativeFinDispatch(run.stdout, witFinDispatchExpected), witFinDispatchExpected);
	// A host that enters the adapter before rejecting is caught at its first invalid row.
	const leaked = await runCopied(join(root, "leaking", "dispatch"), [join(root, "leaking")], root, preload);
	assert.match(leaked.stdout, /^invalid-mirror-bound rejected:arg0<10 1 0 0 1 0 0$/m);
	assert.throws(() => readNativeFinDispatch(leaked.stdout, witFinDispatchExpected), /invalid-mirror-bound was rejected but changed counts by 1 0 0 1 0 0/);
});

const checkInstalledWitFin = async (t, reviewed = false) => {
	const environment = nativeFixtureEnvironment(["c", "wit-wasi"]), reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-wit-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-wit-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		const reviewedSource = reviewed ? canonicalJson(reviewedScalarHostIr("nativefin")) : null;
		if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", reviewedSource);
		// The installed WIT harness uses one name for the component and its C prefix, so use a package name without a hyphen.
		await writeFile(join(projectRoot, "lakefile.toml"), 'name = "nativefin"\nversion = "1.0.0"\n[[lean_lib]]\nname = "NativeFin"\n');
		await writeFile(join(projectRoot, "package.json"), '{"name":"nativefin","version":"1.0.0","license":"MIT"}\n');
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "nativefin", version: "1.0.0" }, "wit-wasi": { name: "nativefin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling the shared C library and WIT/WASI host package`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "wit-wasi"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, bounds(item.refinements)])), expectedBounds);
		if(reviewed)
		{
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, reviewedSource);
			assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, sha256(reviewedSource));
		}
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		await rm(author, { recursive: true, force: true });
		if(attempt === 1) break;
		const cPackage = receipt.packages.find(pkg => pkg.target === "c" && pkg.role === "component");
		const extracted = join(consumer, "c-extract");
		await saveLakeFile(extracted, ".keep", "");
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, cPackage.artifacts[0].path)], extracted);
		const cInstalled = join(extracted, `${cPackage.name}-${cPackage.version}-c`);
		const cReceipt = JSON.parse(await readFile(join(cInstalled, "lean-bridge-package.json"), "utf8"));
		await verifyNativeFiles(cInstalled, cReceipt.files);
		const cLibraries = sharedLibraries(cReceipt.files);
		t.diagnostic("offline installation, relocation and two compiler-free executions");
		const pkg = receipt.packages.find(item => item.target === "wit-wasi" && item.role === "component");
		const validateSignatures = document => {
			for(const name of ["native", "api"])
			{
				const iface = document.interfaces.find(item => item.name === name); assert.ok(iface, name);
				assert.deepEqual(Object.keys(iface.functions).sort(), exportsInOrder, name);
			}
			return exportsInOrder;
		};
		const installed = await installedWitCorpus({ library: { cModule: "nativefin" }
			, consumer, handoff, pkg, environment, clean: copiedCleanEnvironment
			, fixture: { source: witFinConsumer(), validateSignatures } })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.ok(installed.observation.checks > 2000);
		assert.equal(installed.observation.rejections, 1013);
		// The host package bundles the exact checked adapter that the C, Python and Rust probes instrument.
		const witLibraries = sharedLibraries(installed.wit.packageReceipt.files);
		const shared = Object.keys(witLibraries).filter(name => Object.hasOwn(cLibraries, name)).sort();
		assert.ok(shared.includes("libnativefin.so"), JSON.stringify({ wit: witLibraries, c: cLibraries }));
		for(const name of shared) assert.equal(witLibraries[name], cLibraries[name], name);
		// The counted adapters are the model's own exports for this component identity.
		assert.equal(model.component.id, "nativefin@1.0.0");
		for(const name of ["mirror", "impossible", "label"])
			assert.equal(model.exports.find(item => item.name === `NativeFin.${name}`).symbol, nativeFinAdapterSymbol(model.component.id, `NativeFin.${name}`), name);
		t.diagnostic("per-step source and adapter counts in the relocated WIT host process");
		const dispatch = await observeWitDispatch({ consumer, handoff, pkg, wit: installed.wit, componentId: model.component.id });
		reports.push({ profile: "wit-wasi"
			, path: reviewed ? "reviewed-ir" : "ordinary-source"
			, ...installed
			, packages: receipt.packages.filter(item => item.target === "wit-wasi")
			, sharedNativeLibraries: Object.fromEntries(shared.map(name => [name, witLibraries[name]]))
			, dispatch
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256
			, ...(reviewed ? { reviewedSourceSha256: model.sourceIdentity.reviewedBindingIr.sourceSha256 } : {})
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", reviewed ? "wit-reviewed.json" : "wit.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
};

test("relocated source-free WIT/WASI hosts check Fin bounds through the bundled C adapter", { skip: process.env.LEAN_BRIDGE_WIT_FIN_TEST !== "1", timeout: 2_400_000 }, t => checkInstalledWitFin(t));

test("independently reviewed Wit packages check scalar Fin through installed consumers", { skip: process.env.LEAN_BRIDGE_WIT_FIN_TEST !== "1", timeout: 2_400_000 }, t => checkInstalledWitFin(t, true));
