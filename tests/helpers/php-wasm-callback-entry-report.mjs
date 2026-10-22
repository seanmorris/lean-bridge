/**
 * Authenticate retained synchronous callback-entry PHP-Wasm evidence. Compiler
 * output supplies identities; this verifier reconstructs sources, probes and
 * independent semantic plans from the exact producer revision.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { callbackCheckedRecordReviewedIr } from "./callback-checked-record-fixture.mjs";
import {
	callbackCheckedRecordPhpWasmConfiguration, checkCallbackCheckedRecordPhpWasmModel
} from "./callback-checked-record-php-wasm-fixture.mjs";
import {
	callbackFinPhpWasmConfiguration, callbackFinPhpWasmReview
	, checkCallbackFinPhpWasmModel
} from "./callback-fin-php-wasm-fixture.mjs";
import {
	phpWasmCallbackEntryCaller, phpWasmCallbackEntryCallerPath
	, phpWasmCallbackEntryExpected, phpWasmCallbackEntryRequest
} from "./php-wasm-callback-entry-fixtures.mjs";
import { phpWasmCallbackEntryPlan } from "./php-wasm-callback-entry-plan.mjs";
import { phpWasmCallbackEntrySelection } from "./php-wasm-callback-entry-selection.mjs";
import {
	phpWasmCallbackEntryFamilies, phpWasmCallbackEntryRoutes
	, phpWasmCallbackEntrySourceDefinition, phpWasmCallbackEntrySourceFixture
} from "./php-wasm-callback-entry-source-fixtures.mjs";
import {
	instrumentPhpWasmCallbackEntries
} from "./php-wasm-callback-entry-c.mjs";
import { parsePhpWasmCallbackEntryTrace } from "./php-wasm-callback-entry-trace.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
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
const originalAt = (producerCommit, path) => execFileSync(
	"git", ["show", `${producerCommit}:${path}`], { maxBuffer: 32 * 1024 * 1024 }
);
const configurationFor = (family, route) => family === "callback-fin"
	? callbackFinPhpWasmConfiguration(route)
	: callbackCheckedRecordPhpWasmConfiguration(route);

/**
 * Parse one exact report-checker CLI selection.
 *
 * @param args - Exact family, route, producer and directory option pairs.
 */
export const parsePhpWasmCallbackEntryReportArgs = args => {
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
	assert.ok(phpWasmCallbackEntryFamilies.includes(selected.family));
	assert.ok(phpWasmCallbackEntryRoutes.includes(selected.route));
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	assert.ok(!selected.directory.startsWith("--"));
	return { family: selected.family, route: selected.route
		, producerCommit: selected.producer, directory: selected.directory };
};

/**
 * Authenticate one complete retained route and callback family.
 *
 * @param records - Closed sorted record inventory and restricted reader.
 * @param selection - Expected family, route and exact producer revision.
 */
export const checkPhpWasmCallbackEntryReport = async (records, selection) => {
	const { family, route, producerCommit } = selection;
	assert.ok(phpWasmCallbackEntryFamilies.includes(family));
	assert.ok(phpWasmCallbackEntryRoutes.includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const { paths, read } = records;
	assert.ok(Array.isArray(paths) && paths.every(safePath));
	assert.deepEqual(paths, [...new Set(paths)].sort(), "record inventory is unique and sorted");
	const bytes = async path => {
		assert.ok(paths.includes(path), `unlisted callback record ${path}`);
		const value = await read(path); assert.ok(Buffer.isBuffer(value), path); return value;
	};
	const json = async path => {
		const source = await bytes(path), value = JSON.parse(source);
		assert.equal(source.toString(), canonicalJson(value), path); return value;
	};
	const report = await json("report.json");
	exact(report, [
		"schemaVersion", "scope", "producerCommit", "family", "route", "configuration"
		, "entryPlan", "source", "observations", "receipt", "phpWasm", "observation"
		, "reproducible", "independentBuilds", "sourceRemovedBeforeInstallation"
		, "compilerFreeReplay", "offlineInstall", "relocatedInstallation"
	], "callback entry report");
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.scope, "separate-instrumented-probe");
	assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.family, family); assert.equal(report.route, route);
	for(const flag of [
		"reproducible", "sourceRemovedBeforeInstallation", "compilerFreeReplay"
		, "offlineInstall", "relocatedInstallation"
	]) assert.equal(report[flag], true, flag);
	assert.equal(report.independentBuilds, 2);
	const configuration = configurationFor(family, route);
	assert.deepEqual(report.configuration, configuration);
	assert.deepEqual(await json("configuration.json"), configuration);
	validatePackageSetReceipt(report.receipt);
	const sourceDefinition = phpWasmCallbackEntrySourceDefinition(family);
	const original = originalAt(producerCommit, sourceDefinition.path);
	const sourceProbe = await phpWasmCallbackEntrySourceFixture(family, original);
	assert.deepEqual(report.source, {
		originalSha256: sourceProbe.originalSha256
		, probeSha256: sourceProbe.probeSha256
	});
	const expectedPaths = new Set(["configuration.json", "report.json"]);
	let retainedReview = null;
	if(route === "reviewed")
	{
		expectedPaths.add("api.binding-ir.json"); retainedReview = await json("api.binding-ir.json");
	}
	const builds = [];
	for(const index of [0, 1])
	{
		const prefix = `build-${index}/`;
		for(const path of ["source-probe.json", "observation.json", "model.json", "commands.json"])
			expectedPaths.add(prefix + path);
		assert.deepEqual(await json(prefix + "source-probe.json"), sourceProbe);
		const modelBytes = await bytes(prefix + "model.json");
		const model = JSON.parse(modelBytes); assert.equal(modelBytes.toString(), canonicalJson(model));
		const review = family === "callback-fin" ? callbackFinPhpWasmReview()
			: route === "reviewed" ? retainedReview : callbackCheckedRecordReviewedIr(model.bindingIr);
		if(family === "callback-fin") checkCallbackFinPhpWasmModel(model, review, route);
		else checkCallbackCheckedRecordPhpWasmModel(model, review, route);
		assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		const selected = phpWasmCallbackEntrySelection(model, sourceProbe.entries);
		const plan = phpWasmCallbackEntryPlan(family, selected.selected);
		assert.deepEqual(report.entryPlan, plan);
		const observation = await json(prefix + "observation.json");
		exact(observation, [
			"schemaVersion", "scope", "selected", "definitionCounts"
			, "compiled", "headers", "commands", "linked", "modelSha256"
			, "component", "library", "packageSetSha256"
		], `callback build ${index} observation`);
		assert.equal(observation.schemaVersion, 1); assert.equal(observation.scope, report.scope);
		assert.equal(observation.linked, true); assert.equal(observation.modelSha256, sha256(modelBytes));
		assert.deepEqual(observation.selected, selected.selected);
		assert.deepEqual(observation.definitionCounts
			, Object.fromEntries(selected.selected.map(item => [item.symbol, 1])));
		assert.equal(observation.packageSetSha256, sha256(canonicalJson(report.receipt)));
		const commands = await json(prefix + "commands.json");
		assert.deepEqual(commands, {
			selected: observation.selected
			, definitionCounts: observation.definitionCounts
			, compiled: observation.compiled, headers: observation.headers
			, commands: observation.commands, linked: true
		});
		assert.ok(observation.compiled.length > 0);
		for(const compiled of observation.compiled)
		{
			assert.match(compiled.name, /^\d+-[A-Za-z0-9_.+-]+$/u);
			const inputPath = `${prefix}c-inputs/${compiled.name}`;
			const probePath = `${prefix}c-probes/${compiled.name}`;
			expectedPaths.add(inputPath); expectedPaths.add(probePath);
			const input = await bytes(inputPath), probe = await bytes(probePath);
			const reconstructed = instrumentPhpWasmCallbackEntries(
				input.toString(), observation.selected
			);
			assert.deepEqual(probe, Buffer.from(reconstructed.source));
			assert.equal(compiled.originalSha256, sha256(input));
			assert.equal(compiled.probeSha256, sha256(probe));
			assert.deepEqual(compiled.insertions, reconstructed.receipt.insertions);
			exact(compiled.object, ["bytes", "sha256"], "callback object identity");
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
			const reconstructed = instrumentPhpWasmCallbackEntries(
				input.toString(), observation.selected
			);
			assert.deepEqual(probe, Buffer.from(reconstructed.source));
			assert.equal(header.originalSha256, sha256(input));
			assert.equal(header.probeSha256, sha256(probe));
			assert.deepEqual(header.insertions, reconstructed.receipt.insertions);
		}
		assert.deepEqual(report.observations[index], observation);
		builds.push({ model, observation, plan });
	}
	assert.equal(report.observations.length, 2);
	assert.deepEqual(builds[1].model, builds[0].model, "independent callback models reproduce");
	for(const key of ["selected", "definitionCounts", "component", "library", "packageSetSha256"])
		assert.deepEqual(builds[1].observation[key], builds[0].observation[key], key);
	assert.deepEqual([...paths], [...expectedPaths].sort(), "closed callback record inventory");
	const { phpWasm } = report;
	exact(phpWasm, [
		"packageSet", "host", "component", "runtime", "nodeVersion", "nodeSha256"
		, "npm", "composer", "driverSha256", "offlineInstall", "emptyCaches"
		, "lockedInstall", "relocated", "publicApiOnly", "repeatExecution"
		, "unchangedDeployment", "compilerFreeExecution", "consumerSources"
		, "requests", "deployment", "executions", "browserVersion", "browserSha256"
	], "installed callback PHP-Wasm evidence");
	for(const flag of phpWasmIsolationFlags) assert.equal(phpWasm[flag], true, flag);
	digest(phpWasm.nodeSha256); digest(phpWasm.browserSha256); digest(phpWasm.driverSha256);
	assert.equal(phpWasm.component.profile, "php-wasm-copied-v1");
	assert.equal(phpWasm.component.pointerBits, 32); assert.equal(phpWasm.runtime.pointerBits, 32);
	assert.equal(phpWasm.component.modelSha256, builds[0].observation.modelSha256);
	assert.equal(phpWasm.component.bindingIrSha256, builds[0].model.bindingIrSha256);
	assert.deepEqual(phpWasm.component.wasmLibrary, builds[0].observation.library);
	assert.ok(phpWasm.packageSet && typeof phpWasm.packageSet === "object");
	assert.equal(report.receipt.profiles.length, 1);
	assert.equal(report.receipt.profiles[0].id, "php-wasm-copied-v1");
	assert.equal(report.receipt.profiles[0].bindingIrSha256, builds[0].model.bindingIrSha256);
	const authoritativePlan = builds[0].plan;
	const expected = phpWasmCallbackEntryExpected(authoritativePlan.cases);
	assert.deepEqual(report.observation, expected);
	const tuples = phpWasm.executions.map(item =>
		`${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort();
	assert.deepEqual(tuples, phpWasmExecutionTuples);
	const controls = authoritativePlan.cases.map(item => item.control);
	let retainedCases = null;
	for(const execution of phpWasm.executions)
	{
		const keys = ["realm", "arrangement", "loading", "mode", "phases", "observation", "entryProbe"];
		if(execution.realm === "chromium") keys.push("requests");
		exact(execution, keys, "installed callback execution");
		assert.deepEqual(execution.observation, expected);
		assert.deepEqual(execution.phases.map(item => item.stage)
			, ["ready", "autoload", "invalid", "complete"]);
		exact(execution.entryProbe, ["scope", "family", "controls", "cases"]
			, "callback entry execution");
		assert.equal(execution.entryProbe.scope, report.scope);
		assert.equal(execution.entryProbe.family, family);
		assert.deepEqual(execution.entryProbe.controls, controls);
		assert.equal(execution.entryProbe.cases.length, authoritativePlan.cases.length);
		for(const [index, observed] of execution.entryProbe.cases.entries())
		{
			exact(observed, ["control", "outcome", "trace", "calls"], "callback control evidence");
			const planned = authoritativePlan.cases[index];
			assert.equal(observed.control, planned.control); assert.equal(observed.outcome, planned.outcome);
			assert.deepEqual(parsePhpWasmCallbackEntryTrace(observed.trace
				, authoritativePlan.selected), planned.calls);
			assert.deepEqual(observed.calls, planned.calls);
		}
		if(retainedCases === null) retainedCases = execution.entryProbe.cases;
		else assert.deepEqual(execution.entryProbe.cases, retainedCases
			, "all installed contexts execute one callback plan");
	}
	const driver = originalAt(producerCommit
		, "tests/fixtures/php-wasm-callback-entry/driver.mjs");
	const parser = originalAt(producerCommit
		, "tests/helpers/php-wasm-callback-entry-trace.mjs");
	assert.equal(phpWasm.driverSha256, sha256(driver));
	const deployed = (path, value) => {
		exact(phpWasm.deployment[path], ["bytes", "sha256"], `callback deployment ${path}`);
		assert.deepEqual(phpWasm.deployment[path], identity(value));
	};
	deployed("driver.mjs", driver); deployed("callback-entry-trace.mjs", parser);
	const callerSource = originalAt(producerCommit, phpWasmCallbackEntryCallerPath(family));
	for(const mode of ["weak", "strict"])
	{
		const source = await phpWasmCallbackEntryCaller(family, mode, callerSource);
		assert.equal(phpWasm.consumerSources[mode], sha256(source));
		deployed(mode + ".php", Buffer.from(source));
	}
	for(const arrangement of ["embedded", "composer"])
	{
		const request = phpWasmCallbackEntryRequest(family, arrangement, authoritativePlan);
		assert.equal(phpWasm.requests[arrangement], sha256(request)
			, `${family}/${route}/${arrangement} request identity`);
		deployed(`request-${arrangement}.json`, Buffer.from(request));
	}
	return { schemaVersion: 1, family, route, producerCommit
		, records: paths.length, executions: phpWasm.executions.length
		, controls: controls.length };
};
