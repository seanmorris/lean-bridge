/**
 * Compile a public owned-value C library against verified native components.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateOwnedCPackage } from "../backends/c/owned-package.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime } from "./native-artifacts.mjs";
import { buildNativeGmp } from "./native-gmp.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { packageOwnedNativeC } from "../release/owned-c-package.mjs";

/**
 * Build and package the complete public header, native code and GMP dependency.
 *
 * @param options - Private staging roots and validated C package coordinates.
 * @param options.working - Exclusively owned build staging directory.
 * @param options.nativeRoot - Verified component directory.
 * @param options.runtimeRoot - Verified shared runtime directory.
 * @param options.leanPrefix - Pinned Lean distribution containing license notices.
 * @param options.settings - Validated C package coordinates.
 * @param options.environment - Explicit compiler and platform environment.
 * @param options.signal - Optional build cancellation signal.
 */
export const projectOwnedNativeC = async ({ working, nativeRoot, runtimeRoot, leanPrefix, settings, environment = process.env, signal }) => {
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true });
	if(!model.ownedGraph) throw new TypeError("Owned C projection requires a v4 native component");
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	const generated = generateOwnedCPackage({ metadata, sourceIdentity: model.sourceIdentity, component: model.component });
	const p = generated.values.prefix, root = join(working, "native/owned-c-binding");
	for(const [path, source] of Object.entries(generated.files))
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
		, join(root, "src", `${p}.c`)
		, "-L", nativeRoot, "-L", join(runtimeRoot, "lib"), "-L", join(gmpRoot, "lib")
		, "-Wl,--no-as-needed", `-l:${receipt.library}`
		, "-llean_bridge_native", "-lleanshared", "-l:libgmp.so.10"
		, "-Wl,-z,defs", "-Wl,--build-id=none", "-Wl,-rpath,$ORIGIN"
		, "-Wl,-z,nodelete"
		, `-Wl,-soname,${library}`, "-o", join(root, "lib", library)]);
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
	const adapter = { schemaVersion: 2, profile: "native-library-v1"
		, bindingIrSha256: model.bindingIrSha256
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, runtimeIdentity: identity, library
		, ownedValues: { schemaVersion: 1
			, headerSha256: sha256(generated.publicHeader)
			, sourceSha256: sha256(generated.source) }
		, gmp: { version: "6.3.0" }, files };
	await writeFile(join(root, "native-c-adapter.json"), canonicalJson(adapter));
	return packageOwnedNativeC({ working, adapterRoot: root, nativeRoot, runtimeRoot, leanPrefix, settings, glibcMinimumVersion: floor });
};
