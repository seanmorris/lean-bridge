/**
 * Checked top-level Fin sites in installed, relocated WIT/WASI host packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { witFinReadme } from "../src/backends/wit/fin-refinements.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { installedWitCorpus } from "./helpers/type-corpus-wit.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

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
#include "native_fin_wasmtime.h"
#include <link.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static size_t checks, rejections;
static native_fin_wasmtime *session;
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
  wasmtime_error_t *error = native_fin_wasmtime_call(session, name, args, count, &result);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%s: %.*s\\n", name, (int)message.size, message.data); exit(1);
  }
  return result;
}
/* A rejected call names the parameter and bound and leaves the result slot unchanged. */
static bool rejected(const char *name, const value *args, size_t count, const char *needle) {
  value output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_error_t *error = native_fin_wasmtime_call(session, name, args, count, &output);
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
  wasmtime_error_t *opened = native_fin_wasmtime_open(&session);
  if (opened) { fprintf(stderr, "cannot open session\\n"); return 1; }
  const uint32_t word[] = {0, 1}, word_next[] = {1, 1};
  const uint32_t huge[] = {0, 0, 64}, huge_next[] = {1, 0, 64}, wide[] = {0, 0, 0, 0, 1};
  const uint32_t last[] = {UINT32_MAX, UINT32_MAX, 63}, below[] = {UINT32_MAX - 1, UINT32_MAX, 63};
  const uint32_t seven[] = {7}, nine[] = {9}, two[] = {2}, large[] = {598};

  /* Fin 0 is uninhabited: every input is rejected by the native bound check. */
  CHECK(unary_rejected("impossible", small(0), "value is not below its Fin 0 bound"));
  CHECK(unary_rejected("impossible", small(1), "value is not below its Fin 0 bound"));
  /* Fin 1 admits only zero. */
  CHECK(unary("only", small(0), seven, 1));
  CHECK(unary_rejected("only", small(1), "value is not below its Fin 1 bound"));
  /* Fin 10 with a Fin result: endpoints and beyond-bound inputs. */
  CHECK(unary("mirror", small(0), nine, 1));
  CHECK(unary("mirror", small(9), NULL, 0));
  CHECK(unary_rejected("mirror", small(10), "value is not below its Fin 10 bound"));
  CHECK(unary_rejected("mirror", small(11), "value is not below its Fin 10 bound"));
  CHECK(unary_rejected("mirror", nat(word, 2), "value is not below its Fin 10 bound"));
  CHECK(unary_rejected("mirror", nat(huge, 3), "value is not below its Fin 10 bound"));
  /* A transparent alias keeps its exact bound. */
  CHECK(unary("twice", small(299), large, 1));
  CHECK(unary_rejected("twice", small(300), "value is not below its Fin 300 bound"));
  CHECK(unary_rejected("twice", small(301), "value is not below its Fin 300 bound"));
  /* 2^70 exceeds every machine word. */
  CHECK(unary("succ-huge", nat(word, 2), word_next, 2));
  CHECK(unary("succ-huge", nat(below, 3), last, 3));
  CHECK(unary("succ-huge", nat(last, 3), last, 3));
  CHECK(unary_rejected("succ-huge", nat(huge, 3), "value is not below its Fin ${huge} bound"));
  CHECK(unary_rejected("succ-huge", nat(huge_next, 3), "value is not below its Fin ${huge} bound"));
  CHECK(unary_rejected("succ-huge", nat(wide, 5), "value is not below its Fin ${huge} bound"));
  /* A result-only refinement returns limbs below its bound. */
  CHECK(unary("wrap", small(100), two, 1));
  CHECK(unary("wrap", nat(huge, 3), two, 1));
  CHECK(unary("wrap", small(0), NULL, 0));
  /* Multiargument calls reject the Fin argument and leave caller values unchanged. */
  value arguments[3] = {small(5), small(3), text("slot")};
  value labelled = call("label", arguments, 3);
  CHECK(labelled.kind == WASMTIME_COMPONENT_STRING && labelled.of.string.size == 6 && memcmp(labelled.of.string.data, "slot:8", 6) == 0);
  clear(&labelled); clear(&arguments[1]); arguments[1] = small(4);
  CHECK(rejected("label", arguments, 3, "offset is not below its Fin 4 bound"));
  CHECK(is_small(&arguments[0], 5) && is_small(&arguments[1], 4));
  CHECK(arguments[2].kind == WASMTIME_COMPONENT_STRING && arguments[2].of.string.size == 4 && memcmp(arguments[2].of.string.data, "slot", 4) == 0);
  clear(&arguments[1]); arguments[1] = small(0);
  labelled = call("label", arguments, 3);
  CHECK(labelled.of.string.size == 6 && memcmp(labelled.of.string.data, "slot:5", 6) == 0);
  clear(&labelled); for (size_t i = 0; i < 3; ++i) clear(&arguments[i]);
  /* Repeated invalid and valid calls recover; each rejection refreshes the store. */
  for (uint32_t i = 0; i < 1000; ++i) {
    if (!unary_rejected("mirror", small(10 + i), "value is not below its Fin 10 bound")) { fprintf(stderr, "invalid call %u accepted\\n", i); return 1; }
    const uint32_t expected = 9 - i % 10;
    if (!unary("mirror", small(i % 10), &expected, expected ? 1 : 0)) { fprintf(stderr, "valid call %u failed\\n", i); return 1; }
  }
  checks += 2000;
  native_fin_wasmtime_close(session); session = NULL;
  printf("{\\"hostVersion\\":\\"%s\\",\\"checks\\":%zu,\\"rejections\\":%zu,\\"results\\":[],\\"loadedLibraries\\":[", WASMTIME_VERSION, checks, rejections);
  bool comma = false; dl_iterate_phdr(loaded, &comma); puts("]}");
  return 0;
}
`;

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
	assert.equal(supportsNativeRefinementTargets(["wit-wasi", "cpan"]), false);
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
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "subtype", constructor: "Fins.check" }, null], result: null };
	assert.throws(() => witFinReadme(compileCopiedWitModel(ir, settings)), TypeError);
});

test("relocated source-free WIT/WASI hosts check Fin bounds through the bundled C adapter", { skip: process.env.LEAN_BRIDGE_WIT_FIN_TEST !== "1", timeout: 2_400_000 }, async t => {
	const environment = nativeFixtureEnvironment(["c", "wit-wasi"]), reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-wit-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-wit-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "native-fin", version: "1.0.0" }, "wit-wasi": { name: "native-fin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling the shared C library and WIT/WASI host package`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "wit-wasi"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, bounds(item.refinements)])), expectedBounds);
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
		const installed = await installedWitCorpus({ library: { cModule: "native_fin" }
			, consumer, handoff, pkg, environment, clean: copiedCleanEnvironment
			, fixture: { source: witFinConsumer(), validateSignatures } })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.ok(installed.observation.checks > 2000);
		assert.equal(installed.observation.rejections, 1013);
		// The host package bundles the exact checked adapter that the C, Python and Rust probes instrument.
		const witLibraries = sharedLibraries(installed.wit.packageReceipt.files);
		const shared = Object.keys(witLibraries).filter(name => Object.hasOwn(cLibraries, name)).sort();
		assert.ok(shared.includes("libnative_fin.so"), JSON.stringify({ wit: witLibraries, c: cLibraries }));
		for(const name of shared) assert.equal(witLibraries[name], cLibraries[name], name);
		reports.push({ profile: "wit-wasi", path: "ordinary-source"
			, ...installed
			, packages: receipt.packages.filter(item => item.target === "wit-wasi")
			, sharedNativeLibraries: Object.fromEntries(shared.map(name => [name, witLibraries[name]]))
			, dispatch: { observed: false, reason: "the Wasmtime host library links the bundled adapter privately; identity with the instrumented C adapter is asserted instead" }
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", "wit.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
