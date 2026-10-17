/**
 * Reject missing, extra, swapped and coordinated substitutions of recursive PHP-Wasm originals.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkRecursiveCheckedRecordPhpWasmReport } from "./recursive-checked-record-php-wasm-report.mjs";
import { recursiveCheckedRecordPhpWasmReview } from "./recursive-checked-record-php-wasm-fixture.mjs";
import { recursiveCheckedRecordPhpWasmGenerators } from "./recursive-checked-record-php-wasm-sources.mjs";

/**
 * Challenge every record and the compiler, transport, caller, installation and host claims.
 *
 * @param originals - Complete immutable original selection records.
 * @param options - Independent route, module and frozen producer.
 * @param options.route - Ordinary source or independent review.
 * @param options.fixture - Recursive or mutual module.
 * @param options.producerCommit - Immutable original producer revision.
 */
export const checkRecursiveCheckedRecordPhpWasmControls = async (originals, options) => {
	const read = records => async path => { assert.ok(records.has(path), "Missing " + path); return records.get(path); };
	const load = (records, path) => JSON.parse(records.get(path));
	const save = (records, path, value) => records.set(path, Buffer.from(canonicalJson(value)));
	// The verifier must read exactly the retained set: an unread extra record also refuses.
	const verify = async records => {
		const result = await checkRecursiveCheckedRecordPhpWasmReport(read(records), options);
		assert.deepEqual([...records.keys()].sort(), result.records, "Retained records differ from the verified set");
		return result;
	};
	const hashes = new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)]));
	const valid = await verify(originals);
	let recordControls = 0, semanticControls = 0;
	for(const path of valid.records)
	{
		const missing = new Map(originals); missing.delete(path);
		await assert.rejects(verify(missing), undefined, path); recordControls++;
		const changed = new Map(originals); changed.set(path, Buffer.concat([originals.get(path), Buffer.from("changed")]));
		await assert.rejects(verify(changed), undefined, path); recordControls++;
	}
	const extra = new Map(originals); extra.set("unrecorded.json", Buffer.from("{}"));
	await assert.rejects(verify(extra)); recordControls++;
	for(const [left, right] of [
		["weak.php", "strict.php"]
		, ["request-embedded.json", "request-composer.json"]
		, ["deployment/weak.php", "deployment/strict.php"]
		, ["build-0/model.json", "build-0/package-set-receipt.json"]
		, ["executions/0.json", "executions/1.json"]
	]) {
		const swapped = new Map(originals); swapped.set(left, originals.get(right)); swapped.set(right, originals.get(left));
		await assert.rejects(verify(swapped), undefined, `${left} <-> ${right}`); recordControls++;
	}
	const refuse = async (mutate, label) => {
		const records = new Map(originals), report = load(records, "report.json");
		mutate(records, report);
		for(const [index, execution] of report.phpWasm.executions.entries()) save(records, `executions/${index}.json`, execution);
		save(records, "report.json", report);
		assert.ok([...records].some(([path, bytes]) => !bytes.equals(originals.get(path))), "Mutation must alter an original");
		await assert.rejects(verify(records), undefined, label); semanticControls++;
	};
	for(const key of ["authorInputsUnchanged", "reproducible", "offlineInstall", "compilerFreeReplay", "relocatedInstallation", "sourceRemovedBeforeInstallation", "consumerSourceRequired"])
		await refuse((_records, report) => { report[key] = false; }, key);
	// Altered diagnostic outcomes: every count, including exact rejections, is pinned per execution.
	for(const key of ["checks", "rejections", "hostRejections", "recoveries", "snapshots", "snapshotControls", "rounds", "word_bits"])
		await refuse((_records, report) => { report.phpWasm.executions[0].observation[key]--; }, key);
	const otherFixture = options.fixture === "recursive" ? "mutual" : "recursive";
	for(const [label, mutate] of [
		["wrong fixture", report => { report.fixture = otherFixture; }]
		, ["wrong route", report => { report.route = options.route === "ordinary" ? "reviewed" : "ordinary"; }]
		, ["wrong producer", report => { report.producerCommit = "0".repeat(40); }]
		, ["load ceiling 6", report => { report.loadCeiling = 6; }]
		, ["load ceiling 10", report => { report.loadCeiling = 10; }]
		, ["one author", report => { report.independentBuilds = 1; }]
		, ["dropped author", report => { report.builds.pop(); }]
		, ["diverged author", report => { report.builds[1] = { ...report.builds[1], modelSha256: "0".repeat(64) }; }]
		, ["duplicated tuple", report => { report.phpWasm.executions.push(report.phpWasm.executions[0]); }]
		, ["missing tuple", report => { report.phpWasm.executions.pop(); }]
		, ["missing phase", report => { report.phpWasm.executions[0].phases.pop(); }]
		, ["eager lazy load", report => { report.phpWasm.executions[0].phases[0].libraries = []; }]
		, ["other PHP", report => { report.phpWasm.executions[0].observation.php = "8.4.0"; }]
		, ["invented realm", report => { report.phpWasm.executions[0].realm = "invented"; }]
		, ["changed arrangement", report => { report.phpWasm.executions[0].arrangement = report.phpWasm.executions[0].arrangement === "embedded" ? "composer" : "embedded"; }]
		, ["changed loading", report => { report.phpWasm.executions[0].loading = report.phpWasm.executions[0].loading === "lazy" ? "startup" : "lazy"; }]
		, ["changed strictness", report => { report.phpWasm.executions[0].mode = report.phpWasm.executions[0].mode === "weak" ? "strict" : "weak"; }]
		, ["relocation omitted", report => { report.phpWasm.relocated = false; }]
		, ["changed deployment", report => { report.phpWasm.unchangedDeployment = false; }]
		, ["warm caches", report => { report.phpWasm.emptyCaches = false; }]
		, ["compiler used", report => { report.phpWasm.compilerFreeExecution = false; }]
		, ["64-bit component", report => { report.phpWasm.component.pointerBits = 64; }]
		, ["64-bit runtime", report => { report.phpWasm.runtime.pointerBits = 64; }]
		, ["browser requests", report => { report.phpWasm.executions.find(item => item.realm === "chromium").requests = []; }]
		, ["dispatch claimed", report => { report.dispatch.observed = true; }]
		, ["npm coordinate", report => { report.phpWasm.packageSet.npmSettings = { ...report.phpWasm.packageSet.npmSettings, name: "other" }; }]
		, ["Composer coordinate", report => { report.phpWasm.packageSet.composerSettings = { ...report.phpWasm.packageSet.composerSettings, version: "2.0.0" }; }]
		, ["source leakage", report => {
			const bytes = Buffer.from("leaked\n"); report.phpWasm.deployment["lean-bridge.exports.json"] = { bytes: bytes.length, sha256: sha256(bytes) };
		}]
	]) await refuse((_records, report) => mutate(report), label);
	// Feature-off drift: a component compiled without diagnostics names the default Zend manifest.
	const { generateCopiedPhpGraphZendAdapter } = await recursiveCheckedRecordPhpWasmGenerators(options.producerCommit);
	const featureOff = sha256(generateCopiedPhpGraphZendAdapter(recursiveCheckedRecordPhpWasmReview(options.fixture))["graph-zend-manifest.json"]);
	await refuse((_records, report) => { report.phpWasm.component.zendSha256 = featureOff; }, "feature-off transport");
	for(const index of [0, 1]) for(const [label, mutate] of [
		["32-bit model", model => { model.pointerBits = 64; }]
		, ["dropped export", model => { model.exports.pop(); }]
		, ["export selection", model => { model.sourceIdentity.request.exports.pop(); }]
		, ["configuration digest", model => { model.sourceIdentity.exportConfigurationSha256 = "0".repeat(64); }]
		, ["Fin bound", model => {
			const item = model.exports.find(entry => entry.name.endsWith(".first")), text = JSON.stringify(item.refinements);
			assert.ok(text.includes('"bound":"3"'), "Fin 3 tree present");
			item.refinements = JSON.parse(text.replace('"bound":"3"', '"bound":"4"'));
		}]
		, ["constructor", model => {
			const item = model.exports.find(entry => entry.name.endsWith(".second")), text = JSON.stringify(item.refinements);
			assert.match(text, /CheckedRecords\.normalize/u, "per-use normalize constructor present");
			item.refinements = JSON.parse(text.replace(/CheckedRecords\.normalize/u, "CheckedRecords.mk"));
		}]
	]) await refuse((records, report) => {
		const path = `build-${index}/model.json`, model = load(records, path); mutate(model); save(records, path, model);
		report.builds[index].modelSha256 = sha256(records.get(path));
	}, `build-${index} ${label}`);
	for(const path of ["weak.php", "strict.php"]) await refuse((records, report) => {
		const bytes = Buffer.from("<?php echo 'invented expected counts';\n");
		records.set(path, bytes); records.set("deployment/" + path, bytes);
		report.phpWasm.consumerSources[path.slice(0, -4)] = sha256(bytes);
		report.phpWasm.deployment[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}, path);
	for(const index of [0, 1]) await refuse(records => {
		const path = `build-${index}/author-inputs.json`, inputs = load(records, path);
		inputs[0].sha256 = "0".repeat(64); save(records, path, inputs);
	}, `author ${index}`);
	for(const key of ["freeBytes", "availableBytes", "load"]) await refuse((records, report) => {
		const resources = load(records, "resources.json");
		resources[0].observations.at(-1)[key] = key === "load" ? report.loadCeiling : 1;
		save(records, "resources.json", resources);
	}, key);
	await verify(originals);
	assert.deepEqual(new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)])), hashes);
	return { recordControls, semanticControls };
};
