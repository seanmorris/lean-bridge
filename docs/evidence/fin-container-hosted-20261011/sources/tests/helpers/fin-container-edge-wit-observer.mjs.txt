/**
 * Count the complete public WIT consumer through its receipt-pinned Wasmtime host and component.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, realpath } from "node:fs/promises";
import { basename, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEdgeEntries, finContainerEdgeInterposer, finContainerEdgeSourceEntries } from "./fin-container-edge-dispatch.mjs";
import { assertFinContainerEdgeProbeLocation, finContainerEdgeDefinitions, verifyFinContainerEdgeDeployment } from "./fin-container-edge-observer.mjs";
import { finContainerEdgeWitChecks, finContainerEdgeWitProbe, finContainerEdgeWitSymbols, readFinContainerEdgeWit } from "./fin-container-edge-wit.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Resolve the host, engine and C wire entries independently of their dynamically loaded addresses.
 *
 * @param deployment - Receipt-verified native model and complete library directory.
 */
export const finContainerEdgeWitDefinitions = async deployment => {
	const definitions = await finContainerEdgeDefinitions(deployment, { publicWire: true });
	const listings = {};
	for(const name of Object.keys(deployment.libraries))
		listings[name] = (await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(deployment.directory, name)], deployment.directory, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" })).stdout;
	for(const symbol of finContainerEdgeWitSymbols)
	{
		const owners = Object.keys(listings).filter(name => listings[name].split("\n").some(line => new RegExp(`^[0-9a-f]+ [TW] ${symbol}$`, "u").test(line.trim())));
		assert.equal(owners.length, 1, `${symbol} must have exactly one verified definition`);
		definitions[symbol] = join(deployment.directory, owners[0]);
	}
	return definitions;
};

/**
 * Compile only a caller and interposer, then authenticate every installed/probe file around each run.
 *
 * @param options - Original archive identity and relocated WIT installation.
 * @param options.installed - Package-owned directory after relocation.
 * @param options.receiptPath - Original archive receipt path.
 * @param options.receiptBytes - Receipt bytes authenticated against the original archive.
 * @param options.expectedModelSha256 - Producer model digest.
 * @param options.probeRoot - Fresh directory outside the package-owned tree.
 */
export const observeFinContainerEdgeWit = async ({ installed, receiptPath, receiptBytes, expectedModelSha256, probeRoot }) => {
	await assertFinContainerEdgeProbeLocation(installed, probeRoot);
	const options = { installed, receiptPath, receiptBytes, expectedModelSha256, exactFileClosure: true };
	const before = await verifyFinContainerEdgeDeployment(options);
	assert.equal(before.receipt.kind, "lean-bridge-ordinary-wit-package");
	assert.equal(before.receipt.ecosystem, "wit-wasi");
	assert.equal(before.receipt.wasmtime, "42.0.1");
	assert.equal(before.directory, join(installed, "lib"));
	const componentPath = "component/fincontainers.wasm";
	assert.match(before.receipt.componentSha256, /^[a-f0-9]{64}$/u);
	assert.equal(before.receipt.files[componentPath]?.sha256, before.receipt.componentSha256);
	const headers = Object.keys(before.receipt.files).filter(path => path.startsWith("include/") && path.endsWith(".h"));
	for(const path of ["include/fincontainers_wasmtime.h", "include/wasmtime.h", "include/wasmtime/component.h", "include/fincontainers.h"])
		assert.ok(headers.includes(path), `WIT header is not receipt-pinned: ${path}`);
	const definitions = await finContainerEdgeWitDefinitions(before);
	const select = symbols => Object.fromEntries(symbols.map(symbol => [symbol, definitions[symbol]]));
	const { source } = await finContainerEdgeWitProbe(before.model, before.receipt.component, select(finContainerEdgeWitSymbols));
	const instrument = finContainerEdgeInterposer(before.model, before.receipt.component, select(before.columns));
	await mkdir(probeRoot);
	await saveLakeFile(probeRoot, "public.c", source);
	await saveLakeFile(probeRoot, "interposer.c", instrument);
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	const linkLibraries = [...new Set([definitions.fincontainers_wasmtime_call, definitions.wasmtime_error_message].map(path => basename(path)))];
	const link = ["-L", before.directory, "-Wl,--no-as-needed", ...linkLibraries.map(name => `-l:${name}`), `-Wl,-rpath,${before.directory}`, "-ldl"];
	try
	{
		await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "libedge.so"], probeRoot, tools);
		await runCopied("/usr/bin/cc", [...strict, "-I", join(installed, "include"), "public.c", ...link, "-o", "public"], probeRoot, tools);
	}
	finally
	{ assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "WIT compilation must not alter package files"); }
	const paths = ["interposer.c", "libedge.so", "public", "public.c"];
	assert.deepEqual(await nativeArtifactPaths(probeRoot), paths);
	const probeFiles = Object.fromEntries(await Promise.all(paths.map(async path => [path, sha256(await readFile(join(probeRoot, path)))])));
	assert.equal(probeFiles["public.c"], sha256(source)); assert.equal(probeFiles["interposer.c"], sha256(instrument));
	const check = async () => {
		assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before);
		assert.deepEqual(await nativeArtifactPaths(probeRoot), paths);
		for(const [path, digest] of Object.entries(probeFiles))
		{
			assert.equal(await realpath(join(probeRoot, path)), join(probeRoot, path));
			assert.equal(sha256(await readFile(join(probeRoot, path))), digest, `WIT probe drift: ${path}`);
		}
	};
	const execute = async observed => {
		await check();
		try
		{ return await runCopied(join(probeRoot, "public"), [], probeRoot, { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1", ...observed ? { LD_PRELOAD: join(probeRoot, "libedge.so") } : {} }); }
		finally
		{ await check(); }
	};
	await assert.rejects(execute(false), error => /exited with status 2:/u.test(error.message)
		&& error.details.stdout === "" && error.details.stderr === "edge interposer is not loaded\n");
	const run = await execute(true); assert.equal(run.stderr, "");
	const observations = readFinContainerEdgeWit(run.stdout);
	const repeat = await execute(true); assert.equal(repeat.stderr, "");
	assert.equal(repeat.stdout, run.stdout, "a fresh Wasmtime process must repeat every measured call");
	readFinContainerEdgeWit(repeat.stdout);
	return { kind: "fin-container-edge-public-wit-v1"
		, observed: true, profile: "wit-wasi"
		, caller: "The complete original-plus-edge public Wasmtime C consumer, through the embedded Component Model"
		, instrument: "LD_PRELOAD with runtime defining-library checks"
		, checks: finContainerEdgeWitChecks, measuredCalls: observations.length
		, observations, componentId: before.model.component.id
		, columns: before.columns
		, measuredAdapters: finContainerEdgeEntries.map(name => `FinContainers.${name}`)
		, measuredSources: finContainerEdgeSourceEntries.map(name => `FinContainers.${name}`)
		, sourceFunctionsNotMeasured: finContainerEdgeEntries.filter(name => !finContainerEdgeSourceEntries.includes(name)).map(name => `FinContainers.${name}`)
		, publicSymbols: finContainerEdgeWitSymbols, linkLibraries
		, packageDirectory: installed, libraryDirectory: before.directory
		, libraries: before.libraries, wasmtime: before.receipt.wasmtime
		, componentSha256: before.receipt.componentSha256
		, definitions: Object.fromEntries(Object.entries(definitions).map(([symbol, path]) => [symbol, basename(path)]))
		, headerDigests: Object.fromEntries(headers.map(path => [path, before.receipt.files[path].sha256]))
		, ...before.identity, probeFiles
		, probeFilesSha256: sha256(canonicalJson(probeFiles))
		, probeSha256: sha256(source), interposerSha256: sha256(instrument)
		, stdoutSha256: sha256(run.stdout), repeatExecutions: 2
		, missingInstrumentRefused: true, installedFilesUnchanged: true
		, runtimeDefinitionsChecked: true, repeatedColdProcess: true };
};
