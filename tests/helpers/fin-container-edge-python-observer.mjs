/**
 * Run the full public Python consumer in the actual moved interpreter installation.
 * The separate raw C observer does not stand in for this host's calls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEdgeColumns, finContainerEdgeEntries, finContainerEdgeInterposer, finContainerEdgeSourceEntries, finContainerEdgeWireSymbols } from "./fin-container-edge-dispatch.mjs";
import { assertFinContainerEdgeProbeLocation, finContainerEdgeDefinitions, verifyFinContainerEdgeDeployment } from "./fin-container-edge-observer.mjs";
import { finContainerEdgePythonProbe, readFinContainerEdgePython } from "./fin-container-edge-python.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Compile only test instrumentation. Public calls use the installed generated Python package.
 *
 * @param options - Original archive identity and moved Python deployment.
 * @param options.installed - Receipt-verified site-packages directory.
 * @param options.receiptPath - Relative receipt path.
 * @param options.receiptBytes - Authenticated original archive member bytes.
 * @param options.expectedModelSha256 - Producer model digest.
 * @param options.probeRoot - New directory outside the installation.
 * @param options.command - Absolute moved virtual environment interpreter.
 */
export const observeFinContainerEdgePython = async ({ installed, receiptPath, receiptBytes, expectedModelSha256, probeRoot, command }) => {
	await assertFinContainerEdgeProbeLocation(installed, probeRoot);
	assert.ok(typeof command === "string" && isAbsolute(command) && !command.includes("\0"));
	const options = { installed, receiptPath, receiptBytes, expectedModelSha256 };
	const before = await verifyFinContainerEdgeDeployment(options);
	const modules = ["lean_fincontainers/__init__.py", "lean_fincontainers/_native.py"];
	for(const path of modules) assert.ok(Object.hasOwn(before.receipt.files, path), `Python module is not receipt-pinned: ${path}`);
	const definitions = await finContainerEdgeDefinitions(before, { publicWire: true });
	const select = symbols => Object.fromEntries(symbols.map(symbol => [symbol, definitions[symbol]]));
	const packageDirectory = join(installed, "lean_fincontainers");
	const source = await finContainerEdgePythonProbe(before.model, before.receipt.component, { definitions: select(finContainerEdgeWireSymbols), packageDirectory });
	const instrument = finContainerEdgeInterposer(before.model, before.receipt.component, select(before.columns));
	await mkdir(probeRoot);
	await saveLakeFile(probeRoot, "public.py", source);
	await saveLakeFile(probeRoot, "interposer.c", instrument);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "libedge.so"], probeRoot, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
	const args = ["-I", "-B", "public.py"];
	await assert.rejects(() => runCopied(command, args, probeRoot, copiedCleanEnvironment)
		, error => /exited with status 2:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === "edge interposer is not loaded\n");
	const environment = { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1", LD_PRELOAD: join(probeRoot, "libedge.so") };
	const run = await runCopied(command, args, probeRoot, environment);
	assert.equal(run.stderr, "");
	const observations = readFinContainerEdgePython(run.stdout);
	const repeat = await runCopied(command, args, probeRoot, environment);
	assert.equal(repeat.stderr, ""); assert.equal(repeat.stdout, run.stdout, "a fresh Python process must repeat the exact transcript");
	const version = await runCopied(command, ["-I", "-B", "-c", "import sys; print(sys.version.split()[0])"], probeRoot, copiedCleanEnvironment);
	assert.equal(version.stderr, ""); assert.match(version.stdout, /^3\.(?:1[1-9]|[2-9][0-9])\.[0-9]+\n$/u);
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "Python observation must not alter installed files");
	return { kind: "fin-container-edge-public-python-v1"
		, observed: true, profile: "python"
		, caller: "The complete original-plus-edge public Python consumer with per-call entry instrumentation"
		, instrument: "LD_PRELOAD with runtime defining-library checks"
		, checks: 14095, measuredCalls: observations.length, observations
		, python: version.stdout.trim(), packageDirectory
		, componentId: before.model.component.id
		, columns: finContainerEdgeColumns(before.model, before.receipt.component)
		, measuredAdapters: finContainerEdgeEntries.map(name => `FinContainers.${name}`)
		, measuredSources: finContainerEdgeSourceEntries.map(name => `FinContainers.${name}`)
		, sourceFunctionsNotMeasured: finContainerEdgeEntries.filter(name => !finContainerEdgeSourceEntries.includes(name)).map(name => `FinContainers.${name}`)
		, publicSymbols: finContainerEdgeWireSymbols
		, libraryDirectory: before.directory, libraries: before.libraries
		, definitions: Object.fromEntries(Object.entries(definitions).map(([symbol, path]) => [symbol, basename(path)]))
		, moduleDigests: Object.fromEntries(modules.map(path => [path, before.receipt.files[path].sha256]))
		, ...before.identity
		, probeSha256: sha256(source), interposerSha256: sha256(instrument)
		, stdoutSha256: sha256(run.stdout), missingInstrumentRefused: true
		, installedFilesUnchanged: true, runtimeDefinitionsChecked: true
		, repeatedColdProcess: true };
};
