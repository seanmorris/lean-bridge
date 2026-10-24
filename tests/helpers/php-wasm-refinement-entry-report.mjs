/**
 * Authenticate retained installed call traces for copied PHP-Wasm entry probes.
 * Compiler output supplies marker identities; the verifier
 * independently reconstructs the call plan and replays every retained trace.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	phpWasmRefinementEntryCaller, phpWasmRefinementEntryExpected
	, phpWasmRefinementEntryRequest
} from "./php-wasm-refinement-entry-callers.mjs";
import { phpWasmRefinementEntryPlan } from "./php-wasm-refinement-entry-plan.mjs";
import { phpWasmRefinementEntrySelection } from "./php-wasm-refinement-entry-selection.mjs";
import { phpWasmRefinementEntrySource } from "./php-wasm-refinement-entry-source.mjs";
import {
	phpWasmRefinementEntryRoutes, phpWasmRefinementEntrySourceFamilies
	, phpWasmRefinementEntrySourceFixture
} from "./php-wasm-refinement-entry-source-fixtures.mjs";
import {
	phpWasmOwnedRefinementEntryCaller, phpWasmOwnedRefinementEntryExpected
	, phpWasmOwnedRefinementEntryFamilies, phpWasmOwnedRefinementEntryRequest
	, phpWasmOwnedRefinementEntryRoutes
} from "./php-wasm-owned-refinement-entry-fixtures.mjs";
import { phpWasmOwnedRefinementEntryPlan } from "./php-wasm-owned-refinement-entry-plan.mjs";
import { phpWasmOwnedRefinementEntrySelection } from "./php-wasm-owned-refinement-entry-selection.mjs";
import {
	phpWasmOwnedRefinementEntrySourceDefinition
} from "./php-wasm-owned-refinement-entry-source-fixtures.mjs";
import { phpWasmReducedArityTargets } from "./php-wasm-entry-call-targets.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import { instrumentSubtypeCEntries } from "./php-wasm-subtype-entry-c.mjs";
import { parseSubtypeEntryTrace } from "./php-wasm-subtype-entry-trace.mjs";
import { phpWasmIsolationFlags } from "./type-corpus-php-wasm-evidence.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const exact = (value, keys, label) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value), label);
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} fields`);
};
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const safePath = path => typeof path === "string" && path.length > 0
	&& !path.startsWith("/") && !path.includes("\\") && !/[\0\r\n]/u.test(path)
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const allFamilies = [...phpWasmRefinementEntrySourceFamilies, ...phpWasmOwnedRefinementEntryFamilies];
const ownedFamily = family => phpWasmOwnedRefinementEntryFamilies.includes(family);
assert.deepEqual(phpWasmOwnedRefinementEntryRoutes, phpWasmRefinementEntryRoutes);
const sourceDefinition = family => ownedFamily(family)
	? phpWasmOwnedRefinementEntrySourceDefinition(family)
	: phpWasmRefinementEntrySourceFixture(family);
const selectEntries = (family, model, sourceEntries) => ownedFamily(family)
	? phpWasmOwnedRefinementEntrySelection(model, sourceEntries)
	: phpWasmRefinementEntrySelection(model, sourceEntries);
const planEntries = (family, selection, classifications) => ownedFamily(family)
	? phpWasmOwnedRefinementEntryPlan(family, selection.selected, selection.adapters.leanSource, classifications)
	: phpWasmRefinementEntryPlan(family, selection.selected, selection.generated.leanSource, classifications);
const caller = (family, mode) => ownedFamily(family)
	? phpWasmOwnedRefinementEntryCaller(family, mode)
	: phpWasmRefinementEntryCaller(family, mode);
const expectedObservation = (family, cases) => ownedFamily(family)
	? phpWasmOwnedRefinementEntryExpected(family, cases)
	: phpWasmRefinementEntryExpected(family, cases);
const requestFor = (family, arrangement, plan) => ownedFamily(family)
	? phpWasmOwnedRefinementEntryRequest(family, arrangement, plan)
	: phpWasmRefinementEntryRequest(family, arrangement, plan);

/**
 * Parse the closed report-checker CLI selection.
 *
 * @param args - Exact --family, --route, --producer and --directory pairs.
 */
export const parsePhpWasmRefinementEntryReportArgs = args => {
	assert.ok(Array.isArray(args) && args.length === 8);
	const selected = {};
	for(let index = 0; index < args.length; index += 2)
	{
		const option = args[index], value = args[index + 1];
		assert.ok(["--family", "--route", "--producer", "--directory"].includes(option));
		assert.ok(typeof value === "string" && value.length > 0 && !/[\0\r\n]/u.test(value));
		const key = option.slice(2); assert.ok(!Object.hasOwn(selected, key)); selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), ["directory", "family", "producer", "route"]);
	assert.ok(allFamilies.includes(selected.family));
	assert.ok(phpWasmRefinementEntryRoutes.includes(selected.route));
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	assert.ok(!selected.directory.startsWith("--"));
	return {
		family: selected.family, route: selected.route
		, producerCommit: selected.producer, directory: selected.directory
	};
};

/**
 * Authenticate one complete route/family record directory.
 *
 * @param records - Closed retained record inventory and byte reader.
 * @param records.paths - Complete sorted regular-file inventory.
 * @param records.read - Reader restricted to an inventory-relative path.
 * @param selection - Immutable producer and matrix selection.
 * @param selection.family - One nominal or recursive graph family.
 * @param selection.route - Ordinary or independently reviewed source route.
 * @param selection.producerCommit - Full package-producing Git revision.
 */
export const checkPhpWasmRefinementEntryReport = async (records, {
	family, route, producerCommit
}) => {
	assert.ok(allFamilies.includes(family));
	assert.ok(phpWasmRefinementEntryRoutes.includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const { paths, read } = records;
	assert.ok(Array.isArray(paths) && paths.every(safePath));
	assert.deepEqual(paths, [...new Set(paths)].sort(), "record inventory is unique and sorted");
	const bytes = async path => {
		assert.ok(paths.includes(path), `unlisted record ${path}`);
		const value = await read(path); assert.ok(Buffer.isBuffer(value), path); return value;
	};
	const json = async path => {
		const source = await bytes(path), value = JSON.parse(source);
		assert.equal(source.toString(), canonicalJson(value), path); return value;
	};
	const report = await json("report.json"), summary = await json("summary.json");
	exact(report, [
		"schemaVersion", "scope", "producerCommit", "family", "route", "entryPlan"
		, "phpWasm", "observation", "reproducible", "independentBuilds"
		, "sourceRemovedBeforeInstallation", "compilerFreeReplay"
		, "offlineInstall", "relocatedInstallation"
	], "entry report");
	exact(summary, [
		"schemaVersion", "scope", "producerCommit", "family", "route"
		, "source", "receipt", "observations"
	], "entry summary");
	for(const value of [report, summary])
	{
		assert.equal(value.schemaVersion, 1); assert.equal(value.scope, "separate-instrumented-probe");
		assert.equal(value.producerCommit, producerCommit); assert.equal(value.family, family);
		assert.equal(value.route, route);
	}
	for(const flag of [
		"reproducible", "sourceRemovedBeforeInstallation", "compilerFreeReplay"
		, "offlineInstall", "relocatedInstallation"
	]) assert.equal(report[flag], true, flag);
	assert.equal(report.independentBuilds, 2);
	validatePackageSetReceipt(summary.receipt);
	const marker = sourceDefinition(family);
	const original = execFileSync("git", ["show", `${producerCommit}:${marker.path}`], {
		maxBuffer: 16 * 1024 * 1024
	}).toString();
	const sourceProbe = phpWasmRefinementEntrySource(original, marker);
	assert.deepEqual(summary.source, {
		originalSha256: sourceProbe.originalSha256
		, probeSha256: sourceProbe.probeSha256
	});
	const expectedPaths = new Set(["report.json", "summary.json"]), builds = [];
	for(const index of [0, 1])
	{
		const prefix = `build-${index}/`;
		for(const path of ["source-probe.json", "observation.json", "model.json", "commands.json"])
			expectedPaths.add(prefix + path);
		assert.deepEqual(await json(prefix + "source-probe.json"), sourceProbe);
		const modelBytes = await bytes(prefix + "model.json");
		const model = JSON.parse(modelBytes); assert.equal(modelBytes.toString(), canonicalJson(model));
		const observation = await json(prefix + "observation.json");
		exact(observation, [
			"schemaVersion"
			, "scope"
			, "selected"
			, "definitionCounts"
			, "compiled"
			, "headers"
			, "commands", "linked", "modelSha256", "component", "library"
			, "packageSetSha256"
			, ...Object.hasOwn(observation, "globalDefinitions") ? ["globalDefinitions"] : []
		], `build ${index} observation`);
		assert.equal(observation.schemaVersion, 1);
		assert.equal(observation.scope, report.scope); assert.equal(observation.linked, true);
		assert.equal(observation.modelSha256, sha256(modelBytes));
		const selected = selectEntries(family, model, sourceProbe.entries);
		assert.deepEqual(observation.selected, selected.selected);
		assert.deepEqual(observation.definitionCounts
			, Object.fromEntries(selected.selected.map(item => [item.symbol, 1])));
		const commands = await json(prefix + "commands.json");
		assert.deepEqual(commands, {
			selected: observation.selected
			, definitionCounts: observation.definitionCounts
			, compiled: observation.compiled, headers: observation.headers
			, commands: observation.commands, linked: true
			, ...Object.hasOwn(observation, "globalDefinitions") ? { globalDefinitions: observation.globalDefinitions } : {}
		});
		assert.ok(observation.compiled.length > 0);
		assert.equal(new Set(observation.compiled.map(item => item.name)).size
			, observation.compiled.length);
		const inputs = [], forms = new Map(observation.selected.map(item => [item.symbol, []]));
		for(const compiled of observation.compiled)
		{
			assert.match(compiled.name, /^\d+-[A-Za-z0-9_.+-]+$/u);
			const inputPath = `${prefix}c-inputs/${compiled.name}`;
			const probePath = `${prefix}c-probes/${compiled.name}`;
			expectedPaths.add(inputPath); expectedPaths.add(probePath);
			const input = await bytes(inputPath), probe = await bytes(probePath);
			const reconstructed = instrumentSubtypeCEntries(input.toString(), observation.selected);
			assert.deepEqual(probe, Buffer.from(reconstructed.source));
			assert.equal(compiled.originalSha256, sha256(input));
			assert.equal(compiled.probeSha256, sha256(probe));
			assert.deepEqual(compiled.insertions, reconstructed.receipt.insertions);
			assert.deepEqual(compiled.definitions, reconstructed.receipt.definitions);
			for(const item of reconstructed.receipt.definitions) forms.get(item.symbol).push(item.form);
			inputs.push({ name: compiled.name, text: input.toString() });
			exact(compiled.object, ["bytes", "sha256"], "compiled object identity");
			assert.ok(Number.isSafeInteger(compiled.object.bytes) && compiled.object.bytes > 0);
			digest(compiled.object.sha256);
		}
		for(const header of observation.headers)
		{
			assert.ok(safePath(header.path));
			const inputPath = `${prefix}header-inputs/${header.path}`;
			const probePath = `${prefix}header-probes/${header.path}`;
			expectedPaths.add(inputPath); expectedPaths.add(probePath);
			const input = await bytes(inputPath), probe = await bytes(probePath);
			const reconstructed = instrumentSubtypeCEntries(input.toString(), observation.selected);
			assert.deepEqual(probe, Buffer.from(reconstructed.source));
			assert.equal(header.originalSha256, sha256(input));
			assert.equal(header.probeSha256, sha256(probe));
			assert.deepEqual(header.insertions, reconstructed.receipt.insertions);
			assert.deepEqual(header.definitions, reconstructed.receipt.definitions);
			for(const item of reconstructed.receipt.definitions) forms.get(item.symbol).push(item.form);
		}
		// Retained compiler inputs, not the trace, decide which entries cannot carry markers.
		for(const [symbol, values] of forms) assert.equal(values.length, 1, `${symbol}: one retained compiled definition`);
		const globalDefinitions = observation.selected.filter(item => forms.get(item.symbol)[0] === "global");
		assert.deepEqual(observation.globalDefinitions ?? [], globalDefinitions);
		assert.equal(Object.hasOwn(observation, "globalDefinitions"), globalDefinitions.length > 0);
		assert.deepEqual(globalDefinitions, sourceProbe.entries
			.filter(item => sourceProbe.entryForms[item.symbol] === "global"));
		const classifications = {
			globalDefinitions
			, reducedArity: phpWasmReducedArityTargets(inputs, observation.selected, { globalDefinitions })
		};
		const plan = planEntries(family, selected, classifications);
		assert.deepEqual(report.entryPlan, plan);
		assert.deepEqual(summary.observations[index], observation);
		assert.equal(observation.packageSetSha256, sha256(canonicalJson(summary.receipt)));
		builds.push({ model, observation, plan });
	}
	assert.equal(summary.observations.length, 2);
	assert.deepEqual(builds[1].model, builds[0].model, "independent models reproduce");
	for(const key of ["selected", "definitionCounts", "component", "library", "packageSetSha256"])
		assert.deepEqual(builds[1].observation[key], builds[0].observation[key], key);
	assert.deepEqual([...paths], [...expectedPaths].sort(), "closed record inventory");
	const { phpWasm } = report;
	exact(phpWasm, [
		"packageSet", "host", "component", "runtime", "nodeVersion", "nodeSha256"
		, "npm", "composer", "driverSha256", "offlineInstall", "emptyCaches"
		, "lockedInstall", "relocated", "publicApiOnly", "repeatExecution"
		, "unchangedDeployment", "compilerFreeExecution", "consumerSources"
		, "requests", "deployment", "executions", "browserVersion", "browserSha256"
	], "installed PHP-Wasm evidence");
	for(const flag of phpWasmIsolationFlags) assert.equal(phpWasm[flag], true, flag);
	digest(phpWasm.nodeSha256); digest(phpWasm.browserSha256); digest(phpWasm.driverSha256);
	assert.equal(phpWasm.component.profile, "php-wasm-copied-v1");
	assert.equal(phpWasm.component.pointerBits, 32); assert.equal(phpWasm.runtime.pointerBits, 32);
	assert.equal(phpWasm.component.modelSha256, builds[0].observation.modelSha256);
	assert.equal(phpWasm.component.bindingIrSha256, builds[0].model.bindingIrSha256);
	assert.deepEqual(phpWasm.component.wasmLibrary, builds[0].observation.library);
	assert.equal(summary.receipt.profiles.length, 1);
	assert.equal(summary.receipt.profiles[0].id, "php-wasm-copied-v1");
	assert.equal(summary.receipt.profiles[0].bindingIrSha256, builds[0].model.bindingIrSha256);
	const expected = expectedObservation(family, report.entryPlan.cases);
	assert.deepEqual(report.observation, expected);
	const tuples = phpWasm.executions.map(item =>
		`${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort();
	assert.deepEqual(tuples, phpWasmExecutionTuples);
	const controls = report.entryPlan.cases.map(item => item.control);
	const calls = report.entryPlan.cases.map(item => item.call);
	const totals = Object.fromEntries(["validator", "constructor", "adapter", "source"].map(kind => [
		kind, calls.reduce((sum, item) => sum + item.counts[kind], 0)
	]));
	let trace;
	for(const execution of phpWasm.executions)
	{
		const keys = ["realm", "arrangement", "loading", "mode", "phases", "observation", "entryProbe"];
		if(execution.realm === "chromium") keys.push("requests");
		exact(execution, keys, "installed execution");
		assert.deepEqual(execution.observation, expected);
		assert.deepEqual(execution.phases.map(item => item.stage)
			, ["ready", "autoload", "invalid", "complete"]);
		exact(execution.entryProbe, [
			"scope", "family", "trace", "calls", "controls", "counts"
		], "entry probe execution");
		assert.equal(execution.entryProbe.scope, report.scope);
		assert.equal(execution.entryProbe.family, family);
		assert.deepEqual(parseSubtypeEntryTrace(execution.entryProbe.trace
			, report.entryPlan.selected), calls);
		assert.equal(execution.entryProbe.calls, calls.length);
		assert.deepEqual(execution.entryProbe.controls, controls);
		assert.deepEqual(execution.entryProbe.counts, totals);
		if(trace === undefined) trace = execution.entryProbe.trace;
		else assert.equal(execution.entryProbe.trace, trace, "all installed routes execute one plan");
	}
	const driver = await readFile(new URL("../fixtures/php-wasm-refinement-entry/driver.mjs", import.meta.url));
	const traceParser = await readFile(new URL("php-wasm-subtype-entry-trace.mjs", import.meta.url));
	assert.equal(phpWasm.driverSha256, sha256(driver));
	const deployed = (path, value) => {
		exact(phpWasm.deployment[path], ["bytes", "sha256"], `deployment ${path}`);
		assert.deepEqual(phpWasm.deployment[path], identity(value));
	};
	deployed("driver.mjs", driver); deployed("entry-trace.mjs", traceParser);
	for(const mode of ["weak", "strict"])
	{
		const source = await caller(family, mode);
		assert.equal(phpWasm.consumerSources[mode], sha256(source));
		deployed(mode + ".php", Buffer.from(source));
	}
	for(const arrangement of ["embedded", "composer"])
	{
		const request = requestFor(family, arrangement, report.entryPlan);
		assert.equal(phpWasm.requests[arrangement], sha256(request));
		deployed(`request-${arrangement}.json`, Buffer.from(request));
	}
	return {
		schemaVersion: 1, family, route, producerCommit
		, records: paths.length, executions: phpWasm.executions.length
		, calls: calls.length, counts: totals
	};
};
