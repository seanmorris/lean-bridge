/**
 * Adversarial controls for retained installed graph-entry evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { componentRecordDefinitions } from "../../src/abi/component-records.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	nominalPrimitiveSubtypePhpWasmReview
} from "./nominal-primitive-subtype-php-wasm-fixture.mjs";
import {
	recursiveCheckedRecordPhpWasmReview
} from "./recursive-checked-record-php-wasm-fixture.mjs";
import {
	phpWasmRefinementEntryCaller, phpWasmRefinementEntryExpected
	, phpWasmRefinementEntryRequest
} from "./php-wasm-refinement-entry-callers.mjs";
import { phpWasmRefinementEntryPlan } from "./php-wasm-refinement-entry-plan.mjs";
import {
	checkPhpWasmRefinementEntryReport, parsePhpWasmRefinementEntryReportArgs
} from "./php-wasm-refinement-entry-report.mjs";
import { phpWasmGraphRefinementEntrySelection } from "./php-wasm-refinement-entry-selection.mjs";
import { phpWasmRefinementEntrySource } from "./php-wasm-refinement-entry-source.mjs";
import { phpWasmRefinementEntrySourceFixture } from "./php-wasm-refinement-entry-source-fixtures.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import { instrumentSubtypeCEntries } from "./php-wasm-subtype-entry-c.mjs";
import { recursiveSubtypeReview } from "./recursive-subtype-fixture.mjs";

const digest = value => sha256(Buffer.from(value));
const identity = value => ({ bytes: Buffer.byteLength(value), sha256: digest(value) });

const fixtureModel = family => {
	const nominal = family.startsWith("nominal-");
	const bindingIr = nominal
		? nominalPrimitiveSubtypePhpWasmReview(family === "nominal-result-only" ? "result-only" : "full")
		: family === "recursive-subtype" ? recursiveSubtypeReview()
			: recursiveCheckedRecordPhpWasmReview("recursive");
	const module = nominal ? "NominalPrimitiveSubtypes"
		: family === "recursive-subtype" ? "RecursiveSubtypes" : "RecursiveCheckedRecords";
	const component = bindingIr.component;
	const exports = bindingIr.declarations.map(item => ({
		bindingId: item.id
		, symbol: `lean_bridge_${sha256(component.id + "\0" + item.id).slice(0, 24)}`
		, parameters: item.parameters.map(site => site.type)
		, result: item.result.type, resultMode: item.resultMode
	}));
	return {
		schemaVersion: 5, profile: "php-wasm-copied-v1", pointerBits: 32
		, byteOrder: "little", component, bindingIr
		, bindingIrSha256: hashBindingIr(bindingIr)
		, copiedGraph: { schemaVersion: 1
			, types: componentRecordDefinitions(bindingIr, true), exports }
		, exports: bindingIr.declarations.map((declaration, index) => ({
			bindingId: declaration.id, symbol: `${exports[index].symbol}_lean`
			, name: declaration.source.declaration, module
			, parameters: declaration.parameters.map(() => ({}))
			, ...declaration.source.extensions["lean-lang.org/refinements"] ? {
				refinements: declaration.source.extensions["lean-lang.org/refinements"]
			} : {}
		}))
	};
};

const receipt = model => {
	const runtimeIdentity = digest("runtime"), profile = "php-wasm-copied-v1";
	const requirement = (ecosystem, name) => ({ ecosystem, name, version: "1.0.0" });
	const artifact = path => ({ path, bytes: 1, sha256: digest(path) });
	return {
		schemaVersion: 1, kind: "lean-bridge-package-set-receipt"
		, component: { id: "probe@1.0.0", name: "probe", version: "1.0.0" }
		, source: { treeSha256: digest("tree") }
		, profiles: [{ id: profile, bindingIrSha256: model.bindingIrSha256, runtimeIdentity }]
		, packages: [{
			target: "php-wasm", ecosystem: "npm"
			, name: "@probe/runtime", version: "1.0.0"
			, profile, role: "runtime", runtimeIdentity, runtimeDelivery: "provided"
			, requires: [], artifacts: [artifact("packages/runtime.tgz")]
		}
		, {
			target: "php-wasm", ecosystem: "npm"
			, name: "@probe/component", version: "1.0.0"
			, profile, role: "component", runtimeIdentity, runtimeDelivery: "dependency"
			, requires: [requirement("npm", "@probe/runtime")]
			, artifacts: [artifact("packages/component.tgz")]
		}
		, {
			target: "php-wasm", ecosystem: "composer"
			, name: "probe/api", version: "1.0.0"
			, profile, role: "api", runtimeIdentity, runtimeDelivery: "dependency"
			, requires: [
				requirement("npm", "@probe/runtime"), requirement("npm", "@probe/component")
			]
			, artifacts: [artifact("packages/api.zip")]
		}]
	};
};

const traceOf = plan => plan.cases.map(item => [
	`LB_SUBTYPE_ENTRY_V1 begin public ${item.call.publicName}`
	, ...item.call.entries.map(entry => `LB_SUBTYPE_ENTRY_V1 enter ${entry.kind} ${entry.label}`)
	, `LB_SUBTYPE_ENTRY_V1 end public ${item.call.publicName}`
].join("\n") + "\n").join("");

const makeRecords = async (family = "recursive-subtype", route = "ordinary") => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const marker = phpWasmRefinementEntrySourceFixture(family);
	const original = execFileSync("git", ["show", `${producerCommit}:${marker.path}`]
		, { encoding: "utf8" });
	const sourceProbe = phpWasmRefinementEntrySource(original, marker);
	const model = fixtureModel(family);
	const selection = phpWasmGraphRefinementEntrySelection(model, sourceProbe.entries);
	const plan = phpWasmRefinementEntryPlan(family, selection.selected, selection.generated.leanSource);
	const cInput = selection.selected.map(item => item.kind === "public"
		? `static ZEND_FUNCTION(${item.symbol}) { RETURN_NULL(); }`
		: `lean_object *${item.symbol}(lean_object *value) { return value; }`).join("\n") + "\n";
	const instrumented = instrumentSubtypeCEntries(cInput, selection.selected);
	const library = identity("probe-wasm"), modelBytes = Buffer.from(canonicalJson(model));
	const packageReceipt = receipt(model), packageSetSha256 = sha256(canonicalJson(packageReceipt));
	const files = new Map();
	const save = (path, value) => files.set(path, Buffer.isBuffer(value) ? value : Buffer.from(value));
	const observations = [];
	for(const index of [0, 1])
	{
		const root = `/temporary/build-${index}`;
		const compiled = [{
			name: "1-probe.c", originalPath: `${root}/probe.c`
			, probePath: `${root}/records/c-probes/1-probe.c`
			, objectPath: `${root}/probe.o`
			, ...instrumented.receipt
			, object: identity("object")
		}];
		const commands = [{
			command: "/tool/emcc"
			, originalArgs: ["-c", `${root}/probe.c`, "-o", `${root}/probe.o`]
			, probeArgs: ["-c", compiled[0].probePath, "-o", `${root}/probe.o`]
		}
		, {
			command: "/tool/emcc", originalArgs: ["-sSIDE_MODULE=2", `${root}/probe.o`]
			, probeArgs: ["-sSIDE_MODULE=2", `${root}/probe.o`]
		}];
		const observation = {
			schemaVersion: 1, scope: "separate-instrumented-probe"
			, selected: selection.selected
			, definitionCounts: Object.fromEntries(selection.selected.map(item => [item.symbol, 1]))
			, compiled, commands, linked: true, modelSha256: sha256(modelBytes)
			, component: { id: "component", wasmLibrary: library }
			, library, packageSetSha256
		};
		const prefix = `build-${index}/`;
		save(prefix + "source-probe.json", canonicalJson(sourceProbe));
		save(prefix + "model.json", modelBytes);
		save(prefix + "observation.json", canonicalJson(observation));
		save(prefix + "commands.json", canonicalJson({
			selected: observation.selected
			, definitionCounts: observation.definitionCounts
			, compiled, commands, linked: true
		}));
		save(prefix + "c-inputs/1-probe.c", cInput);
		save(prefix + "c-probes/1-probe.c", instrumented.source);
		observations.push(observation);
	}
	const expected = phpWasmRefinementEntryExpected(family, plan.cases), trace = traceOf(plan);
	const counts = Object.fromEntries(["validator", "constructor", "adapter", "source"].map(kind => [
		kind, plan.cases.reduce((sum, item) => sum + item.call.counts[kind], 0)
	]));
	const executions = phpWasmExecutionTuples.map(tuple => {
		const [realm, arrangement, loading, mode] = tuple.split("/");
		return {
			realm, arrangement, loading, mode
			, phases: ["ready", "autoload", "invalid", "complete"].map(stage => ({
				stage, libraries: stage === "complete" ? ["component.so"] : []
			}))
			, observation: expected
			, entryProbe: {
				scope: plan.scope, family, trace, calls: plan.cases.length
				, controls: plan.cases.map(item => item.control), counts
			}
			, ...realm === "chromium" ? { requests: [] } : {}
		};
	});
	const driver = await readFile("tests/fixtures/php-wasm-refinement-entry/driver.mjs");
	const parser = await readFile("tests/helpers/php-wasm-subtype-entry-trace.mjs");
	const deployment = {
		"driver.mjs": identity(driver), "entry-trace.mjs": identity(parser)
	};
	const consumerSources = {}, requests = {};
	for(const mode of ["weak", "strict"])
	{
		const source = await phpWasmRefinementEntryCaller(family, mode);
		consumerSources[mode] = sha256(source); deployment[mode + ".php"] = identity(source);
	}
	for(const arrangement of ["embedded", "composer"])
	{
		const request = phpWasmRefinementEntryRequest(family, arrangement, plan);
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
		, lockedInstall: true, relocated: true, publicApiOnly: true
		, repeatExecution: true, unchangedDeployment: true
		, compilerFreeExecution: true
		, consumerSources, requests, deployment, executions
		, browserVersion: "1.2.3.4", browserSha256: digest("browser")
	};
	const report = {
		schemaVersion: 1, scope: plan.scope, producerCommit
		, family, route, entryPlan: plan
		, phpWasm, observation: expected, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true, compilerFreeReplay: true
		, offlineInstall: true, relocatedInstallation: true
	};
	const summary = {
		schemaVersion: 1, scope: plan.scope, producerCommit, family, route
		, source: {
			originalSha256: sourceProbe.originalSha256
			, probeSha256: sourceProbe.probeSha256
		}
		, receipt: packageReceipt, observations
	};
	save("report.json", canonicalJson(report)); save("summary.json", canonicalJson(summary));
	const records = () => ({
		paths: [...files.keys()].sort()
		, read: path => Promise.resolve(files.get(path))
	});
	return { files, records, options: { family, route, producerCommit } };
};

const mutateJson = (files, path, change) => {
	const value = JSON.parse(files.get(path)); change(value);
	files.set(path, Buffer.from(canonicalJson(value)));
};

test("graph-entry report CLI requires one closed matrix selection", () => {
	const producer = "a".repeat(40), args = [
		"--family", "recursive-subtype", "--route", "ordinary"
		, "--producer", producer, "--directory", "records"
	];
	assert.deepEqual(parsePhpWasmRefinementEntryReportArgs(args), {
		family: "recursive-subtype", route: "ordinary", producerCommit: producer
		, directory: "records"
	});
	for(const changed of [
		args.slice(2), [...args, "--other", "x"]
		, [...args.slice(0, -2), "--producer", producer]
		, args.map(value => value === producer ? "HEAD" : value)
		, args.map(value => value === "ordinary" ? "unknown" : value)
		, args.map(value => value === "records" ? "bad\npath" : value)
	]) assert.throws(() => parsePhpWasmRefinementEntryReportArgs(changed));
});

test("installed graph-entry report reconstructs every compiler input and call trace", async () => {
	const fixture = await makeRecords();
	const checked = await checkPhpWasmRefinementEntryReport(fixture.records(), fixture.options);
	assert.deepEqual([checked.family, checked.route, checked.executions]
		, ["recursive-subtype", "ordinary", 12]);
	assert.ok(checked.records > 10); assert.ok(checked.calls > 1);
});

test("installed graph-entry report refuses substituted claims and incomplete records", async t => {
	const mutations = [
		files => mutateJson(files, "report.json", value => { value.producerCommit = "0".repeat(40); })
		, files => mutateJson(files, "report.json", value => { value.reproducible = false; })
		, files => mutateJson(files, "report.json", value => { value.entryPlan.cases[0].call.entries.pop(); })
		, files => mutateJson(files, "report.json", value => { value.phpWasm.executions.pop(); })
		, files => mutateJson(files, "report.json", value => { value.phpWasm.executions[0].entryProbe.trace += "unexpected\n"; })
		, files => mutateJson(files, "report.json", value => { value.phpWasm.executions[0].entryProbe.controls.reverse(); })
		, files => mutateJson(files, "report.json", value => { value.phpWasm.executions[0].observation.checks++; })
		, files => mutateJson(files, "report.json", value => { value.phpWasm.consumerSources.weak = "0".repeat(64); })
		, files => mutateJson(files, "report.json", value => { value.phpWasm.driverSha256 = "0".repeat(64); })
		, files => mutateJson(files, "summary.json", value => { value.receipt.source.treeSha256 = "0".repeat(64); })
		, files => mutateJson(files, "build-0/source-probe.json", value => { value.probeSha256 = "0".repeat(64); })
		, files => mutateJson(files, "build-0/model.json", value => { value.pointerBits = 64; })
		, files => mutateJson(files, "build-0/observation.json", value => { value.definitionCounts[Object.keys(value.definitionCounts)[0]] = 0; })
		, files => files.set("build-0/c-probes/1-probe.c", Buffer.from("changed"))
		, files => files.delete("build-1/c-inputs/1-probe.c")
		, files => files.set("invented.json", Buffer.from("{}\n"))
	];
	let controls = 0;
	for(const mutate of mutations)
	{
		const fixture = await makeRecords(); mutate(fixture.files);
		await assert.rejects(checkPhpWasmRefinementEntryReport(fixture.records(), fixture.options));
		controls++;
	}
	assert.equal(controls, mutations.length); t.diagnostic(`${controls} substituted or incomplete controls`);
});
