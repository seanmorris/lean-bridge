/**
 * Check compiled Ruby conversion observations without promoting package support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedRubyConversions } from "../../src/backends/ruby/owned-conversions.mjs";
import { historicalOwnedRubyCallbackRuntime as ownedRubyRuntime } from "./owned-ruby-callback-generated-history.mjs";
import { beforeOwnedRubyTransfer, ownedRubyTransferHistoricalBytes } from "./owned-ruby-transfer-history.mjs";

export const ownedRubyConversionSources = [
	"src/backends/ruby/owned-runtime.mjs"
	, "src/backends/ruby/owned-values.mjs"
	, "src/backends/ruby/owned-layout.mjs"
	, "src/backends/ruby/owned-conversion-runtime.mjs"
	, "src/backends/ruby/owned-conversions.mjs"
	, "src/backends/ruby/owned-call-boundary.mjs"
	, "src/backends/ruby/owned-callables.mjs"
	, "tests/owned-ruby-conversions.test.mjs"
	, "tests/owned-ruby-runtime.test.mjs"
	, "tests/owned-ruby-values.test.mjs"
	, "tests/owned-ruby-layout.test.mjs"
	, "tests/fixtures/structured-types/owned-ruby-probe.rb"
	, "tests/fixtures/structured-types/owned-ruby-scalars.rb"
	, "tests/fixtures/structured-types/owned-ruby-values.rb"
	, "tests/fixtures/structured-types/owned-ruby-callables.rb"
	, "tests/fixtures/structured-types/owned-ruby-runtime.rb"
];

/**
 * Require source-bound observations for both independent compilation paths.
 *
 * @param record - Captured conversion-only execution evidence.
 */
export const assertOwnedRubyConversions = async record => {
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.kind, "owned-ruby-conversion-execution");
	assert.equal(record.planNode, 1219);
	assert.deepEqual(record.scope, { compiledLean: true, aggregateConversions: true
		, nativeCallbacks: true, installedPackage: false, typeSurfacePromotions: 0 });
	assert.deepEqual(record.sources.map(item => item.path), ownedRubyConversionSources);
	for(const item of record.sources)
	{
		const bytes = ownedRubyTransferHistoricalBytes(item.path, await readFile(item.path), item.sha256);
		assert.equal(item.bytes, Buffer.byteLength(bytes), item.path);
		assert.equal(item.sha256, sha256(bytes), item.path);
	}
	const [execution, lint] = record.commands;
	assert.equal(record.commands.length, 2);
	for(const command of record.commands)
	{ assert.equal(command.exitCode, 0); assert.equal(command.sha256, sha256(command.stdout)); }
	assert.match(execution.stdout, /# tests 16\n# suites 0\n# pass 16\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n/u);
	assert.doesNotMatch(execution.stdout, /^not ok/gmu);
	assert.equal(lint.stdout, "");
	const paths = ["ordinary", "reviewed", "scalars-ordinary", "scalars-reviewed"];
	assert.deepEqual(record.reports.map(item => item.path), paths.map(path => `build/owned-ruby-conversions/${path}.json`));
	for(const entry of record.reports)
	{
		const report = entry.report, source = canonicalJson(report);
		assert.equal(entry.bytes, Buffer.byteLength(source)); assert.equal(entry.sha256, sha256(source));
		assert.equal(report.compiledLean, true); assert.equal(report.installedPackage, false);
		const generated = generateOwnedRubyConversions(report.bindingIr);
		assert.equal(report.runtimeSha256, sha256(ownedRubyRuntime(generated.c.prefix)));
		assert.equal(report.valuesSha256, sha256(generated.valuesSource));
		assert.equal(report.conversionsSha256, sha256(generated.source));
		assert.equal(report.boundarySha256, sha256(generated.cSource));
		assert.equal(report.helpersSha256, sha256(await readFile("tests/fixtures/structured-types/owned-ruby-probe.rb")));
		for(const probe of report.probes) assert.equal(probe.sha256, sha256(await readFile(probe.path)));
		const scalar = entry.path.includes("scalars-");
		assert.deepEqual(report.observations.map(item => item.mode), scalar ? ["scalars"] : ["values", "malformed", "callables"]);
		assert.equal(report.probes.length, report.observations.length);
		for(const observation of report.observations)
		{
			assert.equal(observation.live, 0); assert.equal(observation.identities, 0);
			assert.equal(observation.checks, { scalars: 278, values: 595, malformed: 6, callables: 485 }[observation.mode]);
			if(observation.mode !== "malformed")
			{
				assert.equal(observation.rubyCheckpoints, { scalars: 39, values: 153, callables: 107 }[observation.mode]);
				assert.equal(observation.rubyFaults, observation.rubyCheckpoints);
				assert.equal(observation.nativeFaults, { scalars: 23, values: 110, callables: 101 }[observation.mode]);
			}
			if(scalar) assert.equal(observation.primitives, 19);
			if(observation.mode === "callables") assert.equal(observation.boundedInvocations, 819);
		}
	}
	const foundationBytes = await readFile(record.foundation.path), foundation = JSON.parse(foundationBytes);
	assert.equal(record.foundation.sha256, sha256(foundationBytes));
	assert.deepEqual(record.compilerInputs, foundation.compilerInputs);
	const update = record.foundation.runtimeUpdate;
	assert.equal(update.path, "src/backends/ruby/owned-runtime.mjs");
	const current = beforeOwnedRubyTransfer(update.path, await readFile(update.path, "utf8"), update.afterSha256);
	assert.equal(current.split(update.after).length, 2);
	assert.equal(update.afterSha256, sha256(current));
	const original = current.replace(update.after, () => update.before);
	assert.equal(update.beforeSha256, sha256(original));
	assert.equal(update.beforeSha256, foundation.sources.find(item => item.path === update.path).sha256);
	for(const source of foundation.sources.filter(item => item.path !== update.path))
		assert.equal(source.sha256, sha256(ownedRubyTransferHistoricalBytes(source.path, await readFile(source.path), source.sha256)));
};
