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
import { nativeFinConsumer, nativeFinDispatchColumns, nativeFinDispatchInterposer, nativeFinDispatchProbe } from "./helpers/native-fin-consumers.mjs";
import { buildNativeProject, supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

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

test("native validation admits Fin only at a top-level Nat site", () => {
	for(const bound of ["0", "1", huge]) assert.equal(validateNativeType(fin(bound)).predicate.bound, bound);
	assert.throws(() => validateNativeType(fin("5"), 1), /top-level/);
	assert.throws(() => validateNativeType(fin("5"), 0, true), /top-level/);
	assert.throws(() => validateNativeType({ kind: "array", element: fin("5"), abi: nat.abi }), /top-level/);
	assert.throws(() => validateNativeType({ kind: "option", element: fin("5"), abi: nat.abi }), /top-level/);
	for(const bound of ["", "05", "-1", "1e3", 5]) assert.throws(() => validateNativeType(fin(bound)), /invalid Fin refinement/);
	assert.throws(() => validateNativeType({ ...fin("5"), predicate: { kind: "subtype", bound: "5" } }), /invalid Fin refinement/);
	assert.throws(() => validateNativeType({ ...fin("5"), predicate: { kind: "fin", bound: "5", extra: true } }), /invalid refinement predicate fields/);
	const int = { ...nat, name: "int", lean: "Int" };
	assert.throws(() => validateNativeType({ ...fin("5"), base: int }), /Nat base/);
	assert.throws(() => validateNativeType({ ...fin("5"), abi: { ...nat.abi, heap: true } }), /representation differs/);
});

test("checked Fin consumers are exactly the C and C++ projections", () => {
	assert.equal(supportsNativeRefinementTargets(["c"]), true);
	assert.equal(supportsNativeRefinementTargets(["cpp"]), true);
	assert.equal(supportsNativeRefinementTargets(["c", "cpp"]), true);
	for(const target of ["cpan", "pypi", "cargo", "rubygems", "nuget", "maven", "php-native", "wit-wasi"])
	{
		assert.equal(supportsNativeRefinementTargets([target]), false, target);
		assert.equal(supportsNativeRefinementTargets(["c", target]), false, target);
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
		&& /checked Fin refinements are implemented only for ordinary C and C\+\+ native packages/.test(error.message));
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
});

test("native builds reject Fin for every non-C-family target and every nested position", { skip: !enabled, timeout: 900_000 }, async t => {
	const fixture = await project(t);
	const environment = nativeFixtureEnvironment(["c"]);
	for(const targets of [["pypi"], ["c", "cargo"], ["cpp", "rubygems"]])
	{
		await saveLakeFile(fixture.projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: Object.fromEntries(targets.map(target => [target, target === "cpan" ? { module: "NativeFin", version: "1.0.0" } : { name: "native-fin", version: "1.0.0" }])) }));
		await assert.rejects(() => buildNativeProject({ projectRoot: fixture.projectRoot, outputRoot: join(fixture.root, `out-${targets.join("-")}`), environment, targets })
			, error => error.code === "native-refinements-unsupported", targets.join(","));
	}
	const sites = [["array", "(value : Array (Fin 5)) : Nat := value.size"]
		, ["option", "(value : Option (Fin 5)) : Nat := 0"]
		, ["result", "(value : Nat) : Option (Fin 5) := none"]
		, ["callback", "(value : Fin 5 → Nat) : Nat := value 0"]
		, ["tuple", "(value : Fin 5 × Nat) : Nat := value.2"]];
	for(const [name, signature] of sites)
	{
		const nested = await project(t, `namespace NativeFin\ndef ${name}Site ${signature}\nend NativeFin\n`);
		await assert.rejects(() => component(nested, true), error => /Fin refinements are not implemented by the native-library profile outside top-level parameters and results/.test(JSON.stringify(error.details ?? error.message)), name);
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
];

/**
 * Count real dispatch with a test-only interposer; valid calls are the positive control.
 *
 * @param consumer - Consumer root containing the installed C package.
 * @param packages - Installed C packages.
 */
const observeDispatch = async (consumer, packages) => {
	const root = join(consumer, "c"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}-c`);
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	await saveLakeFile(root, "interposer.c", nativeFinDispatchInterposer());
	await saveLakeFile(root, "probe.c", nativeFinDispatchProbe());
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], root, compile);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "probe.c", ...flags, "-o", "probe"], root, compile);
	const run = await runCopied(join(root, "probe"), [], root, { ...copiedCleanEnvironment, LD_PRELOAD: join(root, "libdispatch.so") });
	assert.equal(run.stderr, "");
	const observed = run.stdout.trim().split("\n").map(line => {
		const [step, status, ...counts] = line.split(" ");
		return [step, Number(status), counts.map(Number)];
	});
	assert.deepEqual(observed, dispatchExpected);
	return { columns: nativeFinDispatchColumns, observed, interposer: "LD_PRELOAD", positiveControl: "valid public and raw calls increment source and adapter counts" };
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

test("relocated source-free C and C++ packages check Fin bounds through public and raw adapters", { skip: process.env.LEAN_BRIDGE_NATIVE_FIN_INSTALLED_TEST !== "1", timeout: 1_800_000 }, async t => {
	const environment = nativeFixtureEnvironment(["c", "cpp"]), reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-native-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-native-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "native-fin", version: "1.0.0" }, cpp: { name: "native-fin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling C/GMP and C++ packages`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "cpp"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), nativeFinRefinements);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
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
			const dispatch = profile === "c" ? await observeDispatch(consumer, packages) : null;
			const relocation = await relocate(profile, consumer, packages, observation);
			reports.push({ profile
				, path: "ordinary-source"
				, ...observation
				, ...relocation
				, ...(dispatch ? { dispatch } : {})
				, packages
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, `${profile}-relocated`), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	// Two clean authoring roots must produce byte-identical release archives.
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", "native.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
