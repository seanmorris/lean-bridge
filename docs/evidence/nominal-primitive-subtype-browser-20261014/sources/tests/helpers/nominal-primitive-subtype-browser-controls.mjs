/**
 * Refuse missing originals and coordinated substitutions in nominal browser evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypeBrowserReport, nominalPrimitiveSubtypeBrowserRecords } from "./nominal-primitive-subtype-browser-report.mjs";
import { checkNominalPrimitiveSubtypeNpmControls } from "./nominal-primitive-subtype-npm-controls.mjs";
import { nominalPrimitiveSubtypeNpmRecordPaths } from "./nominal-primitive-subtype-npm-report.mjs";

/**
 * Challenge actual installed observations without changing their original bytes.
 *
 * @param originals - Complete original selection records.
 * @param options - Independently selected author route, API mode, producer and runtime.
 */
export const checkNominalPrimitiveSubtypeBrowserControls = async (originals, options) => {
	const read = records => async path => { assert.ok(records.has(path), "Missing original " + path); return records.get(path); };
	const load = (records, path) => JSON.parse(records.get(path));
	const save = (records, path, value) => records.set(path, Buffer.from(canonicalJson(value)));
	const verify = records => checkNominalPrimitiveSubtypeBrowserReport(read(records), options);
	const hashes = new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)]));
	await verify(originals);
	const receipt = load(originals, "report.json").receipt;
	const paths = nominalPrimitiveSubtypeBrowserRecords(options.mode, receipt).sort();
	assert.deepEqual([...originals.keys()].sort(), paths);
	const npm = await checkNominalPrimitiveSubtypeNpmControls(read(originals), options);
	const npmPaths = new Set(nominalPrimitiveSubtypeNpmRecordPaths(options.mode, receipt));
	let recordControls = npm.recordControls, browserControls = 0;
	for(const path of paths.filter(path => !npmPaths.has(path)))
	{
		const missing = new Map(originals); missing.delete(path);
		await assert.rejects(verify(missing), undefined, path); recordControls++;
		const changed = new Map(originals); changed.set(path, Buffer.concat([originals.get(path), Buffer.from("changed")]));
		await assert.rejects(verify(changed), undefined, path); recordControls++;
	}
	const changed = records => assert.ok([...records].some(([path, bytes]) => !bytes.equals(originals.get(path))), "Mutation must change an original");
	const mirror = (records, report) => {
		save(records, "browser.json", report);
		for(const row of report.reports)
		{
			save(records, row.profile + "/report.json", row);
			save(records, row.profile + "/observations.json", row.observations);
			save(records, row.profile + "/inputs.json", row.inputs);
		}
	};
	const refuseBrowser = async mutate => {
		const records = new Map(originals), report = load(records, "browser.json");
		mutate(records, report); mirror(records, report); changed(records);
		await assert.rejects(verify(records)); browserControls++;
	};
	for(const mutate of [
		report => { report.reports.pop(); }
		, report => { report.reports[1] = report.reports[0]; }
		, report => { report.requestedEngines.pop(); }
		, report => { report.route = "invented"; }
		, report => { report.mode = options.mode === "full" ? "result-only" : "full"; }
		, report => { report.producerCommit = "0".repeat(40); }
		, report => { report.runtime.node = "v0.0.0"; }
		, report => { report.dispatchObserved = true; }
	]) await refuseBrowser((_records, report) => mutate(report));
	for(const [index, profile] of load(originals, "browser.json").reports.entries())
	{
		const mutations = [
			...["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"].map(key => row => { row[key] = false; })
			, ...["bindingIrSha256", "receiptSha256", "corpusSha256", "packageSourceSha256"].map(key => row => { row[key] = "0".repeat(64); })
			, row => { row.browser.installedSourcesRemoved = false; }
			, row => { row.browser.externalNetworkBlocked = false; }
			, row => { row.browser.requestedEngines.pop(); }
			, row => { row.browser.executions.pop(); }
			, row => { row.observations.pop(); }
			, row => { row.observations[0].observation.results.checks--; }
			, row => { row.observations[0].observation.results.rejections++; }
			, row => { row.observations[0].observation.results.resultOnly = !row.observations[0].observation.results.resultOnly; }
			, row => { row.observations[0].observation.realm = "wrong"; }
			, row => { row.observations[0].observation.hostVersion = ""; }
			, row => {
				const engine = row.browser.executions[0].engine;
				row.observation.hostVersion = "substituted";
				for(const execution of row.browser.executions.filter(item => item.engine === engine)) execution.observation.hostVersion = "substituted";
				for(const observation of row.observations.filter(item => item.engine === engine)) observation.observation.hostVersion = "substituted";
			}
			, row => { row.observations[0].engine = "unknown"; }
			, row => { row.observations[0].phase = "first-copy"; }
			, row => { row.browser.executions[0].failedAssetRecovery = false; }
			, row => { row.browser.executions[0].assets.pop(); }
			, row => { row.browser.executions[0].assets[0].status = 404; }
			, row => { row.browser.executions[0].assets[0].bytes--; }
			, row => { row.browser.executions[0].assets[0].mime = "text/plain"; }
			, row => { row.browser.executions[0].lifecycle = {}; }
			, row => { row.browser.installedAssets[0].sha256 = "0".repeat(64); }
			, row => { row.browser.deployments[0].modulePaths = []; }
			, row => { row.inventedEvidence = true; }
			, row => {
				row.browser.deployments[0].files.find(file => file.path.endsWith(".wasm")).sha256 = "0".repeat(64);
				row.browser.deployments[0].sha256 = sha256(canonicalJson(row.browser.deployments[0].files));
			}
		];
		if(profile.profile === "browser-react") mutations.push(row => { row.browser.executions[0].pendingUnmount = false; });
		for(const mutate of mutations) await refuseBrowser((_records, report) => mutate(report.reports[index]));
		for(const name of ["javascript.mjs", "index.html", "package.mjs", "fixtures/nominal-primitive-subtype-consumers/browser.mjs", "fixtures/nominal-primitive-subtype-consumers/javascript.mjs"])
			await refuseBrowser((records, report) => {
				const row = report.reports[index], bytes = Buffer.from("invented caller returning expected counts\n");
				records.set(row.profile + "/" + name, bytes); row.inputs[name] = { bytes: bytes.length, sha256: sha256(bytes) };
			});
		for(const [name, mutate] of [
			["installed-runtime-identity.json", value => { value.files.find(file => file.path === "internal/main.wasm").sha256 = "0".repeat(64); }]
			, ["installed-runtime-package.json", value => { value.version = "1.0.0"; }]
			, ["installed-component-package.json", value => { value.leanBridge.bindingIrSha256 = "0".repeat(64); }]
			, ["installed-component-package.json", value => { value.dependencies["@lean-bridge/runtime"] = "*"; }]
			, ["installed-component-package.json", value => { value.exports["."].browser = "./other.mjs"; }]
			, ["package-lock.json", value => { value.packages["node_modules/nominalprimitivesubtypes"].version = "999.0.0"; }]
			, ["package-lock.json", value => { value.packages["node_modules/nominalprimitivesubtypes"].integrity = "sha512-" + Buffer.alloc(64).toString("base64"); }]
			, ["package-lock.json", value => { value.packages["node_modules/@lean-bridge/runtime"].integrity = "sha512-" + Buffer.alloc(64).toString("base64"); }]
		]) await refuseBrowser((records, report) => {
			const row = report.reports[index], path = row.profile + "/" + name, value = load(records, path);
			const before = canonicalJson(value); mutate(value); assert.notEqual(canonicalJson(value), before); save(records, path, value);
			if(row.inputs[name]) row.inputs[name] = { bytes: records.get(path).length, sha256: sha256(records.get(path)) };
		});
	}
	await verify(originals);
	assert.deepEqual(new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)])), hashes);
	return { recordControls, reportControls: npm.reportControls, adapterControls: npm.adapterControls, browserControls };
};
