/**
 * Receipt-bound raw C observation of an installed host package's native libraries. The package's normal
 * host-language execution remains a separate observation. No C probe is attributed to that host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validateNativeElf, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEdgeColumns, finContainerEdgeEntries, finContainerEdgeInterposer, finContainerEdgePublicSymbols, finContainerEdgeRawProbe, finContainerEdgeSourceEntries, readFinContainerEdgeRaw } from "./fin-container-edge-dispatch.mjs";
import { finContainerEntryInitializer } from "./fin-container-entry-dispatch.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const shared = /^[A-Za-z0-9_.+-]+\.so(?:\.[0-9]+)*$/u;
const digest = /^[a-f0-9]{64}$/u;
const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };

/**
 * Refuse probes inside the installed package, including through a symlinked parent directory.
 *
 * @param installed - Existing installed package root.
 * @param probeRoot - Fresh probe directory whose parent already exists.
 */
export const assertFinContainerEdgeProbeLocation = async (installed, probeRoot) => {
	const packageRoot = await realpath(installed);
	const probeParent = await realpath(dirname(resolve(probeRoot)));
	const location = relative(packageRoot, join(probeParent, basename(resolve(probeRoot))));
	assert.ok(location.startsWith("../") || isAbsolute(location), "probe directory must be outside the installed package");
};

/**
 * Bind the installed model and the complete native library directory to the original archive receipt.
 * The caller must first authenticate receiptBytes against the verified original package archive.
 *
 * @param options - Archive identity and installed paths.
 * @param options.installed - Package root, after installation or a full-tree move.
 * @param options.receiptPath - Relative path of its receipt.
 * @param options.receiptBytes - Exact original archive member bytes, not a reconstructed receipt.
 * @param options.expectedModelSha256 - Native model digest recorded before producer deletion.
 */
export const verifyFinContainerEdgeDeployment = async ({ installed, receiptPath, receiptBytes, expectedModelSha256 }) => {
	assert.match(expectedModelSha256, digest);
	assert.equal(await realpath(installed), resolve(installed));
	assert.match(receiptPath, /^(?:[A-Za-z0-9_.+-]+\/)*[A-Za-z0-9_.+-]+\.json$/u);
	assert.ok(receiptPath.split("/").every(part => part !== "." && part !== ".."));
	const bytes = Buffer.from(receiptBytes);
	assert.deepEqual(await readFile(join(installed, receiptPath)), bytes, "receipt must equal the original archive member");
	const receipt = JSON.parse(bytes);
	assert.match(receipt.bindingIrSha256, digest);
	await verifyNativeFiles(installed, receipt.files);
	const models = Object.keys(receipt.files).filter(path => path.endsWith("/component/model.json"));
	assert.equal(models.length, 1, "one receipt-pinned native model is required");
	const modelBytes = await readFile(join(installed, models[0]));
	assert.equal(sha256(modelBytes), expectedModelSha256, "installed model must be the producer's model");
	const model = JSON.parse(modelBytes);
	assert.equal(model.bindingIrSha256, receipt.bindingIrSha256);
	const columns = finContainerEdgeColumns(model, receipt.component);
	const libraries = Object.keys(receipt.files).filter(path => shared.test(basename(path))).sort();
	assert.ok(libraries.length > 0, "receipt must name native libraries");
	assert.equal(new Set(libraries.map(dirname)).size, 1, "native libraries must share one verified directory");
	const directory = join(installed, dirname(libraries[0]));
	assert.deepEqual((await readdir(directory)).filter(name => shared.test(name)).sort(), libraries.map(path => basename(path)).sort(), "unrecorded native library in installed directory");
	for(const path of libraries) validateNativeElf(await readFile(join(installed, path)));
	return { model, receipt, columns, directory
		, libraries: Object.fromEntries(libraries.map(path => [basename(path), receipt.files[path].sha256]))
		, identity: { receiptSha256: sha256(bytes), modelSha256: expectedModelSha256
			, installedFilesSha256: sha256(canonicalJson(receipt.files)) } };
};

/**
 * Require one real dynamic definition of every counter and both initializer entrypoints.
 *
 * @param deployment - Verified installed model, columns, directory and library names.
 * @param options - Additional public C definition requirements.
 * @param options.publicC - Also authenticate the six GMP entrypoints.
 */
export const finContainerEdgeDefinitions = async (deployment, { publicC = false } = {}) => {
	assert.equal(typeof publicC, "boolean");
	const listings = {};
	for(const name of Object.keys(deployment.libraries))
		listings[name] = (await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(deployment.directory, name)], deployment.directory, tools)).stdout;
	const required = [...deployment.columns, "lean_bridge_native_component_initialize", finContainerEntryInitializer(deployment.model.component.id), ...publicC ? finContainerEdgePublicSymbols : []];
	return Object.fromEntries(required.map(symbol => {
		const owners = Object.entries(listings).filter(([, text]) => text.split("\n").some(line => new RegExp(`^[0-9a-f]+ [TW] ${symbol}$`, "u").test(line.trim()))).map(([name]) => name);
		assert.equal(owners.length, 1, `${symbol} must have exactly one verified definition`);
		return [symbol, join(deployment.directory, owners[0])];
	}));
};

/**
 * Compile a test-only probe and interposer, call the receipt-verified installed adapters, and recheck
 * every pinned file. Definitions are checked again inside the running interposer with dladdr/realpath.
 *
 * @param options - Verified archive handoff, installed root and probe toolchain.
 * @param options.installed - Installed package root.
 * @param options.receiptPath - Relative receipt path.
 * @param options.receiptBytes - Authenticated archive member bytes.
 * @param options.expectedModelSha256 - Producer model digest.
 * @param options.probeRoot - New task-owned probe directory; existing directories are refused.
 * @param options.leanPrefix - Matching pinned Lean installation, used only for the raw probe header.
 */
export const observeFinContainerEdgeRaw = async ({ installed, receiptPath, receiptBytes, expectedModelSha256, probeRoot, leanPrefix }) => {
	await assertFinContainerEdgeProbeLocation(installed, probeRoot);
	const options = { installed, receiptPath, receiptBytes, expectedModelSha256 };
	const before = await verifyFinContainerEdgeDeployment(options);
	const definitions = await finContainerEdgeDefinitions(before);
	const counted = Object.fromEntries(before.columns.map(column => [column, definitions[column]]));
	const source = finContainerEdgeRawProbe(before.model, before.receipt.component);
	const instrument = finContainerEdgeInterposer(before.model, before.receipt.component, counted);
	await mkdir(probeRoot); // Exclusive: do not rewrite an earlier measurement.
	await saveLakeFile(probeRoot, "raw.c", source);
	await saveLakeFile(probeRoot, "interposer.c", instrument);
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "libedge.so"], probeRoot, tools);
	const link = ["-L", before.directory, "-Wl,--no-as-needed", ...Object.keys(before.libraries).map(name => `-l:${name}`), `-Wl,-rpath,${before.directory}`, "-ldl"];
	await runCopied("/usr/bin/cc", [...strict, "-isystem", join(leanPrefix, "include"), "raw.c", ...link, "-o", "raw"], probeRoot, tools);
	await assert.rejects(() => runCopied(join(probeRoot, "raw"), [], probeRoot, copiedCleanEnvironment)
		, error => /exited with status 2:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === "edge interposer is not loaded\n");
	const run = await runCopied(join(probeRoot, "raw"), [], probeRoot, { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1", LD_PRELOAD: join(probeRoot, "libedge.so") });
	assert.equal(run.stderr, "");
	const observed = readFinContainerEdgeRaw(run.stdout);
	const after = await verifyFinContainerEdgeDeployment(options);
	assert.deepEqual(after, before, "instrumentation must not change receipt-pinned installed files");
	return { kind: "fin-container-edge-raw-v1"
		, caller: "Separate C raw-adapter probe of receipt-verified installed native libraries; not a host-language call"
		, instrument: "LD_PRELOAD with runtime defining-library checks"
		, componentId: before.model.component.id
		, columns: before.columns, observed
		, measuredAdapters: finContainerEdgeEntries.map(name => `FinContainers.${name}`)
		, measuredSources: finContainerEdgeSourceEntries.map(name => `FinContainers.${name}`)
		, sourceFunctionsNotMeasured: finContainerEdgeEntries.filter(name => !finContainerEdgeSourceEntries.includes(name)).map(name => `FinContainers.${name}`)
		, libraryDirectory: before.directory
		, libraries: before.libraries
		, definitions: Object.fromEntries(Object.entries(definitions).map(([symbol, path]) => [symbol, basename(path)]))
		, ...before.identity
		, probeSha256: sha256(source)
		, interposerSha256: sha256(instrument)
		, stdoutSha256: sha256(run.stdout)
		, missingInstrumentRefused: true
		, installedFilesUnchanged: true
		, runtimeDefinitionsChecked: true };
};
