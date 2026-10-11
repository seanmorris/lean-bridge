/**
 * Check original Perl checked-record records without reopening historical environment paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { checkedRecordPerlConfigurations, checkedRecordPerlModes, assertCheckedRecordPerlIdentity, assertCheckedRecordPerlPackageIdentity } from "./checked-record-perl-install.mjs";
import { checkedRecordPerlConsumer, checkedRecordPerlSelection } from "./checked-record-perl-fixture.mjs";
import { refinementsKey } from "./checked-record-fixture.mjs";

const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
// Perl's installed manual-page names may contain namespace colons.
const safePath = path => assert.ok(/^(?:[A-Za-z0-9_.:-]+\/)*[A-Za-z0-9_.:-]+$/u.test(path) && path.split("/").every(part => ![".", ".."].includes(part)));

/**
 * Validate every matrix entry, source choice, prepared identity and installed trace.
 *
 * @param options - Exact route and archive-relative byte access.
 * @param options.route - Ordinary/reviewed full or standalone result-only route.
 * @param options.read - Byte reader which never reopens recorded environment paths.
 */
export const assertCheckedRecordPerlRecords = async ({ route, read }) => {
	const selection = checkedRecordPerlSelection(route);
	const json = async path => {
		const bytes = Buffer.from(await read(path)).toString(), parsed = JSON.parse(bytes);
		assert.equal(bytes, canonicalJson(parsed), path); return parsed;
	};
	const report = await json("report.json");
	assert.deepEqual(Object.keys(report).sort(), ["builds", "configurations", "expectedBindingIrSha256", "glibcMinimumVersion", "interpreters", "modes", "reports", "reproducible", "route", "schemaVersion", "sourceRemovedBeforeInstallation"]);
	assert.ok(["2.36", "2.38"].includes(report.glibcMinimumVersion));
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.deepEqual(report.configurations, checkedRecordPerlConfigurations);
	assert.deepEqual(report.modes, checkedRecordPerlModes);
	assert.equal(report.reproducible, true); assert.equal(report.sourceRemovedBeforeInstallation, true);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(selection.expected));
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	assert.deepEqual(report.interpreters.map(item => item.configuration), checkedRecordPerlConfigurations);
	for(const item of report.interpreters)
	{ assertCheckedRecordPerlIdentity(item.configuration, item.identity); hash(item.executableSha256); }
	let receipt;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, model = await json(prefix + "model.json");
		receipt = await json(prefix + "package-set-receipt.json"); validatePackageSetReceipt(receipt);
		assert.deepEqual(await json(prefix + "expected.json"), selection.expected);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json"), selection.configuration);
		const source = await readFile("tests/fixtures/onboarding/checked-records/CheckedRecords.lean", "utf8");
		assert.equal(Buffer.from(await read(prefix + "CheckedRecords.lean")).toString(), source);
		assert.equal(model.moduleName, "LeanBridge::CheckedRecords");
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64);
		assert.equal(reviewedContractDifference(selection.expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.exports.length, selection.expected.declarations.length);
		for(const declaration of selection.expected.declarations)
		{
			const actual = model.exports.find(item => item.name === declaration.source.declaration);
			const tree = (site, constructor) => {
				const type = selection.expected.types.find(type => type.id === site.type.id);
				return type ? { kind: "checked-record", definition: type.id.slice(5), constructor, fields: type.fields.map(field => field.name) } : null;
			};
			assert.deepEqual(actual.refinements, {
				parameters: declaration.parameters.map((site, index) => tree(site, declaration.source.extensions[refinementsKey]?.parameters[index]?.constructor ?? null))
				, result: tree(declaration.result, null)
			});
		}
		const identity = model.sourceIdentity;
		assert.equal(identity.exportConfigurationSource, canonicalJson(selection.configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(selection.configuration)));
		assert.equal(identity.modules.length, 1);
		assert.equal(identity.modules[0].module, "CheckedRecords");
		assert.deepEqual(identity.modules[0].source, { path: "CheckedRecords.lean", bytes: Buffer.byteLength(source), sha256: sha256(source) });
		if(selection.reviewed)
		{
			assert.deepEqual(await json(prefix + "api.binding-ir.json"), selection.expected);
			assert.equal(identity.reviewedBindingIr.source, canonicalJson(selection.expected));
			assert.equal(identity.reviewedBindingIr.sourceSha256, sha256(canonicalJson(selection.expected)));
			assert.equal(identity.reviewedBindingIr.semanticSha256, hashBindingIr(selection.expected));
			const request = reviewedSourceSelection(identity.reviewedBindingIr);
			for(const key of ["contracts", "exports", "specializations"])
				assert.deepEqual(identity.request[key], request[key]);
		} else
		{
			assert.equal(identity.reviewedBindingIr, undefined);
			assert.deepEqual(identity.request.contracts, selection.configuration.contracts);
			assert.deepEqual(identity.request.exports, selection.configuration.exports);
			assert.equal(identity.request.specializations, undefined);
		}
		for(const key of ["arities", "resources"]) assert.deepEqual(identity.request[key], []);
		for(const key of ["modules", "exportModules"]) assert.deepEqual(identity.request[key], ["CheckedRecords"]);
		assert.equal(identity.request.profile, "native-library-v1");
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1);
		assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(item => item.role).sort(), ["component", "runtime"]);
		assert.ok(receipt.packages.every(item => item.target === "cpan" && item.artifacts.length === 1));
		assert.deepEqual(report.builds[attempt], {
			bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(canonicalJson(receipt))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))) });
	}
	const caller = await checkedRecordPerlConsumer(route);
	assert.equal(Buffer.from(await read("consumer.pl")).toString(), caller);
	const matrix = checkedRecordPerlConfigurations.flatMap(configuration => checkedRecordPerlModes.map(mode => [configuration, mode]));
	assert.deepEqual(report.reports.map(item => [item.configuration, item.mode]), matrix);
	for(const item of report.reports)
	{
		const prefix = `${item.configuration}/${item.mode}/`;
		assert.deepEqual(await json(prefix + "report.json"), item);
		assert.equal(item.route, route); assert.equal(item.checks, selection.checks);
		assert.equal(item.consumerSha256, sha256(caller));
		const interpreter = report.interpreters.find(value => value.configuration === item.configuration);
		assert.deepEqual(item.identity, interpreter.identity); assert.equal(item.executableSha256, interpreter.executableSha256);
		for(const key of ["offlineInstall", "compilerFreeExecution", "leanCompilerUnavailable", "extractedDistributionsRemoved", "nativePayloadUnchanged", "installedBytesUnchanged", "relocatedInstallation", "compilerFreeReplay", "sourceUnchangedAfterReplay"])
			assert.equal(item[key], true, key);
		assert.equal(item.installationCCompilerAvailable, item.mode === "build-xs"); assert.equal(item.repeatedRuns, 2);
		assert.deepEqual(item.dispatch, { observed: false, reason: "No entry instrumentation in this Perl installed acceptance" });
		const installed = await json(prefix + "installed-files.json");
		assert.equal(item.installedFilesSha256, sha256(canonicalJson(installed)));
		for(const [path, record] of Object.entries(installed))
		{ safePath(path); hash(record.sha256); assert.ok(Number.isSafeInteger(record.bytes) && record.bytes >= 0); }
		for(const name of ["first.stdout", "repeated.stdout"])
			assert.equal(Buffer.from(await read(prefix + name)).toString(), `checked-record-ok:${selection.checks}\n`);
		assert.deepEqual(item.traces.map(trace => trace.role), ["runtime", "component"]);
		const runtime = await json(prefix + "runtime-manifest.json");
		for(const recorded of item.traces)
		{
			const role = recorded.role, manifest = await json(prefix + `${role}-manifest.json`);
			const receiptBytes = await read(prefix + `${role}-install-receipt.json`), installation = JSON.parse(receiptBytes);
			const trace = await json(prefix + `${role}-trace.json`);
			assert.equal(recorded.manifestSha256, sha256(canonicalJson(manifest)));
			assert.equal(recorded.receiptSha256, sha256(receiptBytes)); assert.equal(recorded.traceSha256, sha256(canonicalJson(trace)));
			assertCheckedRecordPerlPackageIdentity(manifest, receipt.packages.find(pkg => pkg.role === role), runtime);
			assert.equal(manifest.module, role === "runtime" ? "LeanBridge::Runtime" : "LeanBridge::CheckedRecords");
			assert.equal(manifest.glibcMinimumVersion, report.glibcMinimumVersion);
			assert.equal(sha256(await read(prefix + `${role}-source.xs`)), manifest.files[manifest.xs]);
			const expectedOperation = item.mode === "prebuilt-only" ? "prebuilt-xs" : "generated-xs-only";
			assert.equal(installation.operation, expectedOperation); assert.equal(trace.operation, expectedOperation);
			assert.equal(trace.nativePayloadUnchanged, true); assert.equal(trace.runtimeIdentity, manifest.runtimeIdentity);
			for(const field of ["archname", "useithreads", "usemultiplicity", "ivsize", "ptrsize"])
				assert.equal(installation.abi[field], item.identity[field] ?? "", field);
			assert.equal(installation.abi.api_revision, item.identity.version.split(".")[0]);
			assert.equal(installation.abi.api_version, item.identity.version.split(".")[1]);
			assert.equal(manifest.prebuilt.length, 4);
			assert.equal(new Set(manifest.prebuilt.map(variant => variant.abiKey)).size, 4);
			assert.ok(manifest.prebuilt.some(variant => canonicalJson(variant.abi) === canonicalJson(installation.abi)));
			const relative = manifest.module.replaceAll("::", "/"), suffix = `${relative}/install-receipt.json`;
			const matched = Object.keys(installed).filter(path => path.endsWith("/" + suffix));
			assert.equal(matched.length, 1);
			const base = matched[0].slice(0, -suffix.length);
			assert.equal(installed[matched[0]].sha256, sha256(receiptBytes));
			assert.ok(trace.files.length > 1);
			for(const file of trace.files)
			{ safePath(file.path); assert.equal(installed[base + file.path]?.sha256, file.sha256); }
			const payloads = Object.entries(manifest.files).filter(([path]) => path.startsWith("lib/")).map(([path, sha256]) => ({ path: path.slice(4), sha256, origin: "prepared-payload" }));
			assert.deepEqual(trace.files.slice(0, -1), payloads);
			const xs = `auto/${relative}/${relative.split("/").at(-1)}.so`;
			assert.deepEqual(trace.files.at(-1), { path: xs, sha256: installation.outputSha256, origin: expectedOperation });
			if(item.mode === "prebuilt-only") assert.ok(manifest.prebuilt.some(variant => variant.abiKey === sha256(JSON.stringify(JSON.parse(canonicalJson(installation.abi)))) && manifest.files[variant.path] === installation.outputSha256));
			else
			{
				assert.equal(installation.sourceSha256, manifest.files[manifest.xs]);
				assert.equal(installation.runtimeIdentity, manifest.runtimeIdentity); hash(installation.generatedCSha256);
				assert.equal(installation.commands.length, 2);
				const [compile, link] = installation.commands, stem = relative.split("/").at(-1);
				assert.deepEqual(compile.filter(argument => argument.endsWith(".c")), [`_xs-build/${stem}.c`]);
				assert.ok(compile.includes("-c")); assert.ok(link.includes(`_xs-build/${stem}.o`));
				assert.ok(link.includes(`_xs-build/${stem}.so`));
				assert.ok([compile[0], link[0]].every(command => !/(?:^|\/)(?:lean|lake|node|emcc)$/u.test(command)));
			}
		}
	}
	return report;
};
