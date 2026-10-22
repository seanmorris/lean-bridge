/** @file */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createNativeCallableGraphDescriptor } from "../../src/build/native-callable-graph.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	callbackFinPhpWasmConfiguration, callbackFinPhpWasmReview
} from "./callback-fin-php-wasm-fixture.mjs";
import {
	phpWasmCallbackEntryCaller, phpWasmCallbackEntryCallerPath
	, phpWasmCallbackEntryExpected, phpWasmCallbackEntryRequest
} from "./php-wasm-callback-entry-fixtures.mjs";
import { phpWasmCallbackEntryPlan } from "./php-wasm-callback-entry-plan.mjs";
import {
	checkPhpWasmCallbackEntryReport, parsePhpWasmCallbackEntryReportArgs
} from "./php-wasm-callback-entry-report.mjs";
import { phpWasmCallbackEntrySelection } from "./php-wasm-callback-entry-selection.mjs";
import {
	phpWasmCallbackEntrySourceDefinition, phpWasmCallbackEntrySourceFixture
} from "./php-wasm-callback-entry-source-fixtures.mjs";
import { instrumentPhpWasmCallbackEntries } from "./php-wasm-callback-entry-c.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";

const digest = value => sha256(Buffer.from(value));
const identity = value => {
	const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
	return { bytes: bytes.length, sha256: sha256(bytes) };
};

const fixtureModel = route => {
	const bindingIr = callbackFinPhpWasmReview();
	const copiedGraph = createNativeCallableGraphDescriptor(bindingIr);
	const exports = bindingIr.declarations.map(declaration => {
		const entry = copiedGraph.exports.find(item => item.bindingId === declaration.id);
		const refinements = declaration.source.extensions["lean-lang.org/refinements"];
		return { module: "ReviewedCallbacks", name: declaration.source.declaration
			, bindingId: declaration.id, symbol: `${entry.symbol}_lean`
			, parameters: declaration.parameters.map(() => ({ leanType: "" }))
			, ...refinements ? { refinements } : {} };
	});
	return { schemaVersion: route === "reviewed" ? 5 : 4
		, profile: "php-wasm-copied-v1", pointerBits: 32, byteOrder: "little"
		, component: bindingIr.component, bindingIr
		, bindingIrSha256: hashBindingIr(bindingIr)
		, copiedGraph, exports, types: [] };
};

const receipt = model => {
	const runtimeIdentity = digest("runtime"), profile = "php-wasm-copied-v1";
	const requirement = (ecosystem, name) => ({ ecosystem, name, version: "1.0.0" });
	const artifact = path => ({ path, bytes: 1, sha256: digest(path) });
	return { schemaVersion: 1, kind: "lean-bridge-package-set-receipt"
		, component: { id: "probe@1.0.0", name: "probe", version: "1.0.0" }
		, source: { treeSha256: digest("tree") }
		, profiles: [{ id: profile, bindingIrSha256: model.bindingIrSha256, runtimeIdentity }]
		, packages: [{ target: "php-wasm", ecosystem: "npm", name: "@probe/runtime"
			, version: "1.0.0", profile, role: "runtime", runtimeIdentity
			, runtimeDelivery: "provided", requires: []
			, artifacts: [artifact("packages/runtime.tgz")] }
		, { target: "php-wasm", ecosystem: "npm", name: "@probe/component"
			, version: "1.0.0", profile, role: "component", runtimeIdentity
			, runtimeDelivery: "dependency"
			, requires: [requirement("npm", "@probe/runtime")]
			, artifacts: [artifact("packages/component.tgz")] }
		, { target: "php-wasm", ecosystem: "composer", name: "probe/api"
			, version: "1.0.0", profile, role: "api", runtimeIdentity
			, runtimeDelivery: "dependency"
			, requires: [requirement("npm", "@probe/runtime")
				, requirement("npm", "@probe/component")]
			, artifacts: [artifact("packages/api.zip")] }] };
};

const traceOf = calls => calls.map(call => [
	`LB_CALLBACK_ENTRY_V1 begin public ${call.publicName}`
	, ...call.entries.map(entry => `LB_CALLBACK_ENTRY_V1 enter ${entry.kind} ${entry.label}`)
	, `LB_CALLBACK_ENTRY_V1 end public ${call.publicName}`
].join("\n") + "\n").join("");

const makeRecords = async (route = "ordinary") => {
	const family = "callback-fin";
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const definition = phpWasmCallbackEntrySourceDefinition(family);
	const original = execFileSync("git", ["show", `${producerCommit}:${definition.path}`]);
	const sourceProbe = await phpWasmCallbackEntrySourceFixture(family, original);
	const model = fixtureModel(route), modelBytes = Buffer.from(canonicalJson(model));
	const selection = phpWasmCallbackEntrySelection(model, sourceProbe.entries);
	const plan = phpWasmCallbackEntryPlan(family, selection.selected);
	const cInput = selection.selected.map(item => item.kind === "public"
		? `static ZEND_FUNCTION(${item.symbol}) { RETURN_NULL(); }`
		: `lean_object *${item.symbol}(lean_object *value) { return value; }`).join("\n") + "\n";
	const instrumented = instrumentPhpWasmCallbackEntries(cInput, selection.selected);
	const library = identity("callback-probe-wasm");
	const packageReceipt = receipt(model);
	const packageSetSha256 = sha256(canonicalJson(packageReceipt));
	const files = new Map();
	const save = (path, value) => files.set(path, Buffer.isBuffer(value) ? value : Buffer.from(value));
	const observations = [];
	for(const index of [0, 1])
	{
		const root = `/temporary/callback-build-${index}`;
		const compiled = [{
			name: "1-callback.c", originalPath: `${root}/callback.c`
			, probePath: `${root}/records/c-probes/1-callback.c`
			, objectPath: `${root}/callback.o`
			, ...instrumented.receipt
			, object: identity("object")
		}];
		const commands = [{ command: "/tool/emcc"
			, originalArgs: ["-c", `${root}/callback.c`, "-o", `${root}/callback.o`]
			, probeArgs: ["-c", compiled[0].probePath, "-o", `${root}/callback.o`] }
		, { command: "/tool/emcc"
			, originalArgs: ["-sSIDE_MODULE=2", `${root}/callback.o`]
			, probeArgs: ["-sSIDE_MODULE=2", `${root}/callback.o`] }];
		const observation = { schemaVersion: 1, scope: "separate-instrumented-probe"
			, selected: selection.selected
			, definitionCounts: Object.fromEntries(selection.selected
				.map(item => [item.symbol, 1]))
			, compiled, headers: [], commands, linked: true
			, modelSha256: sha256(modelBytes)
			, component: { id: "component", wasmLibrary: library }
			, library, packageSetSha256 };
		const prefix = `build-${index}/`;
		save(prefix + "source-probe.json", canonicalJson(sourceProbe));
		save(prefix + "model.json", modelBytes);
		save(prefix + "observation.json", canonicalJson(observation));
		save(prefix + "commands.json", canonicalJson({ selected: observation.selected
			, definitionCounts: observation.definitionCounts, compiled, headers: []
			, commands, linked: true }));
		save(prefix + "c-inputs/1-callback.c", cInput);
		save(prefix + "c-probes/1-callback.c", instrumented.source);
		observations.push(observation);
	}
	const expected = phpWasmCallbackEntryExpected(plan.cases);
	const cases = plan.cases.map(item => ({
		control: item.control, outcome: item.outcome
		, trace: traceOf(item.calls), calls: item.calls
	}));
	const executions = phpWasmExecutionTuples.map(tuple => {
		const [realm, arrangement, loading, mode] = tuple.split("/");
		return {
			realm, arrangement, loading, mode
			, phases: ["ready", "autoload", "invalid", "complete"].map(stage => ({
				stage, libraries: stage === "complete" ? ["component.so"] : []
			}))
			, observation: expected
			, entryProbe: { scope: plan.scope, family
				, controls: plan.cases.map(item => item.control), cases }
			, ...realm === "chromium" ? { requests: [] } : {}
		};
	});
	const driver = execFileSync("git", ["show"
		, `${producerCommit}:tests/fixtures/php-wasm-callback-entry/driver.mjs`]);
	const parser = execFileSync("git", ["show"
		, `${producerCommit}:tests/helpers/php-wasm-callback-entry-trace.mjs`]);
	const deployment = { "driver.mjs": identity(driver)
		, "callback-entry-trace.mjs": identity(parser) };
	const caller = execFileSync("git", ["show"
		, `${producerCommit}:${phpWasmCallbackEntryCallerPath(family)}`]);
	const consumerSources = {}, requests = {};
	for(const mode of ["weak", "strict"])
	{
		const source = await phpWasmCallbackEntryCaller(family, mode, caller);
		consumerSources[mode] = sha256(source); deployment[mode + ".php"] = identity(source);
	}
	for(const arrangement of ["embedded", "composer"])
	{
		const request = phpWasmCallbackEntryRequest(family, arrangement, plan);
		requests[arrangement] = sha256(request);
		deployment[`request-${arrangement}.json`] = identity(request);
	}
	const component = {
		profile: "php-wasm-copied-v1", pointerBits: 32
		, modelSha256: observations[0].modelSha256
		, bindingIrSha256: model.bindingIrSha256, wasmLibrary: library
	};
	const phpWasm = {
		packageSet: {}, host: {}, component, runtime: { pointerBits: 32 }
		, nodeVersion: "v22.0.0", nodeSha256: digest("node"), npm: {}, composer: {}
		, driverSha256: sha256(driver), offlineInstall: true, emptyCaches: true
		, lockedInstall: true, relocated: true
		, publicApiOnly: true, repeatExecution: true
		, unchangedDeployment: true, compilerFreeExecution: true
		, consumerSources, requests, deployment, executions
		, browserVersion: "1.2.3.4", browserSha256: digest("browser")
	};
	const report = {
		schemaVersion: 1, scope: plan.scope, producerCommit, family, route
		, configuration: callbackFinPhpWasmConfiguration(route), entryPlan: plan
		, source: { originalSha256: sourceProbe.originalSha256
			, probeSha256: sourceProbe.probeSha256 }
		, observations, receipt: packageReceipt, phpWasm, observation: expected
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true
		, compilerFreeReplay: true, offlineInstall: true, relocatedInstallation: true
	};
	save("configuration.json", canonicalJson(report.configuration));
	if(route === "reviewed") save("api.binding-ir.json", canonicalJson(callbackFinPhpWasmReview()));
	save("report.json", canonicalJson(report));
	return {
		files
		, records: () => ({ paths: [...files.keys()].sort()
			, read: path => Promise.resolve(files.get(path)) })
		, options: { family, route, producerCommit }
	};
};

const mutateJson = (files, path, change) => {
	const value = JSON.parse(files.get(path)); change(value);
	files.set(path, Buffer.from(canonicalJson(value)));
};

test("callback-entry report CLI requires one closed route selection", () => {
	const producer = "a".repeat(40), args = ["--family", "callback-fin"
		, "--route", "ordinary", "--producer", producer, "--directory", "records"];
	assert.deepEqual(parsePhpWasmCallbackEntryReportArgs(args), { family: "callback-fin"
		, route: "ordinary", producerCommit: producer, directory: "records" });
	for(const changed of [args.slice(2), [...args, "--other", "x"]
		, args.map(value => value === producer ? "HEAD" : value)
		, args.map(value => value === "ordinary" ? "unknown" : value)
		, args.map(value => value === "records" ? "bad\npath" : value)])
		assert.throws(() => parsePhpWasmCallbackEntryReportArgs(changed));
});

test("callback-entry report reconstructs every source, C probe and installed trace", async () => {
	for(const route of ["ordinary", "reviewed"])
	{
		const fixture = await makeRecords(route);
		const checked = await checkPhpWasmCallbackEntryReport(fixture.records(), fixture.options);
		assert.deepEqual([checked.family, checked.route, checked.executions]
			, ["callback-fin", route, 12]);
		assert.ok(checked.records > 10); assert.ok(checked.controls > 5);
	}
});

test("callback-entry report refuses substituted claims and incomplete records", async t => {
	const mutations = [
		files => mutateJson(files, "report.json", value => { value.producerCommit = "0".repeat(40); })
		, files => mutateJson(files, "report.json", value => { value.reproducible = false; })
		, files => mutateJson(files, "report.json", value => { value.entryPlan.cases[0].calls[0].entries.pop(); })
		, files => mutateJson(files, "report.json", value => { value.phpWasm.executions.pop(); })
		, files => mutateJson(files, "report.json", value => {
			value.phpWasm.executions[0].entryProbe.cases[0].trace += "unexpected\n";
		})
		, files => mutateJson(files, "report.json", value => {
			value.phpWasm.executions[0].entryProbe.controls.reverse();
		})
		, files => mutateJson(files, "report.json", value => {
			value.phpWasm.executions[0].observation.controls++;
		})
		, files => mutateJson(files, "report.json", value => {
			value.phpWasm.consumerSources.weak = "0".repeat(64);
		})
		, files => mutateJson(files, "report.json", value => {
			value.phpWasm.driverSha256 = "0".repeat(64);
		})
		, files => mutateJson(files, "report.json", value => {
			value.receipt.source.treeSha256 = "0".repeat(64);
		})
		, files => mutateJson(files, "build-0/source-probe.json", value => {
			value.probeSha256 = "0".repeat(64);
		})
		, files => mutateJson(files, "build-0/model.json", value => { value.pointerBits = 64; })
		, files => mutateJson(files, "build-0/observation.json", value => {
			value.definitionCounts[Object.keys(value.definitionCounts)[0]] = 0;
		})
		, files => files.set("build-0/c-probes/1-callback.c", Buffer.from("changed"))
		, files => files.delete("build-1/c-inputs/1-callback.c")
		, files => files.set("invented.json", Buffer.from("{}\n"))
	];
	for(const mutate of mutations)
	{
		const fixture = await makeRecords(); mutate(fixture.files);
		await assert.rejects(checkPhpWasmCallbackEntryReport(fixture.records(), fixture.options));
	}
	t.diagnostic(`${mutations.length} substituted or incomplete callback controls`);
});
