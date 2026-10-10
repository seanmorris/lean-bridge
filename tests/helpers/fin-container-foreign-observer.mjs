/**
 * Measure malformed foreign carriers against a selected installed package's verified native ABI.
 * This separate C caller never stands in for the package's public-language consumer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEdgeProfiles } from "./fin-container-edges.mjs";
import { finContainerEdgeEntries, finContainerEdgeInterposer, finContainerEdgeSourceEntries } from "./fin-container-edge-dispatch.mjs";
import { assertFinContainerEdgeProbeLocation, finContainerEdgeDefinitions, verifyFinContainerEdgeDeployment } from "./fin-container-edge-observer.mjs";
import { finForeignCases, finForeignClearSymbols, finForeignHeader, finForeignProbe, finForeignSymbols, readFinForeign } from "./fin-container-foreign-carriers.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };

/**
 * Extend the original definition audit with the disposal functions used by positive controls.
 *
 * @param deployment - Original receipt-verified installed model and native libraries.
 */
export const finForeignDefinitions = async deployment => {
	const definitions = await finContainerEdgeDefinitions(deployment, { publicWire: true });
	const listings = {};
	for(const name of Object.keys(deployment.libraries))
		listings[name] = (await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(deployment.directory, name)], deployment.directory, tools)).stdout;
	for(const symbol of finForeignClearSymbols)
	{
		const owners = Object.entries(listings).filter(([, text]) => text.split("\n").some(line => new RegExp(`^[0-9a-f]+ [TW] ${symbol}$`, "u").test(line.trim()))).map(([name]) => name);
		assert.equal(owners.length, 1, `${symbol} must have one verified definition`);
		definitions[symbol] = join(deployment.directory, owners[0]);
	}
	return definitions;
};

/**
 * Run structural and bound refusals, valid controls and 1,000 recovery pairs per selected entrypoint.
 *
 * @param options - The caller must authenticate receiptBytes against the original package archive.
 * @param options.installed - Verified package root after relocation.
 * @param options.receiptPath - Relative receipt path.
 * @param options.receiptBytes - Original archive receipt bytes.
 * @param options.expectedModelSha256 - Producer's model identity.
 * @param options.probeRoot - New directory outside the installed package.
 * @param options.profile - Installed package profile, not the C probe's language.
 * @param options.exactFileClosure - Whether the package layout requires exact payload closure.
 */
export const observeFinForeignCarriers = async ({ installed, receiptPath, receiptBytes, expectedModelSha256, probeRoot, profile, exactFileClosure = false }) => {
	assert.ok(finContainerEdgeProfiles.includes(profile), "Explicit installed package profile required");
	await assertFinContainerEdgeProbeLocation(installed, probeRoot);
	const options = { installed, receiptPath, receiptBytes, expectedModelSha256, exactFileClosure };
	const before = await verifyFinContainerEdgeDeployment(options);
	const definitions = await finForeignDefinitions(before);
	const selected = symbols => Object.fromEntries(symbols.map(symbol => [symbol, definitions[symbol]]));
	const header = finForeignHeader(before.model), source = await finForeignProbe(before.model, selected(finForeignSymbols));
	const instrument = finContainerEdgeInterposer(before.model, before.receipt.component, selected(before.columns));
	await mkdir(probeRoot);
	await saveLakeFile(probeRoot, "fincontainers.h", header);
	await saveLakeFile(probeRoot, "foreign.c", source);
	await saveLakeFile(probeRoot, "interposer.c", instrument);
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "libedge.so"], probeRoot, tools);
	const link = ["-L", before.directory, "-Wl,--no-as-needed", ...Object.keys(before.libraries).map(name => `-l:${name}`), `-Wl,-rpath,${before.directory}`, "-ldl"];
	await runCopied("/usr/bin/cc", [...strict, "-I.", "foreign.c", ...link, "-o", "foreign"], probeRoot, tools);
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "probe compilation must not change installed files");
	await assert.rejects(() => runCopied(join(probeRoot, "foreign"), [], probeRoot, copiedCleanEnvironment)
		, error => /exited with status 2:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === "edge interposer is not loaded\n");
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "missing instrumentation control must not change installed files");
	const run = await runCopied(join(probeRoot, "foreign"), [], probeRoot, { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1", LD_PRELOAD: join(probeRoot, "libedge.so") });
	assert.equal(run.stderr, "");
	const observations = readFinForeign(run.stdout);
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "foreign-carrier execution must not change installed files");
	for(const [name, content] of [["fincontainers.h", header], ["foreign.c", source], ["interposer.c", instrument]])
		assert.equal(await readFile(join(probeRoot, name), "utf8"), content);
	return { kind: "fin-container-foreign-carriers-v1", packageProfile: profile
		, caller: "Separate C foreign-carrier probe of receipt-verified installed native libraries; not a public-language consumer"
		, instrument: "LD_PRELOAD with runtime defining-library checks"
		, componentId: before.model.component.id, columns: before.columns
		, measuredAdapters: finContainerEdgeEntries.map(name => `FinContainers.${name}`)
		, measuredSources: finContainerEdgeSourceEntries.map(name => `FinContainers.${name}`)
		, sourceFunctionsNotMeasured: finContainerEdgeEntries.filter(name => !finContainerEdgeSourceEntries.includes(name)).map(name => `FinContainers.${name}`)
		, libraryDirectory: before.directory, libraries: before.libraries
		, definitions: Object.fromEntries(Object.entries(definitions).map(([symbol, path]) => [symbol, basename(path)]))
		, publicSymbols: finForeignSymbols
		, ...before.identity
		, bindingIr: before.model.bindingIr
		, headerOrigin: "production-generated from receipt-pinned Binding IR"
		, headerSha256: sha256(header)
		, probeSha256: sha256(source)
		, interposerSha256: sha256(instrument)
		, observed: true, observations, measuredCalls: observations.at(-1)[2]
		, cases: finForeignCases.length, recoveryPairsPerEntrypoint: 1000
		, stdoutSha256: sha256(run.stdout), missingInstrumentRefused: true
		, installedFilesUnchanged: true, runtimeDefinitionsChecked: true };
};
