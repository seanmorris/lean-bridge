/**
 * Independently reconcile retained value-indexed checked-record Perl evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	checkedRecordValueIndexFixtureRoot, checkedRecordValueIndexModule
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexPerlConsumer, checkedRecordValueIndexPerlExpected
	, checkedRecordValueIndexPerlModule, checkedRecordValueIndexPerlSelection
} from "./checked-record-value-index-perl-fixture.mjs";
import {
	assertCheckedRecordValueIndexPerlPackageIdentity
	, checkedRecordValueIndexPerlConfigurations
	, checkedRecordValueIndexPerlInstallModes
} from "./checked-record-value-index-perl-install.mjs";
import { assertCheckedRecordPerlIdentity } from "./checked-record-perl-install.mjs";

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label);
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const json = (bytes, label) => {
	const text = Buffer.from(bytes).toString(), value = JSON.parse(text);
	assert.equal(text, canonicalJson(value), label); return value;
};
const source = (commit, path) => execFileSync("git", [
	"show", `${commit}:${checkedRecordValueIndexFixtureRoot}/${path}`
], { maxBuffer: 16 * 1024 * 1024 });
const safePath = path => assert.ok(typeof path === "string"
	&& /^(?:[A-Za-z0-9_.:-]+\/)*[A-Za-z0-9_.:-]+$/u.test(path)
	&& path.split("/").every(part => part && part !== "." && part !== ".."));

const fixtureFiles = Object.freeze([
	`${checkedRecordValueIndexModule}.lean`, "LICENSE", "lakefile.toml"
	, "lean-toolchain", "package.json"
]);

const assertProcess = (value, expected, label) => {
	assert.equal(typeof value, "object", label);
	assert.equal(value.stderr, "", `${label} stderr`);
	assert.equal(value.stdout, `${canonicalJson(expected)}\n`, `${label} stdout`);
};

/**
 * Validate one complete route of original author/build/install records.
 *
 * @param options - Exact route, producer commit, and byte reader.
 * @param options.route - Ordinary/reviewed and full/result-only route.
 * @param options.producerCommit - Revision that produced the evidence.
 * @param options.read - Relative evidence byte reader.
 * @param options.interpreters - Optional independently observed toolchains.
 */
export const assertCheckedRecordValueIndexPerlRecords = async ({
	route, producerCommit, read, interpreters: observedInterpreters
}) => {
	const selection = checkedRecordValueIndexPerlSelection(route);
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const report = json(await read("report.json"), "canonical report");
	exactKeys(report, [
		"schemaVersion", "route", "producerCommit", "runtime", "glibcMinimumVersion"
		, "configurations", "installModes", "interpreters", "builds", "reports"
		, "reproducible", "independentBuilds", "authorInputsUnchanged"
		, "sourceRemovedBeforeInstallation", "expectedBindingIrSha256"
	], "report keys");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.runtime, json(await read("runtime.json"), "runtime"));
	assert.deepEqual([report.runtime.platform, report.runtime.arch], ["linux", "x64"]);
	assert.match(report.runtime.glibc, /^2\.[0-9]+$/u);
	assert.ok(["2.36", "2.38"].includes(report.glibcMinimumVersion));
	assert.ok(Number(report.runtime.glibc.split(".")[1])
		>= Number(report.glibcMinimumVersion.split(".")[1]));
	assert.deepEqual(report.configurations, checkedRecordValueIndexPerlConfigurations);
	assert.deepEqual(report.installModes, checkedRecordValueIndexPerlInstallModes);
	assert.equal(report.reproducible, true); assert.equal(report.independentBuilds, 2);
	assert.equal(report.authorInputsUnchanged, true);
	assert.equal(report.sourceRemovedBeforeInstallation, true);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(selection.expected));
	assert.deepEqual(json(await read("configuration.json"), "configuration")
		, selection.configuration);
	assert.deepEqual(json(await read("expected.binding-ir.json"), "review")
		, selection.expected);
	assert.equal(Buffer.from(await read("consumer.pl")).toString()
		, await checkedRecordValueIndexPerlConsumer(route));
	const interpreters = json(await read("interpreters.json"), "interpreters");
	assert.deepEqual(interpreters, report.interpreters);
	if(observedInterpreters !== undefined)
		assert.deepEqual(interpreters, observedInterpreters);
	assert.deepEqual(interpreters.map(item => item.configuration)
		, checkedRecordValueIndexPerlConfigurations);
	for(const item of interpreters)
	{
		exactKeys(item, ["configuration", "command", "executable", "identity"]
			, "interpreter keys");
		assert.match(item.command, /^\//u);
		assertCheckedRecordPerlIdentity(item.configuration, item.identity);
		assert.ok(Number.isSafeInteger(item.executable.bytes) && item.executable.bytes > 0);
		hash(item.executable.sha256);
	}
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	let receipt;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}`;
		const authorInputs = json(await read(`${prefix}/author-inputs.json`)
			, `${prefix} author inputs`);
		const expectedInputs = [
			...fixtureFiles, "lean-bridge.exports.json"
			, ...selection.reviewed ? ["api.binding-ir.json"] : []
		].sort();
		assert.deepEqual(authorInputs.map(item => item.path).sort(), expectedInputs);
		for(const item of authorInputs)
		{
			exactKeys(item, ["mode", "path", "sha256"], `${prefix} author input`);
			assert.equal(item.mode, 33188); hash(item.sha256);
		}
		for(const path of fixtureFiles)
		{
			const item = authorInputs.find(value => value.path === path);
			assert.ok(item, path); assert.equal(item.sha256, sha256(source(producerCommit, path)));
		}
		assert.equal(authorInputs.find(item => item.path === "lean-bridge.exports.json").sha256
			, sha256(canonicalJson(selection.configuration)));
		if(selection.reviewed)
			assert.equal(authorInputs.find(item => item.path === "api.binding-ir.json").sha256
				, sha256(canonicalJson(selection.expected)));
		assert.deepEqual(await read(`${prefix}/${checkedRecordValueIndexModule}.lean`)
			, source(producerCommit, `${checkedRecordValueIndexModule}.lean`));
		assert.deepEqual(json(await read(`${prefix}/lean-bridge.exports.json`)
			, `${prefix} configuration`), selection.configuration);
		if(selection.reviewed)
			assert.deepEqual(json(await read(`${prefix}/api.binding-ir.json`)
				, `${prefix} reviewed IR`), selection.expected);
		const modelBytes = await read(`${prefix}/model.json`);
		const model = json(modelBytes, `${prefix} model`);
		assert.equal(model.moduleName, checkedRecordValueIndexPerlModule);
		assert.equal(model.profile, "native-library-v1");
		assert.equal(reviewedContractDifference(selection.expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		const receiptBytes = await read(`${prefix}/package-set-receipt.json`);
		receipt = json(receiptBytes, `${prefix} receipt`);
		validatePackageSetReceipt(receipt);
		assert.deepEqual(receipt.packages.map(item => [item.target, item.role]).sort()
			, [["cpan", "component"], ["cpan", "runtime"]]);
		assert.deepEqual(report.builds[attempt], {
			bindingIrSha256: model.bindingIrSha256, modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(artifact => [artifact.path, artifact.sha256])))
		});
	}
	const caller = await checkedRecordValueIndexPerlConsumer(route);
	const expected = checkedRecordValueIndexPerlExpected(route);
	const matrix = checkedRecordValueIndexPerlConfigurations.flatMap(configuration =>
		checkedRecordValueIndexPerlInstallModes.map(installMode => [configuration, installMode]));
	assert.deepEqual(report.reports.map(item => [item.configuration, item.installMode])
		, matrix);
	for(const item of report.reports)
	{
		const prefix = `${item.configuration}/${item.installMode}`;
		assert.deepEqual(json(await read(`${prefix}/report.json`), `${prefix} report`), item);
		exactKeys(item, [
			"configuration", "installMode", "route", "identity", "executableSha256"
			, "consumerSha256", "resultSha256", "installedFilesSha256", "traces"
			, "counts"
			, "offlineInstall"
			, "compilerFreeExecution"
			, "leanCompilerUnavailable"
			, "extractedDistributionsRemoved"
			, "nativePayloadUnchanged"
			, "installedBytesUnchanged"
			, "relocatedInstallation", "compilerFreeReplay", "repeatedRuns"
			, "callerInputsUnchanged"
			, "proofFieldsAbsent"
			, "installationCCompilerAvailable"
			, "sourceUnchangedAfterReplay"
		], `${prefix} report keys`);
		assert.equal(item.route, route);
		assert.ok(checkedRecordValueIndexPerlConfigurations.includes(item.configuration));
		assert.ok(checkedRecordValueIndexPerlInstallModes.includes(item.installMode));
		assertCheckedRecordPerlIdentity(item.configuration, item.identity);
		const interpreter = interpreters.find(value => value.configuration === item.configuration);
		assert.deepEqual(item.identity, interpreter.identity);
		assert.equal(item.executableSha256, interpreter.executable.sha256);
		assert.equal(item.consumerSha256, sha256(caller));
		assert.deepEqual(item.counts, expected);
		assert.equal(item.resultSha256, sha256(canonicalJson(expected)));
		for(const field of [
			"offlineInstall", "compilerFreeExecution", "leanCompilerUnavailable"
			, "extractedDistributionsRemoved"
			, "nativePayloadUnchanged"
			, "installedBytesUnchanged"
			, "relocatedInstallation", "compilerFreeReplay", "callerInputsUnchanged"
			, "proofFieldsAbsent", "sourceUnchangedAfterReplay"
		]) assert.equal(item[field], true, `${prefix} ${field}`);
		assert.equal(item.repeatedRuns, 2);
		assert.equal(item.installationCCompilerAvailable, item.installMode === "build-xs");
		assert.deepEqual(json(await read(`${prefix}/installed.json`), `${prefix} installed`)
			, expected);
		assert.deepEqual(json(await read(`${prefix}/relocated.json`), `${prefix} relocated`)
			, expected);
		assertProcess(json(await read(`${prefix}/installed-process.json`)
			, `${prefix} installed process`), expected, `${prefix} installed process`);
		assertProcess(json(await read(`${prefix}/relocated-process.json`)
			, `${prefix} relocated process`), expected, `${prefix} relocated process`);
		const installed = json(await read(`${prefix}/installed-files.json`), `${prefix} files`);
		assert.equal(item.installedFilesSha256, sha256(canonicalJson(installed)));
		for(const [path, file] of Object.entries(installed))
		{
			safePath(path); exactKeys(file, ["bytes", "sha256"], `${prefix} file`);
			assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); hash(file.sha256);
		}
		assert.deepEqual(item.traces.map(trace => trace.role), ["runtime", "component"]);
		const runtime = json(await read(`${prefix}/runtime-manifest.json`), `${prefix} runtime`);
		for(const recorded of item.traces)
		{
			const role = recorded.role;
			const manifest = json(await read(`${prefix}/${role}-manifest.json`)
				, `${prefix} ${role} manifest`);
			const installationBytes = await read(`${prefix}/${role}-install-receipt.json`);
			const installation = JSON.parse(installationBytes);
			const trace = json(await read(`${prefix}/${role}-trace.json`), `${prefix} ${role} trace`);
			hash(recorded.manifestSha256); hash(recorded.receiptSha256); hash(recorded.traceSha256);
			assert.equal(recorded.manifestSha256, sha256(canonicalJson(manifest)));
			assert.equal(recorded.receiptSha256, sha256(installationBytes));
			assert.equal(recorded.traceSha256, sha256(canonicalJson(trace)));
			assertCheckedRecordValueIndexPerlPackageIdentity(manifest
				, receipt.packages.find(pkg => pkg.role === role), runtime);
			assert.equal(manifest.glibcMinimumVersion, report.glibcMinimumVersion);
			assert.equal(sha256(await read(`${prefix}/${role}-source.xs`))
				, manifest.files[manifest.xs]);
			const operation = item.installMode === "prebuilt-only"
				? "prebuilt-xs" : "generated-xs-only";
			assert.equal(installation.operation, operation); assert.equal(trace.operation, operation);
			assert.equal(trace.nativePayloadUnchanged, true);
			assert.equal(trace.runtimeIdentity, manifest.runtimeIdentity);
			for(const field of ["archname", "useithreads", "usemultiplicity", "ivsize", "ptrsize"])
				assert.equal(installation.abi[field], item.identity[field] ?? "", field);
			assert.equal(installation.abi.api_revision, item.identity.version.split(".")[0]);
			assert.equal(installation.abi.api_version, item.identity.version.split(".")[1]);
			assert.equal(manifest.prebuilt.length, 4);
			assert.equal(new Set(manifest.prebuilt.map(variant => variant.abiKey)).size, 4);
			assert.ok(manifest.prebuilt.some(variant =>
				canonicalJson(variant.abi) === canonicalJson(installation.abi)));
		}
	}
	return report;
};
