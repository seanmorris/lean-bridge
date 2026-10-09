/**
 * Observe a full public C or C++ consumer against its authenticated, moved installed package.
 * Each observation is attributed only to the actual language used by that caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEdgeColumns, finContainerEdgeEntries, finContainerEdgeInterposer, finContainerEdgePublicProbe, finContainerEdgePublicSymbols, finContainerEdgeSourceEntries, readFinContainerEdgePublic } from "./fin-container-edge-dispatch.mjs";
import { assertFinContainerEdgeProbeLocation, finContainerEdgeDefinitions, verifyFinContainerEdgeDeployment } from "./fin-container-edge-observer.mjs";
import { finContainerEdgeCppProbe, finContainerEdgeCppSymbols, readFinContainerEdgeCpp } from "./fin-container-edge-cpp.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Compile only the caller and instrumentation, using receipt-pinned installed headers and libraries.
 *
 * @param options - Original archive identity and installed C deployment.
 * @param options.installed - Installed C package after the full-tree move.
 * @param options.receiptPath - Relative installed receipt path.
 * @param options.receiptBytes - Receipt bytes authenticated against the original archive.
 * @param options.expectedModelSha256 - Producer model identity.
 * @param options.probeRoot - Fresh directory outside the installed package.
 * @param options.profile - The public caller's language, c (default) or cpp.
 */
export const observeFinContainerEdgePublic = async ({ installed, receiptPath, receiptBytes, expectedModelSha256, probeRoot, profile = "c" }) => {
	assert.ok(["c", "cpp"].includes(profile), "public entry observation supports only C and C++");
	const cpp = profile === "cpp";
	await assertFinContainerEdgeProbeLocation(installed, probeRoot);
	const options = { installed, receiptPath, receiptBytes, expectedModelSha256, exactFileClosure: true };
	const before = await verifyFinContainerEdgeDeployment(options);
	const headers = cpp
		? ["include/fincontainers.h", "include/fincontainers.hpp", ...Object.keys(boostSources()).filter(path => path.startsWith("include/"))]
		: ["include/fincontainers.h", "include/detail/fincontainers_gmp.h", "include/gmp.h"];
	for(const path of headers) assert.ok(Object.hasOwn(before.receipt.files, path), `public ${profile} header is not receipt-pinned: ${path}`);
	const definitions = await finContainerEdgeDefinitions(before, { publicC: !cpp, publicWire: cpp });
	const select = symbols => Object.fromEntries(symbols.map(symbol => [symbol, definitions[symbol]]));
	const publicSymbols = cpp ? finContainerEdgeCppSymbols : finContainerEdgePublicSymbols;
	const source = await (cpp ? finContainerEdgeCppProbe : finContainerEdgePublicProbe)(before.model, before.receipt.component, select(publicSymbols));
	const instrument = finContainerEdgeInterposer(before.model, before.receipt.component, select(before.columns));
	await mkdir(probeRoot);
	const sourceName = cpp ? "public.cpp" : "public.c";
	await saveLakeFile(probeRoot, sourceName, source);
	await saveLakeFile(probeRoot, "interposer.c", instrument);
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "libedge.so"], probeRoot, tools);
	// Match the public C++ package's link surface. Directly linking Lean's runtime changes ELF lookup
	// order: its exported _Unwind_* functions can precede libgcc_s and break ordinary C++ exceptions.
	const linkLibraries = cpp ? [...new Set(publicSymbols.map(symbol => basename(definitions[symbol])))] : Object.keys(before.libraries);
	const link = ["-L", before.directory, "-Wl,--no-as-needed", ...linkLibraries.map(name => `-l:${name}`), `-Wl,-rpath,${before.directory}`, "-ldl"];
	await runCopied(cpp ? "/usr/bin/c++" : "/usr/bin/cc", [cpp ? "-std=c++20" : strict[0], ...strict.slice(1), "-I", join(installed, "include"), sourceName, ...link, "-o", "public"], probeRoot, tools);
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "public compilation must not alter installed files");
	await assert.rejects(() => runCopied(join(probeRoot, "public"), [], probeRoot, copiedCleanEnvironment)
		, error => /exited with status 2:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === "edge interposer is not loaded\n");
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "negative public run must not alter installed files");
	const run = await runCopied(join(probeRoot, "public"), [], probeRoot, { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1", LD_PRELOAD: join(probeRoot, "libedge.so") });
	assert.equal(run.stderr, "");
	const observations = (cpp ? readFinContainerEdgeCpp : readFinContainerEdgePublic)(run.stdout);
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "public observation must not alter any installed file");
	const caller = cpp
		? "The complete original-plus-edge public C++ consumer with per-call entry instrumentation"
		: "The complete original-plus-edge public C GMP consumer with per-call entry instrumentation";
	return { kind: `fin-container-edge-public-${profile}-v1`
		, observed: true, profile, caller
		, instrument: "LD_PRELOAD with runtime defining-library checks"
		, checks: cpp ? 14099 : 14114
		, measuredCalls: observations.length, observations
		, componentId: before.model.component.id
		, columns: finContainerEdgeColumns(before.model, before.receipt.component)
		, measuredAdapters: finContainerEdgeEntries.map(name => `FinContainers.${name}`)
		, measuredSources: finContainerEdgeSourceEntries.map(name => `FinContainers.${name}`)
		, sourceFunctionsNotMeasured: finContainerEdgeEntries.filter(name => !finContainerEdgeSourceEntries.includes(name)).map(name => `FinContainers.${name}`)
		, publicSymbols
		, ...(cpp ? { linkLibraries } : {})
		, libraryDirectory: before.directory, libraries: before.libraries
		, definitions: Object.fromEntries(Object.entries(definitions).map(([symbol, path]) => [symbol, basename(path)]))
		, headerDigests: Object.fromEntries(headers.map(path => [path, before.receipt.files[path].sha256]))
		, ...before.identity
		, probeSha256: sha256(source), interposerSha256: sha256(instrument)
		, stdoutSha256: sha256(run.stdout), missingInstrumentRefused: true
		, installedFilesUnchanged: true, runtimeDefinitionsChecked: true };
};
