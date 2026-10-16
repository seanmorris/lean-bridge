/**
 * Refuse missing originals and coordinated substitutions in nested checked-record browser evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	controlNestedCheckedRecordNpmReport,
	nestedCheckedRecordNpmRecordPaths
} from "./nested-checked-record-npm-report.mjs";
import {
	checkNestedCheckedRecordBrowserReport,
	nestedCheckedRecordBrowserRecordPaths
} from "./nested-checked-record-browser-report.mjs";

/**
 * Challenge accepted npm and browser records without changing their original bytes.
 *
 * @param originals - Complete original records for one route.
 * @param options - Independent producer, consumer, runtime and checker identities.
 * @param options.checkerCommit - Frozen revision containing these controls.
 */
export const controlNestedCheckedRecordBrowserReport = async (originals, options) => {
	assert.match(options.checkerCommit, /^[a-f0-9]{40}$/u);
	const read = records => async path => {
		assert.ok(records.has(path), "Missing original " + path);
		return records.get(path);
	};
	const load = (records, path) => JSON.parse(records.get(path));
	const save = (records, path, value) => records.set(path
		, Buffer.from(canonicalJson(value)));
	const verify = records => checkNestedCheckedRecordBrowserReport(read(records), options);
	const identities = new Map([...originals]
		.map(([path, bytes]) => [path, sha256(bytes)]));
	const accepted = await verify(originals);
	const npmReport = load(originals, "report.json");
	const paths = nestedCheckedRecordBrowserRecordPaths(
		npmReport.apiMode, npmReport.receipt).sort();
	assert.deepEqual([...originals.keys()].sort(), paths);
	const npm = await controlNestedCheckedRecordNpmReport(read(originals), options);
	const npmPaths = new Set(nestedCheckedRecordNpmRecordPaths(
		npmReport.apiMode, npmReport.receipt));
	let recordControls = npm.recordControls, browserControls = 0;
	for(const path of paths.filter(path => !npmPaths.has(path)))
	{
		const missing = new Map(originals); missing.delete(path);
		await assert.rejects(verify(missing), undefined, path); recordControls++;
		const changed = new Map(originals);
		changed.set(path, Buffer.concat([originals.get(path), Buffer.from("changed")]));
		await assert.rejects(verify(changed), undefined, path); recordControls++;
	}
	const changed = records => assert.ok([...records].some(([path, bytes]) =>
		!bytes.equals(originals.get(path))), "Mutation must change an original");
	const mirror = (records, report) => {
		save(records, "browser.json", report);
		for(const row of report.reports)
		{
			const prefix = `browser/${row.profile}/`;
			save(records, prefix + "report.json", row);
			save(records, prefix + "observations.json", row.observations);
			save(records, prefix + "inputs.json", row.inputs);
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
		, report => { report.producerCommit = "0".repeat(40); }
		, report => { report.consumerCommit = "0".repeat(40); }
		, report => { delete report.schemaVersion; }
	]) await refuseBrowser((_records, report) => mutate(report));
	const baseline = load(originals, "browser.json");
	for(const [index, profile] of baseline.reports.entries())
	{
		const mutations = [
			...["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]
				.map(key => row => { row[key] = false; })
			, ...["bindingIrSha256", "receiptSha256", "corpusSha256", "packageSourceSha256"]
				.map(key => row => { row[key] = "0".repeat(64); })
			, row => { row.route = "invented"; }
			, row => { row.producerCommit = "0".repeat(40); }
			, row => { row.consumerCommit = "0".repeat(40); }
			, row => { row.browser.installedSourcesRemoved = false; }
			, row => { row.browser.externalNetworkBlocked = false; }
			, row => { row.browser.requestedEngines.pop(); }
			, row => { row.browser.executions.pop(); }
			, row => { row.observations.pop(); }
			, row => { row.observations[0].observation.results.checks--; }
			, row => { row.observations[0].observation.results.rejections++; }
			, row => { row.observations[0].observation.results.calls--; }
			, row => { row.observations[0].observation.results.snapshots--; }
			, row => { row.observations[0].observation.results.recoveries++; }
			, row => {
				row.observations[0].observation.results.resultOnly
					= !row.observations[0].observation.results.resultOnly;
			}
			, row => { row.observations[0].observation.realm = "wrong"; }
			, row => { row.observations[0].observation.hostVersion = ""; }
			, row => {
				const engine = row.browser.executions[0].engine;
				row.observation.hostVersion = "substituted";
				for(const execution of row.browser.executions
					.filter(value => value.engine === engine))
					execution.observation.hostVersion = "substituted";
				for(const observation of row.observations
					.filter(value => value.engine === engine))
					observation.observation.hostVersion = "substituted";
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
				const wasm = row.browser.deployments[0].files
					.find(file => file.path.endsWith(".wasm"));
				wasm.sha256 = "0".repeat(64);
				row.browser.deployments[0].sha256
					= sha256(canonicalJson(row.browser.deployments[0].files));
			}
		];
		if(profile.profile === "browser-react")
			mutations.push(row => { row.browser.executions[0].pendingUnmount = false; });
		for(const mutate of mutations)
			await refuseBrowser((_records, report) => mutate(report.reports[index]));
		const entry = {
			"browser-javascript": "plain", "browser-react": "react"
			, "browser-worker": "worker-main"
		}[profile.profile];
		for(const name of [
			"javascript.mjs", "index.html", "package.mjs", "check.mjs", `${entry}.mjs`
			, ...profile.profile === "browser-worker" ? ["worker.mjs"] : []
		]) await refuseBrowser((records, report) => {
			const row = report.reports[index], path = `browser/${row.profile}/${name}`;
			const bytes = Buffer.from("invented caller returning expected counts\n");
			records.set(path, bytes);
			row.inputs[name] = { bytes: bytes.length, sha256: sha256(bytes) };
		});
		for(const [name, mutate] of [
			["installed-runtime-identity.json", value => {
				value.files.find(file => file.path === "internal/main.wasm").sha256
					= "0".repeat(64);
			}]
			, ["installed-runtime-package.json", value => { value.version = "1.0.0"; }]
			, ["installed-component-package.json", value => {
				value.leanBridge.bindingIrSha256 = "0".repeat(64);
			}]
			, ["installed-component-package.json", value => {
				value.dependencies["@lean-bridge/runtime"] = "*";
			}]
			, ["installed-component-package.json", value => {
				value.exports["."].browser = "./other.mjs";
			}]
			, ["package-lock.json", value => {
				value.packages["node_modules/nestedcheckedrecords"].version = "999.0.0";
			}]
			, ["package-lock.json", value => {
				value.packages["node_modules/nestedcheckedrecords"].integrity
					= "sha512-" + Buffer.alloc(64).toString("base64");
			}]
			, ["package-lock.json", value => {
				value.packages["node_modules/@lean-bridge/runtime"].integrity
					= "sha512-" + Buffer.alloc(64).toString("base64");
			}]
		]) await refuseBrowser((records, report) => {
			const row = report.reports[index];
			const path = `browser/${row.profile}/${name}`, value = load(records, path);
			const before = canonicalJson(value); mutate(value);
			assert.notEqual(canonicalJson(value), before); save(records, path, value);
			if(row.inputs[name]) row.inputs[name] = {
				bytes: records.get(path).length, sha256: sha256(records.get(path))
			};
		});
		for(const name of ["installed-binding-ir.json", "installed-index.d.ts"])
			await refuseBrowser((records, report) => {
				const row = report.reports[index], path = `browser/${row.profile}/${name}`;
				records.set(path, Buffer.concat([records.get(path), Buffer.from("changed")]));
			});
	}
	await verify(originals);
	for(const [path, bytes] of originals)
		assert.equal(sha256(bytes), identities.get(path), path);
	return {
		schemaVersion: 1, checkerCommit: options.checkerCommit, accepted
		, recordControls, npmReportControls: npm.reportControls
		, npmAdapterControls: npm.adapterControls, browserControls
	};
};
