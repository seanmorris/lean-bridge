/**
 * Install a prepared Component Model package and compile only its public caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, readdir, realpath, rename, rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { corpusCases, corpusHostCase } from "../fixtures/type-corpus/cases.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";
import { validateCFamilyDiagnostic } from "./type-corpus-c-source.mjs";
import { corpusWitRejection, corpusWitSource, validateWitSignatures } from "./type-corpus-wit-source.mjs";
import { witCompilerOptions, witIsolationFlags } from "./type-corpus-wit-evidence.mjs";

const repository = resolve(import.meta.dirname, "../..");
const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });
const json = async path => JSON.parse(await readFile(path, "utf8"));
const digest = async path => sha256(await readFile(path));

/**
 * Consume only the verified tarball; author/oracle directories are already gone.
 *
 * @param options - Installed consumer inputs.
 * @param options.library - Independent catalog library.
 * @param options.consumer - Temporary downstream root.
 * @param options.handoff - Verified, relocated prepared archives.
 * @param options.pkg - Verified package-set entry.
 * @param options.environment - Selected author tools for declaration inspection.
 * @param options.clean - Compiler-free execution environment.
 */
export const installedWitCorpus = async ({ library, consumer, handoff, pkg, environment, clean }) => {
	const root = join(consumer, "wit-wasi"), project = join(root, "project"), tools = join(project, "tools");
	const deployment = join(root, "relocated"), p = library.cModule;
	await mkdir(tools, { recursive: true });
	for(const name of ["as", "ld"]) await symlink(`/usr/bin/${name}`, join(tools, name));
	const compiler = await realpath("/usr/bin/cc"), compile = { ...clean, PATH: tools, LC_ALL: "C" };
	const compilerVersion = (await run(compiler, ["-dumpfullversion"], project, compile)).stdout.trim();
	assert.match(compilerVersion, /^\d+\.\d+(?:\.\d+)?$/); assert.ok(Number(compilerVersion.split(".")[0]) >= 12);
	const macros = (await run(compiler, ["-dM", "-E", "-x", "c", "/dev/null"], project, compile)).stdout;
	assert.match(macros, /#define __GNUC__ /); assert.doesNotMatch(macros, /__clang__/);
	const extracted = join(project, "package"); await mkdir(extracted);
	await run("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, pkg.artifacts[0].path), "-C", extracted], project, clean);
	const packageName = `${pkg.name}-${pkg.version}-wit-wasi`;
	assert.deepEqual(await readdir(extracted), [packageName]);
	const installed = join(extracted, packageName), receiptPath = join(installed, "lean-bridge-package.json");
	const receipt = await json(receiptPath);
	assert.equal(receipt.kind, "lean-bridge-ordinary-wit-package");
	assert.equal(receipt.ecosystem, "wit-wasi");
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.component.name, p); assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.deepEqual(await nativeArtifactPaths(installed), [...Object.keys(receipt.files), "lean-bridge-package.json"].sort());
	await verifyNativeFiles(installed, receipt.files);
	const wasmTools = await realpath(environment.LEAN_BRIDGE_WASM_TOOLS ?? join(repository, ".toolchains/wasm-tools/bin/wasm-tools"));
	const wasmToolsVersion = (await run(wasmTools, ["--version"], project, clean)).stdout.trim();
	assert.match(wasmToolsVersion, /^wasm-tools 1\.245\.1(?: \([a-f0-9]+ \d{4}-\d{2}-\d{2}\))?$/);
	const declarations = {};
	for(const [name, file] of [["wit", `wit/${pkg.name}.wit`], ["component", `component/${pkg.name}.wasm`]])
	{
		if(name === "component") await run(wasmTools, ["validate", "--features", "component-model", join(installed, file)], project, clean);
		const document = JSON.parse((await run(wasmTools, ["component", "wit", join(installed, file), "--json"], project, clean)).stdout);
		declarations[name] = { inputSha256: receipt.files[file].sha256, document, signatures: validateWitSignatures(document, library) };
	}
	const source = corpusWitSource(library);
	await saveLakeFile(project, "src/main.c", source);
	for(const header of ["c-family.h", "wit.h"])
		await saveLakeFile(project, `src/${header}`, await readFile(join(repository, "tests/fixtures/type-corpus/consumers", header)));
	const config = { ...compile, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await run("/usr/bin/pkg-config", ["--cflags", "--libs", `${pkg.name}-wit`], project, config)).stdout.trim().split(/\s+/);
	assert.equal(flags.length, 5);
	assert.ok(flags[0].startsWith("-I") && flags[1].startsWith("-L"));
	assert.equal(resolve(flags[0].slice(2)), join(installed, "include"));
	assert.equal(resolve(flags[1].slice(2)), join(installed, "lib"));
	assert.deepEqual(flags.slice(2), [`-Wl,-rpath,${flags[1].slice(2)}`, `-l${p}_wasmtime`, "-lwasmtime"]);
	await run(compiler, [...witCompilerOptions, "src/main.c", flags[0], flags[1], ...flags.slice(3), "-Wl,-rpath,$ORIGIN/lib", "-o", "consumer"], project, compile);
	const negativeCompilerOptions = [...witCompilerOptions, "-Wconversion", "-Wsign-conversion", "-fsyntax-only", "-fdiagnostics-format=json"];
	const rejected = [];
	for(const entry of corpusCases(library).map(entry => corpusHostCase(entry, "wit-wasi")).filter(entry => entry.expectation.kind === "compile-rejection"))
	{
		const source = corpusWitRejection(library, entry), file = `src/reject-${entry.id.split("/")[1]}.c`;
		await saveLakeFile(project, file, source);
		const failure = await captureCorpusCompiler(compiler, [...negativeCompilerOptions, flags[0], file], project, compile);
		assert.equal(failure.code, 1, `${entry.id}: expected compiler rejection: ${failure.stderr}`);
		const diagnostics = JSON.parse(failure.stderr).filter(message => message.kind === "error").map(message => {
			const location = message.locations[0]?.caret;
			assert.equal(location?.file, file);
			const diagnostic = { code: "narrowing", file, line: location.line, column: location.column, option: message.option ?? null, message: message.message };
			validateCFamilyDiagnostic(diagnostic, "c", "narrowing"); return diagnostic;
		});
		assert.ok(diagnostics.length > 0);
		rejected.push({ id: entry.id, status: "rejected-at-compile-time", sourceSha256: sha256(source), diagnostics });
	}
	const libraries = Object.fromEntries(Object.entries(receipt.files).filter(([path]) => /^lib\/[^/]+\.so(?:\.[0-9]+)*$/.test(path)));
	await mkdir(join(deployment, "lib"), { recursive: true });
	for(const path of Object.keys(libraries)) await copyFile(join(installed, path), join(deployment, path));
	await rename(join(project, "consumer"), join(deployment, "consumer"));
	await copyFile(join(installed, `component/${pkg.name}.wasm`), join(deployment, "component.wasm"));
	const wit = { ...Object.fromEntries(witIsolationFlags.map(flag => [flag, true]))
		, packageReceipt: receipt, packageReceiptSha256: await digest(receiptPath)
		, archiveSha256: pkg.artifacts[0].sha256
		, compiled: await json(join(installed, "native-wit-adapter.json"))
		, componentReceipt: await json(join(installed, "share/lean-bridge/component/native-component.json"))
		, adapterReceipt: await json(join(installed, "share/lean-bridge/native-c-adapter.json"))
		, runtimeReceipt: await json(join(installed, "share/lean-bridge/runtime.json"))
		, compilerVersion, compilerSha256: await digest(compiler)
		, compilerMacrosSha256: sha256(macros)
		, compilerOptions: [...witCompilerOptions], negativeCompilerOptions
		, sourceSha256: sha256(source)
		, executableSha256: await digest(join(deployment, "consumer"))
		, wasmToolsVersion, wasmToolsSha256: await digest(wasmTools), declarations
		, deploymentRoot: deployment, libraries
		, pkgConfig: { version: (await run("/usr/bin/pkg-config", ["--version"], project, compile)).stdout.trim(), flags, manifestSha256: receipt.files[`lib/pkgconfig/${pkg.name}-wit.pc`].sha256 } };
	assert.equal(wit.packageReceiptSha256, sha256(canonicalJson(receipt)));
	await rm(project, { recursive: true, force: true });
	assert.deepEqual(await readdir(root), ["relocated"]);
	assert.deepEqual(await nativeArtifactPaths(deployment), [...Object.keys(libraries), "consumer", "component.wasm"].sort());
	const observations = [];
	for(let attempt = 0; attempt < 2; attempt++)
	{
		const observation = JSON.parse((await run(join(deployment, "consumer"), [], deployment, clean)).stdout);
		const paths = Object.keys(libraries).map(path => join(deployment, path));
		assert.equal(new Set(observation.loadedLibraries).size, observation.loadedLibraries.length);
		for(const path of paths) assert.ok(observation.loadedLibraries.includes(path), `Packaged library not loaded: ${path}`);
		assert.deepEqual(observation.loadedLibraries.filter(path => path.startsWith(deployment + "/")).sort(), paths.sort());
		observation.results.push(...rejected); observations.push(observation);
	}
	assert.deepEqual(observations[0], observations[1]);
	await verifyNativeFiles(deployment, libraries);
	assert.equal(await digest(join(deployment, "consumer")), wit.executableSha256);
	assert.equal(await digest(join(deployment, "component.wasm")), receipt.componentSha256);
	wit.repeatExecutions = 2;
	return { observation: observations[0], wit };
};
