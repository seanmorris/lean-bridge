/**
 * Compile one C adapter for all requested C-family packages without rebuilding Lean.
 *
 * @file
 */
import { compileCallableJvmGraphPackageModel } from "../backends/jvm/callable-graph-model.mjs";
import { compileCallablePhpGraphPackageModel } from "../backends/php/callable-graph-model.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { generateCBindingPackage } from "../backends/c/generate.mjs";
import { generateCppBindingPackage } from "../backends/cpp/generate.mjs";
import { boostSources } from "../backends/cpp/boost.mjs";
import { generateGmpProjection } from "../backends/c/gmp-projection.mjs";
import { generateCallableCGraphPackage } from "../backends/c/callable-graph-package.mjs";
import { generateCopiedGraphPackage } from "../backends/c/graph-package.mjs";
import { generateCallableCppGraphPackage } from "../backends/cpp/callable-graph-package.mjs";
import { nativeGraphProjectionSources } from "./native-graph-sources.mjs";
import { rubyGraphClearSource } from "../backends/ruby/copied-graph-package.mjs";
import { generateCopiedJvmGraphConversions } from "../backends/jvm/copied-graph-conversions.mjs";
import { generateCopiedPhpGraphConversions } from "../backends/php/copied-graph-conversions.mjs";
import { compileNativeGraphProjection } from "./native-graph-projection.mjs";
import { buildNativeGmp } from "./native-gmp.mjs";
import { compilePrimitiveCSurface } from "../backends/c/primitive-surface.mjs";
import { generateNativePrimitiveC } from "../backends/c/native-primitives.mjs";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime } from "./native-artifacts.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { packageNativeCFamily } from "../release/native-c-family.mjs";
import { projectOrdinaryDotnet } from "./native-dotnet-projection.mjs";
import { projectOrdinaryJvm } from "./native-jvm-projection.mjs";
import { packageOrdinaryRuby } from "../release/native-rubygems.mjs";
import { projectOrdinaryWasi } from "./native-wit-projection.mjs";
import { packageOrdinaryPython } from "../release/native-pypi.mjs";
import { projectOrdinaryRust } from "./native-rust-projection.mjs";
import { packageOrdinaryPhp } from "../release/native-composer.mjs";

/**
 * Reuse compiled source and runtime artifacts across C and C++ projections.
 *
 * @param options - Private native build staging and validated target choices.
 * @param options.working - Private staging directory.
 * @param options.nativeRoot - Compiled component directory.
 * @param options.runtimeRoot - Compiled runtime directory.
 * @param options.leanPrefix - Pinned Lean installation and license notices.
 * @param options.targets - C-family projections to package.
 * @param options.settings - Validated target coordinates.
 * @param options.environment - Explicit host compiler environment.
 * @param options.signal - Optional abort signal.
 */
export const projectNativeCFamily = async ({ working, nativeRoot, runtimeRoot, leanPrefix, targets, settings = {}, environment = process.env, signal }) => {
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { copiedGraphs: targets.every(target => ["c", "cpp", "cargo", "pypi", "rubygems", "nuget", "maven", "php-native", "wit-wasi"].includes(target)) });
	const graph = model.copiedGraph ? compileNativeGraphProjection(model.bindingIr, targets) : null;
	const surface = graph ? null : compilePrimitiveCSurface(model.bindingIr, { structuredCallables: targets.every(target => ["c", "cpp", "cargo", "pypi", "rubygems", "nuget", "maven", "php-native", "wit-wasi"].includes(target)), variants: targets.every(target => ["c", "cpp", "pypi", "cargo", "nuget", "maven", "rubygems", "php-native", "wit-wasi"].includes(target)), lists: targets.every(target => ["c", "cpp", "pypi", "cargo", "nuget", "maven", "rubygems", "php-native", "wit-wasi"].includes(target)), compounds: targets.every(target => ["c", "cpp", "pypi", "cargo", "nuget", "maven", "rubygems", "php-native", "wit-wasi"].includes(target)), callables: targets.every(target => ["c", "cpp", "pypi", "rubygems", "cargo", "nuget", "maven", "php-native", "wit-wasi"].includes(target)) });
	const p = graph ? graph.prefix : surface.prefix;
	const root = join(working, "native/c-binding");
	const cGraphTargets = targets.filter(target => ["c", "cpp"].includes(target));
	const callableFiles = graph?.callableGraph ? {
		...targets.includes("c") ? generateCallableCGraphPackage(model.bindingIr).files : {}
		, ...targets.includes("cpp") ? generateCallableCppGraphPackage(model.bindingIr).files : {}
	} : null;
	const files = graph ? { ...graph.callableGraph ? callableFiles
		: cGraphTargets.length ? generateCopiedGraphPackage(model.bindingIr, cGraphTargets).files : {} }
		: { ...generateCBindingPackage(model.bindingIr), "src/native.c": generateNativePrimitiveC(model, receipt) };
	if(graph)
	{
		Object.assign(files, nativeGraphProjectionSources(model, receipt));
		if(targets.includes("rubygems")) files["src/ruby-graph-clear.c"] = rubyGraphClearSource(p);
		if(targets.includes("maven")) files["src/jvm-graph-clear.c"] = (model.copiedGraph.callbacks ? compileCallableJvmGraphPackageModel(model.bindingIr) : generateCopiedJvmGraphConversions(model.bindingIr)).nativeReleaseSource;
		if(targets.includes("php-native")) files["src/php-graph-clear.c"] = (model.copiedGraph.callbacks ? compileCallablePhpGraphPackageModel(model.bindingIr) : generateCopiedPhpGraphConversions(model.bindingIr)).nativeReleaseSource;
		if(targets.includes("cpp") && graph.bigint) Object.assign(files, boostSources());
	}
	if(targets.includes("cpp") && !graph)
	{
		const cpp = generateCppBindingPackage(model.bindingIr);
		files[`include/${p}.hpp`] = cpp[`include/${p}.hpp`];
		files[`src/${p}.cpp`] = cpp[`src/${p}.cpp`];
		files["cpp-binding-manifest.json"] = cpp["binding-manifest.json"];
		if(surface.copies.some(copy => ["nat", "int"].includes(copy.scalarName))) Object.assign(files, boostSources());
	}
	for(const [path, contents] of Object.entries(files))
	{ await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), contents); }
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: root, env: environment, signal });
	const includes = ["-I", join(root, "include"), "-I", join(root, "internal"), "-I", nativeRoot, "-I", join(runtimeRoot, "include")];
	if(graph) includes.push("-I", join(root, "include/detail"));
	const library = `lib${p}.so`;
	await mkdir(join(root, "lib"));
	await run(environment.CC ?? "cc", ["-std=c11", "-O2", "-g0", "-fPIC"
		, "-shared", "-Wall", "-Wextra", "-Werror"
		, `-ffile-prefix-map=${working}=/build/native-c`
		, ...includes, ...graph ? [] : [join(root, surface.paths.implementation)]
		, join(root, "src/native.c")
		, ...graph && targets.includes("rubygems") ? [join(root, "src/ruby-graph-clear.c")] : []
		, ...graph && targets.includes("maven") ? [join(root, "src/jvm-graph-clear.c")] : []
		, ...graph && targets.includes("php-native") ? [join(root, "src/php-graph-clear.c")] : []
		, "-L", nativeRoot, "-L", join(runtimeRoot, "lib"), "-Wl,--no-as-needed"
		, `-l:${receipt.library}`, "-llean_bridge_native", "-lleanshared"
		, "-Wl,-z,defs", "-Wl,--build-id=none", "-Wl,-rpath,$ORIGIN"
		, "-Wl,-z,nodelete"
		, `-Wl,-soname,${library}`, "-o", join(root, "lib", library)]);
	if(targets.includes("cpp")) await run(environment.CXX ?? "c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", ...includes, "-fsyntax-only", join(root, `src/${p}.cpp`)]);
	const gmp = targets.includes("c") ? graph ? { library: `lib${p}_gmp.so`, files: {} }
		: surface.copies.some(copy => ["nat", "int"].includes(copy.scalarName)) ? generateGmpProjection(model.bindingIr) : null : null;
	if(gmp)
	{
		const gmpRoot = join(root, "gmp");
		await buildNativeGmp({ root: gmpRoot, environment, signal });
		for(const [path, contents] of Object.entries(gmp.files))
		{ await mkdir(dirname(join(gmpRoot, path)), { recursive: true }); await writeFile(join(gmpRoot, path), contents); }
		await run(environment.CC ?? "cc", ["-std=c11", "-O2", "-g0", "-fPIC"
			, "-shared", "-Wall", "-Wextra", "-Werror"
			, `-ffile-prefix-map=${working}=/build/native-c`, ...includes
			, ...graph ? ["-I", join(gmpRoot, "include/detail"), "-I", join(gmpRoot, "internal")] : []
			, "-I", join(gmpRoot, "include"), join(gmpRoot, `src/${p}_gmp.c`)
			, "-L", join(root, "lib"), "-L", join(gmpRoot, "lib")
			, `-l${p}`, "-l:libgmp.so.10", "-Wl,-z,defs", "-Wl,--build-id=none"
			, ...graph ? ["-L", join(runtimeRoot, "lib"), "-llean_bridge_native", "-Wl,-z,nodelete"] : []
			, "-Wl,-rpath,$ORIGIN", `-Wl,-soname,${gmp.library}`
			, "-o", join(gmpRoot, "lib", gmp.library)]);
	}
	const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38";
	if(!/^2\.\d+$/.test(floor)) throw new TypeError("Invalid native glibc floor");
	for(const path of [join(root, "lib", library)
		, join(nativeRoot, receipt.library)
		, join(runtimeRoot, "lib/libleanshared.so")
		, join(runtimeRoot, "lib/liblean_bridge_native.so")
		, ...gmp ? [join(root, "gmp/lib", gmp.library), join(root, "gmp/lib/libgmp.so.10")] : []]) {
		const report = await run("readelf", ["--version-info", path]);
		for(const match of report.stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/g))
			if(Number(match[1]) > 2 || (Number(match[1]) === 2 && (Number(match[2]) > Number(floor.slice(2)) || (Number(match[2]) === Number(floor.slice(2)) && Number(match[3] ?? 0) > 0))))
				throw new Error(`Native library requires ${match[0]}, above the package floor ${floor}`);
		}
	const inventory = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await writeFile(join(root, "native-c-adapter.json"), canonicalJson({
		schemaVersion: 1, profile: "native-library-v1"
		, bindingIrSha256: model.bindingIrSha256
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, runtimeIdentity: identity, library
		, ...graph ? { copiedGraph: { schemaVersion: 1, layoutSha256: graph.layoutSha256 } } : {}
		, ...(gmp ? { gmp: { library: gmp.library, version: "6.3.0" } } : {})
		, files: inventory }));
	const projections = [];
	for(const target of targets) projections.push(target === "nuget"
		? await projectOrdinaryDotnet({ working, adapterRoot: root, nativeRoot, runtimeRoot, leanPrefix, settings: settings[target], glibcMinimumVersion: floor, environment, signal })
		: target === "maven" ? await projectOrdinaryJvm({ working, adapterRoot: root, nativeRoot, runtimeRoot, leanPrefix, settings: settings[target], glibcMinimumVersion: floor, environment, signal })
			: target === "rubygems" ? await packageOrdinaryRuby({ working, adapterRoot: root, nativeRoot, runtimeRoot, leanPrefix, settings: settings[target], glibcMinimumVersion: floor, environment, signal })
				: target === "wit-wasi" ? await projectOrdinaryWasi({ working, adapterRoot: root, nativeRoot, runtimeRoot, leanPrefix, settings: settings[target], glibcMinimumVersion: floor, environment, signal })
					: target === "pypi" ? await packageOrdinaryPython({ working, adapterRoot: root, nativeRoot, runtimeRoot, leanPrefix, settings: settings[target], glibcMinimumVersion: floor, environment, signal })
						: target === "cargo" ? await projectOrdinaryRust({ working, adapterRoot: root, nativeRoot, runtimeRoot, leanPrefix, settings: settings[target], glibcMinimumVersion: floor, environment, signal })
							: target === "php-native" ? await packageOrdinaryPhp({ working, adapterRoot: root, nativeRoot, runtimeRoot, leanPrefix, settings: settings[target], glibcMinimumVersion: floor, environment, signal })
								: await packageNativeCFamily({ working, adapterRoot: root, nativeRoot, runtimeRoot, leanPrefix, target, settings: settings[target], glibcMinimumVersion: floor }));
	return projections;
};
