/**
 * Independent nineteen-base WIT contracts and C model controls, without installed Lean claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader } from "../../src/backends/wit/copied-host.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeFields, nominalPrimitiveSubtypeReview } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypeWitCaller, nominalPrimitiveSubtypeWitConfiguration, nominalPrimitiveSubtypeWitCounts, nominalPrimitiveSubtypeWitModes, nominalPrimitiveSubtypeWitReview, nominalPrimitiveSubtypeWitRoutes, nominalPrimitiveSubtypeWitSelection, nominalPrimitiveSubtypeWitTarget, parseNominalPrimitiveSubtypeWitResult } from "./nominal-primitive-subtype-wit-fixture.mjs";
import { assertNominalPrimitiveSubtypeWitIdentity, nominalPrimitiveSubtypeWitDirectory, nominalPrimitiveSubtypeWitNativeEvidence } from "./nominal-primitive-subtype-wit-package.mjs";
import { verifyNominalPrimitiveSubtypeWitEnvironment } from "./nominal-primitive-subtype-wit-install.mjs";
import { assertNominalSubtypeWitInterfaces } from "./nominal-subtype-wit-interface.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import "./nominal-primitive-subtype-wit-ci-report-tests.mjs";
import "./nominal-primitive-subtype-wit-ci-shell-tests.mjs";
import "./nominal-primitive-subtype-wit-ci-handoff-tests.mjs";
import "./nominal-primitive-subtype-wit-ci-workflow-tests.mjs";

const capi = process.env.LEAN_BRIDGE_WASMTIME_C_API ?? resolve(".toolchains/wasmtime42");
const cc = process.env.CC ?? "/usr/bin/cc";
const callerControls = process.env.LEAN_BRIDGE_WASMTIME_C_API !== undefined || existsSync(join(capi, "include/wasmtime.h"));
const consumers = "tests/fixtures/nominal-primitive-subtype-consumers/";
const witNames = ["echo-a", "echo-b", "refuse-unit", "combine", "echo-pair", "echo-event-a", "echo-event-b", "aliases", "produce", "produce-group", "produce-pair", "produce-event", "produce-choices", "word-bits"];

test("primitive-base nominal WIT preserves both complete author contracts and constructor-free results", async () => {
	for(const route of nominalPrimitiveSubtypeWitRoutes) for(const mode of nominalPrimitiveSubtypeWitModes)
	{
		const expected = nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only");
		const actual = nominalPrimitiveSubtypeWitConfiguration(route, mode); validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { "wit-wasi": { name: "nominalprimitivesubtypes", version: "1.0.0" } });
		const review = nominalPrimitiveSubtypeWitReview(mode); validateBindingIr(review);
		assert.deepEqual(review, nominalPrimitiveSubtypeReview(mode === "result-only"));
		const projection = compileCopiedWitModel(review, actual.targets["wit-wasi"], { callables: true });
		const names = mode === "full" ? witNames : witNames.slice(8);
		assert.deepEqual(projection.surface.functions.map(fn => fn.witName), names);
		const packet = projection.surface.copies.find(copy => copy.witName === "packet");
		assert.deepEqual(packet.fields.map(field => field.witName), [...nominalPrimitiveSubtypeFields.map(field => field.name.replace(/([a-z0-9])([A-Z])/gu, "$1-$2").toLowerCase()), "digit"]);
		assert.deepEqual(packet.fields.map(field => field.type.wit), ["bridge-value-0", "bool", "u8", "u16", "u32", "u64", "s8", "s16", "s32", "s64", "bridge-value-10", "bridge-value-11", "f32", "f64", "string", "bridge-value-15", "char", "u64", "s64", "bridge-value-10"]);
		assert.match(projection.wit, /enum bridge-value-0 \{ unit \}\n {2}type bridge-value-10 = list<u32>;\n {2}record bridge-value-11 \{ negative: bool, limbs: list<u32> \}\n {2}type bridge-value-15 = list<u8>;\n/u);
		if(mode === "result-only") assert.equal(actual.contracts, undefined);
		const caller = await nominalPrimitiveSubtypeWitCaller(route, mode);
		assert.doesNotMatch(caller, /#include "wit-(?:values|inputs)\.h"/u);
		assert.equal(caller.startsWith("#define NOMINAL_RESULT_ONLY\n"), mode === "result-only");
		assert.equal(await nominalPrimitiveSubtypeWitCaller("reviewed", mode), (await nominalPrimitiveSubtypeWitCaller("ordinary", mode)).replaceAll(/arg([01])/gu, "value$1"));
		for(const name of names) assert.ok(caller.includes(`"${name}"`), name);
		assert.ok(caller.includes("\"rounds\\\":256,\\\"wordBits\\\":64"));
	}
	for(const [route, mode] of [["unknown", "full"], ["ordinary", "unknown"]])
	{
		assert.throws(() => nominalPrimitiveSubtypeWitConfiguration(route, mode));
		await assert.rejects(nominalPrimitiveSubtypeWitCaller(route, mode));
	}
	assert.throws(() => nominalPrimitiveSubtypeWitReview("unknown"));
	for(const mode of nominalPrimitiveSubtypeWitModes)
	{
		const counts = nominalPrimitiveSubtypeWitCounts[mode]; assert.deepEqual(parseNominalPrimitiveSubtypeWitResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts)) assert.throws(() => parseNominalPrimitiveSubtypeWitResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalPrimitiveSubtypeWitResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNominalPrimitiveSubtypeWitResult("{}", "unknown"));
});

test("primitive-base nominal WIT selections refuse disabled explicit work and unknown or duplicate selections", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_WIT_";
	assert.deepEqual(nominalPrimitiveSubtypeWitSelection({}), { enabled: false, routes: [...nominalPrimitiveSubtypeWitRoutes], modes: [...nominalPrimitiveSubtypeWitModes] });
	assert.deepEqual(nominalPrimitiveSubtypeWitSelection({ [prefix + "TEST"]: "1", [prefix + "ROUTES"]: "reviewed", [prefix + "MODES"]: "result-only", [prefix + "OUTPUT"]: "build/x" })
		, { enabled: true, routes: ["reviewed"], modes: ["result-only"] });
	const refused = [
		{ TEST: "yes" }, { ROUTES: "ordinary" }, { OUTPUT: "build/x" }
		, { TEST: "1", ROUTES: "ordinary,ordinary" }, { TEST: "1", MODES: "partial" }
		, { TEST: "1", ROUTES: "" }, { TEST: "1", OUTPUT: "" }
	];
	for(const selection of refused)
	{
		const environment = Object.fromEntries(Object.entries(selection).map(([key, value]) => [prefix + key, value]));
		assert.throws(() => nominalPrimitiveSubtypeWitSelection(environment), JSON.stringify(environment));
	}
});

test("primitive-base nominal WIT package identity refuses changed coordinates, source, runtime, component and floor", () => {
	const model = { bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }, sourceIdentity: { fixture: true } };
	const pkg = {
		target: "wit-wasi", ecosystem: "wit-wasi", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, ...nominalPrimitiveSubtypeWitTarget, runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path: `archives/${nominalPrimitiveSubtypeWitDirectory}.tar.gz` }]
	};
	assert.equal(nominalPrimitiveSubtypeWitDirectory, "nominalprimitivesubtypes-1.0.0-wit-wasi");
	const receipt = {
		schemaVersion: 1, kind: "lean-bridge-ordinary-wit-package"
		, ecosystem: "wit-wasi", name: pkg.name, version: pkg.version
		, runtimeIdentity: pkg.runtimeIdentity, ...model, glibcMinimumVersion: "2.36"
		, wasmtime: wasmtimeCapiIdentity.version, componentSha256: "c".repeat(64)
	};
	assertNominalPrimitiveSubtypeWitIdentity(receipt, pkg, model, "2.36");
	for(const key of Object.keys(receipt))
	{
		assert.throws(() => assertNominalPrimitiveSubtypeWitIdentity({ ...receipt, [key]: "changed" }, pkg, model, "2.36"));
		const missing = { ...receipt }; delete missing[key]; assert.throws(() => assertNominalPrimitiveSubtypeWitIdentity(missing, pkg, model, "2.36"));
	}
	for(const key of Object.keys(pkg)) assert.throws(() => assertNominalPrimitiveSubtypeWitIdentity(receipt, { ...pkg, [key]: "changed" }, model, "2.36"));
	for(const artifacts of [[], [...pkg.artifacts, ...pkg.artifacts]]) assert.throws(() => assertNominalPrimitiveSubtypeWitIdentity(receipt, { ...pkg, artifacts }, model, "2.36"));
	assert.throws(() => assertNominalPrimitiveSubtypeWitIdentity(receipt, pkg, model, "2.38"));
	const file = digit => ({ sha256: digit.repeat(64), bytes: 1 });
	const runtime = { files: { "lib/libruntime.so": file("1"), "lib/liblean.so": file("2") } };
	const identity = { runtimeIdentity: sha256(canonicalJson(runtime)), bindingIrSha256: "3".repeat(64) };
	const component = { ...identity, library: "libcomponent.so", nativeLibrary: file("4") };
	const adapter = { ...identity, library: "libadapter.so", componentReceiptSha256: sha256(canonicalJson(component)), files: { "lib/libadapter.so": file("5") } };
	const shared = file("6"), tools = { wasmtime: { root: "/synthetic", ...wasmtimeCapiIdentity, files: { "lib/libwasmtime.so": shared } } };
	const library = "libnominalprimitivesubtypes_wasmtime.so";
	const wit = {
		...identity, componentReceiptSha256: sha256(canonicalJson(component))
		, adapterReceiptSha256: sha256(canonicalJson(adapter))
		, profile: "native-wit-v1", library
		, component: "component/nominalprimitivesubtypes.wasm"
		, glibcMinimumVersion: "2.36"
		, settings: { ...nominalPrimitiveSubtypeWitTarget }
		, wasmtime: { ...wasmtimeCapiIdentity, files: tools.wasmtime.files }
		, files: { [`lib/${library}`]: file("7"), "wasmtime/lib/libwasmtime.so": shared }
	};
	const libraries = { "lib/libcomponent.so": file("4"), "lib/libwasmtime.so": file("6"), [`lib/${library}`]: file("7") };
	const packageReceipt = { ...identity, glibcMinimumVersion: "2.36", files: { ...runtime.files, ...adapter.files, ...libraries } };
	assert.equal(nominalPrimitiveSubtypeWitNativeEvidence(packageReceipt, component, adapter, runtime, wit, tools).dependencies.length, 5);
	const mutations = [
		item => { delete item.files["lib/libruntime.so"]; }
		, item => { item.files["lib/extra.so"] = file("1"); }
		, item => { item.files["lib/libwasmtime.so"] = file("0"); }
		, item => { item.files[`lib/${library}`] = file("0"); }
		, item => { item.runtimeIdentity = "0".repeat(64); }
		, item => { item.bindingIrSha256 = "0".repeat(64); }
	];
	for(const mutate of mutations)
	{
		const changed = structuredClone(packageReceipt); mutate(changed); assert.throws(() => nominalPrimitiveSubtypeWitNativeEvidence(changed, component, adapter, runtime, wit, tools));
	}
	for(const key of ["componentReceiptSha256", "adapterReceiptSha256", "profile", "library", "component", "glibcMinimumVersion", "settings", "wasmtime"])
		assert.throws(() => nominalPrimitiveSubtypeWitNativeEvidence(packageReceipt, component, adapter, runtime, { ...wit, [key]: "changed" }, tools));
});

test("primitive-base nominal WIT replay closure rejects receipt, binary and file-set drift or remaining build inputs", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-wit-closure-")); t.after(() => rm(root, { recursive: true }));
	const directory = nominalPrimitiveSubtypeWitDirectory, payload = "synthetic payload", binary = "synthetic executable";
	const file = value => ({ bytes: Buffer.byteLength(value), sha256: sha256(value) });
	const receiptBytes = canonicalJson({ files: { "payload.txt": file(payload) } });
	await saveLakeFile(root, `${directory}/lean-bridge-package.json`, receiptBytes);
	await saveLakeFile(root, `${directory}/payload.txt`, payload); await saveLakeFile(root, "consumer", binary);
	const context = { root, receiptBytes, executable: file(binary) }, original = await verifyNominalPrimitiveSubtypeWitEnvironment(context);
	for(const [path, bytes] of [["consumer", binary], [`${directory}/lean-bridge-package.json`, receiptBytes], [`${directory}/payload.txt`, payload]])
	{
		await saveLakeFile(root, path, bytes + "changed"); await assert.rejects(verifyNominalPrimitiveSubtypeWitEnvironment(context));
		await saveLakeFile(root, path, bytes); assert.deepEqual(await verifyNominalPrimitiveSubtypeWitEnvironment(context), original);
	}
	for(const path of ["consumer.c", "unrecorded.txt", `${directory}/unrecorded.txt`])
	{
		await saveLakeFile(root, path, "unexpected"); await assert.rejects(verifyNominalPrimitiveSubtypeWitEnvironment(context)); await rm(join(root, path));
	}
	assert.deepEqual(await verifyNominalPrimitiveSubtypeWitEnvironment(context), original);
});

test("primitive-base nominal WIT compiled components expose complete API interfaces instead of flat exports", { skip: !callerControls }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-wit-interface-")); let complete = false;
	t.after(async () => { if(complete) await rm(root, { recursive: true }); else t.diagnostic(`Retained WIT interface controls: ${root}`); });
	const command = process.env.LEAN_BRIDGE_WASM_TOOLS ?? resolve(".toolchains/wasm-tools/bin/wasm-tools"); assert.ok(isAbsolute(command));
	const commands = [];
	const run = async args => {
		const result = await runCopied(command, args, root); commands.push({ command, args, result });
		await saveLakeFile(root, "commands.json", canonicalJson(commands)); assert.equal(result.stderr, ""); return result.stdout;
	};
	let controls = 0;
	for(const mode of nominalPrimitiveSubtypeWitModes) for(const route of nominalPrimitiveSubtypeWitRoutes)
	{
		const ir = nominalPrimitiveSubtypeWitReview(mode);
		if(route === "ordinary") for(const declaration of ir.declarations)
			for(const [index, site] of declaration.parameters.entries()) site.name = `arg${index}`;
		const projection = compileCopiedWitModel(ir, { ...nominalPrimitiveSubtypeWitTarget }, { callables: true });
		const name = `${route}-${mode}`;
		await saveLakeFile(root, `${name}.wat`, projection.wat);
		await run(["parse", `${name}.wat`, "-o", `${name}.wasm`]);
		await run(["validate", "--features", "component-model", `${name}.wasm`]);
		const document = JSON.parse(await run(["component", "wit", `${name}.wasm`, "--json"]));
		assertNominalSubtypeWitInterfaces(document, projection);
		const api = document.interfaces.findIndex(item => item.name === "api");
		const native = document.interfaces.findIndex(item => item.name === "native");
		const packet = document.types.findIndex(item => item.name === "packet");
		assert.ok(packet >= 0); assert.equal(document.types[packet].kind.record.fields.length, 20);
		const mutations = [item => { item.worlds[0].exports = {}; }
			, item => { item.worlds[0].imports = {}; }
			, item => { item.worlds[0].exports = { [`interface-${native}`]: { interface: { id: native } } }; }
			, item => { item.worlds.push(structuredClone(item.worlds[0])); }
			, item => { item.interfaces[api].name = "unexported"; }
			, item => { item.packages[item.interfaces[api].package].name = "wrong:package"; }
			, item => { delete item.interfaces[api].functions.produce; }
			, item => { item.interfaces[api].functions.extra = item.interfaces[api].functions.produce; }
			, item => { item.interfaces[api].functions.produce.kind = "method"; }
			, item => { item.interfaces[api].functions.produce.params[0].name = "wrong"; }
			, item => { item.interfaces[api].functions["word-bits"].result = "u64"; }
			, item => { item.interfaces[native].functions.produce.params.pop(); }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(document); mutate(changed); assert.throws(() => assertNominalSubtypeWitInterfaces(changed, projection)); controls++;
		}
	}
	t.diagnostic(`Four compiled components and ${controls} changed-interface controls; no Lean execution claim`); complete = true;
});

test("primitive-base nominal WIT value snapshots and exact diagnostic causes reject altered data and unrelated errors", { skip: !callerControls }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-wit-values-")); let complete = false;
	t.after(async () => { if(complete) await rm(root, { recursive: true }); else t.diagnostic(`Retained WIT value controls: ${root}`); });
	await saveLakeFile(root, "wit-values.h", await readFile(consumers + "wit-values.h"));
	await saveLakeFile(root, "control.c", String.raw`#include "wit-values.h"
#include <stdio.h>
int main(void) {
  (void)huge; (void)pair; (void)s8; (void)s16; (void)s32; (void)u16; (void)event_empty; (void)event_box; (void)event_choices; (void)group; (void)boxes; (void)branch; (void)bytes; (void)character; (void)text; (void)integer;
  (void)produced_fields; (void)normalized_fields; (void)two_to_100_plus_2; (void)two_to_100_minus_2; (void)unicode_text; (void)unicode_normalized; (void)appended_bytes; (void)forty_three; (void)hundred;
  unsigned controls=nominal_snapshot_controls(), diagnostics=0;
  if (controls!=22) return 1;
  const char *cause="arg0.natValue was rejected by NominalPrimitiveSubtypes.natA";
#define REQUIRE(value) do { if (!(value)) return 2; ++diagnostics; } while(0)
  REQUIRE(exact_cause(cause,strlen(cause),cause));
  const char *wrapped="error while executing at wasm backtrace:\n    0: 0x123 - <unknown>!<wasm function 0>\n\nCaused by:\n    arg0.natValue was rejected by NominalPrimitiveSubtypes.natA";
  REQUIRE(exact_cause(wrapped,strlen(wrapped),cause));
  char ending[512]; snprintf(ending,sizeof(ending),"%s\n",wrapped);
  REQUIRE(exact_cause(ending,strlen(ending),cause));
  const char *bad[]={
    "prefix arg0.natValue was rejected by NominalPrimitiveSubtypes.natA",
    "arg0.natValue was rejected by NominalPrimitiveSubtypes.natA suffix",
    "arg0.natValue was rejected by NominalPrimitiveSubtypes.natA\n",
    "arg1.natValue was rejected by NominalPrimitiveSubtypes.natA",
    "arg0.natValue was rejected by NominalPrimitiveSubtypes.natB",
    "error while executing at wasm backtrace:\n    0: frame\n\nCaused by:\n    arg0.natValue was rejected by NominalPrimitiveSubtypes.natA\n\n",
    "error while executing at wasm backtrace:\n    0: frame\n\nCaused by:\n    unrelated\n\nCaused by:\n    arg0.natValue was rejected by NominalPrimitiveSubtypes.natA",
    "error while executing at wasm backtrace:\n    0: frame\n\nCaused by:\n    arg0.natValue was rejected by NominalPrimitiveSubtypes.natA suffix",
    "Caused by:\n    arg0.natValue was rejected by NominalPrimitiveSubtypes.natA"
  };
  for (size_t i=0;i<sizeof(bad)/sizeof(*bad);++i) REQUIRE(!exact_cause(bad[i],strlen(bad[i]),cause));
  const char nul[]="arg0.natValue was rejected by NominalPrimitiveSubtypes.natA\0trailing";
  REQUIRE(!exact_cause(nul,sizeof(nul)-1,cause));
  fields f=base(); value a=packet(&f), b=packet(&f);
  REQUIRE(same(&a,&b)); field(&b,FLOAT32_FIELD)->of.f32=-0.0f; REQUIRE(!same(&a,&b)); clear(&a); clear(&b);
  printf("{\"snapshotControls\":%u,\"diagnosticControls\":%u}\n",controls,diagnostics);
  return 0;
}
`);
	const commands = [];
	const run = async (command, args) => {
		const result = spawnSync(command, args, { cwd: root, env: { PATH: "/usr/bin:/bin", LC_ALL: "C" }, encoding: "utf8", timeout: 30_000 });
		commands.push({ command, args, status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr });
		await saveLakeFile(root, "commands.json", canonicalJson(commands));
		assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, ""); return result.stdout;
	};
	await run(cc, ["-std=c11", "-Wall", "-Wextra", "-Werror", `-I${join(capi, "include")}`, "control.c", `-L${join(capi, "lib")}`, `-Wl,-rpath,${join(capi, "lib")}`, "-lwasmtime", "-o", "control"]);
	assert.deepEqual(JSON.parse(await run(join(root, "control"), [])), { snapshotControls: 22, diagnosticControls: 15 }); complete = true;
});

export const nominalPrimitiveSubtypeWitResultFaults = Object.freeze([
	"word-bits", "produce-lenient", "produce-digit", "missing-group"
	, "pair-left-empty", "missing-event-value", "wrong-choice-tag"
	, "accept-noncanonical-nat", "accept-bool-two", "accept-negative-zero-int"
	, "accept-wrong-kind", "accept-invalid-utf8", "accept-surrogate-char"
	, "wrong-host-diagnostic", "changed-field-name", "input-mutation"
]);
export const nominalPrimitiveSubtypeWitInputFaults = Object.freeze([
	"missing-fin", "fin-after-constructor", "missing-normalization"
	, "conflated-constructor", "wrong-native-path", "diagnostic-suffix"
	, "wrong-active-choice", "echo-a", "echo-b", "refuse-unit", "combine"
	, "float-sign", "mutate-accepted-input", "mutate-rejected-input"
]);

for(const route of nominalPrimitiveSubtypeWitRoutes) for(const mode of nominalPrimitiveSubtypeWitModes) test(`primitive-base nominal WIT independent C caller model detects semantic faults ${route} ${mode}`, { skip: !callerControls, timeout: 300_000 }, async t => {
	assert.ok(isAbsolute(cc) && isAbsolute(capi));
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-wit-model-")); let complete = false;
	t.after(async () => { if(complete) await rm(root, { recursive: true }); else t.diagnostic(`Retained failed WIT model inputs: ${root}`); });
	const commands = [], environment = { PATH: "/usr/bin:/bin", LC_ALL: "C" };
	const run = async (command, args, extra = {}) => {
		const result = spawnSync(command, args, { cwd: root, env: { ...environment, ...extra }, encoding: "utf8", maxBuffer: 4 * 1024 ** 2, timeout: 60_000 });
		const row = { command, args, environment: { ...environment, ...extra }, status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr };
		commands.push(row); await saveLakeFile(root, "commands.json", canonicalJson(commands));
		assert.equal(result.error, undefined); assert.equal(result.signal, null); return row;
	};
	const projection = compileCopiedWitModel(nominalPrimitiveSubtypeWitReview(mode), { ...nominalPrimitiveSubtypeWitTarget }, { callables: true });
	await saveLakeFile(root, "nominalprimitivesubtypes_wasmtime.h", renderWitHostHeader(projection));
	await saveLakeFile(root, "consumer.c", await nominalPrimitiveSubtypeWitCaller(route, mode));
	await saveLakeFile(root, "wit-values.h", await readFile(consumers + "wit-values.h"));
	for(const name of ["nominal-primitive-subtype-wit-model.c", "nominal-primitive-subtype-wit-input-model.h"])
	{
		const define = mode === "result-only" && name.endsWith(".c") ? "#define NOMINAL_RESULT_ONLY\n" : "";
		await saveLakeFile(root, name, define + await readFile(`tests/helpers/${name}`, "utf8"));
	}
	const flags = route === "reviewed" ? ["-DNOMINAL_REVIEWED"] : [];
	const compile = await run(cc, [
		"-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", ...flags
		, `-I${join(capi, "include")}`, "consumer.c"
		, "nominal-primitive-subtype-wit-model.c", `-L${join(capi, "lib")}`
		, `-Wl,-rpath,${join(capi, "lib")}`, "-lwasmtime", "-o", "consumer"
	]);
	assert.equal(compile.status, 0, compile.stderr); assert.equal(compile.stderr, "");
	const baseline = await run(join(root, "consumer"), []); assert.equal(baseline.status, 0, baseline.stderr); assert.equal(baseline.stderr, "");
	parseNominalPrimitiveSubtypeWitResult(baseline.stdout, mode);
	const faults = [...nominalPrimitiveSubtypeWitResultFaults, ...mode === "full" ? nominalPrimitiveSubtypeWitInputFaults : []];
	for(const fault of faults)
	{
		const changed = await run(join(root, "consumer"), [], { NOMINAL_WIT_FAULT: fault });
		assert.equal(changed.status, 1, fault); assert.equal(changed.stdout, ""); assert.match(changed.stderr, /nominal WIT check failed/u);
	}
	t.diagnostic(`${faults.length} incorrect stand-ins rejected; no compiled Lean or installed Component Model claim`);
	complete = true;
});
