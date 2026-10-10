/**
 * Check complete installed container edge reports. These checks validate reported execution;
 * generated unit fixtures are never installed acceptance evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { finContainerEdgeConsumer, finContainerEdgeProfiles, finContainerEdgeRefinements, finContainerEdgeSource } from "./fin-container-edges.mjs";
import { finContainerEdgeChecks } from "./fin-container-edge-install.mjs";
import { finContainerTargets } from "./fin-container-install.mjs";
import { finContainerEntryAdapter, finContainerEntryInitializer } from "./fin-container-entry-dispatch.mjs";
import { finContainerEdgeColumns, finContainerEdgeEntries, finContainerEdgeInterposer, finContainerEdgePublicExpected, finContainerEdgePublicSymbols, finContainerEdgeRawExpected, finContainerEdgeRawProbe, finContainerEdgeSourceEntries, finContainerEdgeWireSymbols } from "./fin-container-edge-dispatch.mjs";
import { finContainerEdgeCppExpected, finContainerEdgeCppSymbols } from "./fin-container-edge-cpp.mjs";
import { finContainerEdgePythonExpected } from "./fin-container-edge-python.mjs";
import { finContainerEdgeRustExpected } from "./fin-container-edge-rust.mjs";
import { finContainerEdgeRubyExpected } from "./fin-container-edge-ruby.mjs";
import { finContainerEdgeDotnetExpected } from "./fin-container-edge-dotnet.mjs";
import { finContainerEdgeJvmExpected } from "./fin-container-edge-jvm.mjs";
import { finContainerEdgePhpExpected } from "./fin-container-edge-php.mjs";
import { finContainerEdgeWitExpected, finContainerEdgeWitSymbols } from "./fin-container-edge-wit.mjs";
import { assertFinContainerEdgeHostReport } from "./fin-container-edge-report-hosts.mjs";

const digest = /^[a-f0-9]{64}$/u;
const flags = (value, names) => {
	for(const name of names) assert.equal(value[name], true, name);
};
const hashFields = (value, names) => {
	for(const name of names) assert.match(value[name], digest, name);
};
const absolute = path => assert.ok(typeof path === "string" && isAbsolute(path) && !path.includes("\0"));
const methods = values => values.map(name => `FinContainers.${name}`);

/** Expected public rows remain specific to the actual language, never substituted from the C raw caller. */
export const finContainerEdgeReportContracts = Object.freeze({
	c: { kind: "c", prefix: "public", rows: finContainerEdgePublicExpected, symbols: finContainerEdgePublicSymbols }
	, cpp: { kind: "cpp", prefix: "cpp", rows: finContainerEdgeCppExpected, symbols: finContainerEdgeCppSymbols }
	, python: { kind: "python", prefix: "python", rows: finContainerEdgePythonExpected, symbols: finContainerEdgeWireSymbols }
	, rust: { kind: "rust", prefix: "rust", rows: finContainerEdgeRustExpected, symbols: finContainerEdgeWireSymbols }
	, ruby: { kind: "ruby", prefix: "ruby", rows: finContainerEdgeRubyExpected, symbols: finContainerEdgeWireSymbols }
	, dotnet: { kind: "dotnet", prefix: "dotnet", rows: finContainerEdgeDotnetExpected, symbols: finContainerEdgeWireSymbols }
	, java: { kind: "jvm", prefix: "java", rows: finContainerEdgeJvmExpected, symbols: finContainerEdgeWireSymbols }
	, kotlin: { kind: "jvm", prefix: "kotlin", rows: finContainerEdgeJvmExpected, symbols: finContainerEdgeWireSymbols }
	, "php-native": { kind: "php", prefix: "php", rows: finContainerEdgePhpExpected, symbols: finContainerEdgeWireSymbols }
	, "wit-wasi": { kind: "wit", prefix: "wit", rows: finContainerEdgeWitExpected, symbols: finContainerEdgeWitSymbols }
});

/**
 * Minimal independently specified signatures for reconstructing the instrument, not compiler acceptance.
 *
 * @param componentId - Canonical fixture component identifier.
 */
export const finContainerEdgeReportModel = (componentId = "fincontainers@1.0.0") => ({
	component: { id: componentId }
	, exports: finContainerEdgeEntries.map(name => ({
		name: `FinContainers.${name}`, parameters: [{}]
		, symbol: finContainerEntryAdapter(componentId, `FinContainers.${name}`)
		, refinements: structuredClone(finContainerEdgeRefinements[`FinContainers.${name}`])
	}))
});

/**
 * Exact output digest for the whole measured public caller.
 *
 * @param profile - Explicit native profile.
 */
export const finContainerEdgeReportTranscript = profile => {
	const contract = finContainerEdgeReportContracts[profile]; assert.ok(contract);
	return contract.rows.map(([step, method, status, counts]) =>
		`edge-${contract.prefix} ${step} ${method} ${status} ${counts.join(" ")}\n`).join("")
		+ `fin-container-ok:${finContainerEdgeChecks[profile]}\n`;
};

const observationIdentity = (value, item, model, publicSymbols = []) => {
	assert.equal(value.componentId, model.component.id);
	const columns = finContainerEdgeColumns(model, model.component);
	assert.deepEqual(value.columns, columns);
	assert.deepEqual(value.measuredAdapters, methods(finContainerEdgeEntries));
	assert.deepEqual(value.measuredSources, methods(finContainerEdgeSourceEntries));
	assert.deepEqual(value.sourceFunctionsNotMeasured, methods(finContainerEdgeEntries.filter(name => !finContainerEdgeSourceEntries.includes(name))));
	absolute(value.libraryDirectory);
	assert.ok(Object.keys(value.libraries).length >= 2);
	for(const [name, hash] of Object.entries(value.libraries))
	{
		assert.match(name, /^[A-Za-z0-9_.+-]+\.so(?:\.[0-9]+)*$/u);
		assert.match(hash, digest);
	}
	const required = [...columns, "lean_bridge_native_component_initialize", finContainerEntryInitializer(model.component.id), ...publicSymbols];
	assert.deepEqual(Object.keys(value.definitions).sort(), [...required].sort());
	for(const name of Object.values(value.definitions)) assert.ok(Object.hasOwn(value.libraries, name));
	for(const [observed, original] of [
		["receiptSha256", "installedReceiptSha256"]
		, ["installedFilesSha256", "installedFilesSha256"]
		, ["modelSha256", "modelSha256"]
	]) assert.equal(value[observed], item[original], observed);
	flags(value, ["missingInstrumentRefused", "installedFilesUnchanged", "runtimeDefinitionsChecked"]);
	if(item.profile === "python")
	{
		assert.equal(Object.hasOwn(value, "exactPackageFiles"), false);
		assert.equal(Object.hasOwn(value, "packageFileSetSha256"), false);
	}
	else
	{
		assert.equal(value.exactPackageFiles, true);
		assert.equal(value.packageFileSetSha256, item.packageFileSetSha256);
	}
};

/**
 * Validate all selected hosts, their original archive identities and both kinds of measured call.
 * Probe source and host-specific runtime identities are checked by the accompanying host verifier.
 *
 * @param report - Completed canonical installed report.
 * @param profiles - Explicit, ordered selection expected from this CI job.
 * @param options - Optional exact Python floor required by this job.
 * @param options.python - Expected Python major/minor, when selected.
 */
export const assertFinContainerEdgeReport = async (report, profiles, { python } = {}) => {
	if(python !== undefined) assert.ok(["3.11", "3.12"].includes(python) && profiles.includes("python"));
	assert.ok(Array.isArray(profiles) && profiles.length > 0);
	assert.deepEqual(profiles, [...new Set(profiles)].sort());
	assert.ok(profiles.every(profile => finContainerEdgeProfiles.includes(profile)));
	assert.equal(report.schemaVersion, 1);
	assert.deepEqual(report.profiles, profiles);
	assert.equal(report.reproducible, true); assert.equal(report.authorRoots, 2);
	assert.deepEqual(report.reports.map(item => item.profile), profiles);
	const archives = {};
	const sourceSha256 = sha256(await finContainerEdgeSource()), model = finContainerEdgeReportModel();
	for(const item of report.reports)
	{
		const profile = item.profile, contract = finContainerEdgeReportContracts[profile];
		assert.equal(item.path, "ordinary-source");
		assert.equal(item.checks, finContainerEdgeChecks[profile]);
		assert.equal(item.fixtureSha256, sourceSha256);
		assert.equal(item.consumerSha256, sha256(await finContainerEdgeConsumer(profile)));
		assert.deepEqual(item.refinements, finContainerEdgeRefinements);
		flags(item, ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "installedFilesUnchanged"]);
		hashFields(item, ["sourceTreeSha256", "modelSha256", "bindingIrSha256", "receiptSha256", "installedFilesSha256", "installedReceiptSha256"]);
		if(profile === "python")
		{
			assert.equal(Object.hasOwn(item, "exactPackageFiles"), false);
			assert.equal(item.pythonBytecodePolicy, "isolated-empty-prefix");
			hashFields(item.pythonEnvironment, ["baselineSha256", "environmentSha256", "interpreterSha256"]);
			assert.equal(item.pythonEnvironment.python, item.python);
		}
		else
		{ flags(item, ["exactPackageFiles"]); hashFields(item, ["packageFileSetSha256"]); }
		assert.ok(Array.isArray(item.packages) && item.packages.length === 1);
		const pkg = item.packages[0], [target, coordinate] = finContainerTargets[profile];
		assert.equal(pkg.role, "component"); assert.equal(pkg.target, target);
		assert.equal(pkg.name, coordinate.name); assert.equal(pkg.version, coordinate.version);
		assert.ok(Array.isArray(pkg.artifacts) && pkg.artifacts.length > 0);
		const paths = new Set();
		for(const artifact of pkg.artifacts)
		{
			assert.match(artifact.path, /^(?:[A-Za-z0-9_.+-]+\/)*[A-Za-z0-9_.+-]+$/u);
			assert.ok(artifact.path.split("/").every(part => part !== "." && part !== ".."));
			assert.equal(paths.has(artifact.path), false); paths.add(artifact.path);
			assert.match(artifact.sha256, digest);
			assert.equal(report.archives[artifact.path], artifact.sha256);
			if(Object.hasOwn(archives, artifact.path)) assert.equal(archives[artifact.path], artifact.sha256);
			archives[artifact.path] = artifact.sha256;
		}
		if(profile === "python")
		{
			assert.match(item.python, /^3\.(?:11|12)\.[0-9]+$/u);
			if(python !== undefined) assert.ok(item.python.startsWith(python + "."));
		}
		assert.equal(item.dispatch.kind, "fin-container-edge-dispatch-v1");
		const raw = item.dispatch.rawAdapter, host = item.dispatch.publicHost;
		assert.equal(raw.kind, "fin-container-edge-raw-v1");
		assert.equal(raw.instrument, "LD_PRELOAD with runtime defining-library checks");
		assert.match(raw.caller, /Separate C raw-adapter probe.*not a host-language call/u);
		observationIdentity(raw, item, model);
		assert.deepEqual(raw.observed, finContainerEdgeRawExpected);
		assert.equal(raw.probeSha256, sha256(finContainerEdgeRawProbe(model, model.component)));
		const definitions = Object.fromEntries(raw.columns.map(symbol => [symbol, join(raw.libraryDirectory, raw.definitions[symbol])]));
		assert.equal(raw.interposerSha256, sha256(finContainerEdgeInterposer(model, model.component, definitions)));
		assert.equal(raw.stdoutSha256, sha256(raw.observed.map(([step, status, counts]) => `${step} ${status} ${counts.join(" ")}\n`).join("")));
		assert.equal(host.kind, `fin-container-edge-public-${contract.kind}-v1`);
		assert.match(host.caller, /^The complete original-plus-edge /u);
		assert.equal(host.observed, true); assert.equal(host.profile, profile);
		assert.equal(host.checks, item.checks); assert.equal(host.measuredCalls, contract.rows.length);
		observationIdentity(host, item, model, contract.symbols);
		assert.deepEqual(host.publicSymbols, contract.symbols);
		assert.deepEqual(host.observations, contract.rows);
		assert.deepEqual(host.libraries, raw.libraries);
		for(const [symbol, owner] of Object.entries(raw.definitions)) assert.equal(host.definitions[symbol], owner);
		if(profile !== "dotnet") assert.equal(host.libraryDirectory, raw.libraryDirectory);
		const transcriptSha256 = sha256(finContainerEdgeReportTranscript(profile));
		if(profile === "php-native")
		{
			assert.equal(item.repeatStrictExecution, true);
			assert.deepEqual(host.modes.map(mode => mode.mode), ["weak", "strict"]);
			for(const mode of host.modes)
			{
				assert.equal(mode.checks, item.checks); assert.equal(mode.measuredCalls, contract.rows.length);
				assert.equal(mode.stdoutSha256, transcriptSha256);
			}
		}
		else assert.equal(host.stdoutSha256, transcriptSha256);
		if(!["c", "cpp"].includes(profile)) flags(host, ["repeatedColdProcess"]);
		if(profile === "python") assert.equal(host.python, item.python);
		await assertFinContainerEdgeHostReport(item, model);
	}
	assert.deepEqual(report.archives, archives, "no missing, extra or relabelled archive");
};
