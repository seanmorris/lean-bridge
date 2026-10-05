/**
 * Reject incomplete recursive JVM acceptance and unknown source transitions.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sha256 } from '../src/capsule/node.mjs';
import { assertJvmRecursiveCallableExecution, assertJvmRecursiveCallableIntegration, jvmRecursiveCallableExecutionPath } from './helpers/jvm-recursive-callable-evidence.mjs';
import { beforeJvmRecursiveCallables, jvmRecursiveCallableHistoryPath, reverseJvmRecursiveCallableUpdate } from './helpers/jvm-recursive-callable-source-history.mjs';
import { assertJvmRecursiveProbes } from './helpers/jvm-recursive-callable-faults.mjs';
import { beforePhpRecursiveCallables } from './helpers/php-recursive-callable-source-history.mjs';

const json = async path => JSON.parse(await readFile(path, 'utf8'));

test('recursive JVM acceptance adds exactly eight cells and preserves authenticated history', async () => {
	await assertJvmRecursiveCallableIntegration(await json(jvmRecursiveCallableHistoryPath));
});

test('recursive JVM receipts require original installs, both languages and exact examples', async () => {
	const original = await json(jvmRecursiveCallableExecutionPath);
	await assertJvmRecursiveCallableExecution(original);
	for(const change of [
		record => { record.reports.pop(); }
		, record => { record.mixedReports.pop(); }
		, record => { record.reports[0].consumers.pop(); }
		, record => { record.reports[0].producerRemovedBeforeInstall = false; }
		, record => { record.reports[0].packages[0].target = 'c'; }
		, record => { record.reports[0].producerSources['Structured.lean'] = '0'.repeat(64); }
		, record => { record.reports[0].documentation.compiledVerbatim = false; }
		, record => { record.reports[0].consumers[0].jvm.archiveSha256 = '0'.repeat(64); }
		, record => { record.reports[0].consumers[0].jvm.offline = false; }
		, record => { record.reports[0].consumers[0].jvm.handoffRemovedBeforeExecution = false; }
		, record => { record.reports[0].consumers[1].jvm.runtimeOnlyExecution = false; }
		, record => { record.reports[0].consumers[1].jvm.documentation[1].sourceSha256 = '0'.repeat(64); }
		, record => { record.reports[0].consumers[1].observation.results.pop(); }
		, record => { record.reports[0].consumers[0].jvm.inspection.tamper.observations.pop(); }
		, record => { record.reports[0].consumers[0].jvm.inspection.tamper.originalPackagesUnchanged = false; }
		, record => { record.mixedReports[0].consumers[0].jvm.documentation.pop(); }
		, record => { record.mixedReports[0].consumers[1].jvm.consumerSourceSha256 = '0'.repeat(64); }
		, record => { record.regressions.primitive.reports.pop(); }
		, record => { record.regressions.structured.reports.pop(); }
		, record => { record.regressions.copied.reports.reproducibility.observations[0].package.artifacts[0].sha256 = '0'.repeat(64); }
		, record => { record.regressions.generatedEquivalence.copied = '0'.repeat(64); }
		, record => { delete record.regressions.projectionSources['src/build/native-graph-projection.mjs']; }
		, record => { record.installed.recursive.command += ' --import staging.mjs'; }
		, record => { record.installed.mixed = record.installed.recursive; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertJvmRecursiveCallableExecution(changed), change.toString());
	}
});

test('recursive JVM probes require every fault path, ownership mutation and lifetime case', async () => {
	const jvm = (await json(jvmRecursiveCallableExecutionPath)).reports[0].consumers[0].jvm;
	const original = jvm.inspection.probes;
	await assertJvmRecursiveProbes(original, jvm);
	for(const change of [
		record => { record.layout--; }
		, record => { record.originalHash = '0'.repeat(64); }
		, record => { record.installedPackagesUnchanged = false; }
		, record => { record.instrumentedAdapter = record.originalAdapter; }
		, record => { record.edits.returned--; }
		, record => { record.observations.pop(); }
		, record => { record.observations[0].shapes.pop(); }
		, record => { record.observations[0].shapes[0].seed = 1; }
		, record => { delete record.observations[0].shapes[0].paths['create-call']; }
		, record => { record.observations[0].shapes[0].paths.callback.checkpoints--; }
		, record => { record.observations[0].shapes[0].paths.callback.hostAllocations--; }
		, record => { record.observations[0].shapes[0].paths.callback.nativeAllocations--; }
		, record => { record.observations[0].identities++; }
		, record => { record.observations[0].deferred--; }
		, record => { record.observations[1].retired--; }
		, record => { record.observations[1].clears++; }
		, record => { record.ownership.observations[0].checkedBeforeDecode = false; }
		, record => { record.ownership.observations[2].errors.pop(); }
		, record => { record.ownership.observations[4].exitCode = 139; }
		, record => { record.ownership.observations[4].stderr = 'unrelated failure'; }
		, record => { record.lifetimes.observations[0].capacity--; }
		, record => { record.lifetimes.observations[0].recovered--; }
		, record => { record.lifetimes.observations[0].cleaner = false; }
		, record => { record.lifetimes.observations[0].actualFork = true; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertJvmRecursiveProbes(changed, jvm), change.toString());
	}
});

test('recursive JVM source transitions reject unrelated bytes and substituted predecessors', async () => {
	for(const update of(await json(jvmRecursiveCallableHistoryPath)).updates)
	{
		const source = beforePhpRecursiveCallables(update.path, await readFile(update.path, 'utf8'));
		assert.equal(sha256(reverseJvmRecursiveCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeJvmRecursiveCallables(update.path, source)), update.previousSha256);
		assert.equal(beforeJvmRecursiveCallables(update.path, source, update.currentSha256), source);
		const unrelated = source + '\n/* unrelated */\n';
		assert.equal(beforeJvmRecursiveCallables(update.path, unrelated), unrelated);
		assert.throws(() => reverseJvmRecursiveCallableUpdate(unrelated, update));
		assert.throws(() => reverseJvmRecursiveCallableUpdate(source, { ...update, previousSha256: '0'.repeat(64) }));
	}
});

test('CI requires both original recursive and mixed Maven packages with retained reports', async () => {
	const workflow = await readFile('.github/workflows/consumer-matrix.yml', 'utf8');
	const command = 'LEAN_BRIDGE_JVM_RECURSIVE_CALLABLE_TEST=1 node --test tests/jvm-recursive-callables.test.mjs';
	assert.equal(workflow.split(command).length, 3);
	for(const name of ['jvm-recursive', 'jvm-mixed'])
	{
		assert.ok(workflow.includes('          test -s build/recursive-callables/' + name + '.json\n'));
		assert.ok(workflow.includes('            build/recursive-callables/' + name + '.json\n'));
	}
});
