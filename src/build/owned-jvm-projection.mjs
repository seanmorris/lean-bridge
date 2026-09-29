/**
 * Compile the private JVM ownership adapter and metadata-backed JVM classes.
 *
 * @file
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateOwnedCPackage } from "../backends/c/owned-package.mjs";
import { generateOwnedJvmPackage } from "../backends/jvm/owned-package.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime } from "./native-artifacts.mjs";
import { ownedJvmAdapterSources, ownedJvmEvidence } from "./owned-jvm-artifacts.mjs";
import { buildNativeGmp } from "./native-gmp.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { packageOwnedMaven } from "../release/owned-maven.mjs";
import { compileJvmSources } from "./compile-jvm-sources.mjs";

/**
 * Producers compile once; Maven consumers only load the authenticated binaries.
 *
 * @param options - Authenticated native roots, package settings and build tools.
 */
export const projectOwnedJvm = async options => {
	const { working, nativeRoot, runtimeRoot, environment = process.env, signal } = options;
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true });
	if(!model.ownedGraph?.hostCallbacks) throw new TypeError("Owned JVM requires authenticated callback/copy support");
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const c = generateOwnedCPackage({ metadata, sourceIdentity: model.sourceIdentity, component: model.component, hostCallbacks: true, transferredInputs });
	const projection = generateOwnedJvmPackage(model.bindingIr, null, { transferredInputs }), prefix = c.values.prefix;
	const adapterRoot = join(working, "native/owned-jvm-binding"), gmpRoot = join(adapterRoot, "gmp");
	const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38";
	if(!/^2\.\d+$/u.test(floor)) throw new TypeError("Invalid JVM native glibc floor");
	for(const [path, source] of Object.entries(ownedJvmAdapterSources(c, projection)))
	{
		await mkdir(dirname(join(adapterRoot, path)), { recursive: true });
		await writeFile(join(adapterRoot, path), source, { flag: "wx" });
	}
	await buildNativeGmp({ root: gmpRoot, environment, signal, privateSoname: true });
	await mkdir(join(adapterRoot, "lib"));
	const library = `lib${prefix}_jvm.so`, gmpLibrary = "libgmp-lean-bridge.so.10";
	const nativeScratch = join(working, "jvm-native-compiler"); await mkdir(nativeScratch);
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: adapterRoot, env: environment, signal });
	const flags = ["-O2", "-g0", "-fPIC", "-Wall", "-Wextra", "-Werror"
		, `-ffile-prefix-map=${working}=/build/owned-jvm`
		, "-I", join(adapterRoot, "include"), "-I", join(adapterRoot, "internal")
		, "-I", join(gmpRoot, "include"), "-I", join(runtimeRoot, "include")];
	await run(environment.CC ?? "cc", ["-std=c11", ...flags
		, "-c", join(adapterRoot, "src", `${prefix}-jvm.c`)
		, "-o", join(nativeScratch, "api.o")]);
	await run(environment.CXX ?? "c++", ["-std=c++17", ...flags
		, "-c", join(adapterRoot, "src", `${prefix}-jvm-thread-exit.cpp`)
		, "-o", join(nativeScratch, "guard.o")]);
	await run(environment.CXX ?? "c++", ["-shared", "-pthread"
		, join(nativeScratch, "api.o"), join(nativeScratch, "guard.o")
		, "-L", join(gmpRoot, "lib"), "-L", nativeRoot
		, "-L", join(runtimeRoot, "lib"), "-Wl,--no-as-needed"
		, `-l:${gmpLibrary}`, `-l:${receipt.library}`
		, "-llean_bridge_native", "-lleanshared", "-Wl,-z,defs"
		, "-Wl,--build-id=none", "-Wl,-rpath,$ORIGIN", "-Wl,-z,nodelete"
		, `-Wl,-soname,${library}`, "-o", join(adapterRoot, "lib", library)]);
	await rm(nativeScratch, { recursive: true, force: true });
	for(const path of [join(adapterRoot, "lib", library)
		, join(nativeRoot, receipt.library)
		, join(runtimeRoot, "lib/libleanshared.so")
		, join(runtimeRoot, "lib/liblean_bridge_native.so")
		, join(gmpRoot, "lib", gmpLibrary)]) {
		const report = await run("readelf", ["--version-info", path]);
		for(const match of report.stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
			if(Number(match[1]) > 2 || (Number(match[1]) === 2 && (Number(match[2]) > Number(floor.slice(2)) || (Number(match[2]) === Number(floor.slice(2)) && Number(match[3] ?? 0) > 0))))
				throw new Error(`Owned JVM library requires ${match[0]}, above the package floor ${floor}`);
		}
	const files = {};
	for(const path of await nativeArtifactPaths(adapterRoot))
	{ const bytes = await readFile(join(adapterRoot, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await writeFile(join(adapterRoot, "native-jvm-adapter.json"), canonicalJson({ schemaVersion: transferredInputs ? 2 : 1
		, profile: "native-library-v1", bindingIrSha256: model.bindingIrSha256
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, runtimeIdentity: identity, library
		, ownedValues: { schemaVersion: transferredInputs ? 3 : 2
			, hostCallbacks: model.ownedGraph.hostCallbacks
			, ...transferredInputs ? { inputTransfers: model.ownedGraph.inputTransfers } : {}
			, headerSha256: sha256(c.publicHeader), sourceSha256: sha256(c.source) }
		, jvmValues: projection.contract
		, gmp: { version: "6.3.0", soname: gmpLibrary, binding: "local-symbols" }
		, files }), { flag: "wx" });
	const { evidence } = await ownedJvmEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const generated = generateOwnedJvmPackage(model.bindingIr, evidence, { transferredInputs });
	const jvmRoot = join(working, "native/jvm");
	for(const [path, contents] of Object.entries(generated.files))
	{ await mkdir(dirname(join(jvmRoot, path)), { recursive: true }); await writeFile(join(jvmRoot, path), contents, { flag: "wx" }); }
	const compilers = await compileJvmSources({ root: jvmRoot, files: generated.files, environment, signal });
	const inventory = {};
	for(const path of await nativeArtifactPaths(jvmRoot))
	{ const bytes = await readFile(join(jvmRoot, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await writeFile(join(jvmRoot, "native-jvm.json"), canonicalJson({ schemaVersion: transferredInputs ? 2 : 1
		, profile: "native-library-v1", bindingIrSha256: model.bindingIrSha256
		, evidence, ...compilers, namespace: projection.namespace
		, ownedValues: projection.contract, files: inventory }), { flag: "wx" });
	return packageOwnedMaven({ ...options, adapterRoot, jvmRoot, glibcMinimumVersion: floor });
};
