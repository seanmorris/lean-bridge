/**
 * Validate nested checked-record Perl records without reopening their original temporary paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { reviewedContractDifference, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { assertCheckedRecordPerlIdentity } from "./checked-record-perl-install.mjs";
import {
	assertNestedCheckedRecordPerlResult
	, nestedCheckedRecordPerlCaller
	, nestedCheckedRecordPerlConfiguration
	, nestedCheckedRecordPerlExpected
	, nestedCheckedRecordPerlReview
	, parseNestedCheckedRecordPerlResult
} from "./nested-checked-record-perl-fixture.mjs";
import {
	assertNestedCheckedRecordPerlPackageIdentity
	, nestedCheckedRecordPerlConfigurations
	, nestedCheckedRecordPerlInstallModes
} from "./nested-checked-record-perl-install.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const safePath = path => assert.ok(
	/^(?:[A-Za-z0-9_.:-]+\/)*[A-Za-z0-9_.:-]+$/u.test(path)
	&& path.split("/").every(part => ![".", ".."].includes(part))
);
const stableResult = value => {
	const copy = structuredClone(value); delete copy.api; return copy;
};

/**
 * Validate every author build, ABI, install mode, caller result, and relocation replay.
 *
 * @param options - Selection and archive-relative byte access.
 * @param options.name - Ordinary/reviewed and full/result-only case name.
 * @param options.read - Byte reader which never follows recorded environment paths.
 */
export const assertNestedCheckedRecordPerlRecords = async ({ name, read }) => {
	assert.ok([
		"ordinary-full"
		, "ordinary-result-only"
		, "reviewed-full"
		, "reviewed-result-only"
	].includes(name));
	const authorRoute = name.startsWith("ordinary-") ? "ordinary" : "reviewed";
	const apiMode = name.endsWith("-result-only") ? "result-only" : "full";
	const configuration = nestedCheckedRecordPerlConfiguration(authorRoute, apiMode);
	const expected = nestedCheckedRecordPerlReview(apiMode);
	const json = async path => {
		const bytes = Buffer.from(await read(path)).toString(), value = JSON.parse(bytes);
		assert.equal(bytes, canonicalJson(value), path); return value;
	};
	const report = await json("report.json");
	assert.deepEqual(Object.keys(report).sort(), [
		"apiMode", "authorRoute", "builds", "configurations"
		, "expectedBindingIrSha256", "glibcMinimumVersion", "installModes"
		, "interpreters", "name", "reports", "reproducible", "schemaVersion"
		, "sourceRemovedBeforeInstallation"
	]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.name, name);
	assert.equal(report.authorRoute, authorRoute); assert.equal(report.apiMode, apiMode);
	assert.ok(["2.36", "2.38"].includes(report.glibcMinimumVersion));
	assert.deepEqual(report.configurations, nestedCheckedRecordPerlConfigurations);
	assert.deepEqual(report.installModes, nestedCheckedRecordPerlInstallModes);
	assert.equal(report.reproducible, true);
	assert.equal(report.sourceRemovedBeforeInstallation, true);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	assert.deepEqual(report.interpreters.map(item => item.configuration)
		, nestedCheckedRecordPerlConfigurations);
	for(const item of report.interpreters)
	{
		assertCheckedRecordPerlIdentity(item.configuration, item.identity);
		digest(item.executableSha256);
	}
	let receipt;
	const source = await readFile(
		"tests/fixtures/onboarding/nested-checked-records/NestedCheckedRecords.lean", "utf8"
	);
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, model = await json(prefix + "model.json");
		receipt = await json(prefix + "package-set-receipt.json");
		validatePackageSetReceipt(receipt);
		assert.deepEqual(await json(prefix + "expected.binding-ir.json"), expected);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json"), configuration);
		assert.equal(Buffer.from(await read(prefix + "NestedCheckedRecords.lean")).toString()
			, source);
		assert.equal(model.moduleName, "LeanBridge::NestedCheckedRecords");
		assert.equal(model.profile, "native-library-v1");
		assert.equal(model.pointerBits, 64);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.exports.length, expected.declarations.length);
		assert.ok(model.exports.every(item => item.refinements));
		const identity = model.sourceIdentity;
		assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.equal(identity.modules.length, 1);
		assert.equal(identity.modules[0].module, "NestedCheckedRecords");
		assert.deepEqual(identity.modules[0].source, {
			path: "NestedCheckedRecords.lean", bytes: Buffer.byteLength(source)
			, sha256: sha256(source)
		});
		if(authorRoute === "reviewed")
		{
			assert.deepEqual(await json(prefix + "api.binding-ir.json"), expected);
			assert.equal(identity.reviewedBindingIr.source, canonicalJson(expected));
			assert.equal(identity.reviewedBindingIr.sourceSha256, sha256(canonicalJson(expected)));
			assert.equal(identity.reviewedBindingIr.semanticSha256, hashBindingIr(expected));
			const selection = reviewedSourceSelection(identity.reviewedBindingIr);
			for(const key of ["contracts", "exports", "specializations"])
				assert.deepEqual(identity.request[key], selection[key]);
		}
		else
		{
			assert.equal(identity.reviewedBindingIr, undefined);
			assert.deepEqual(identity.request.contracts, configuration.contracts);
			assert.deepEqual(identity.request.exports, configuration.exports);
			assert.equal(identity.request.specializations, undefined);
		}
		for(const key of ["arities", "resources"]) assert.deepEqual(identity.request[key], []);
		for(const key of ["modules", "exportModules"])
			assert.deepEqual(identity.request[key], ["NestedCheckedRecords"]);
		assert.equal(identity.request.profile, "native-library-v1");
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1);
		assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(item => item.role).sort()
			, ["component", "runtime"]);
		assert.ok(receipt.packages.every(item =>
			item.target === "cpan" && item.artifacts.length === 1));
		assert.deepEqual(report.builds[attempt], {
			bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(canonicalJson(receipt))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(item => [item.path, item.sha256])))
		});
	}
	const caller = await nestedCheckedRecordPerlCaller(authorRoute, apiMode);
	assert.equal(Buffer.from(await read("consumer.pl")).toString(), caller);
	const matrix = nestedCheckedRecordPerlConfigurations.flatMap(configurationName =>
		nestedCheckedRecordPerlInstallModes.map(installMode => [configurationName, installMode]));
	assert.deepEqual(report.reports.map(item => [item.configuration, item.installMode]), matrix);
	for(const item of report.reports)
	{
		const prefix = `${item.configuration}/${item.installMode}/`;
		assert.deepEqual(await json(prefix + "report.json"), item);
		assert.equal(item.authorRoute, authorRoute); assert.equal(item.apiMode, apiMode);
		assert.equal(item.consumerSha256, sha256(caller)); digest(item.resultSha256);
		assert.deepEqual(item.counts, nestedCheckedRecordPerlExpected[apiMode]);
		const interpreter = report.interpreters.find(value =>
			value.configuration === item.configuration);
		assert.deepEqual(item.identity, interpreter.identity);
		assert.equal(item.executableSha256, interpreter.executableSha256);
		for(const key of [
			"offlineInstall", "compilerFreeExecution", "leanCompilerUnavailable"
			, "extractedDistributionsRemoved", "nativePayloadUnchanged"
			, "installedBytesUnchanged", "relocatedInstallation", "compilerFreeReplay"
			, "relocatedApiPath", "callerInputsUnchanged", "proofFieldsAbsent"
			, "sourceUnchangedAfterReplay"
		]) assert.equal(item[key], true, key);
		assert.equal(item.installationCCompilerAvailable, item.installMode === "build-xs");
		assert.equal(item.repeatedRuns, 2);
		const installed = await json(prefix + "installed-files.json");
		assert.equal(item.installedFilesSha256, sha256(canonicalJson(installed)));
		for(const [path, record] of Object.entries(installed))
		{
			safePath(path); digest(record.sha256);
			assert.ok(Number.isSafeInteger(record.bytes) && record.bytes >= 0);
		}
		const first = assertNestedCheckedRecordPerlResult(
			parseNestedCheckedRecordPerlResult(Buffer.from(await read(prefix + "first.json")).toString())
			, apiMode
		);
		const repeated = assertNestedCheckedRecordPerlResult(
			parseNestedCheckedRecordPerlResult(Buffer.from(await read(prefix + "repeated.json")).toString())
			, apiMode
		);
		assert.notEqual(first.api, repeated.api);
		assert.deepEqual(stableResult(first), stableResult(repeated));
		assert.equal(item.resultSha256, sha256(canonicalJson(stableResult(first))));
		assert.deepEqual(item.nativeLibraries, first.nativeLibraries);
		assert.deepEqual(item.traces.map(trace => trace.role), ["runtime", "component"]);
		const runtime = await json(prefix + "runtime-manifest.json");
		for(const recorded of item.traces)
		{
			const role = recorded.role;
			const manifest = await json(prefix + `${role}-manifest.json`);
			const receiptBytes = await read(prefix + `${role}-install-receipt.json`);
			const installation = JSON.parse(receiptBytes);
			const trace = await json(prefix + `${role}-trace.json`);
			assert.equal(recorded.manifestSha256, sha256(canonicalJson(manifest)));
			assert.equal(recorded.receiptSha256, sha256(receiptBytes));
			assert.equal(recorded.traceSha256, sha256(canonicalJson(trace)));
			assertNestedCheckedRecordPerlPackageIdentity(
				manifest, receipt.packages.find(pkg => pkg.role === role), runtime
			);
			assert.equal(manifest.glibcMinimumVersion, report.glibcMinimumVersion);
			assert.equal(sha256(await read(prefix + `${role}-source.xs`))
				, manifest.files[manifest.xs]);
			const operation = item.installMode === "prebuilt-only"
				? "prebuilt-xs" : "generated-xs-only";
			assert.equal(installation.operation, operation);
			assert.equal(trace.operation, operation);
			assert.equal(trace.nativePayloadUnchanged, true);
			assert.equal(trace.runtimeIdentity, manifest.runtimeIdentity);
			for(const field of ["archname", "useithreads", "usemultiplicity", "ivsize", "ptrsize"])
				assert.equal(installation.abi[field], item.identity[field] ?? "", field);
			assert.equal(installation.abi.api_revision, item.identity.version.split(".")[0]);
			assert.equal(installation.abi.api_version, item.identity.version.split(".")[1]);
			assert.equal(manifest.prebuilt.length, 4);
			assert.equal(new Set(manifest.prebuilt.map(value => value.abiKey)).size, 4);
			assert.ok(manifest.prebuilt.some(value =>
				canonicalJson(value.abi) === canonicalJson(installation.abi)));
			const relative = manifest.module.replaceAll("::", "/");
			const suffix = `${relative}/install-receipt.json`;
			const matched = Object.keys(installed).filter(path => path.endsWith("/" + suffix));
			assert.equal(matched.length, 1);
			const base = matched[0].slice(0, -suffix.length);
			assert.equal(installed[matched[0]].sha256, sha256(receiptBytes));
			assert.ok(trace.files.length > 1);
			for(const file of trace.files)
			{
				safePath(file.path);
				assert.equal(installed[base + file.path]?.sha256, file.sha256);
			}
			const payloads = Object.entries(manifest.files)
				.filter(([path]) => path.startsWith("lib/"))
				.map(([path, fileSha256]) => ({
					path: path.slice(4), sha256: fileSha256, origin: "prepared-payload"
				}));
			assert.deepEqual(trace.files.slice(0, -1), payloads);
			const stem = relative.split("/").at(-1);
			assert.deepEqual(trace.files.at(-1), {
				path: `auto/${relative}/${stem}.so`, sha256: installation.outputSha256
				, origin: operation
			});
			if(item.installMode === "prebuilt-only")
				assert.ok(manifest.prebuilt.some(value =>
					value.abiKey === sha256(JSON.stringify(JSON.parse(canonicalJson(installation.abi))))
					&& manifest.files[value.path] === installation.outputSha256));
			else
			{
				assert.equal(installation.sourceSha256, manifest.files[manifest.xs]);
				assert.equal(installation.runtimeIdentity, manifest.runtimeIdentity);
				digest(installation.generatedCSha256); assert.equal(installation.commands.length, 2);
				const [compile, link] = installation.commands;
				assert.deepEqual(compile.filter(argument => argument.endsWith(".c"))
					, [`_xs-build/${stem}.c`]);
				assert.ok(compile.includes("-c")); assert.ok(link.includes(`_xs-build/${stem}.o`));
				assert.ok(link.includes(`_xs-build/${stem}.so`));
				assert.ok([compile[0], link[0]].every(command =>
					!/(?:^|\/)(?:lean|lake|node|emcc)$/u.test(command)));
			}
		}
	}
	return report;
};
