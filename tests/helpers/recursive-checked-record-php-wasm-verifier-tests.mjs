/**
 * Source-only fail-closed controls for the recursive PHP-Wasm verifier. Each pure claim runs on a
 * synthetic or genuinely generated valid input, then refuses every listed corruption. No
 * producer records exist yet; the archive-level controls run only over real originals.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { generateCopiedPhpGraphZendAdapter } from "../../src/backends/php/copied-graph-zend.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import {
	checkRecursiveCheckedRecordPhpWasmExecutions, checkRecursiveCheckedRecordPhpWasmModel
	, recursiveCheckedRecordPhpWasmCallerSource, recursiveCheckedRecordPhpWasmConfiguration
	, recursiveCheckedRecordPhpWasmExpected, recursiveCheckedRecordPhpWasmPackage
	, recursiveCheckedRecordPhpWasmRequest, recursiveCheckedRecordPhpWasmReview
} from "./recursive-checked-record-php-wasm-fixture.mjs";
import {
	checkRecursiveCheckedRecordPhpWasmConsumers, checkRecursiveCheckedRecordPhpWasmContext
	, checkRecursiveCheckedRecordPhpWasmDeployment, checkRecursiveCheckedRecordPhpWasmReportClaims
	, checkRecursiveCheckedRecordPhpWasmTransport, recursiveCheckedRecordPhpWasmCallers
	, recursiveCheckedRecordPhpWasmPublicSources
} from "./recursive-checked-record-php-wasm-checks.mjs";
import { checkRecursiveCheckedRecordPhpWasmReport } from "./recursive-checked-record-php-wasm-report.mjs";
import { checkRecursiveCheckedRecordPhpWasmControls } from "./recursive-checked-record-php-wasm-controls.mjs";
import { mutualCheckedRecordRefinements } from "./mutual-checked-record-fixture.mjs";
import { recursiveCheckedRecordRefinements } from "./recursive-checked-record-fixture.mjs";

const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const original = path => execFileSync("git", ["cat-file", "blob", `${producerCommit}:${path}`]);
const refinements = { recursive: recursiveCheckedRecordRefinements, mutual: mutualCheckedRecordRefinements };
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const clone = value => structuredClone(value);
const refusesAll = (valid, check, mutations) => {
	check(clone(valid));
	let refused = 0;
	for(const [label, mutate] of mutations)
	{
		const changed = clone(valid); mutate(changed);
		assert.throws(() => check(changed), undefined, label); refused++;
	}
	return refused;
};

test("recursive PHP-Wasm report claims refuse wrong selections, authors and isolation claims", () => {
	const build = { bindingIrSha256: "a".repeat(64), modelSha256: "b".repeat(64), receiptSha256: "c".repeat(64), packageSetSha256: "d".repeat(64), archives: { "archives/x.zip": "e".repeat(64) } };
	for(const fixture of ["recursive", "mutual"])
	{
		const scope = { route: "ordinary", fixture, producerCommit };
		const reason = "No constructor/source entry counters in this unmodified PHP-Wasm package";
		const report = {
			schemaVersion: 1, route: "ordinary", fixture, producerCommit
			, configuration: recursiveCheckedRecordPhpWasmConfiguration("ordinary", fixture)
			, expectedBindingIrSha256: "f".repeat(64), builds: [build, clone(build)]
			, receipt: {}, phpWasm: {}, observation: {}
			, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
			, sourceRemovedBeforeInstallation: true, offlineInstall: true
			, compilerFreeReplay: true, relocatedInstallation: true
			, consumerSourceRequired: true, loadCeiling: 8
			, dispatch: { observed: false, reason }
		};
		const refused = refusesAll(report, value => checkRecursiveCheckedRecordPhpWasmReportClaims(value, scope), [
			["wrong fixture", value => { value.fixture = fixture === "recursive" ? "mutual" : "recursive"; }]
			, ["wrong route", value => { value.route = "reviewed"; }]
			, ["wrong producer", value => { value.producerCommit = "0".repeat(40); }]
			, ["schema", value => { value.schemaVersion = 2; }]
			, ...["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation", "consumerSourceRequired"]
				.map(key => [key, value => { value[key] = false; }])
			, ["load ceiling", value => { value.loadCeiling = 6; }]
			, ["one author", value => { value.independentBuilds = 1; }]
			, ["dropped author", value => { value.builds.pop(); }]
			, ["diverged author", value => { value.builds[1].archives = { "archives/x.zip": "0".repeat(64) }; }]
			, ["dispatch", value => { value.dispatch.observed = true; }]
			, ["extra claim", value => { value.mode = "full"; }]
			, ["missing claim", value => { delete value.observation; }]
		]);
		assert.equal(refused, 18);
		const context = { producerCommit, route: "ordinary", fixture, root: "/tmp/lean-bridge-recursive-php-wasm-installed-Ab12", consumer: "/tmp/lean-bridge-recursive-php-wasm-installed-Ab12/consumer", handoff: "/tmp/lean-bridge-recursive-php-wasm-installed-Ab12/consumer/handoff" };
		assert.equal(refusesAll(context, value => checkRecursiveCheckedRecordPhpWasmContext(value, report), [
			["wrong fixture", value => { value.fixture = "other"; }]
			, ["nested directory", value => { value.root = "/tmp/lean-bridge-nested-php-wasm-installed-Ab12"; }]
			, ["relative directory", value => { value.root = "tmp/lean-bridge-recursive-php-wasm-installed-Ab12"; }]
			, ["consumer outside root", value => { value.consumer = "/elsewhere/consumer"; }]
			, ["handoff outside consumer", value => { value.handoff = value.root + "/handoff"; }]
			, ["extra key", value => { value.mode = "full"; }]
		]), 6);
	}
});

test("recursive PHP-Wasm consumer records refuse forked, swapped and substituted callers and requests", async () => {
	const callers = recursiveCheckedRecordPhpWasmCallers(original);
	for(const strictness of ["weak", "strict"]) assert.equal(callers[strictness], await recursiveCheckedRecordPhpWasmCallerSource(strictness));
	assert.throws(() => recursiveCheckedRecordPhpWasmCallers(path => Buffer.concat([original(path), Buffer.from("\n")])), /Shared native-PHP caller blob/u);
	for(const fixture of ["recursive", "mutual"])
	{
		const texts = {}, evidence = { consumerSources: {}, requests: {}, deployment: {} };
		for(const strictness of ["weak", "strict"])
		{
			texts[strictness + ".php"] = texts["deployment/" + strictness + ".php"] = callers[strictness];
			evidence.consumerSources[strictness] = sha256(callers[strictness]); evidence.deployment[strictness + ".php"] = identity(callers[strictness]);
		}
		for(const arrangement of ["embedded", "composer"])
		{
			const request = recursiveCheckedRecordPhpWasmRequest(fixture, arrangement);
			texts[`request-${arrangement}.json`] = texts[`deployment/request-${arrangement}.json`] = request;
			evidence.requests[arrangement] = sha256(request);
		}
		const reader = records => async path => {
			assert.ok(Object.hasOwn(records, path), path); return records[path];
		};
		const check = async (records, observed) => checkRecursiveCheckedRecordPhpWasmConsumers({
			text: reader(records), evidence: observed, callers, fixture });
		await check(texts, evidence);
		const swap = (records, left, right) => ({ ...records, [left]: records[right], [right]: records[left] });
		for(const [label, records, observed] of [
			["swapped strictness", swap(texts, "weak.php", "strict.php"), evidence]
			, ["swapped deployed strictness", swap(texts, "deployment/weak.php", "deployment/strict.php"), evidence]
			, ["swapped arrangement", swap(texts, "request-embedded.json", "request-composer.json"), evidence]
			, ["wrong fixture request", { ...texts, "request-composer.json": recursiveCheckedRecordPhpWasmRequest(fixture === "recursive" ? "mutual" : "recursive", "composer") }, evidence]
			, ["substituted caller", { ...texts, "weak.php": "<?php echo '{}';\n" }, evidence]
			, ["consumer hash", texts, { ...evidence, consumerSources: { ...evidence.consumerSources, strict: "0".repeat(64) } }]
			, ["request hash", texts, { ...evidence, requests: { ...evidence.requests, embedded: "0".repeat(64) } }]
			, ["deployed caller identity", texts, { ...evidence, deployment: { ...evidence.deployment, "weak.php": { bytes: 1, sha256: "0".repeat(64) } } }]
		]) await assert.rejects(check(records, observed), undefined, label);
	}
});

test("recursive PHP-Wasm transport and deployment refuse feature-off drift, substituted sources and leakage", () => {
	for(const fixture of ["recursive", "mutual"])
	{
		const ir = recursiveCheckedRecordPhpWasmReview(fixture), on = generateCopiedPhpGraphZendAdapter(ir, { refinementDiagnostics: true });
		const { settings } = recursiveCheckedRecordPhpWasmPackage(fixture);
		const members = () => new Map([
			["component", new Map(recursiveCheckedRecordPhpWasmPublicSources.map(path => ["compiled/" + path, Buffer.from(on[path])]))]
			, ["api", new Map(recursiveCheckedRecordPhpWasmPublicSources.map(path => [path, Buffer.from(on[path])]))]
		]);
		const component = { zendSha256: sha256(on["graph-zend-manifest.json"]) };
		const transport = (value, packaged = members()) => checkRecursiveCheckedRecordPhpWasmTransport({ generator: generateCopiedPhpGraphZendAdapter, fixture, component: value, members: packaged });
		transport(component);
		assert.throws(() => transport({ zendSha256: sha256(generateCopiedPhpGraphZendAdapter(ir)["graph-zend-manifest.json"]) }), /must read exact refinement diagnostics/u);
		assert.throws(() => transport({ zendSha256: "0".repeat(64) }));
		for(const [role, path] of [["component", "compiled/src/Internal/Native.php"], ["api", "src/Api.php"], ["api", "src/Internal/Values.php"]])
		{
			const altered = members(); altered.get(role).set(path, Buffer.concat([altered.get(role).get(path), Buffer.from("\n")]));
			assert.throws(() => transport(component, altered), undefined, `${role} ${path}`);
			const missing = members(); missing.get(role).delete(path);
			assert.throws(() => transport(component, missing), undefined, `missing ${role} ${path}`);
		}
		const deployment = {};
		for(const path of recursiveCheckedRecordPhpWasmPublicSources)
		{
			deployment[`node_modules/${settings.npm.name}/compiled/${path}`] = identity(on[path]);
			deployment[`vendor/${settings.composer.name}/${path}`] = identity(on[path]);
		}
		const place = value => checkRecursiveCheckedRecordPhpWasmDeployment({ deployment: value, members: members(), settings });
		assert.equal(refusesAll(deployment, place, [
			...["lakefile.toml", "lean-toolchain", `${recursiveCheckedRecordPhpWasmPackage(fixture).leanModule}.lean`, "lean-bridge.exports.json", "api.binding-ir.json"]
				.map(path => [`leaked ${path}`, value => { value[`project/${path}`] = identity("leak"); }])
			, ["missing vendor source", value => { delete value[`vendor/${settings.composer.name}/src/Api.php`]; }]
			, ["changed component source", value => { value[`node_modules/${settings.npm.name}/compiled/src/Internal/Wire.php`] = identity("other"); }]
		]), 7);
	}
});

test("recursive PHP-Wasm model and execution claims refuse changed trees and incomplete tuples", () => {
	for(const fixture of ["recursive", "mutual"])
	{
		const review = recursiveCheckedRecordPhpWasmReview(fixture);
		const exports = review.declarations.map(item => item.id.slice(5))
			.map(name => ({ name, refinements: clone(refinements[fixture][name]) }));
		const model = {
			profile: "php-wasm-copied-v1", pointerBits: 32, byteOrder: "little"
			, bindingIr: review, copiedGraph: { callbacks: false }, exports
		};
		const tree = (value, name) => value.exports.find(item => item.name.endsWith("." + name));
		assert.equal(refusesAll(model, value => checkRecursiveCheckedRecordPhpWasmModel(value, "reviewed", fixture), [
			["native profile", value => { value.profile = "native-library-v1"; }]
			, ["64-bit", value => { value.pointerBits = 64; }]
			, ["callable graph", value => { value.copiedGraph.callbacks = true; }]
			, ["no graph", value => { delete value.copiedGraph; }]
			, ["dropped export", value => { value.exports.pop(); }]
			, ["Fin bound", value => { tree(value, "first").refinements = JSON.parse(JSON.stringify(tree(value, "first").refinements).replace('"bound":"3"', '"bound":"4"')); }]
			, ["swapped constructor", value => { tree(value, "second").refinements = JSON.parse(JSON.stringify(tree(value, "second").refinements).replace(/CheckedRecords\.normalize/u, "CheckedRecords.mk")); }]
			, ["result constructor", value => { tree(value, "produce").refinements.result = tree(value, "first").refinements.parameters[0]; }]
		]), 8);
		const libraries = ["component.so", "runtime.so"];
		const loaded = (loading, stage) => loading === "startup" || stage === "complete";
		const phases = loading => ["ready", "autoload", "invalid", "complete"]
			.map(stage => ({ stage, libraries: loaded(loading, stage) ? libraries : [] }));
		const executions = phpWasmExecutionTuples.map(tuple => {
			const [realm, arrangement, loading, mode] = tuple.split("/");
			const observation = recursiveCheckedRecordPhpWasmExpected(fixture);
			return { realm, arrangement, loading, mode, observation, phases: phases(loading) };
		});
		const evidence = {
			component: { pointerBits: 32, library: "compiled/component.so" }
			, runtime: { pointerBits: 32, library: "compiled/runtime.so" }, executions
		};
		assert.equal(refusesAll(evidence, value => checkRecursiveCheckedRecordPhpWasmExecutions(value, fixture), [
			["missing tuple", value => { value.executions.pop(); }]
			, ["duplicated tuple", value => { value.executions[1] = clone(value.executions[0]); }]
			, ["wrong fixture counts", value => { value.executions[0].observation = recursiveCheckedRecordPhpWasmExpected(fixture === "recursive" ? "mutual" : "recursive"); }]
			, ["one fewer exact rejection", value => { value.executions[0].observation.rejections--; }]
			, ["host refusal counted as Lean", value => { value.executions[0].observation.hostRejections--; value.executions[0].observation.rejections++; }]
			, ["64-bit word", value => { value.executions[0].observation.word_bits = 64; }]
			, ["eager lazy library", value => { value.executions.find(item => item.loading === "lazy").phases[0].libraries = libraries; }]
			, ["missing phase", value => { value.executions[0].phases.pop(); }]
			, ["shared library", value => { value.runtime.library = "other/component.so"; }]
			, ["64-bit runtime", value => { value.runtime.pointerBits = 64; }]
		]), 10);
	}
	assert.equal(typeof checkRecursiveCheckedRecordPhpWasmReport, "function");
	assert.equal(typeof checkRecursiveCheckedRecordPhpWasmControls, "function");
});
