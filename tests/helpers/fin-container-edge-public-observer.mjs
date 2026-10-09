/**
 * Observe the full public C consumer against an authenticated, moved installed C package.
 * No public C observation is attributed to another language.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEdgeColumns, finContainerEdgeEntries, finContainerEdgeInterposer, finContainerEdgePublicProbe, finContainerEdgePublicSymbols, finContainerEdgeSourceEntries, readFinContainerEdgePublic } from "./fin-container-edge-dispatch.mjs";
import { assertFinContainerEdgeProbeLocation, finContainerEdgeDefinitions, verifyFinContainerEdgeDeployment } from "./fin-container-edge-observer.mjs";
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
 */
export const observeFinContainerEdgePublic = async ({ installed, receiptPath, receiptBytes, expectedModelSha256, probeRoot }) => {
	await assertFinContainerEdgeProbeLocation(installed, probeRoot);
	const options = { installed, receiptPath, receiptBytes, expectedModelSha256 };
	const before = await verifyFinContainerEdgeDeployment(options);
	const headers = ["include/fincontainers.h", "include/detail/fincontainers_gmp.h", "include/gmp.h"];
	for(const path of headers) assert.ok(Object.hasOwn(before.receipt.files, path), `public C header is not receipt-pinned: ${path}`);
	const definitions = await finContainerEdgeDefinitions(before, { publicC: true });
	const select = symbols => Object.fromEntries(symbols.map(symbol => [symbol, definitions[symbol]]));
	const source = await finContainerEdgePublicProbe(before.model, before.receipt.component, select(finContainerEdgePublicSymbols));
	const instrument = finContainerEdgeInterposer(before.model, before.receipt.component, select(before.columns));
	await mkdir(probeRoot);
	await saveLakeFile(probeRoot, "public.c", source);
	await saveLakeFile(probeRoot, "interposer.c", instrument);
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "libedge.so"], probeRoot, tools);
	const link = ["-L", before.directory, "-Wl,--no-as-needed", ...Object.keys(before.libraries).map(name => `-l:${name}`), `-Wl,-rpath,${before.directory}`, "-ldl"];
	await runCopied("/usr/bin/cc", [...strict, "-I", join(installed, "include"), "public.c", ...link, "-o", "public"], probeRoot, tools);
	await assert.rejects(() => runCopied(join(probeRoot, "public"), [], probeRoot, copiedCleanEnvironment)
		, error => /exited with status 2:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === "edge interposer is not loaded\n");
	const run = await runCopied(join(probeRoot, "public"), [], probeRoot, { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1", LD_PRELOAD: join(probeRoot, "libedge.so") });
	assert.equal(run.stderr, "");
	const observations = readFinContainerEdgePublic(run.stdout);
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "public observation must not alter any installed file");
	return { kind: "fin-container-edge-public-c-v1", observed: true, profile: "c"
		, caller: "The complete original-plus-edge public C GMP consumer with per-call entry instrumentation"
		, instrument: "LD_PRELOAD with runtime defining-library checks"
		, checks: 14114, measuredCalls: observations.length, observations
		, componentId: before.model.component.id
		, columns: finContainerEdgeColumns(before.model, before.receipt.component)
		, measuredAdapters: finContainerEdgeEntries.map(name => `FinContainers.${name}`)
		, measuredSources: finContainerEdgeSourceEntries.map(name => `FinContainers.${name}`)
		, sourceFunctionsNotMeasured: finContainerEdgeEntries.filter(name => !finContainerEdgeSourceEntries.includes(name)).map(name => `FinContainers.${name}`)
		, publicSymbols: finContainerEdgePublicSymbols
		, libraryDirectory: before.directory, libraries: before.libraries
		, definitions: Object.fromEntries(Object.entries(definitions).map(([symbol, path]) => [symbol, basename(path)]))
		, headerDigests: Object.fromEntries(headers.map(path => [path, before.receipt.files[path].sha256]))
		, ...before.identity
		, probeSha256: sha256(source), interposerSha256: sha256(instrument)
		, stdoutSha256: sha256(run.stdout), missingInstrumentRefused: true
		, installedFilesUnchanged: true, runtimeDefinitionsChecked: true };
};
