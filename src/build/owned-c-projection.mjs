/**
 * Compile a public owned-value C library against verified native components.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateOwnedCPackage } from "../backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../backends/cpp/owned-package.mjs";
import { generateOwnedRustPackage } from "../backends/rust/owned-package.mjs";
import { projectOwnedRust } from "./owned-rust-projection.mjs";
import { generateOwnedPythonPackage } from "../backends/python/owned-package.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime } from "./native-artifacts.mjs";
import { buildNativeGmp } from "./native-gmp.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { packageOwnedNativeC } from "../release/owned-c-package.mjs";
import { packageOwnedPython } from "../release/owned-pypi.mjs";

/**
 * Build and package the complete public header, native code and GMP dependency.
 *
 * @param options - Private staging roots and validated C package coordinates.
 * @param options.working - Exclusively owned build staging directory.
 * @param options.nativeRoot - Verified component directory.
 * @param options.runtimeRoot - Verified shared runtime directory.
 * @param options.leanPrefix - Pinned Lean distribution containing license notices.
 * @param options.targets - C, C++, Cargo and/or PyPI projections sharing this adapter.
 * @param options.settings - Validated package coordinates by target.
 * @param options.environment - Explicit compiler and platform environment.
 * @param options.signal - Optional build cancellation signal.
 */
export const projectOwnedNativeCFamily = async ({ working, nativeRoot, runtimeRoot, leanPrefix, targets, settings = {}, environment = process.env, signal }) => {
	if(!Array.isArray(targets) || !targets.length || targets.some(target => !["c", "cpp", "cargo", "pypi"].includes(target)) || new Set(targets).size !== targets.length)
		throw new TypeError("Owned C-family projections require distinct c/cpp/cargo/pypi targets");
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: targets.every(target => ["c", "cpp", "cargo", "pypi"].includes(target)) });
	if(!model.ownedGraph) throw new TypeError("Owned C projection requires a v4 native component");
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	const hostCallbacks = Boolean(model.ownedGraph.hostCallbacks);
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	if(targets.includes("cpp") && !hostCallbacks) throw new TypeError("Owned C++ projection requires authenticated callback/copy support");
	const generated = generateOwnedCPackage({ metadata, sourceIdentity: model.sourceIdentity, component: model.component, hostCallbacks, transferredInputs });
	const cpp = targets.includes("cpp") ? generateOwnedCppPackage(model.bindingIr, { transferredInputs }) : null;
	const rust = targets.includes("cargo") ? generateOwnedRustPackage(model.bindingIr, null, {}, { transferredInputs }) : null;
	if(rust && !hostCallbacks) throw new TypeError("Owned Rust projection requires authenticated callback/copy support");
	const python = targets.includes("pypi") ? generateOwnedPythonPackage(model.bindingIr, null, { transferredInputs }) : null;
	if(python && !hostCallbacks) throw new TypeError("Owned Python projection requires authenticated callback/copy support");
	const p = generated.values.prefix, root = join(working, "native/owned-c-binding");
	const adapterFiles = { ...generated.files, ...cpp?.files
		, ...rust ? { "internal/rust-abi.h": rust.abiHeader } : {}
		, ...python ? { "internal/python-abi.h": python.abiHeader } : {} };
	for(const [path, source] of Object.entries(adapterFiles))
	{
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), source, { flag: "wx" });
	}
	const gmpRoot = join(root, "gmp");
	await buildNativeGmp({ root: gmpRoot, environment, signal });
	await mkdir(join(root, "lib"));
	const library = `lib${p}.so`;
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: root, env: environment, signal });
	await run(environment.CC ?? "cc", ["-std=c11", "-O2", "-g0", "-fPIC", "-shared"
		, "-Wall", "-Wextra", "-Werror"
		, `-ffile-prefix-map=${working}=/build/owned-c`
		, "-I", join(root, "include"), "-I", join(root, "internal")
		, "-I", join(gmpRoot, "include"), "-I", join(runtimeRoot, "include")
		, ...rust ? ["-include", join(root, "internal/rust-abi.h")] : []
		, ...python ? ["-include", join(root, "internal/python-abi.h")] : []
		, join(root, "src", `${p}.c`)
		, "-L", nativeRoot, "-L", join(runtimeRoot, "lib"), "-L", join(gmpRoot, "lib")
		, "-Wl,--no-as-needed", `-l:${receipt.library}`
		, "-llean_bridge_native", "-lleanshared", "-l:libgmp.so.10"
		, "-Wl,-z,defs", "-Wl,--build-id=none", "-Wl,-rpath,$ORIGIN"
		, "-Wl,-z,nodelete"
		, `-Wl,-soname,${library}`, "-o", join(root, "lib", library)]);
	if(cpp) await run(environment.CXX ?? "c++", ["-std=c++20", "-Wall"
		, "-Wextra", "-Werror", "-pthread"
		, "-I", join(root, "include"), "-I", join(gmpRoot, "include")
		, "-fsyntax-only", join(root, `src/${p}.cpp`)]);
	const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38";
	if(!/^2\.\d+$/u.test(floor)) throw new TypeError("Invalid native glibc floor");
	const libraries = [join(root, "lib", library)
		, join(nativeRoot, receipt.library)
		, join(runtimeRoot, "lib/libleanshared.so")
		, join(runtimeRoot, "lib/liblean_bridge_native.so")
		, join(gmpRoot, "lib/libgmp.so.10")];
	for(const path of libraries)
	{
		const report = await run("readelf", ["--version-info", path]);
		for(const match of report.stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
			if(Number(match[1]) > 2 || (Number(match[1]) === 2 && (Number(match[2]) > Number(floor.slice(2)) || (Number(match[2]) === Number(floor.slice(2)) && Number(match[3] ?? 0) > 0))))
				throw new Error(`Owned C library requires ${match[0]}, above the package floor ${floor}`);
	}
	const files = {};
	for(const path of await nativeArtifactPaths(root))
	{
		const bytes = await readFile(join(root, path));
		files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	const adapter = { schemaVersion: transferredInputs ? 4 : hostCallbacks ? 3 : 2
		, profile: "native-library-v1"
		, bindingIrSha256: model.bindingIrSha256
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, runtimeIdentity: identity, library
		, ownedValues: { schemaVersion: transferredInputs ? 3 : hostCallbacks ? 2 : 1
			, ...(transferredInputs ? { inputTransfers: model.ownedGraph.inputTransfers } : {})
			, ...(hostCallbacks ? { hostCallbacks: model.ownedGraph.hostCallbacks } : {})
			, headerSha256: sha256(generated.publicHeader)
			, sourceSha256: sha256(generated.source) }
		, ...(cpp ? { cppValues: cpp.contract } : {})
		, ...(rust ? { rustValues: rust.contract } : {})
		, ...(python ? { pythonValues: python.contract } : {})
		, gmp: { version: "6.3.0" }, files };
	await writeFile(join(root, "native-c-adapter.json"), canonicalJson(adapter));
	const projections = [];
	for(const target of targets)
	{
		const options = { working, adapterRoot: root, nativeRoot, runtimeRoot
			, leanPrefix, settings: settings[target], glibcMinimumVersion: floor
			, environment, signal };
		projections.push(target === "cargo" ? await projectOwnedRust(options)
			: target === "pypi" ? await packageOwnedPython(options)
				: await packageOwnedNativeC({ ...options, target }));
	}
	return projections;
};
