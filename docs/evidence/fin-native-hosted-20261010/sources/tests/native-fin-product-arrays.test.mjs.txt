/**
 * Checked Fin inside arrays of products and Except values of native packages (VO #1441).
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createMetadataRequest } from "../src/analyze/elaborated-metadata.mjs";
import { reviewedContractDifference, validateReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateCopiedNativeCalls } from "../src/backends/c/native-copied-values.mjs";
import { nativeFinBoundPaths } from "../src/backends/native/fin-refinements.mjs";
import { generatePerlBindingPackage } from "../src/backends/perl/generate.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { generateGmpProjection } from "../src/backends/c/gmp-projection.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { finProductArrayStubRuntime } from "./helpers/fin-product-array-mutation.mjs";
import { finProductArrayDispatchColumns, finProductArrayDispatchExpected, finProductArrayDispatchInterposer, finProductArrayDispatchProbe } from "./helpers/fin-product-array-dispatch.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { finProductArrayRefinements, finProductArrayTargets, finProductArrayTree, finProductArrayWitPatterns, installFinProductArrayConsumer } from "./helpers/fin-product-array-install.mjs";
import { finProductArrayReviewedIr } from "./helpers/reviewed-fin-product-array-fixture.mjs";
import { assertReviewedFinChangesRefused, checkInstalledFinFixture, finFixtureProfiles } from "./helpers/fin-fixture-installed.mjs";
import "./helpers/fin-product-arrays-source-history-tests.mjs";

const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { ...heap, heap: false } };
const fin = bound => ({ kind: "refinement", base: nat, predicate: { kind: "fin", bound }, abi: nat.abi });
const rowsType = { kind: "array", element: { kind: "tuple", arguments: [fin("4"), { kind: "result", arguments: [nat, fin("6")], abi: heap }], abi: heap }, abi: heap };

/**
 * A compiler-shaped native model of the fixture's two exports, for generated-source checks
 * without a Lean build.
 *
 * @param options - Extra model options, such as a Perl module name.
 */
const compilerModel = (options = {}) => {
	const input = nativeMetadataFixture(), module = input.metadata.modules[0], template = module.declarations[0];
	module.declarations = [["reversed", rowsType], ["rows", nat]].map(([name, result]) => ({ ...structuredClone(template), identity: `Sample.${name}`
		, projection: { ...structuredClone(template.projection), parameters: [{ name: "value", type: rowsType }], result } }));
	const { metadata, ...selection } = input.sourceIdentity.request;
	void metadata;
	selection.exports = module.declarations.map(item => item.identity);
	const modules = [{ name: "Sample", sourcePath: "Sample.lean", sourceSha256: "e".repeat(64), interfaceSha256: "1".repeat(64) }];
	const identity = { toolchain: "leanprover/lean4:v4.32.2", modules, leanCompilerSha256: input.sourceIdentity.leanCompilerSha256, extractorSha256: input.sourceIdentity.extractorSha256 };
	input.sourceIdentity.request = { ...selection, metadata: createMetadataRequest(selection, identity).metadata };
	input.metadata.producer.invocationIdentitySha256 = input.sourceIdentity.request.metadata.invocationIdentitySha256;
	return createNativeModel({ ...input, ...options, component: { id: "finproductarrays@1.0.0", name: "finproductarrays", version: "1.0.0" } }, { refinements: true });
};
const exportsOf = model => Object.fromEntries(model.exports.map(item => [`FinProductArrays.${item.name.split(".").at(-1)}`, item.refinements]));

test("an array directly over a product keeps the component bound and only the error-branch bound", () => {
	assert.deepEqual(exportsOf(compilerModel()), finProductArrayRefinements);
	// Every element, its first component and its active error branch; the ok branch carries any Nat.
	assert.deepEqual(nativeFinBoundPaths(finProductArrayTree, "arg0"), ["arg0[*].0 < 4", "arg0[*].1.error < 6"]);
	const wit = compileCopiedWitModel(compilerModel().bindingIr).wit;
	for(const pattern of finProductArrayWitPatterns) assert.match(wit, pattern);
});

test("C adapters compare every element's component and active error branch on caller limbs before Lean runs", () => {
	const model = compilerModel(), calls = generateCopiedNativeCalls(model, compilePrimitiveCSurface(model.bindingIr, { compounds: true }));
	const start = calls.indexOf("static finproductarrays_status lb_call_rows("), call = calls.slice(start, calls.indexOf("\n}\n", start));
	const loop = call.indexOf("for (size_t k2 = 0; k2 < arg0->length; ++k2) {");
	const component = call.indexOf("if (!lb_fin_below((&(&arg0->data[k2])->fst)->data, (&(&arg0->data[k2])->fst)->length, lb_fin_rows_0_0, 1)) return lb_invalid(error, \"arg0 is not below its Fin 4 bound\");");
	const branch = call.indexOf("if (!(&(&arg0->data[k2])->snd)->is_ok) {\n      if (!lb_fin_below((&(&(&arg0->data[k2])->snd)->error)->data, (&(&(&arg0->data[k2])->snd)->error)->length, lb_fin_rows_0_1, 1)) return lb_invalid(error, \"arg0 is not below its Fin 6 bound\");\n    }");
	const dispatch = call.indexOf("lean_object *checked = ");
	// The copy check, then each element's comparisons, then the only conversion into Lean.
	assert.ok(call.indexOf("_check(arg0, &budget)") < loop && loop < component && component < branch && branch < dispatch, call);
	assert.doesNotMatch(call, /->ok\)->data/u);
	for(const [name, limbs] of [["lb_fin_rows_0_0", "0x4u"], ["lb_fin_rows_0_1", "0x6u"]])
		assert.ok(calls.includes(`static const uint32_t ${name}[1] = {${limbs}};`), name);
});

test("Lean adapters construct Fin for every element before one source call", () => {
	const model = compilerModel(), lean = generateNativeLeanAdapters(model).leanSource;
	const symbol = model.exports.find(item => item.name.endsWith(".rows")).symbol;
	const section = lean.slice(lean.indexOf(`@[export ${symbol}]`), lean.indexOf("\n\n", lean.indexOf(`@[export ${symbol}]`)));
	assert.ok(section.includes("match ((a0).mapM (fun _bridgeValue0 => (do let _bridgeValue1a ← (if proof : ((_bridgeValue0).fst) < 4 then _root_.Option.some (⟨((_bridgeValue0).fst), proof⟩ : _root_.Fin 4) else _root_.Option.none)"));
	assert.ok(section.includes("| .ok _bridgeValue2 => ((_root_.Option.some (_bridgeValue2))).map _root_.Except.ok | .error _bridgeValue2 => ((if proof : (_bridgeValue2) < 6 then _root_.Option.some (⟨(_bridgeValue2), proof⟩ : _root_.Fin 6) else _root_.Option.none)).map _root_.Except.error"));
	assert.equal((section.match(/_root_\.Sample\.rows/g) ?? []).length, 1);
});

test("Perl XS names the element index, the component and the active branch", () => {
	const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };
	const files = generatePerlBindingPackage(compilerModel({ moduleName: "LeanBridge::FinProductArrays" }), receipt);
	const xs = files["Component.xs"], body = xs.slice(xs.indexOf("\nrows(...)"), xs.indexOf("XSRETURN(1);", xs.indexOf("\nrows(...)")));
	assert.match(body, /croak\("%s\[%zu\]\.0 is not below its Fin 4 bound", "arg0", \(size_t\)k0\);/u);
	assert.match(body, /croak\("%s\[%zu\]\.1\.error is not below its Fin 6 bound", "arg0", \(size_t\)k0\);/u);
	assert.doesNotMatch(body, /\.1\.ok is not below/u);
	assert.ok(body.indexOf("croak(\"%s[%zu].1.error") < body.indexOf("lean_object *checked = "));
	assert.match(files["lib/LeanBridge/FinProductArrays.pm"], /Checked Lean Fin bounds: arg0\[\*\]\.0 < 4; arg0\[\*\]\.1\.error < 6\./u);
});

test("the independent array review passes reviewed admission and equals the compiled trees", () => {
	const review = finProductArrayReviewedIr(), source = canonicalJson(review);
	validateBindingIr(review);
	validateReviewedSource({ schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(review) });
	assert.deepEqual(Object.fromEntries(review.declarations.map(item => [item.id.slice("lean:".length), item.source.extensions["lean-lang.org/refinements"]])), finProductArrayRefinements);
	assert.deepEqual(review.types, []);
});

test("reviewed array bounds and positions must equal the freshly compiled tree", () => {
	const compiled = compilerModel().bindingIr, key = "lean-lang.org/refinements";
	const index = compiled.declarations.findIndex(item => item.id.endsWith(".rows"));
	const path = `bindingIr.declarations[${index}].source.extensions.${key}`;
	assert.equal(reviewedContractDifference(structuredClone(compiled), compiled), null);
	const element = tree => tree.parameters[0].arguments[0];
	const mutations = [
		["tightened component", tree => { element(tree).arguments[0].bound = "3"; }]
		, ["loosened error branch", tree => { element(tree).arguments[1].arguments[1].bound = "7"; }]
		, ["bound moved to the ok branch", tree => { element(tree).arguments[1].arguments.reverse(); }]
		, ["bound moved to the other component", tree => { element(tree).arguments = [{ kind: "result", arguments: [null, { kind: "fin", bound: "6" }] }, { kind: "fin", bound: "4" }]; }]
		, ["dropped component", tree => { element(tree).arguments[0] = null; }]
		, ["element bounds without the array", tree => { tree.parameters[0] = element(tree); }]];
	for(const [label, mutate] of mutations)
	{
		const reviewed = structuredClone(compiled);
		mutate(reviewed.declarations[index].source.extensions[key]);
		assert.ok(reviewedContractDifference(reviewed, compiled)?.startsWith(path), label);
	}
});

const profiles = finFixtureProfiles("LEAN_BRIDGE_FIN_PRODUCT_ARRAY_PROFILES", finProductArrayTargets);
const reviewedProfiles = finFixtureProfiles("LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_ARRAY_PROFILES", finProductArrayTargets);
const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", ruby: "rb", "php-native": "php", "wit-wasi": "c", perl: "pl" };
/**
 * Count real dispatch in the installed C package with a test-only interposer: public
 * rejections reach neither Lean symbol, raw adapter rejections reach only the adapter,
 * and valid calls reach the adapter and the source.
 *
 * @param consumer - Consumer root containing the installed C package.
 * @param packages - Installed C packages.
 * @param leanPrefix - Pinned Lean installation providing lean.h for raw adapter values.
 */
const observeDispatch = async (consumer, packages, leanPrefix) => {
	const root = join(consumer, "c"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}-c`), lib = join(installed, "lib");
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(lib, "pkgconfig"), PKG_CONFIG_PATH: "" };
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	await saveLakeFile(root, "interposer.c", finProductArrayDispatchInterposer());
	await saveLakeFile(root, "probe.c", finProductArrayDispatchProbe());
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], root, compile);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/u);
	await runCopied("/usr/bin/cc", [...strict, "-isystem", join(leanPrefix, "include"), "probe.c", ...flags, "-lleanshared", "-o", "probe"], root, compile);
	// Without the interposer the probe refuses to report, so a missing counter cannot pass.
	await assert.rejects(() => runCopied(join(root, "probe"), [], root, copiedCleanEnvironment), /interposer is not loaded/u);
	const run = await runCopied(join(root, "probe"), [], root, { ...copiedCleanEnvironment, LD_PRELOAD: join(root, "libdispatch.so") });
	assert.equal(run.stderr, "");
	const observed = run.stdout.trim().split("\n").map(line => {
		const [step, status, ...counts] = line.split(" ");
		return [step, Number(status), counts.map(Number)];
	});
	assert.deepEqual(observed, finProductArrayDispatchExpected);
	return { columns: finProductArrayDispatchColumns, observed, interposer: "LD_PRELOAD", positiveControl: "valid public and raw calls increment source and adapter counts" };
};
// The installed C package also reports measured dispatch for rows.
const observe = async ({ profile, consumer, packages, environment }) => profile === "c" ? { dispatch: await observeDispatch(consumer, packages, environment.LEAN_BRIDGE_LEAN_PREFIX) } : {};
const report = { variable: "LEAN_BRIDGE_FIN_PRODUCT_ARRAY_REPORT", reviewedVariable: "LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_ARRAY_REPORT", directory: "build/native-fin-product-arrays" };
const spec = {
	fixture: "tests/fixtures/onboarding/native-fin-product-arrays"
	, module: "FinProductArrays", label: "fin-product-array", report, observe
	, targets: finProductArrayTargets
	, refinements: finProductArrayRefinements
	, reviewedIr: finProductArrayReviewedIr
	, install: installFinProductArrayConsumer
};

test("every native profile has a Fin product array consumer and a target", async () => {
	assert.deepEqual(Object.keys(finProductArrayTargets).sort(), Object.keys(extensions).sort());
	for(const [profile, extension] of Object.entries(extensions)) await access(`tests/fixtures/fin-product-array-consumers/${profile}.${extension}`);
});

// The control needs only a C compiler and GMP; the C shard always has both and must not skip it.
const gmp = ["/usr/include/gmp.h", "/usr/include/x86_64-linux-gnu/gmp.h"].some(path => existsSync(path));
const cSelected = profiles.includes("c") || reviewedProfiles.includes("c");
test("the C consumer passes a faithful stand-in and fails one that rewrites the rejected leaf", { skip: !gmp && !cSelected }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-product-array-mutation-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [path, text] of Object.entries(generateGmpProjection(compilerModel().bindingIr).files)) await saveLakeFile(join(root, dirname(path)), path.split("/").at(-1), text);
	await saveLakeFile(root, "stub.c", finProductArrayStubRuntime());
	await saveLakeFile(root, "consumer.c", await readFile("tests/fixtures/fin-product-array-consumers/c.c", "utf8"));
	const run = async variant => {
		const binary = join(root, `consumer${variant ?? ""}`);
		await promisify(execFile)("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", ...(variant ? [`-D${variant}`] : []), "-I", join(root, "include"), "consumer.c", "stub.c", "-lgmp", "-o", binary], { cwd: root });
		return promisify(execFile)(binary, [], { cwd: root }).then(({ stdout }) => ({ code: 0, stdout, stderr: "" }), error => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));
	};
	// Positive control: bounds, sums and reversal as Lean computes them pass every consumer check.
	assert.deepEqual(await run(), { code: 0, stdout: "fin-product-array-ok:2015\n", stderr: "" });
	// A rejected call that rewrites the failing component or error branch is caught on that input.
	for(const variant of ["MUTATE_COMPONENT", "MUTATE_ERROR"])
	{
		const observed = await run(variant);
		assert.equal(observed.code, 1, variant);
		assert.match(observed.stderr, /^failed at line \d+: all_same\(items, bad\)\n$/u, variant);
	}
});

test("relocated source-free native packages check Fin inside every element of an array of products", { skip: !profiles.length, timeout: 2_400_000 }, t => checkInstalledFinFixture(t, spec, profiles));

test("independently reviewed native packages check array-of-product bounds after source-free installation", { skip: !reviewedProfiles.length, timeout: 2_400_000 }, t => checkInstalledFinFixture(t, spec, reviewedProfiles, true));

test("changed array-of-product reviews are refused against fresh Lean before any output", { skip: !reviewedProfiles.includes("c"), timeout: 1_800_000 }, async t => {
	const refinements = /source\.extensions\.lean-lang\.org\/refinements/u;
	const element = (ir, name) => ir.declarations.find(item => item.id === `lean:FinProductArrays.${name}`).source.extensions["lean-lang.org/refinements"].parameters[0].arguments[0];
	await assertReviewedFinChangesRefused(t, spec, [
		["tightened component", ir => { element(ir, "rows").arguments[0].bound = "3"; }, refinements]
		, ["loosened error branch", ir => { element(ir, "rows").arguments[1].arguments[1].bound = "7"; }, refinements]
		, ["bound moved to the ok branch", ir => { element(ir, "rows").arguments[1].arguments.reverse(); }, refinements]
		, ["dropped result bound", ir => { ir.declarations.find(item => item.id === "lean:FinProductArrays.reversed").source.extensions["lean-lang.org/refinements"].result = null; }, refinements]]);
});
