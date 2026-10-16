/**
 * Reject missing originals and coordinated substitutions without changing evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNestedCheckedRecordPhpWasmReport } from "./nested-checked-record-php-wasm-report.mjs";

/**
 * Challenge all records and the compiler, caller, installation and host claims.
 *
 * @param originals - Complete immutable original selection records.
 * @param options - Independent source route, API mode and frozen producer.
 */
export const checkNestedCheckedRecordPhpWasmControls = async (originals, options) => {
	const read = records => async path => { assert.ok(records.has(path), "Missing " + path); return records.get(path); };
	const load = (records, path) => JSON.parse(records.get(path));
	const save = (records, path, value) => records.set(path, Buffer.from(canonicalJson(value)));
	const verify = records => checkNestedCheckedRecordPhpWasmReport(read(records), options);
	const hashes = new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)]));
	const valid = await verify(originals); assert.deepEqual([...originals.keys()].sort(), valid.records);
	let recordControls = 0, semanticControls = 0;
	for(const path of valid.records)
	{
		const missing = new Map(originals); missing.delete(path);
		await assert.rejects(verify(missing), undefined, path); recordControls++;
		const changed = new Map(originals); changed.set(path, Buffer.concat([originals.get(path), Buffer.from("changed")]));
		await assert.rejects(verify(changed), undefined, path); recordControls++;
	}
	const refuse = async mutate => {
		const records = new Map(originals), report = load(records, "report.json");
		mutate(records, report);
		for(const [index, execution] of report.phpWasm.executions.entries()) save(records, `executions/${index}.json`, execution);
		save(records, "report.json", report);
		assert.ok([...records].some(([path, bytes]) => !bytes.equals(originals.get(path))), "Mutation must alter an original");
		await assert.rejects(verify(records)); semanticControls++;
	};
	for(const key of ["authorInputsUnchanged", "reproducible", "offlineInstall", "compilerFreeReplay", "relocatedInstallation", "sourceRemovedBeforeInstallation"])
		await refuse((_records, report) => { report[key] = false; });
	for(const key of ["checks", "rejections", "hostRejections", "recoveries", "snapshots", "snapshotControls", "rounds", "word_bits"])
		await refuse((_records, report) => { report.phpWasm.executions[0].observation[key]--; });
	for(const mutate of [
		report => { report.mode = options.mode === "full" ? "result-only" : "full"; }
		, report => { report.route = options.route === "ordinary" ? "reviewed" : "ordinary"; }
		, report => { report.producerCommit = "0".repeat(40); }
		, report => { report.consumerSourceRequired = false; }
		, report => { report.loadCeiling = 6; }
		, report => { report.loadCeiling = 10; }
		, report => { report.loadCeiling = 24; }
		, report => { report.independentBuilds = 1; }
		, report => { report.builds.pop(); }
		, report => { report.phpWasm.executions.push(report.phpWasm.executions[0]); }
		, report => { report.phpWasm.executions.pop(); }
		, report => { report.phpWasm.executions[0].phases.pop(); }
		, report => { report.phpWasm.executions[0].phases[0].libraries = []; }
		, report => { report.phpWasm.executions[0].observation.php = "8.4.0"; }
		, report => { report.phpWasm.executions[0].realm = "invented"; }
		, report => { report.phpWasm.executions[0].loading = "lazy"; }
		, report => { report.phpWasm.executions[0].mode = "strict"; }
		, report => { report.phpWasm.repeatExecution = false; }
		, report => { report.phpWasm.unchangedDeployment = false; }
		, report => { report.phpWasm.emptyCaches = false; }
		, report => { report.phpWasm.compilerFreeExecution = false; }
		, report => { report.phpWasm.component.pointerBits = 64; }
		, report => { report.phpWasm.runtime.pointerBits = 64; }
		, report => { report.phpWasm.executions.find(item => item.realm === "chromium").requests = []; }
		, report => { report.dispatch.observed = true; }
	]) await refuse((_records, report) => mutate(report));
	for(const index of [0, 1]) for(const mutate of [
		model => { model.profile = "native-library-v1"; model.pointerBits = 64; }
		, model => { model.exports.pop(); }
		, model => { model.sourceIdentity.request.exports.pop(); }
		, model => { model.sourceIdentity.exportConfigurationSha256 = "0".repeat(64); }
		, model => {
			const packet = model.exports.find(item => item.name.endsWith(".produceOption")).refinements.result.arguments[0];
			assert.equal(packet.kind, "checked-record"); assert.equal(packet.fields[0], "digit"); packet.arguments[0].bound = "9";
		}
		, ...options.mode === "full" ? [model => {
			const packet = model.exports.find(item => item.name.endsWith(".first")).refinements.parameters[0];
			assert.equal(packet.arguments[1].constructor, "NestedCheckedRecords.mkWord");
			packet.arguments[1].constructor = "NestedCheckedRecords.normalizeWord";
		}] : []
	]) await refuse((records, report) => {
		const path = `build-${index}/model.json`, model = load(records, path); mutate(model); save(records, path, model);
		report.builds[index].modelSha256 = sha256(records.get(path));
	});
	for(const path of ["weak.php", "strict.php"]) await refuse((records, report) => {
		const bytes = Buffer.from("<?php echo 'invented expected counts';\n");
		records.set(path, bytes); records.set("deployment/" + path, bytes);
		report.phpWasm.consumerSources[path.slice(0, -4)] = sha256(bytes);
		report.phpWasm.deployment[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	});
	for(const index of [0, 1]) await refuse(records => {
		const path = `build-${index}/author-inputs.json`, inputs = load(records, path);
		inputs[0].sha256 = "0".repeat(64); save(records, path, inputs);
	});
	for(const [key, value] of [["freeBytes", 1], ["availableBytes", 1], ["load", 8]]) await refuse(records => {
		const resources = load(records, "resources.json"); resources[0].observations.at(-1)[key] = value; save(records, "resources.json", resources);
	});
	await verify(originals);
	assert.deepEqual(new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)])), hashes);
	return { recordControls, semanticControls };
};
