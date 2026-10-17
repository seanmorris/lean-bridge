/**
 * Validate recursive checked-record Perl records without reopening producer temporary paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { reviewedContractDifference, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { assertCheckedRecordPerlIdentity } from "./checked-record-perl-install.mjs";
import {
	loadRecursiveCheckedRecordPerlCaller
	, parseRecursiveCheckedRecordPerlResult
	, recursiveCheckedRecordPerlCallerArguments
	, recursiveCheckedRecordPerlConfiguration
	, recursiveCheckedRecordPerlExpected
	, recursiveCheckedRecordPerlPackage
	, recursiveCheckedRecordPerlReview
} from "./recursive-checked-record-perl-fixture.mjs";
import {
	assertRecursiveCheckedRecordPerlPackageIdentity
	, recursiveCheckedRecordPerlConfigurations
	, recursiveCheckedRecordPerlInstallModes
} from "./recursive-checked-record-perl-install.mjs";
import { assertRecursiveCheckedRecordPerlResources } from "./recursive-checked-record-perl-resources.mjs";

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
 * @param root0 - Closed case and archive-relative byte access.
 * @param root0.name - Exact route/fixture case name.
 * @param root0.read - Reader which never follows recorded environment paths.
 */
export const assertRecursiveCheckedRecordPerlRecords = async ({ name, read }) => {
	const [route, fixture, ...rest] = name.split("-");
	assert.deepEqual(rest, []); assert.ok(["ordinary", "reviewed"].includes(route));
	assert.ok(["recursive", "mutual"].includes(fixture));
	const selected = recursiveCheckedRecordPerlPackage(fixture);
	const configuration = recursiveCheckedRecordPerlConfiguration(route, fixture);
	const expected = recursiveCheckedRecordPerlReview(fixture);
	const json = async path => {
		const bytes = Buffer.from(await read(path)).toString(), value = JSON.parse(bytes);
		assert.equal(bytes, canonicalJson(value), path); return value;
	};
	const report = await json("report.json");
	assert.deepEqual(Object.keys(report).sort(), [
		"authorInputsUnchanged", "builds", "configurations"
		, "expectedBindingIrSha256", "fixture", "glibcMinimumVersion"
		, "independentBuilds", "installModes", "interpreters", "loadCeiling"
		, "producerCommit", "reports", "reproducible", "resourceChecks"
		, "route", "runtime", "schemaVersion", "sourceRemovedBeforeInstallation"
	].sort());
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.fixture, fixture); assert.match(report.producerCommit, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(report.glibcMinimumVersion));
	assert.deepEqual(report.configurations, recursiveCheckedRecordPerlConfigurations);
	assert.deepEqual(report.installModes, recursiveCheckedRecordPerlInstallModes);
	assert.equal(report.reproducible, true); assert.equal(report.independentBuilds, 2);
	assert.equal(report.authorInputsUnchanged, true);
	assert.equal(report.sourceRemovedBeforeInstallation, true);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.deepEqual(await json("runtime.json"), report.runtime);
	assert.deepEqual(report.runtime, {
		platform: "linux", arch: "x64", glibc: report.runtime.glibc
	});
	assert.equal(report.runtime.glibc.code, 0); assert.equal(report.runtime.glibc.stderr, "");
	assert.match(report.runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
	const resources = await json("resources.json");
	assert.deepEqual(resources, report.resourceChecks); assert.ok(resources.length >= 3);
	for(const record of resources)
		assertRecursiveCheckedRecordPerlResources(record, report.loadCeiling);
	assert.deepEqual(report.interpreters.map(item => item.configuration)
		, recursiveCheckedRecordPerlConfigurations);
	for(const item of report.interpreters)
	{
		assertCheckedRecordPerlIdentity(item.configuration, item.identity);
		digest(item.executableSha256);
	}
	const source = await readFile(join(selected.root, `${selected.leanModule}.lean`), "utf8");
	let receipt;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, model = await json(prefix + "model.json");
		receipt = await json(prefix + "package-set-receipt.json");
		validatePackageSetReceipt(receipt);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json"), configuration);
		assert.equal(Buffer.from(await read(prefix + `${selected.leanModule}.lean`)).toString()
			, source);
		assert.equal(model.moduleName, selected.module); assert.equal(model.profile, "native-library-v1");
		assert.equal(model.pointerBits, 64); assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.exports.length, expected.declarations.length);
		assert.ok(model.exports.every(item => item.refinements));
		const identity = model.sourceIdentity;
		assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.equal(identity.modules.length, 1); assert.equal(identity.modules[0].module, selected.leanModule);
		assert.deepEqual(identity.modules[0].source, {
			path: `${selected.leanModule}.lean`
			, bytes: Buffer.byteLength(source)
			, sha256: sha256(source)
		});
		if(route === "reviewed")
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
			assert.deepEqual(identity.request[key], [selected.leanModule]);
		assert.equal(identity.request.profile, "native-library-v1");
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component); assert.equal(receipt.profiles.length, 1);
		assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(item => item.role).sort(), ["component", "runtime"]);
		assert.ok(receipt.packages.every(item => item.target === "cpan" && item.artifacts.length === 1));
		assert.deepEqual(report.builds[attempt], {
			bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(canonicalJson(receipt))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(item => [item.path, item.sha256])))
		});
		const author = await json(prefix + "author-inputs.json");
		const authorPaths = [
			"LICENSE", `${selected.leanModule}.lean`, "lakefile.toml"
			, "lean-bridge.exports.json", "lean-toolchain", "package.json"
			, ...route === "reviewed" ? ["api.binding-ir.json"] : []
		].sort();
		assert.deepEqual(author.map(item => item.path).sort(), authorPaths);
		for(const item of author)
		{
			assert.deepEqual(Object.keys(item).sort(), ["ctime", "mode", "mtime", "path", "sha256"]);
			assert.ok(Number.isFinite(item.ctime) && Number.isFinite(item.mtime));
			assert.equal(item.mode, 33188); safePath(item.path); digest(item.sha256);
		}
		assert.equal(author.find(item => item.path === `${selected.leanModule}.lean`).sha256
			, sha256(source));
		assert.equal(author.find(item => item.path === "lean-bridge.exports.json").sha256
			, sha256(canonicalJson(configuration)));
		if(route === "reviewed") assert.equal(author.find(item => item.path === "api.binding-ir.json").sha256
			, sha256(canonicalJson(expected)));
	}
	const caller = await loadRecursiveCheckedRecordPerlCaller();
	assert.equal(Buffer.from(await read("consumer.pl")).toString(), caller);
	const matrix = recursiveCheckedRecordPerlConfigurations.flatMap(configurationName =>
		recursiveCheckedRecordPerlInstallModes.map(installMode => [configurationName, installMode]));
	assert.deepEqual(report.reports.map(item => [item.configuration, item.installMode]), matrix);
	for(const item of report.reports)
	{
		const prefix = `${item.configuration}/${item.installMode}/`;
		assert.deepEqual(await json(prefix + "report.json"), item);
		assert.equal(item.route, route); assert.equal(item.fixture, fixture);
		assert.deepEqual(item.arguments, recursiveCheckedRecordPerlCallerArguments(fixture, route));
		assert.equal(item.consumerSha256, sha256(caller)); digest(item.resultSha256);
		assert.deepEqual(item.counts, recursiveCheckedRecordPerlExpected[fixture]);
		const interpreter = report.interpreters.find(value => value.configuration === item.configuration);
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
		const installedProcess = await json(prefix + "installed-process.json");
		const relocatedProcess = await json(prefix + "relocated-process.json");
		for(const process of [installedProcess, relocatedProcess])
		{
			assert.equal(process.code, 0); assert.equal(process.stderr, "");
			assert.equal(typeof process.stdout, "string");
		}
		const first = parseRecursiveCheckedRecordPerlResult(installedProcess.stdout, fixture, route);
		const repeated = parseRecursiveCheckedRecordPerlResult(relocatedProcess.stdout, fixture, route);
		assert.deepEqual(await json(prefix + "installed.json"), first);
		assert.deepEqual(await json(prefix + "relocated.json"), repeated);
		assert.notEqual(first.api, repeated.api); assert.deepEqual(stableResult(first), stableResult(repeated));
		assert.equal(item.resultSha256, sha256(canonicalJson(stableResult(first))));
		assert.deepEqual(item.failures, first.failures); assert.deepEqual(item.nativeLibraries, first.nativeLibraries);
		assert.deepEqual(item.traces.map(trace => trace.role), ["runtime", "component"]);
		const runtime = await json(prefix + "runtime-manifest.json");
		for(const recorded of item.traces)
		{
			const role = recorded.role, manifest = await json(prefix + `${role}-manifest.json`);
			const receiptBytes = Buffer.from(await read(prefix + `${role}-install-receipt.json`));
			const installation = JSON.parse(receiptBytes), trace = await json(prefix + `${role}-trace.json`);
			assert.equal(recorded.manifestSha256, sha256(canonicalJson(manifest)));
			assert.equal(recorded.receiptSha256, sha256(receiptBytes));
			assert.equal(recorded.traceSha256, sha256(canonicalJson(trace)));
			assertRecursiveCheckedRecordPerlPackageIdentity(
				manifest, receipt.packages.find(pkg => pkg.role === role), runtime, fixture
			);
			assert.equal(manifest.glibcMinimumVersion, report.glibcMinimumVersion);
			assert.equal(sha256(await read(prefix + `${role}-source.xs`)), manifest.files[manifest.xs]);
			const operation = item.installMode === "prebuilt-only" ? "prebuilt-xs" : "generated-xs-only";
			assert.equal(installation.operation, operation); assert.equal(trace.operation, operation);
			assert.equal(trace.nativePayloadUnchanged, true); assert.equal(trace.runtimeIdentity, manifest.runtimeIdentity);
			for(const field of ["archname", "useithreads", "usemultiplicity", "ivsize", "ptrsize"])
				assert.equal(installation.abi[field], item.identity[field] ?? "", field);
			assert.equal(installation.abi.api_revision, item.identity.version.split(".")[0]);
			assert.equal(installation.abi.api_version, item.identity.version.split(".")[1]);
			assert.equal(manifest.prebuilt.length, 4);
			assert.equal(new Set(manifest.prebuilt.map(value => value.abiKey)).size, 4);
			assert.ok(manifest.prebuilt.some(value => canonicalJson(value.abi) === canonicalJson(installation.abi)));
			const relative = manifest.module.replaceAll("::", "/"), suffix = `${relative}/install-receipt.json`;
			const matched = Object.keys(installed).filter(path => path.endsWith("/" + suffix));
			assert.equal(matched.length, 1); const base = matched[0].slice(0, -suffix.length);
			assert.equal(installed[matched[0]].sha256, sha256(receiptBytes)); assert.ok(trace.files.length > 1);
			for(const file of trace.files)
			{
				safePath(file.path); assert.equal(installed[base + file.path]?.sha256, file.sha256);
			}
			const payloads = Object.entries(manifest.files).filter(([path]) => path.startsWith("lib/"))
				.map(([path, fileSha256]) => ({ path: path.slice(4), sha256: fileSha256, origin: "prepared-payload" }));
			assert.deepEqual(trace.files.slice(0, -1), payloads);
			const stem = relative.split("/").at(-1);
			assert.deepEqual(trace.files.at(-1), {
				path: `auto/${relative}/${stem}.so`
				, sha256: installation.outputSha256
				, origin: operation
			});
			if(item.installMode === "prebuilt-only") assert.ok(manifest.prebuilt.some(value =>
				value.abiKey === sha256(JSON.stringify(JSON.parse(canonicalJson(installation.abi))))
				&& manifest.files[value.path] === installation.outputSha256));
			else
			{
				assert.equal(installation.sourceSha256, manifest.files[manifest.xs]);
				assert.equal(installation.runtimeIdentity, manifest.runtimeIdentity);
				digest(installation.generatedCSha256); assert.equal(installation.commands.length, 2);
				const [compile, link] = installation.commands;
				assert.deepEqual(compile.filter(argument => argument.endsWith(".c")), [`_xs-build/${stem}.c`]);
				assert.ok(compile.includes("-c")); assert.ok(link.includes(`_xs-build/${stem}.o`));
				assert.ok(link.includes(`_xs-build/${stem}.so`));
				assert.ok([compile[0], link[0]].every(command => !/(?:^|\/)(?:lean|lake|node|emcc)$/u.test(command)));
			}
		}
	}
	return report;
};
