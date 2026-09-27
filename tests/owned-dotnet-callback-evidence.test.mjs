/**
 * Replay source-bound owned C# callback evidence and reject inflated claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedAggregateCarriers } from "../src/build/owned-aggregate-carriers.mjs";
import { generateOwnedDotnetCalls } from "../src/backends/dotnet/owned-calls.mjs";
import { generateOwnedDotnetConversions } from "../src/backends/dotnet/owned-conversions.mjs";
import { compileOwnedDotnetLayout } from "../src/backends/dotnet/owned-layout.mjs";
import { ownedDotnetRuntime } from "../src/backends/dotnet/owned-runtime.mjs";

const callbackObservation = [
	{ mode: "callbacks", checks: 504, managedFailures: 96, nativeFailures: 95
		, boundedInvocations: 1023, live: 0, identities: 0 }
	, { mode: "retirement", checks: 3, managedFailures: 0, nativeFailures: 0
		, boundedInvocations: 0, live: 0, identities: 0 }
];
const foundationPath = "docs/evidence/owned-dotnet-foundation-20260927.json";
const receiptPath = "docs/evidence/owned-dotnet-callbacks-20260927.json";
const verify = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-dotnet-callback-execution");
	assert.deepEqual(record.scope, { compiledLean: true, hostDelegates: true
		, all19ScalarCallbacks: true, higherOrderClosures: true, typedRecovery: true
		, foundationRegression: true, installedNuget: false
		, typeSurfacePromotions: 0 });
	assert.equal(record.foundation.path, foundationPath);
	assert.equal(record.foundation.baseline, "5d3863c0cdababbc85b6d4028dc655316044929f");
	const foundationBytes = await readFile(foundationPath), foundation = JSON.parse(foundationBytes);
	assert.equal(record.foundation.bytes, foundationBytes.length);
	assert.equal(record.foundation.sha256, "4047eea1ec19c9179ac8b8d954beb9b8f0d3791c101251ca1625873f79eab77c");
	assert.equal(sha256(foundationBytes), record.foundation.sha256);
	assert.deepEqual(record.foundation.updates.map(item => item.path).sort(), [
		"src/backends/dotnet/owned-conversion-runtime.mjs"
		, "src/backends/dotnet/owned-runtime.mjs"
	]);
	assert.equal(record.sources.length, 118);
	assert.equal(new Set(record.sources.map(item => item.path)).size, record.sources.length);
	for(const entry of record.sources)
	{
		assert.match(entry.path, /^(?:src|tests)\/[A-Za-z0-9_./-]+$/u);
		assert.ok(!entry.path.includes(".."));
		const bytes = await readFile(entry.path);
		assert.equal(bytes.length, entry.bytes, entry.path);
		assert.equal(sha256(bytes), entry.sha256, entry.path);
	}
	for(const source of foundation.sources)
	{
		const current = record.sources.find(item => item.path === source.path);
		assert.ok(current);
		const update = record.foundation.updates.find(item => item.path === source.path);
		if(update)
		{
			assert.equal(sha256(update.before), source.sha256);
			assert.equal(update.previousSha256, source.sha256);
			assert.equal(update.currentSha256, current.sha256);
			assert.notEqual(update.previousSha256, update.currentSha256);
		} else assert.equal(current.sha256, source.sha256);
	}
	assert.equal(record.commands.length, 3);
	for(const [index, command] of record.commands.entries())
	{
		assert.equal(command.exitCode, 0);
		assert.equal(sha256(command.stdout), command.sha256);
		if(index < 2)
		{
			const count = index === 0 ? 5 : 14;
			assert.ok(command.stdout.includes(`# tests ${count}\n# suites 0\n# pass ${count}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`));
			assert.doesNotMatch(command.stdout, /^not ok/gmu);
		} else assert.equal(command.stdout, "");
	}
	assert.equal(record.compilerInputs.length, 2); assert.equal(record.reports.length, 4);
	const inputs = [...foundation.compilerInputs, ...record.compilerInputs];
	for(const entry of record.compilerInputs)
	{
		const source = canonicalJson(entry.input);
		assert.equal(Buffer.byteLength(source), entry.bytes);
		assert.equal(sha256(source), entry.sha256);
	}
	for(const wide of [false, true]) for(const reviewed of [false, true])
	{
		const fixture = wide ? "owned-dotnet-callables" : "owned-cpp-composition";
		const input = inputs.find(item => item.path === `build/owned-aggregate-native/${fixture}${reviewed ? "-reviewed" : ""}-callbacks-inputs.json`);
		assert.ok(input);
		const generated = generateOwnedAggregateCarriers({ ...input.input, hostCallbacks: true });
		const model = generateOwnedDotnetCalls(generated.model.bindingIr);
		const path = `build/owned-dotnet-callables/${wide ? "signatures-" : ""}${reviewed ? "reviewed" : "ordinary"}.json`;
		const entry = record.reports.find(item => item.path === path); assert.ok(entry);
		const source = canonicalJson(entry.report), report = entry.report;
		assert.equal(Buffer.byteLength(source), entry.bytes); assert.equal(sha256(source), entry.sha256);
		assert.equal(report.sourceIdentitySha256, generated.sourceIdentitySha256);
		assert.deepEqual(report.bindingIr, generated.model.bindingIr);
		assert.deepEqual(report.generated, Object.fromEntries(Object.entries(model.files).map(([name, text]) => [name, sha256(text)])));
		assert.equal(report.compiledLean, true); assert.equal(report.hostDelegates, true); assert.equal(report.installedPackage, false);
		const probe = `tests/fixtures/structured-types/owned-dotnet-${wide ? "callback-signatures" : "callables"}.cs`;
		assert.equal(report.managedProbeSha256, sha256(await readFile(probe)));
		if(wide) assert.deepEqual(report.observation, { checks: 38, calls: 20, primitives: 19, live: 0, identities: 0 });
		else assert.deepEqual(report.observations, callbackObservation);
	}
	assert.equal(record.regressionReports.length, 11);
	for(const entry of record.regressionReports)
	{
		const before = foundation.reports.find(item => item.path === entry.path); assert.ok(before);
		const source = canonicalJson(entry.report);
		assert.equal(Buffer.byteLength(source), entry.bytes); assert.equal(sha256(source), entry.sha256);
		for(const key of ["checks", "managedChecks", "rejectedConsumers", "observation", "observations"])
			if(Object.hasOwn(before.report, key)) assert.deepEqual(entry.report[key], before.report[key]);
	}
	for(const entry of foundation.compilerInputs)
	{
		const generated = generateOwnedAggregateCarriers({ ...entry.input, hostCallbacks: true });
		const model = generateOwnedDotnetConversions(generated.model.bindingIr), layout = compileOwnedDotnetLayout(generated.model.bindingIr);
		for(const { report } of record.regressionReports.filter(item => item.report.sourceIdentitySha256 === generated.sourceIdentitySha256))
		{
			if(report.runtimeSha256) assert.equal(report.runtimeSha256, sha256(ownedDotnetRuntime(model.c.prefix)));
			if(report.valuesSha256) assert.equal(report.valuesSha256, sha256(model.valuesSource));
			if(report.conversionsSha256) assert.equal(report.conversionsSha256, sha256(model.source));
			if(report.rawSourceSha256) assert.equal(report.rawSourceSha256, sha256(layout.rawSource));
		}
	}
};

test("owned C# callback evidence preserves the foundation and requires every executed signature", async () => {
	const record = JSON.parse(await readFile(receiptPath));
	await verify(record);
	for(const mutate of [
		value => { value.scope.installedNuget = true; }
		, value => { value.scope.typeSurfacePromotions = 1; }
		, value => { value.reports.pop(); }
		, value => { value.reports[0].report.observations[0].live = 1; }
		, value => { value.reports[0].report.observations[0].nativeFailures = 0; }
		, value => { value.reports[2].report.observation.primitives = 18; }
		, value => { value.reports[2].report.observation.calls = 19; }
		, value => { value.sources[0].sha256 = "0".repeat(64); }
		, value => { value.compilerInputs[0].input.metadata = {}; }
		, value => { value.foundation.updates[0].before += "unrecorded change"; }
		, value => { value.regressionReports.pop(); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		for(const entry of changed.reports)
		{
			const source = canonicalJson(entry.report);
			entry.bytes = Buffer.byteLength(source); entry.sha256 = sha256(source);
		}
		await assert.rejects(() => verify(changed));
	}
});
