/**
 * Reject incomplete Composer acceptance and unauthenticated source transitions.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sha256 } from '../src/capsule/node.mjs';
import { assertPhpRecursiveCallableExecution, assertPhpRecursiveCallableIntegration, assertPhpRecursiveInspection, phpRecursiveCallableExecutionPath } from './helpers/php-recursive-callable-evidence.mjs';
import { beforePhpRecursiveCallables, phpRecursiveCallableHistoryPath, reversePhpRecursiveCallableUpdate } from './helpers/php-recursive-callable-source-history.mjs';
import { beforePhpWasmRecursiveCallables } from './helpers/php-wasm-recursive-callable-source-history.mjs';

const json = async path => JSON.parse(await readFile(path, 'utf8'));

test('recursive PHP acceptance adds exactly four cells and preserves authenticated history', async () => {
	await assertPhpRecursiveCallableIntegration(await json(phpRecursiveCallableHistoryPath));
});

test('recursive PHP receipts require original installs, both paths and exact examples', async () => {
	const original = await json(phpRecursiveCallableExecutionPath);
	await assertPhpRecursiveCallableExecution(original);
	for(const change of [
		record => { record.reports.pop(); }
		, record => { record.mixedReports.pop(); }
		, record => { record.reports[0].php.executions.pop(); }
		, record => { record.reports[0].sourceRemovedBeforeInstallation = false; }
		, record => { record.reports[0].package.target = 'c'; }
		, record => { record.reports[0].producerSources['Structured.lean'] = '0'.repeat(64); }
		, record => { record.reports[0].documentation.compiledVerbatim = false; }
		, record => { record.reports[0].php.archiveSha256 = '0'.repeat(64); }
		, record => { record.reports[0].php.offline = false; }
		, record => { record.reports[0].handoffRemovedBeforeExecution = false; }
		, record => { record.reports[0].php.compilerFreeExecution = false; }
		, record => { record.reports[0].documentation.consumerSha256 = '0'.repeat(64); }
		, record => { record.reports[0].afterProbes.pop(); }
		, record => { record.reports[0].php.executions[0].observation.rejections = 0; }
		, record => { record.reports[0].inspection.tamper.cases.pop(); }
		, record => { record.mixedReports[0].php.executions[0].observation.primitiveChecks = 0; }
		, record => { record.mixedReports[0].php.consumerSources.strict = '0'.repeat(64); }
		, record => { record.regressions.primitive.report.reports.pop(); }
		, record => { record.regressions.structured.report.reports.pop(); }
		, record => { record.regressions.copied.reports.reproducibility.observations[0].package.artifacts[0].sha256 = '0'.repeat(64); }
		, record => { delete record.regressions.projectionSources['src/build/native-graph-projection.mjs']; }
		, record => { record.installed.recursive.command += ' --import staging.mjs'; }
		, record => { record.installed.mixed = record.installed.recursive; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertPhpRecursiveCallableExecution(changed), change.toString());
	}
});

test('recursive PHP probes require complete failures, named mutants and real lifetime checks', async () => {
	const original = (await json(phpRecursiveCallableExecutionPath)).reports[0];
	await assertPhpRecursiveInspection(original);
	for(const change of [
		record => { record.probes.adapter.layout--; }
		, record => { record.probes.originalArchiveSha256 = '0'.repeat(64); }
		, record => { record.probes.originalPackagesUnchanged = false; }
		, record => { record.probes.adapter.instrumentedAdapter = record.probes.adapter.originalAdapter; }
		, record => { record.probes.host.shapes.pop(); }
		, record => { record.probes.host.shapes[0].seed = 1; }
		, record => { delete record.probes.host.shapes[0].paths['create-call']; }
		, record => { record.probes.host.shapes[0].paths.callback--; }
		, record => { record.probes.native.shapes[0].paths.callback--; }
		, record => { record.probes.host.liveIdentities++; }
		, record => { record.probes.native.liveNativeAllocations++; }
		, record => { record.probes.poisoned.pop(); }
		, record => { record.probes.poisoned[0].retirements--; }
		, record => { record.probes.ownership[0].checkedBeforeDecode = false; }
		, record => { record.probes.ownership[1].errors.pop(); }
		, record => { record.probes.mutant.exitCode = 139; }
		, record => { record.probes.mutant.stderr = 'unrelated failure'; }
		, record => { record.probes.lifetimes.capacity--; }
		, record => { record.probes.lifetimes.recovered--; }
		, record => { record.probes.lifetimes.gcCleanup = false; }
		, record => { record.probes.lifetimes.actualFork = false; }
		, record => { record.probes.lifetimes.staleGenerationRejected = false; }
		, record => { record.tamper.originalPackagesUnchanged = false; }
	]) {
		const changed = structuredClone(original); change(changed.inspection);
		await assert.rejects(() => assertPhpRecursiveInspection(changed), change.toString());
	}
});

test('recursive PHP source transitions reject unrelated bytes and substituted predecessors', async () => {
	for(const update of(await json(phpRecursiveCallableHistoryPath)).updates)
	{
		const source = beforePhpWasmRecursiveCallables(update.path, await readFile(update.path, 'utf8'));
		assert.equal(sha256(reversePhpRecursiveCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePhpRecursiveCallables(update.path, source)), update.previousSha256);
		assert.equal(beforePhpRecursiveCallables(update.path, source, update.currentSha256), source);
		const unrelated = source + '\n/* unrelated */\n';
		assert.equal(beforePhpRecursiveCallables(update.path, unrelated), unrelated);
		assert.throws(() => reversePhpRecursiveCallableUpdate(unrelated, update));
		assert.throws(() => reversePhpRecursiveCallableUpdate(source, { ...update, previousSha256: '0'.repeat(64) }));
	}
});
