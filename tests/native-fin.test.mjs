/**
 * Checked top-level Fin sites for ordinary-source C and C++ native packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { validateNativeType } from "../src/analyze/native-types.mjs";
import { readExportConfiguration } from "../src/analyze/export-configuration.mjs";
import { finBoundLimbs } from "../src/backends/c/native-copied-values.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeFinConsumer, nativeFinDispatchColumns, nativeFinDispatchInterposer, nativeFinDispatchProbe, nativeFinRuntimeProbe } from "./helpers/native-fin-consumers.mjs";
import { supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { nativeFinReviewedIr } from "./helpers/reviewed-fin-fixture.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_FIN_TEST === "1";
const huge = "1180591620717411303424";
const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false } };
const fin = bound => ({ kind: "refinement", base: nat, predicate: { kind: "fin", bound }, abi: nat.abi });

/** Expected compiler-owned bounds for every selected fixture export. */
export const nativeFinRefinements = {
	"NativeFin.impossible": { parameters: [{ kind: "fin", bound: "0" }], result: null }
	, "NativeFin.label": { parameters: [null, { kind: "fin", bound: "4" }, null], result: null }
	, "NativeFin.mirror": { parameters: [{ kind: "fin", bound: "10" }], result: { kind: "fin", bound: "10" } }
	, "NativeFin.only": { parameters: [{ kind: "fin", bound: "1" }], result: null }
	, "NativeFin.succHuge": { parameters: [{ kind: "fin", bound: huge }], result: { kind: "fin", bound: huge } }
	, "NativeFin.twice": { parameters: [{ kind: "fin", bound: "300" }], result: null }
	, "NativeFin.wrap": { parameters: [null], result: { kind: "fin", bound: "7" } }
};

test("Fin bounds split into exact little-endian uint32 limbs", () => {
	assert.deepEqual(finBoundLimbs("0"), []);
	assert.deepEqual(finBoundLimbs("1"), [1]);
	assert.deepEqual(finBoundLimbs("4294967295"), [0xffffffff]);
	assert.deepEqual(finBoundLimbs("4294967296"), [0, 1]);
	// 2^70 has a zero low word and 2^6 in the third limb; no float arithmetic is involved.
	assert.deepEqual(finBoundLimbs(huge), [0, 0, 64]);
	assert.deepEqual(finBoundLimbs("340282366920938463463374607431768211457"), [1, 0, 0, 0, 1]);
	for(const bound of ["", "01", "-1", "1.5", "1e3", 7]) assert.throws(() => finBoundLimbs(bound), /Invalid Fin bound/);
});

test("native validation admits Fin at a top-level Nat site or inside its structural containers", () => {
	for(const bound of ["0", "1", huge]) assert.equal(validateNativeType(fin(bound)).predicate.bound, bound);
	assert.throws(() => validateNativeType(fin("5"), 1), /top-level/);
	assert.throws(() => validateNativeType(fin("5"), 0, true), /top-level/);
	// Structural containers of a top-level site are checked since VO #1427, products and results since VO #1441.
	validateNativeType({ kind: "array", element: fin("5"), abi: nat.abi });
	validateNativeType({ kind: "option", element: fin("5"), abi: nat.abi });
	validateNativeType({ kind: "tuple", arguments: [fin("5"), nat], abi: nat.abi });
	validateNativeType({ kind: "result", arguments: [nat, fin("5")], abi: nat.abi });
	assert.throws(() => validateNativeType({ kind: "record", name: "Box", lean: "Box", constructor: "Box.mk", fields: [{ name: "digits", projection: "Box.digits", type: { kind: "tuple", arguments: [fin("5"), nat], abi: nat.abi } }], abi: nat.abi }), /top-level/);
	for(const bound of ["", "05", "-1", "1e3", 5]) assert.throws(() => validateNativeType(fin(bound)), /invalid Fin refinement/);
	assert.throws(() => validateNativeType({ ...fin("5"), predicate: { kind: "subtype", bound: "5" } }), /refinement predicate fields/);
	assert.throws(() => validateNativeType({ ...fin("5"), predicate: { kind: "fin", bound: "5", extra: true } }), /invalid refinement predicate fields/);
	const int = { ...nat, name: "int", lean: "Int" };
	assert.throws(() => validateNativeType({ ...fin("5"), base: int }), /Nat base/);
	assert.throws(() => validateNativeType({ ...fin("5"), abi: { ...nat.abi, heap: true } }), /representation differs/);
});

test("every ordinary native projection is a checked Fin consumer", () => {
	assert.equal(supportsNativeRefinementTargets(["c"]), true);
	assert.equal(supportsNativeRefinementTargets(["cpp"]), true);
	assert.equal(supportsNativeRefinementTargets(["c", "cpp"]), true);
	assert.equal(supportsNativeRefinementTargets(["pypi"]), true);
	assert.equal(supportsNativeRefinementTargets(["c", "cpp", "pypi"]), true);
	assert.equal(supportsNativeRefinementTargets(["cargo"]), true);
	assert.equal(supportsNativeRefinementTargets(["c", "cpp", "pypi", "cargo"]), true);
	const all = ["c", "cpp", "pypi", "cargo", "rubygems", "nuget", "maven", "php-native", "wit-wasi", "cpan"];
	assert.equal(supportsNativeRefinementTargets(all), true);
	for(const target of all)
	{
		assert.equal(supportsNativeRefinementTargets([target]), true, target);
		assert.equal(supportsNativeRefinementTargets(["c", target].filter((item, index, list) => list.indexOf(item) === index)), true, target);
	}
});

const project = async (t, source) => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-native-fin-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const projectRoot = join(root, "project");
	await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
	if(source) await saveLakeFile(projectRoot, "NativeFin.lean", source);
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
		, modules: ["NativeFin"]
		, targets: { c: { name: "native-fin", version: "1.0.0" } } }));
	return { root, projectRoot };
};

const component = async ({ root, projectRoot }, nativeRefinements) => {
	const leanPrefix = nativeFixtureEnvironment(["c"]).LEAN_BRIDGE_LEAN_PREFIX, runtimeRoot = join(root, "runtime");
	if(!await access(runtimeRoot).then(() => true, () => false)) await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
	const record = await readExportConfiguration(projectRoot);
	const outputRoot = join(root, `component-${nativeRefinements}`);
	await buildNativeComponent({ projectRoot
		, outputRoot
		, runtimeRoot
		, leanPrefix
		, configurationSha256: record.sha256
		, targets: ["c"], copiedGraphs: true, nativeRefinements });
	return { outputRoot, runtimeRoot };
};

test("real Lean extraction keeps exact Fin bounds and checks them in the exported adapter", { skip: !enabled, timeout: 900_000 }, async t => {
	const fixture = await project(t);
	await assert.rejects(() => component(fixture, false), error => error.code === "native-refinements-unsupported"
		&& /checked Fin refinements are implemented only for ordinary native packages with bound-checking adapters/.test(error.message));
	const { outputRoot, runtimeRoot } = await component(fixture, true);
	const model = JSON.parse(await readFile(join(outputRoot, "model.json"), "utf8"));
	assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), nativeFinRefinements);
	for(const item of model.exports)
	{
		// The C transport is the Nat base; the refinement survives beside it.
		for(const [i, parameter] of item.parameters.entries())
			if(nativeFinRefinements[item.name].parameters[i]) assert.deepEqual(parameter.type, nat);
		if(nativeFinRefinements[item.name].result) assert.deepEqual(item.result, nat);
	}
	for(const declaration of model.bindingIr.declarations)
		assert.deepEqual(declaration.source.extensions["lean-lang.org/refinements"], nativeFinRefinements[declaration.source.declaration]);
	const lean = await readFile(join(outputRoot, "generated.lean"), "utf8");
	assert.doesNotMatch(lean, /\bsorry\b|\baxiom\b|unsafeCast|unsafe |panic!|default/);
	assert.match(lean, /if _bridgeFin0 : \(a0\) < 0 then\n {4}_root_\.Option\.some \(_root_\.NativeFin\.impossible ⟨a0, _bridgeFin0⟩\)\n {2}else\n {4}_root_\.Option\.none/);
	assert.match(lean, new RegExp(`if _bridgeFin0 : \\(a0\\) < ${huge} then\\n {4}_root_\\.Option\\.some \\(\\(_root_\\.NativeFin\\.succHuge ⟨a0, _bridgeFin0⟩\\)\\.val\\)`));
	assert.match(lean, /if _bridgeFin1 : \(a1\) < 4 then\n {4}_root_\.Option\.some \(_root_\.NativeFin\.label a0 ⟨a1, _bridgeFin1⟩ a2\)/);
	// A result-only refinement is total after Lean returns, so it needs no Option.
	assert.match(lean, /\(a0 : _root_\.Nat\) : _root_\.Nat :=\n {2}\(_root_\.NativeFin\.wrap a0\)\.val/);
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	await assert.rejects(() => readVerifiedNativeComponent(outputRoot, identity, { copiedGraphs: true }), error => error.code === "native-refinements-unavailable");
	const verified = await readVerifiedNativeComponent(outputRoot, identity, { copiedGraphs: true, nativeRefinements: true });
	assert.equal(canonicalJson(verified.model), canonicalJson(model));
	// A reviewed document must not erase a compiler-owned bound.
	const reviewed = await project(t);
	const reviewedIr = structuredClone(model.bindingIr);
	// Author-reviewed documents omit compiler extensions, including the bound itself.
	for(const producer of reviewedIr.producers) producer.extensions = {};
	for(const declaration of reviewedIr.declarations) declaration.source.extensions = {};
	await saveLakeFile(reviewed.projectRoot, "reviewed.binding-ir.json", canonicalJson(reviewedIr));
	await assert.rejects(() => component(reviewed, true), error => error.code === "reviewed-ir-source-mismatch"
		&& error.details.field.includes("lean-lang.org/refinements"));
});

// Arrays, lists and options of Fin are checked containers since VO #1427; other positions stay rejected.
test("native builds reject Fin outside top-level sites and their structural containers", { skip: !enabled, timeout: 900_000 }, async t => {
	// Products and Except values are structural containers; inside a record field or a callback they are not.
	const sites = [["field", "structure Box where\n  digit : Fin 5\ndef fieldSite (value : Box) : Nat := value.digit.val"]
		, ["callback", "def callbackSite (value : Fin 5 → Nat) : Nat := value 0"]
		, ["tuple field", "structure Pair where\n  digits : Fin 5 × Nat\ndef tupleSite (value : Pair) : Nat := value.digits.2"]
		, ["except callback", "def exceptSite (value : Nat → Except String (Fin 5)) : Nat := match value 0 with | .ok _ => 1 | .error _ => 0"]];
	for(const [name, source] of sites)
	{
		const nested = await project(t, `namespace NativeFin\n${source}\nend NativeFin\n`);
		await assert.rejects(() => component(nested, true), error => /Fin refinements are not implemented by the native-library profile outside top-level parameters, results and their arrays, lists, options, products and Except values/.test(JSON.stringify(error.details ?? error.message)), name);
	}
});

// Columns: source mirror, source impossible, source label, then their exported adapters.
const dispatchExpected = [
	["start", 0, [0, 0, 0, 0, 0, 0]]
	, ["public-valid-mirror", 0, [1, 0, 0, 1, 0, 0]]
	, ["public-invalid-mirror", 1, [1, 0, 0, 1, 0, 0]]
	, ["public-invalid-impossible", 1, [1, 0, 0, 1, 0, 0]]
	, ["public-invalid-label", 1, [1, 0, 0, 1, 0, 0]]
	, ["public-valid-label", 0, [1, 0, 1, 1, 0, 1]]
	, ["raw-invalid-mirror", 1, [1, 0, 1, 2, 0, 1]]
	, ["raw-invalid-impossible", 1, [1, 0, 1, 2, 1, 1]]
	, ["raw-valid-mirror", 1, [2, 0, 1, 3, 1, 1]]
	, ["raw-invalid-mirror-large", 1, [2, 0, 1, 4, 1, 1]]
];

/**
 * Count real dispatch with a test-only interposer; valid calls are the positive control.
 *
 * @param consumer - Consumer root containing the installed C package.
 * @param packages - Installed C packages.
 * @param leanPrefix - Pinned Lean installation providing lean.h for raw adapter ownership.
 */
const observeDispatch = async (consumer, packages, leanPrefix) => {
	const root = join(consumer, "c"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}-c`), lib = join(installed, "lib");
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(lib, "pkgconfig"), PKG_CONFIG_PATH: "" };
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	await saveLakeFile(root, "interposer.c", nativeFinDispatchInterposer());
	await saveLakeFile(root, "probe.c", nativeFinDispatchProbe());
	await saveLakeFile(root, "runtime.c", nativeFinRuntimeProbe());
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], root, compile);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/);
	// Raw adapter results are released through the pinned Lean object API.
	await runCopied("/usr/bin/cc", [...strict, "-isystem", join(leanPrefix, "include"), "probe.c", ...flags, "-lleanshared", "-o", "probe"], root, compile);
	await runCopied("/usr/bin/cc", [...strict, "-I", join(consumer, "probe-headers"), "runtime.c", `-L${lib}`, `-Wl,-rpath,${lib}`, "-lnative_fin", "-o", "runtime"], root, compile);
	const preload = { ...copiedCleanEnvironment, LD_PRELOAD: join(root, "libdispatch.so") };
	const run = await runCopied(join(root, "probe"), [], root, preload);
	assert.equal(run.stderr, "");
	const observed = run.stdout.trim().split("\n").map(line => {
		const [step, status, ...counts] = line.split(" ");
		return [step, Number(status), counts.map(Number)];
	});
	assert.deepEqual(observed, dispatchExpected);
	const runtime = await runCopied(join(root, "runtime"), [], root, preload);
	assert.equal(runtime.stderr, "");
	const [, runtimeChecks] = /^runtime-ok:(\d+)\n$/u.exec(runtime.stdout) ?? [];
	assert.ok(Number(runtimeChecks) > 1000, runtime.stdout);
	return { columns: nativeFinDispatchColumns, observed, interposer: "LD_PRELOAD"
		, positiveControl: "valid public and raw calls increment source and adapter counts"
		, runtimeTableChecks: Number(runtimeChecks) };
};

const relocate = async (profile, consumer, packages, observation) => {
	const root = join(consumer, profile), pkg = packages.find(item => item.role === "component");
	const directory = `${pkg.name}-${pkg.version}-${profile}`, installed = join(root, directory);
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/);
	const relative = flags.map(flag => flag.startsWith("-Wl,-rpath,") ? `-Wl,-rpath,$ORIGIN/${directory}/lib` : flag);
	await runCopied(profile === "cpp" ? "/usr/bin/c++" : "/usr/bin/cc"
		, [`-std=${profile === "cpp" ? "c++20" : "c11"}`, "-Wall", "-Wextra", "-Werror", "-UNDEBUG", `consumer.${profile === "cpp" ? "cpp" : "c"}`, ...relative, "-o", "consumer"]
		, root, compile);
	const executableSha256 = sha256(await readFile(join(root, "consumer")));
	const relocated = join(consumer, `${profile}-relocated`);
	await rename(root, relocated);
	const repeated = await runCopied(join(relocated, "consumer"), [], relocated);
	assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout.trim(), `fin-ok:${observation.checks}`);
	await verifyNativeFiles(join(relocated, directory), receipt.files);
	return { relocatedInstallation: true
		, repeatExecution: true
		, installedFilesUnchanged: true
		, executableSha256
		, installedFilesSha256: sha256(canonicalJson(receipt.files)) };
};

const checkInstalledFin = async (t, reviewed = false) => {
	const environment = nativeFixtureEnvironment(["c", "cpp"]), reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-native-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-native-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		const reviewedSource = reviewed ? canonicalJson(nativeFinReviewedIr()) : null;
		if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", reviewedSource);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "native-fin", version: "1.0.0" }, cpp: { name: "native-fin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling C/GMP and C++ packages`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "cpp"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), nativeFinRefinements);
		if(reviewed)
		{
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, reviewedSource);
			assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, sha256(reviewedSource));
		}
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		// Test-only raw-ABI probe headers; installed consumers never receive them.
		await saveLakeFile(join(consumer, "probe-headers"), "native_fin.h", await readFile(join(outputRoot, "native/c-binding/include/native_fin.h")));
		await saveLakeFile(join(consumer, "probe-headers"), "native_fin_runtime.h", await readFile(join(outputRoot, "native/c-binding/internal/native_fin_runtime.h")));
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		await rm(author, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const profile of ["c", "cpp"])
		{
			t.diagnostic(`installing ${profile}`);
			const packages = receipt.packages.filter(pkg => pkg.target === profile);
			const observation = await installCopiedConsumer({ profile
				, consumer
				, handoff
				, packages
				, environment
				, fixture: { source: nativeFinConsumer, success: "fin-ok" } });
			const dispatch = profile === "c" ? await observeDispatch(consumer, packages, environment.LEAN_BRIDGE_LEAN_PREFIX) : null;
			const relocation = await relocate(profile, consumer, packages, observation);
			reports.push({ profile
				, path: reviewed ? "reviewed-ir" : "ordinary-source"
				, ...observation
				, ...relocation
				, ...(dispatch ? { dispatch } : {})
				, packages
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, ...(reviewed ? { reviewedSourceSha256: model.sourceIdentity.reviewedBindingIr.sourceSha256 } : {})
				, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, `${profile}-relocated`), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	// Two clean authoring roots must produce byte-identical release archives.
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", reviewed ? "native-reviewed.json" : "native.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
};

test("relocated source-free C and C++ packages check Fin bounds through public and raw adapters", { skip: process.env.LEAN_BRIDGE_NATIVE_FIN_INSTALLED_TEST !== "1", timeout: 1_800_000 }, t => checkInstalledFin(t));

test("independently reviewed C and C++ Fin packages preserve bounds through installed public and raw adapters", { skip: process.env.LEAN_BRIDGE_NATIVE_FIN_INSTALLED_TEST !== "1", timeout: 1_800_000 }, t => checkInstalledFin(t, true));
