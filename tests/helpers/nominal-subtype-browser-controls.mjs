/**
 * Refuse missing originals and coordinated substitutions in nominal browser evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalSubtypeBrowserReport, nominalSubtypeBrowserRecords } from "./nominal-subtype-browser-report.mjs";
import { nominalSubtypeBrowserHandoffRecords } from "./nominal-subtype-browser-package.mjs";

/**
 * Challenge actual installed observations without changing their original bytes.
 *
 * @param originals - Complete original selection records.
 * @param options - Independently selected author route, API mode, producer and runtime.
 */
export const checkNominalSubtypeBrowserControls = async (originals, options) => {
	const read = records => async path => { assert.ok(records.has(path), "Missing original " + path); return records.get(path); };
	const load = (records, path) => JSON.parse(records.get(path));
	const save = (records, path, value) => records.set(path, Buffer.from(canonicalJson(value)));
	const verify = records => checkNominalSubtypeBrowserReport(read(records), options);
	const hashes = new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)]));
	await verify(originals);
	const paths = [...nominalSubtypeBrowserRecords(options.mode), ...nominalSubtypeBrowserHandoffRecords(load(originals, "report.json").receipt)].sort();
	assert.deepEqual([...originals.keys()].sort(), paths);
	let recordControls = 0, npmControls = 0, browserControls = 0;
	for(const path of paths)
	{
		const missing = new Map(originals); missing.delete(path);
		await assert.rejects(verify(missing), undefined, path); recordControls++;
		const changed = new Map(originals); changed.set(path, Buffer.concat([originals.get(path), Buffer.from("changed")]));
		await assert.rejects(verify(changed), undefined, path); recordControls++;
	}
	const changed = records => assert.ok([...records].some(([path, bytes]) => !bytes.equals(originals.get(path))), "Mutation must change an original");
	const refuseNpm = async mutate => {
		const records = new Map(originals), report = load(records, "report.json");
		mutate(records, report); save(records, "report.json", report);
		for(const [index, row] of report.observations.entries()) save(records, index ? "relocated.json" : "installed.json", row);
		changed(records); await assert.rejects(verify(records)); npmControls++;
	};
	for(const key of ["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath", "relocatedInstallation"])
		await refuseNpm((_records, report) => { report[key] = false; });
	for(const mutate of [
		report => { report.route = "invented"; }
		, report => { report.mode = options.mode === "full" ? "result-only" : "full"; }
		, report => { report.producerCommit = "0".repeat(40); }
		, report => { report.independentBuilds = 1; }
		, report => { report.builds.pop(); }
		, report => { report.dispatch.observed = true; }
		, report => { report.typescript.strict = false; }
		, report => { report.typescript.skipLibCheck = true; }
		, report => { report.observations.pop(); }
		, report => { delete report.callers["results.mts"]; }
		, report => { report.expectedBindingIrSha256 = "0".repeat(64); }
		, report => { delete report.trees.nominalsubtypes["internal/validators.mjs"]; }
	]) await refuseNpm((_records, report) => mutate(report));
	for(const index of [0, 1]) for(const mutate of [
		row => { row.relocated = !row.relocated; }
		, row => { row.result.code = 1; }
		, row => { row.result.stderr = "ignored failure"; }
		, row => { row.typescript.code = 1; }
		, row => { row.typescript.stderr = "type error"; }
		, row => { const counts = JSON.parse(row.result.stdout); counts.checks--; row.result.stdout = JSON.stringify(counts) + "\n"; }
		, row => { const runtime = JSON.parse(row.runtime.stdout); runtime.node = "v0.0.0"; row.runtime.stdout = JSON.stringify(runtime) + "\n"; }
	]) await refuseNpm((_records, report) => mutate(report.observations[index]));
	for(const path of Object.keys(load(originals, "report.json").callers)) await refuseNpm((records, report) => {
		const bytes = Buffer.concat([records.get("callers/" + path), Buffer.from("\n// substituted caller\n")]);
		records.set("callers/" + path, bytes); report.callers[path] = sha256(bytes);
	});
	for(const attempt of [0, 1])
	{
		await refuseNpm(records => {
			const path = `build-${attempt}/NominalSubtypes.lean`;
			records.set(path, Buffer.concat([records.get(path), Buffer.from("\n-- changed author\n")]));
		});
		const path = `build-${attempt}/locks/compiler-adapters.json`;
		for(const mutate of [
			adapters => { adapters.privateAbi.version = 6; }
			, adapters => { adapters.exports.pop(); }
			, adapters => { adapters.exports.find(item => item.bindingId.endsWith(".produceEnvelope")).refinements.result.fields[0].refinement.constructor = "NominalSubtypes.plusOne"; }
			, adapters => { adapters.exports.find(item => item.bindingId.endsWith(".produceEnvelope")).refinements.result.fields[1].refinement.bound = "4"; }
			, ...options.mode === "full" ? [adapters => { adapters.exports.find(item => item.bindingId.endsWith(".second")).refinements.parameters[0].fields[0].refinement.constructor = "NominalSubtypes.plusOne"; }] : []
		]) await refuseNpm(records => { const value = load(records, path); mutate(value); save(records, path, value); });
	}
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
		for(const name of ["javascript.mjs", "index.html", "package.mjs", "fixtures/nominal-subtype-consumers/browser.mjs", "fixtures/nominal-subtype-consumers/javascript.mjs", "fixtures/structural-subtype-consumers/javascript.mjs"])
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
			, ["package-lock.json", value => { value.packages["node_modules/nominalsubtypes"].version = "999.0.0"; }]
			, ["package-lock.json", value => { value.packages["node_modules/nominalsubtypes"].integrity = "sha512-" + Buffer.alloc(64).toString("base64"); }]
			, ["package-lock.json", value => { value.packages["node_modules/@lean-bridge/runtime"].integrity = "sha512-" + Buffer.alloc(64).toString("base64"); }]
		]) await refuseBrowser((records, report) => {
			const row = report.reports[index], path = row.profile + "/" + name, value = load(records, path);
			const before = canonicalJson(value); mutate(value); assert.notEqual(canonicalJson(value), before); save(records, path, value);
			if(row.inputs[name]) row.inputs[name] = { bytes: records.get(path).length, sha256: sha256(records.get(path)) };
		});
	}
	await verify(originals);
	assert.deepEqual(new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)])), hashes);
	return { recordControls, npmControls, browserControls };
};
