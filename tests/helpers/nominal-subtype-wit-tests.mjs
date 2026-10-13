/**
 * Independent WIT contracts and C model controls, without installed Lean claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader } from "../../src/backends/wit/copied-host.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypeWitRoutes, nominalSubtypeWitModes, nominalSubtypeWitCounts, nominalSubtypeWitSelection, nominalSubtypeWitReview, nominalSubtypeWitConfiguration, nominalSubtypeWitCaller, parseNominalSubtypeWitResult } from "./nominal-subtype-wit-fixture.mjs";
import { nominalSubtypeWitToolSelection, assertNominalSubtypeWitCapi, inspectNominalSubtypeWitTools } from "./nominal-subtype-wit-tools.mjs";
import { assertNominalSubtypeWitIdentity, nominalSubtypeWitNativeEvidence } from "./nominal-subtype-wit-package.mjs";
import { verifyNominalSubtypeWitEnvironment } from "./nominal-subtype-wit-install.mjs";
import { assertNominalSubtypeWitInterfaces } from "./nominal-subtype-wit-interface.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const capi = process.env.LEAN_BRIDGE_WASMTIME_C_API ?? resolve(".toolchains/wasmtime42");
const cc = process.env.CC ?? "/usr/bin/cc";
const callerControls = process.env.LEAN_BRIDGE_WASMTIME_C_API !== undefined || existsSync(join(capi, "include/wasmtime.h"));

test("nominal WIT preserves both complete author contracts and constructor-free results", async () => {
	for(const route of nominalSubtypeWitRoutes) for(const mode of nominalSubtypeWitModes)
	{
		const expected = nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only");
		const actual = nominalSubtypeWitConfiguration(route, mode); validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { "wit-wasi": { name: "nominalsubtypes", version: "1.0.0" } });
		const review = nominalSubtypeWitReview(mode); validateBindingIr(review);
		assert.deepEqual(review, nominalSubtypeInstalledReview(mode === "result-only"));
		const projection = compileCopiedWitModel(review, actual.targets["wit-wasi"], { callables: true });
		assert.equal(projection.surface.functions.length, mode === "full" ? 26 : 13);
		if(mode === "result-only") assert.equal(actual.contracts, undefined);
		const caller = await nominalSubtypeWitCaller(route, mode);
		assert.doesNotMatch(caller, /#include "wit-(?:values|inputs)\.h"/u);
		assert.equal(caller.startsWith("#define NOMINAL_RESULT_ONLY\n"), mode === "result-only");
		assert.equal(await nominalSubtypeWitCaller("reviewed", mode), (await nominalSubtypeWitCaller("ordinary", mode)).replaceAll(/arg([01])/gu, "value$1"));
	}
	for(const [route, mode] of [["unknown", "full"], ["ordinary", "unknown"]])
	{
		assert.throws(() => nominalSubtypeWitConfiguration(route, mode));
		await assert.rejects(nominalSubtypeWitCaller(route, mode));
	}
	assert.throws(() => nominalSubtypeWitReview("unknown"));
	for(const mode of nominalSubtypeWitModes)
	{
		const counts = nominalSubtypeWitCounts[mode]; assert.deepEqual(parseNominalSubtypeWitResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts)) assert.throws(() => parseNominalSubtypeWitResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalSubtypeWitResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNominalSubtypeWitResult("{}", "unknown"));
});

test("nominal WIT selections refuse disabled explicit work and unknown or duplicate selections", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalSubtypeWitSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalSubtypeWitSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true]) assert.throws(() => nominalSubtypeWitSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true]) assert.throws(() => nominalSubtypeWitSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"]) assert.throws(() => nominalSubtypeWitSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalSubtypeWitSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	assert.throws(() => nominalSubtypeWitSelection({ [prefix + "OUTPUT"]: "explicit" }));
	for(const value of ["", true]) assert.throws(() => nominalSubtypeWitSelection({ ...enabled, [prefix + "OUTPUT"]: value }));
});

test("nominal WIT tools require explicit absolute selections and the complete pinned C API", () => {
	const environment = { CC: "/selected/cc", LEAN_BRIDGE_WASM_TOOLS: "/selected/wasm-tools", LEAN_BRIDGE_WASMTIME_C_API: "/selected/capi" };
	assert.deepEqual(nominalSubtypeWitToolSelection(environment), { cc: environment.CC, wasmTools: environment.LEAN_BRIDGE_WASM_TOOLS, wasmtimeCapi: environment.LEAN_BRIDGE_WASMTIME_C_API });
	for(const key of Object.keys(environment)) for(const value of [undefined, "", true, "ambient", "/selected/\0bad"])
		assert.throws(() => nominalSubtypeWitToolSelection({ ...environment, [key]: value }));
	assert.throws(() => assertNominalSubtypeWitCapi({}));
	assert.throws(() => assertNominalSubtypeWitCapi({ "lib/libwasmtime.so": { bytes: 1, sha256: "0".repeat(64) } }));
});

test("nominal WIT package identity refuses changed coordinates, source, runtime, component and floor", () => {
	const model = { bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }, sourceIdentity: { fixture: true } };
	const pkg = { target: "wit-wasi", ecosystem: "wit-wasi", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, name: "nominalsubtypes", version: "1.0.0"
		, runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path: "archives/nominalsubtypes-1.0.0-wit-wasi.tar.gz" }] };
	const receipt = { schemaVersion: 1
		, kind: "lean-bridge-ordinary-wit-package"
		, ecosystem: "wit-wasi", name: pkg.name, version: pkg.version
		, runtimeIdentity: pkg.runtimeIdentity
		, ...model
		, glibcMinimumVersion: "2.36", wasmtime: "42.0.1"
		, componentSha256: "c".repeat(64) };
	assertNominalSubtypeWitIdentity(receipt, pkg, model, "2.36");
	for(const key of Object.keys(receipt))
	{
		assert.throws(() => assertNominalSubtypeWitIdentity({ ...receipt, [key]: "changed" }, pkg, model, "2.36"));
		const missing = { ...receipt }; delete missing[key]; assert.throws(() => assertNominalSubtypeWitIdentity(missing, pkg, model, "2.36"));
	}
	for(const key of Object.keys(pkg)) assert.throws(() => assertNominalSubtypeWitIdentity(receipt, { ...pkg, [key]: "changed" }, model, "2.36"));
	for(const artifacts of [[], [...pkg.artifacts, ...pkg.artifacts]]) assert.throws(() => assertNominalSubtypeWitIdentity(receipt, { ...pkg, artifacts }, model, "2.36"));
	assert.throws(() => assertNominalSubtypeWitIdentity(receipt, pkg, model, "2.38"));
});

test("nominal WIT host dependencies bind every native library and all C API bytes", () => {
	const file = digit => ({ sha256: digit.repeat(64), bytes: 1 });
	const runtime = { files: { "lib/libruntime.so": file("1"), "lib/liblean.so": file("2") } };
	const identity = { runtimeIdentity: sha256(canonicalJson(runtime)), bindingIrSha256: "3".repeat(64) };
	const component = { ...identity, library: "libcomponent.so", nativeLibrary: file("4") };
	const adapter = { ...identity, library: "libadapter.so", componentReceiptSha256: sha256(canonicalJson(component)), files: { "lib/libadapter.so": file("5") } };
	const tools = { wasmtime: { root: "/synthetic", ...wasmtimeCapiIdentity, files: { "lib/libwasmtime.so": file("6") } } };
	const wit = { ...identity
		, componentReceiptSha256: sha256(canonicalJson(component))
		, adapterReceiptSha256: sha256(canonicalJson(adapter))
		, profile: "native-wit-v1", library: "libnominalsubtypes_wasmtime.so"
		, component: "component/nominalsubtypes.wasm", glibcMinimumVersion: "2.36"
		, settings: { name: "nominalsubtypes", version: "1.0.0" }
		, wasmtime: { ...wasmtimeCapiIdentity, files: tools.wasmtime.files }
		, files: { "lib/libnominalsubtypes_wasmtime.so": file("7")
			, "wasmtime/lib/libwasmtime.so": file("6") } };
	const receipt = { ...identity, glibcMinimumVersion: "2.36"
		, files: { ...runtime.files, ...adapter.files
			, "lib/libcomponent.so": file("4"), "lib/libwasmtime.so": file("6")
			, "lib/libnominalsubtypes_wasmtime.so": file("7") } };
	assert.equal(nominalSubtypeWitNativeEvidence(receipt, component, adapter, runtime, wit, tools).dependencies.length, 5);
	const mutations = [item => { delete item.files["lib/libruntime.so"]; }
		, item => { item.files["lib/extra.so"] = file("1"); }
		, item => { item.files["lib/libwasmtime.so"] = file("0"); }
		, item => { item.files["lib/libnominalsubtypes_wasmtime.so"] = file("0"); }
		, item => { item.runtimeIdentity = "0".repeat(64); }
		, item => { item.bindingIrSha256 = "0".repeat(64); }];
	for(const mutate of mutations)
	{
		const changed = structuredClone(receipt); mutate(changed); assert.throws(() => nominalSubtypeWitNativeEvidence(changed, component, adapter, runtime, wit, tools));
	}
	for(const key of ["componentReceiptSha256", "adapterReceiptSha256", "profile", "library", "component", "glibcMinimumVersion", "settings", "wasmtime"])
		assert.throws(() => nominalSubtypeWitNativeEvidence(receipt, component, adapter, runtime, { ...wit, [key]: "changed" }, tools));
});

test("nominal WIT explicit tool inspection records the pinned library and selected commands", { skip: !callerControls }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-wit-tools-")); t.after(() => rm(root, { recursive: true }));
	const selected = nominalSubtypeWitToolSelection({ CC: cc, LEAN_BRIDGE_WASM_TOOLS: process.env.LEAN_BRIDGE_WASM_TOOLS ?? resolve(".toolchains/wasm-tools/bin/wasm-tools"), LEAN_BRIDGE_WASMTIME_C_API: capi });
	const record = await inspectNominalSubtypeWitTools(selected, root); assertNominalSubtypeWitCapi(record.wasmtime.files);
	assert.match(record.versions.wasmTools.run.stdout, /^wasm-tools 1\.245\.1(?: |\n)/u);
	const mutations = [files => { delete files.LICENSE; }
		, files => { files.LICENSE = { bytes: 0, sha256: "0".repeat(64) }; }
		, files => { files.extra = files.LICENSE; }];
	for(const mutate of mutations)
	{
		const changed = structuredClone(record.wasmtime.files); mutate(changed); assert.throws(() => assertNominalSubtypeWitCapi(changed));
	}
});

test("nominal WIT replay closure rejects receipt, binary and file-set drift or remaining build inputs", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-wit-closure-")); t.after(() => rm(root, { recursive: true }));
	const directory = "nominalsubtypes-1.0.0-wit-wasi", payload = "synthetic payload", binary = "synthetic executable";
	const file = value => ({ bytes: Buffer.byteLength(value), sha256: sha256(value) });
	const receiptBytes = canonicalJson({ files: { "payload.txt": file(payload) } });
	await saveLakeFile(root, `${directory}/lean-bridge-package.json`, receiptBytes);
	await saveLakeFile(root, `${directory}/payload.txt`, payload); await saveLakeFile(root, "consumer", binary);
	const context = { root, receiptBytes, executable: file(binary) }, original = await verifyNominalSubtypeWitEnvironment(context);
	for(const [path, bytes] of [["consumer", binary], [`${directory}/lean-bridge-package.json`, receiptBytes], [`${directory}/payload.txt`, payload]])
	{
		await saveLakeFile(root, path, bytes + "changed"); await assert.rejects(verifyNominalSubtypeWitEnvironment(context));
		await saveLakeFile(root, path, bytes); assert.deepEqual(await verifyNominalSubtypeWitEnvironment(context), original);
	}
	for(const path of ["consumer.c", "unrecorded.txt", `${directory}/unrecorded.txt`])
	{
		await saveLakeFile(root, path, "unexpected"); await assert.rejects(verifyNominalSubtypeWitEnvironment(context)); await rm(join(root, path));
	}
	await mkdir(join(root, "tools")); await assert.rejects(verifyNominalSubtypeWitEnvironment(context)); await rm(join(root, "tools"), { recursive: true });
	await symlink("missing", join(root, "consumer.c")); await assert.rejects(verifyNominalSubtypeWitEnvironment(context)); await rm(join(root, "consumer.c"));
	assert.deepEqual(await verifyNominalSubtypeWitEnvironment(context), original);
});

test("nominal WIT compiled components expose complete API interfaces instead of flat exports", { skip: !callerControls }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-wit-interface-")); let complete = false;
	t.after(async () => { if(complete) await rm(root, { recursive: true }); else t.diagnostic(`Retained WIT interface controls: ${root}`); });
	const command = process.env.LEAN_BRIDGE_WASM_TOOLS ?? resolve(".toolchains/wasm-tools/bin/wasm-tools"); assert.ok(isAbsolute(command));
	const commands = [];
	const run = async args => {
		const result = await runCopied(command, args, root); commands.push({ command, args, result });
		await saveLakeFile(root, "commands.json", canonicalJson(commands)); assert.equal(result.stderr, ""); return result.stdout;
	};
	for(const mode of nominalSubtypeWitModes) for(const route of nominalSubtypeWitRoutes)
	{
		const ir = nominalSubtypeWitReview(mode);
		if(route === "ordinary") for(const declaration of ir.declarations)
			for(const [index, site] of declaration.parameters.entries()) site.name = `arg${index}`;
		const projection = compileCopiedWitModel(ir, { name: "nominalsubtypes", version: "1.0.0" }, { callables: true });
		const name = `${route}-${mode}`;
		await saveLakeFile(root, `${name}.wat`, projection.wat);
		await run(["parse", `${name}.wat`, "-o", `${name}.wasm`]);
		await run(["validate", "--features", "component-model", `${name}.wasm`]);
		const document = JSON.parse(await run(["component", "wit", `${name}.wasm`, "--json"]));
		assertNominalSubtypeWitInterfaces(document, projection);
		const api = document.interfaces.findIndex(item => item.name === "api");
		const native = document.interfaces.findIndex(item => item.name === "native");
		const mutations = [item => { item.worlds[0].exports = {}; }
			, item => { item.worlds[0].imports = {}; }
			, item => { item.worlds[0].exports = { [`interface-${native}`]: { interface: { id: native } } }; }
			, item => { item.worlds.push(structuredClone(item.worlds[0])); }
			, item => { item.interfaces[api].name = "unexported"; }
			, item => { item.packages[item.interfaces[api].package].name = "wrong:package"; }
			, item => { delete item.interfaces[api].functions.scalar; }
			, item => { item.interfaces[api].functions.extra = item.interfaces[api].functions.scalar; }
			, item => { item.interfaces[api].functions.scalar.kind = "method"; }
			, item => { item.interfaces[api].functions.scalar.params[0].name = "wrong"; }
			, item => { item.interfaces[api].functions.scalar.result = "u32"; }
			, item => { item.interfaces[native].functions.scalar.params.pop(); }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(document); mutate(changed); assert.throws(() => assertNominalSubtypeWitInterfaces(changed, projection));
		}
	}
	t.diagnostic("Four compiled components and 48 changed-interface controls; no Lean execution claim"); complete = true;
});

test("nominal WIT value snapshots and exact diagnostic causes reject altered data and unrelated errors", { skip: !callerControls }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-wit-values-")); let complete = false;
	t.after(async () => { if(complete) await rm(root, { recursive: true }); else t.diagnostic(`Retained WIT value controls: ${root}`); });
	await saveLakeFile(root, "wit-values.h", await readFile("tests/fixtures/nominal-subtype-consumers/wit-values.h"));
	await saveLakeFile(root, "control.c", String.raw`#include "wit-values.h"
#include <stdio.h>
int main(void) {
  (void)wide; (void)word; (void)pair; (void)byte; (void)event_empty;
  unsigned controls=nominal_snapshot_controls(), diagnostics=0;
  if (controls!=15) return 1;
  const char *cause="arg0.payload was rejected by NominalSubtypes.plusOne";
#define REQUIRE(value) do { if (!(value)) return 2; ++diagnostics; } while(0)
  REQUIRE(exact_cause(cause,strlen(cause),cause));
  const char *wrapped="error while executing at wasm backtrace:\n    0: 0x123 - <unknown>!<wasm function 0>\n\nCaused by:\n    arg0.payload was rejected by NominalSubtypes.plusOne";
  REQUIRE(exact_cause(wrapped,strlen(wrapped),cause));
  char ending[512]; snprintf(ending,sizeof(ending),"%s\n",wrapped);
  REQUIRE(exact_cause(ending,strlen(ending),cause));
  const char *bad[]={
    "prefix arg0.payload was rejected by NominalSubtypes.plusOne",
    "arg0.payload was rejected by NominalSubtypes.plusOne suffix",
    "arg0.payload was rejected by NominalSubtypes.plusOne\n",
    "arg1.payload was rejected by NominalSubtypes.plusOne",
    "error while executing at wasm backtrace:\n    0: frame\n\nCaused by:\n    arg0.payload was rejected by NominalSubtypes.plusOne\n\n",
    "error while executing at wasm backtrace:\n    0: frame\n\nCaused by:\n    unrelated\n\nCaused by:\n    arg0.payload was rejected by NominalSubtypes.plusOne",
    "error while executing at wasm backtrace:\n    0: frame\n\nCaused by:\n    arg0.payload was rejected by NominalSubtypes.plusOne suffix",
    "Caused by:\n    arg0.payload was rejected by NominalSubtypes.plusOne"
  };
  for (size_t i=0;i<sizeof(bad)/sizeof(*bad);++i) REQUIRE(!exact_cause(bad[i],strlen(bad[i]),cause));
  const char nul[]="arg0.payload was rejected by NominalSubtypes.plusOne\0trailing";
  REQUIRE(!exact_cause(nul,sizeof(nul)-1,cause));
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
	assert.deepEqual(JSON.parse(await run(join(root, "control"), [])), { snapshotControls: 15, diagnosticControls: 12 }); complete = true;
});

const resultFaults = ["truncate-large", "wrong-digit", "swapped-pair", "wrong-host-diagnostic", "wrong-plus-one", "wrong-plus-two", "short-sequence", "present-zero-option", "swapped-product", "swapped-result", "empty-box", "nonempty-empty", "wrong-error-arm", "nonempty-list", "changed-field-name", "input-mutation"];
const inputFaults = ["missing-fin", "fin-after-constructor", "missing-normalization", "conflated-constructor", "wrong-native-path", "diagnostic-suffix", "wrong-active-choice"];

for(const route of nominalSubtypeWitRoutes) for(const mode of nominalSubtypeWitModes) test(`nominal WIT independent C caller model detects semantic faults ${route} ${mode}`, { skip: !callerControls, timeout: 180_000 }, async t => {
	assert.ok(isAbsolute(cc) && isAbsolute(capi));
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-wit-model-")); let complete = false;
	t.after(async () => { if(complete) await rm(root, { recursive: true }); else t.diagnostic(`Retained failed WIT model inputs: ${root}`); });
	const commands = [], environment = { PATH: "/usr/bin:/bin", LC_ALL: "C" };
	const run = async (command, args, extra = {}) => {
		const result = spawnSync(command, args, { cwd: root, env: { ...environment, ...extra }, encoding: "utf8", maxBuffer: 4 * 1024 ** 2, timeout: 30_000 });
		const row = { command, args, environment: { ...environment, ...extra }, status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr };
		commands.push(row); await saveLakeFile(root, "commands.json", canonicalJson(commands));
		assert.equal(result.error, undefined); assert.equal(result.signal, null); return row;
	};
	const projection = compileCopiedWitModel(nominalSubtypeWitReview(mode), { name: "nominalsubtypes", version: "1.0.0" }, { callables: true });
	await saveLakeFile(root, "nominalsubtypes_wasmtime.h", renderWitHostHeader(projection));
	await saveLakeFile(root, "consumer.c", await nominalSubtypeWitCaller(route, mode));
	await saveLakeFile(root, "wit-values.h", await readFile("tests/fixtures/nominal-subtype-consumers/wit-values.h"));
	for(const name of ["nominal-subtype-wit-model.c", "nominal-subtype-wit-input-model.h"])
	{
		const define = mode === "result-only" && name.endsWith(".c") ? "#define NOMINAL_RESULT_ONLY\n" : "";
		await saveLakeFile(root, name, define + await readFile(`tests/helpers/${name}`, "utf8"));
	}
	const flags = route === "reviewed" ? ["-DNOMINAL_REVIEWED"] : [];
	const compile = await run(cc, ["-std=c11", "-Wall", "-Wextra", "-Werror"
		, "-UNDEBUG", ...flags, `-I${join(capi, "include")}`
		, "consumer.c", "nominal-subtype-wit-model.c"
		, `-L${join(capi, "lib")}`, `-Wl,-rpath,${join(capi, "lib")}`
		, "-lwasmtime", "-o", "consumer"]);
	assert.equal(compile.status, 0, compile.stderr); assert.equal(compile.stderr, "");
	const baseline = await run(join(root, "consumer"), []); assert.equal(baseline.status, 0, baseline.stderr); assert.equal(baseline.stderr, "");
	parseNominalSubtypeWitResult(baseline.stdout, mode);
	const faults = [...resultFaults, ...mode === "full" ? inputFaults : []];
	for(const fault of faults)
	{
		const changed = await run(join(root, "consumer"), [], { NOMINAL_WIT_FAULT: fault });
		assert.equal(changed.status, 1, fault); assert.equal(changed.stdout, ""); assert.match(changed.stderr, /nominal WIT check failed/u);
	}
	t.diagnostic(`${faults.length} incorrect stand-ins rejected; no compiled Lean or installed Component Model claim`);
	complete = true;
});
