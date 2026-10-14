/**
 * Independently check all four original primitive-base nominal CPAN installed selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkedRecordPerlConfigurations, checkedRecordPerlModes, assertCheckedRecordPerlIdentity } from "./checked-record-perl-install.mjs";
import { nominalPrimitiveSubtypePerlCounts, nominalPrimitiveSubtypePerlRoutes, nominalPrimitiveSubtypePerlModes, nominalPrimitiveSubtypePerlArguments, parseNominalPrimitiveSubtypePerlResult } from "./nominal-primitive-subtype-perl-fixture.mjs";
import { nominalSubtypePerlOriginal as nominalPrimitiveSubtypePerlOriginal } from "./nominal-subtype-perl-generators.mjs";
import { checkNominalPrimitiveSubtypePerlModels } from "./nominal-primitive-subtype-perl-model-records.mjs";
import { checkNominalPrimitiveSubtypePerlPackages } from "./nominal-primitive-subtype-perl-package-records.mjs";
import { checkNominalPrimitiveSubtypePerlHandoff, nominalPrimitiveSubtypePerlHandoffRecords } from "./nominal-primitive-subtype-perl-handoff.mjs";

/**
 * Enumerate the complete original record set, including both author roots and the retained archives.
 *
 * @param route - Explicit ordinary or reviewed source route.
 * @param receipt - Independently checked package-set receipt naming both archives.
 */
export const nominalPrimitiveSubtypePerlRecords = (route, receipt) => {
	assert.ok(nominalPrimitiveSubtypePerlRoutes.includes(route));
	return ["report.json", "runtime.json", "expected.binding-ir.json"
		, "configuration.json", "consumer.pl"
		, ...nominalPrimitiveSubtypePerlHandoffRecords(receipt)
		, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json"
			, "author-inputs.json", "NominalPrimitiveSubtypes.lean"
			, "lean-bridge.exports.json"
			, ...route === "reviewed" ? ["api.binding-ir.json"] : []].map(path => `build-${index}/${path}`))
		, ...checkedRecordPerlConfigurations.flatMap(configuration => checkedRecordPerlModes.flatMap(delivery => [
			"report.json", "installed-files.json", "first.json", "repeated.json"
			, ...["runtime", "component"].flatMap(role => ["manifest.json", "source.xs", "public.pm", "install-receipt.json", "trace.json"].map(name => `${role}-${name}`))
		].map(path => `${configuration}/${delivery}/${path}`)))];
};

/**
 * Check compiler decisions, every installed ABI/mode, both unchanged executions and the archives.
 *
 * @param read - Original byte reader, relative to one route/mode record directory.
 * @param options - Independently selected route, mode, producer and runtime floor.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.mode - Full or constructor-free result-only API.
 * @param options.producerCommit - Frozen producer revision.
 * @param options.runtime - Observed platform, architecture and glibc version.
 * @param options.floor - Explicit package glibc floor.
 */
export const checkNominalPrimitiveSubtypePerlReport = async (read, { route, mode, producerCommit, runtime, floor }) => {
	assert.ok(nominalPrimitiveSubtypePerlRoutes.includes(route)); assert.ok(nominalPrimitiveSubtypePerlModes.includes(mode));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= Number(floor.split(".")[1]));
	const json = async path => {
		const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
		assert.ok(bytes.toString() === canonicalJson(value), `Noncanonical record: ${path}`); return value;
	};
	const report = await json("report.json");
	const keys = ["authorInputsUnchanged", "builds", "configurations"
		, "declaredGlibcFloor"
		, "deliveryModes", "expectedBindingIrSha256", "independentBuilds"
		, "interpreters", "mode", "producerCommit", "reports", "reproducible"
		, "route", "runtime"
		, "schemaVersion", "sourceRemovedBeforeInstallation"];
	assert.deepEqual(Object.keys(report).sort(), keys);
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route); assert.equal(report.mode, mode);
	assert.equal(report.producerCommit, producerCommit); assert.equal(report.declaredGlibcFloor, floor);
	assert.deepEqual(report.configurations, checkedRecordPerlConfigurations); assert.deepEqual(report.deliveryModes, checkedRecordPerlModes);
	assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation"]) assert.equal(report[key], true, key);
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, runtimeRecord); assert.deepEqual(await json("runtime.json"), runtimeRecord);
	assert.deepEqual(report.interpreters.map(item => item.configuration), checkedRecordPerlConfigurations);
	assert.equal(new Set(report.interpreters.map(item => item.executableSha256)).size, 4);
	for(const item of report.interpreters)
	{ assertCheckedRecordPerlIdentity(item.configuration, item.identity); assert.match(item.executableSha256, /^[a-f0-9]{64}$/u); }
	const { model, receipt } = await checkNominalPrimitiveSubtypePerlModels({ report, read, json, route, mode, producerCommit });
	const caller = nominalPrimitiveSubtypePerlOriginal(producerCommit, "tests/fixtures/nominal-primitive-subtype-consumers/perl.pl").toString();
	assert.equal((await read("consumer.pl")).toString(), caller);
	const matrix = checkedRecordPerlConfigurations.flatMap(configuration => checkedRecordPerlModes.map(delivery => [configuration, delivery]));
	assert.deepEqual(report.reports.map(item => [item.configuration, item.delivery]), matrix);
	const manifests = {};
	for(const item of report.reports)
	{
		const prefix = `${item.configuration}/${item.delivery}/`;
		assert.deepEqual(await json(prefix + "report.json"), item);
		assert.equal(item.route, route); assert.equal(item.mode, mode);
		for(const [key, count] of Object.entries(nominalPrimitiveSubtypePerlCounts[mode])) assert.equal(item[key], count);
		assert.equal(item.consumerSha256, sha256(caller));
		assert.deepEqual(item.arguments, nominalPrimitiveSubtypePerlArguments(route, mode));
		const interpreter = report.interpreters.find(value => value.configuration === item.configuration);
		assert.deepEqual(item.identity, interpreter.identity); assert.equal(item.executableSha256, interpreter.executableSha256);
		const flags = ["offlineInstall", "compilerFreeExecution"
			, "leanCompilerUnavailable", "extractedDistributionsRemoved"
			, "nativePayloadUnchanged", "installedBytesUnchanged"
			, "relocatedInstallation", "compilerFreeReplay"
			, "sourceUnchangedAfterReplay"];
		for(const key of flags) assert.equal(item[key], true, key);
		assert.equal(item.installationCCompilerAvailable, item.delivery === "build-xs"); assert.equal(item.repeatedRuns, 2);
		assert.deepEqual(item.dispatch, { observed: false, reason: "Separate constructor/source entry probe remains required" });
		let first;
		for(const name of ["first.json", "repeated.json"])
		{
			const run = await json(prefix + name);
			assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);
			assert.equal(run.code, 0); assert.equal(run.stderr, ""); parseNominalPrimitiveSubtypePerlResult(run.stdout, mode);
			if(first) assert.deepEqual(run, first); else first = run;
		}
		await checkNominalPrimitiveSubtypePerlPackages({ read, json, item, receipt, model, producerCommit, floor });
		// Every installation inspected the same prepared archives; retain one manifest per role for the handoff check.
		for(const role of ["runtime", "component"])
		{
			const manifest = await json(prefix + `${role}-manifest.json`);
			if(manifests[role]) assert.deepEqual(manifest, manifests[role], `${prefix}${role} manifest`);
			manifests[role] = manifest;
		}
	}
	const handoff = await checkNominalPrimitiveSubtypePerlHandoff(read, { receipt, manifests });
	assert.deepEqual(Object.fromEntries(Object.entries(handoff.archives).map(([path, item]) => [path, item.sha256])), report.builds[0].archives);
	return { route, mode, producerCommit, runtime, floor
		, configurations: report.configurations
		, deliveryModes: report.deliveryModes
		, counts: nominalPrimitiveSubtypePerlCounts[mode]
		, executions: 16, dispatchObserved: false
		, handoff
		, records: nominalPrimitiveSubtypePerlRecords(route, receipt).length };
};
