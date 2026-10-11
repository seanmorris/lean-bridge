/**
 * Challenge actual checked-record run records with missing and coordinated replacements.
 *
 * @file
 */
import assert from 'node:assert/strict';
import {canonicalJson, sha256} from '../../src/capsule/node.mjs';
import {checkCheckedRecordBrowserReport, checkedRecordBrowserRecords} from './checked-record-browser-report.mjs';

/**
 * Refuse incomplete and coordinated substitutions without changing original records.
 *
 * @param originals - Original run record bytes keyed by route-relative path.
 * @param options - Independently selected route and original producer revision.
 */
export const checkedRecordBrowserNegativeControls = async (originals, options) => {
	const read = records => async path => { assert.ok(records.has(path), 'Missing original ' + path); return records.get(path); };
	const load = (records, path) => JSON.parse(records.get(path));
	const save = (records, path, value) => records.set(path, Buffer.from(canonicalJson(value)));
	const verify = records => checkCheckedRecordBrowserReport(read(records), options);
	await verify(originals);
	let missing = 0, npm = 0, browser = 0;
	for(const path of checkedRecordBrowserRecords)
	{
		const records = new Map(originals); records.delete(path);
		await assert.rejects(verify(records), undefined, path); missing++;
	}
	const npmRefuse = async mutate => {
		const records = new Map(originals), report = load(records, 'report.json');
		const before = canonicalJson(report);
		mutate(records, report); save(records, 'report.json', report);
		assert.ok(before !== canonicalJson(report) || [...records].some(([path, bytes]) => !bytes.equals(originals.get(path))), 'Mutation must change a record');
		await assert.rejects(verify(records)); npm++;
	};
	for(const key of ['reproducible', 'sourceRemovedBeforeInstallation', 'offlineInstall', 'compilerFreePath', 'relocatedInstallation'])
		await npmRefuse((_records, report) => { report[key] = false; });
	const npmMutations = [
		report => { report.route = 'invented'; }
		, report => { report.producerCommit = '0'.repeat(40); }
		, report => { report.builds.pop(); }
		, report => { report.independentBuilds = 1; }
		, report => { report.dispatch.observed = true; }
		, report => { report.typescript.strict = false; }
		, report => { report.typescript.skipLibCheck = true; }
		, report => { report.observations.pop(); }
	];
	for(const mutate of npmMutations) await npmRefuse((_records, report) => mutate(report));
	for(const [index, path] of ['installed.json', 'relocated.json'].entries())
	{
		const observationMutations = [
			row => { row.relocated = !row.relocated; }
			, row => { row.result.code = 1; }
			, row => { row.result.stderr = 'ignored failure'; }
			, row => { row.typescript.code = 1; }
			, row => { row.typescript.stderr = 'type error'; }, row => {
				const counts = JSON.parse(row.result.stdout); counts.snapshots--; row.result.stdout = JSON.stringify(counts) + '\n';
			}
		];
		for(const mutate of observationMutations) await npmRefuse((records, report) => {
			mutate(report.observations[index]); save(records, path, report.observations[index]);
		});
	}
	for(const [path, field] of [['check.mjs', 'corpusSha256'], ['index.mjs', 'consumerSha256'], ['index.mts', null]])
		await npmRefuse((records, report) => {
			const bytes = Buffer.concat([records.get(path), Buffer.from('\n// replaced caller\n')]); records.set(path, bytes);
			if(field) report[field] = sha256(bytes); else report.typescript.sourceSha256 = sha256(bytes);
		});
	for(const attempt of [0, 1]) for(const path of ['CheckedRecords.lean', 'locks/compiler-adapters.json', 'binding/binding-ir.json'])
		await npmRefuse(records => {
			const key = `build-${attempt}/${path}`;
			if(path.endsWith('.lean')) records.set(key, Buffer.concat([records.get(key), Buffer.from('\n-- altered producer\n')]));
			else
			{
				const value = load(records, key);
				if(path.includes('adapters')) value.privateAbi.version = 6; else value.types[0].source.extensions['lean-lang.org/erased-proofs'] = [];
				save(records, key, value);
			}
		});
	const mirror = (records, report) => {
		save(records, 'browser.json', report);
		for(const row of report.reports)
		{
			save(records, row.profile + '/report.json', row);
			save(records, row.profile + '/observations.json', row.observations);
			save(records, row.profile + '/inputs.json', row.inputs);
		}
	};
	const browserRefuse = async mutate => {
		const records = new Map(originals), report = load(records, 'browser.json');
		mutate(records, report); mirror(records, report);
		assert.ok([...records].some(([path, bytes]) => !bytes.equals(originals.get(path))), 'Mutation must change a record');
		await assert.rejects(verify(records)); browser++;
	};
	const browserMutations = [
		report => { report.reports.pop(); }
		, report => { report.reports[1] = report.reports[0]; }
		, report => { report.requestedEngines.pop(); }
		, report => { report.route = 'invented'; }
		, report => { report.producerCommit = '0'.repeat(40); }
		, report => { report.dispatchObserved = true; }
	];
	for(const mutate of browserMutations) await browserRefuse((_records, report) => mutate(report));
	const browserBaseline = load(originals, 'browser.json');
	for(const index of browserBaseline.reports.keys())
	{
		const mutations = [
			...['offlineInstall', 'compilerFreePath', 'sourceRemovedBeforeInstallation'].map(key => row => { row[key] = false; })
			, ...['bindingIrSha256', 'receiptSha256', 'corpusSha256', 'packageSourceSha256'].map(key => row => { row[key] = '0'.repeat(64); })
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
			, row => { row.observations[0].observation.results.resultOnly = !row.observations[0].observation.results.resultOnly; }
			, row => { row.observations[0].observation.realm = 'wrong'; }
			, row => { row.observations[0].observation.hostVersion = ''; }
			, row => { row.observations[0].engine = 'unknown'; }
			, row => { row.observations[0].phase = 'first-copy'; }
			, row => { row.browser.executions[0].failedAssetRecovery = false; }
			, row => { row.browser.executions[0].assets.pop(); }
			, row => { row.browser.executions[0].assets[0].status = 404; }
			, row => { row.browser.executions[0].assets[0].bytes--; }
			, row => { row.browser.executions[0].assets[0].mime = 'text/plain'; }
			, row => { row.browser.executions[0].lifecycle = {}; }
			, row => { row.browser.installedAssets[0].sha256 = '0'.repeat(64); }
			, row => { row.browser.deployments[0].modulePaths = []; }
			, row => { row.inventedEvidence = true; }, row => {
				row.browser.deployments[0].files.find(file => file.path.endsWith('.wasm')).sha256 = '0'.repeat(64);
				row.browser.deployments[0].sha256 = sha256(canonicalJson(row.browser.deployments[0].files));
			}
		];
		if(browserBaseline.reports[index].profile === 'browser-react') mutations.push(row => { row.browser.executions[0].pendingUnmount = false; });
		for(const mutate of mutations) await browserRefuse((_records, report) => mutate(report.reports[index]));
		for(const name of ['javascript.mjs', 'index.html', 'package.mjs', 'check.mjs'])
			await browserRefuse((records, report) => {
				const row = report.reports[index], bytes = Buffer.from('invented caller returning expected counts\n');
				records.set(row.profile + '/' + name, bytes); row.inputs[name] = { bytes: bytes.length, sha256: sha256(bytes) };
			});
		const packageMutations = [
			['installed-runtime-identity.json', value => { value.files.find(file => file.path === 'internal/main.wasm').sha256 = '0'.repeat(64); }]
			, ['installed-runtime-package.json', value => { value.version = '1.0.0'; }]
			, ['installed-component-package.json', value => { value.leanBridge.bindingIrSha256 = '0'.repeat(64); }]
			, ['installed-component-package.json', value => { value.dependencies['@lean-bridge/runtime'] = '*'; }]
			, ['installed-component-package.json', value => { value.exports['.'].browser = './other.mjs'; }]
			, ['package-lock.json', value => { value.packages['node_modules/checkedrecords'].version = '999.0.0'; }]
		];
		for(const [name, mutate] of packageMutations) await browserRefuse((records, report) => {
			const row = report.reports[index], path = row.profile + '/' + name, value = load(records, path);
			const before = canonicalJson(value); mutate(value); assert.notEqual(canonicalJson(value), before);
			save(records, path, value);
			if(row.inputs[name]) row.inputs[name] = { bytes: records.get(path).length, sha256: sha256(records.get(path)) };
		});
	}
	await verify(originals);

	return {missing, npm, browser};
};
