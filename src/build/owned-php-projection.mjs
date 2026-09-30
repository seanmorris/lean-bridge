/**
 * Compile PHP's resource-bearing value adapter with private GMP dependencies.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateOwnedCPackage } from "../backends/c/owned-package.mjs";
import { generateOwnedPhpPackage } from "../backends/php/owned-package.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime } from "./native-artifacts.mjs";
import { ownedPhpAdapterSources } from "./owned-php-artifacts.mjs";
import { buildNativeGmp } from "./native-gmp.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { packageOwnedPhp } from "../release/owned-composer.mjs";

/**
 * Build a Composer archive from authenticated Lean component and runtime bytes.
 *
 * @param options - Private staging, producer tools and Composer coordinates.
 */
export const projectOwnedPhp = async options => {
	const { working, nativeRoot, runtimeRoot, environment = process.env, signal } = options;
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true });
	if(!model.ownedGraph?.hostCallbacks) throw new TypeError("Owned PHP requires authenticated callback/copy support");
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const c = generateOwnedCPackage({ metadata, sourceIdentity: model.sourceIdentity, component: model.component, hostCallbacks: true, transferredInputs });
	const php = generateOwnedPhpPackage(model.bindingIr, null, { transferredInputs }), prefix = c.values.prefix;
	const root = join(working, "native/owned-php-binding"), gmpRoot = join(root, "gmp");
	const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38";
	if(!/^2\.\d+$/u.test(floor)) throw new TypeError("Invalid PHP native glibc floor");
	for(const [path, source] of Object.entries(ownedPhpAdapterSources(c, php)))
	{
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), source, { flag: "wx" });
	}
	await buildNativeGmp({ root: gmpRoot, environment, signal, privateSoname: true });
	await mkdir(join(root, "lib"));
	const library = `lib${prefix}_php.so`, gmpLibrary = "libgmp-lean-bridge.so.10";
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: root, env: environment, signal });
	await run(environment.CC ?? "cc", ["-std=c11", "-O2", "-g0", "-fPIC", "-shared"
		, "-Wall", "-Wextra", "-Werror"
		, `-ffile-prefix-map=${working}=/build/owned-php`
		, "-I", join(root, "include"), "-I", join(root, "internal")
		, "-I", join(gmpRoot, "include"), "-I", join(runtimeRoot, "include")
		, join(root, "src", `${prefix}-php.c`)
		, "-L", join(gmpRoot, "lib"), "-L", nativeRoot, "-L", join(runtimeRoot, "lib")
		// Lean also exports GMP. The adapter's isolated dependency must come first.
		, "-Wl,--no-as-needed", `-l:${gmpLibrary}`, `-l:${receipt.library}`
		, "-llean_bridge_native", "-lleanshared", "-Wl,-z,defs", "-Wl,--build-id=none"
		, "-Wl,-rpath,$ORIGIN", "-Wl,-z,nodelete", `-Wl,-soname,${library}`
		, "-o", join(root, "lib", library)]);
	const libraries = [join(root, "lib", library)
		, join(nativeRoot, receipt.library)
		, join(runtimeRoot, "lib/libleanshared.so")
		, join(runtimeRoot, "lib/liblean_bridge_native.so")
		, join(gmpRoot, "lib", gmpLibrary)];
	for(const path of libraries)
	{
		const report = await run("readelf", ["--version-info", path]);
		for(const match of report.stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
			if(Number(match[1]) > 2 || (Number(match[1]) === 2 && (Number(match[2]) > Number(floor.slice(2)) || (Number(match[2]) === Number(floor.slice(2)) && Number(match[3] ?? 0) > 0))))
				throw new Error(`Owned PHP library requires ${match[0]}, above the package floor ${floor}`);
	}
	const files = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await writeFile(join(root, "native-php-adapter.json"), canonicalJson({ schemaVersion: transferredInputs ? 2 : 1
		, profile: "native-library-v1", bindingIrSha256: model.bindingIrSha256
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, runtimeIdentity: identity, library
		, ownedValues: { schemaVersion: transferredInputs ? 3 : 2
			, hostCallbacks: model.ownedGraph.hostCallbacks
			, ...transferredInputs ? { inputTransfers: model.ownedGraph.inputTransfers } : {}
			, headerSha256: sha256(c.publicHeader), sourceSha256: sha256(c.source) }
		, phpValues: php.contract
		, gmp: { version: "6.3.0", soname: gmpLibrary, binding: "local-symbols" }
		, files }), { flag: "wx" });
	return packageOwnedPhp({ ...options, adapterRoot: root, glibcMinimumVersion: floor });
};
