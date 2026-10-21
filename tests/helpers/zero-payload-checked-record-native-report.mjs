/**
 * Independently reconcile retained C/C++ zero-payload package records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	zeroPayloadCheckedRecordFixture, zeroPayloadCheckedRecordModule
} from "./zero-payload-checked-record-fixture.mjs";
import {
	parseZeroPayloadNativeResult, zeroPayloadNativeCaller
	, zeroPayloadNativeProfiles, zeroPayloadNativeRoutes
	, zeroPayloadNativeSelection
} from "./zero-payload-checked-record-native-fixture.mjs";

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label);
const json = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};
const fixturePaths = Object.freeze([
	`${zeroPayloadCheckedRecordModule}.lean`, "LICENSE", "lakefile.toml"
	, "lean-toolchain", "package.json"
]);
const original = (commit, path) => execFileSync("git", [
	"show", `${commit}:${zeroPayloadCheckedRecordFixture}/${path}`
], { maxBuffer: 16 * 1024 * 1024 });

/**
 * Complete route-relative retained-file closure before controls are added.
 *
 * @param route - Exact author/API route.
 * @param receipt - Authenticated native package-set receipt.
 */
export const zeroPayloadNativeRecordPaths = (route, receipt) => {
	assert.ok(zeroPayloadNativeRoutes.includes(route));
	validatePackageSetReceipt(receipt);
	const build = [
		"author-inputs.json", "model.json", "package-set-receipt.json"
		, `${zeroPayloadCheckedRecordModule}.lean`, "lean-bridge.exports.json"
		, ...route.endsWith("reviewed-ir") ? ["api.binding-ir.json"] : []
	];
	return [
		"configuration.json", "expected.binding-ir.json", "report.json"
		, "runtime.json"
		, ...[0, 1].flatMap(attempt => build.map(path => `build-${attempt}/${path}`))
		, ...zeroPayloadNativeProfiles.flatMap(profile => [
			`consumers/${profile}.${profile}`, `${profile}/report.json`
			, `${profile}/lean-bridge-package.json`
			, `${profile}/installed.stdout`, `${profile}/relocated.stdout`
		])
		, ...[
			"package-set-receipt.json", "package-set-receipt.json.sha256"
			, ...receipt.packages.flatMap(pkg => pkg.artifacts.map(item => item.path))
		].map(path => `handoff/${path}`)
	].sort();
};

/**
 * Bind an installed package to the compiler-derived, reproducible Binding IR.
 *
 * @param packageReceipt - Metadata copied beside the installed public headers.
 * @param report - Route report containing both independent build identities.
 * @param profile - Native target used in assertion labels.
 */
export const assertZeroPayloadNativeInstalledBindingIr = (
	packageReceipt, report, profile
) => {
	assert.equal(report.builds.length, 2);
	assert.equal(report.builds[0].bindingIrSha256
		, report.builds[1].bindingIrSha256, "Reproducible native Binding IR");
	assert.equal(packageReceipt.bindingIrSha256
		, report.builds[0].bindingIrSha256
		, `${profile} installed compiler Binding IR`);
};

/**
 * Authenticate one complete independently built and consumed native route.
 *
 * @param read - Reader relative to the route record root.
 * @param options - Frozen producer, consumer and runtime identities.
 * @param options.route - Exact author/API route.
 * @param options.producerCommit - Package-producing Git revision.
 * @param options.consumerCommit - Caller-producing Git revision.
 * @param options.runtime - Independently observed host/toolchain identity.
 * @param options.floor - Declared glibc compatibility floor.
 */
export const checkZeroPayloadNativeReport = async (read, options) => {
	const { route, producerCommit, consumerCommit, runtime, floor } = options;
	assert.ok(zeroPayloadNativeRoutes.includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.match(consumerCommit, /^[a-f0-9]{40}$/u);
	assert.match(floor, /^2\.[0-9]+$/u);
	const selection = zeroPayloadNativeSelection(route);
	const reportBytes = await read("report.json");
	const report = json(reportBytes, "canonical report");
	exactKeys(report, [
		"schemaVersion", "route", "producerCommit", "consumerCommit", "runtime"
		, "declaredGlibcFloor", "configuration", "expectedBindingIrSha256"
		, "builds", "receipt", "reports", "profiles", "independentBuilds"
		, "reproducible", "authorInputsUnchanged", "sourceCommitClean"
		, "sourceRemovedBeforeInstallation", "offlineInstall"
		, "compilerFreePath", "relocatedInstallation"
		, "immutableCallerAssertions", "negativeControls"
	], "top-level report keys");
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.consumerCommit, consumerCommit);
	assert.deepEqual(report.runtime, runtime, "report runtime identity");
	assert.deepEqual(json(await read("runtime.json"), "runtime record"), runtime
		, "runtime record identity");
	assert.equal(report.declaredGlibcFloor, floor);
	assert.deepEqual(report.profiles, zeroPayloadNativeProfiles);
	assert.equal(report.independentBuilds, 2);
	for(const field of [
		"reproducible", "authorInputsUnchanged", "sourceCommitClean"
		, "sourceRemovedBeforeInstallation", "offlineInstall"
		, "compilerFreePath", "relocatedInstallation"
		, "immutableCallerAssertions"
	]) assert.equal(report[field], true, field);
	assert.deepEqual(report.negativeControls, {
		checkedRefusals: selection.resultOnly ? 0 : 1
		, shapeRefusals: 0, recoveries: selection.resultOnly ? 0 : 1
	});
	assert.deepEqual(report.configuration, selection.configuration);
	assert.deepEqual(json(await read("configuration.json"), "configuration")
		, selection.configuration);
	const expected = json(await read("expected.binding-ir.json"), "expected IR");
	assert.deepEqual(expected, selection.expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	let receipt;
	for(const [attempt, build] of report.builds.entries())
	{
		exactKeys(build, [
			"authorInputsSha256", "bindingIrSha256", "modelSha256"
			, "receiptSha256", "archives"
		], `build-${attempt} keys`);
		const prefix = `build-${attempt}`;
		const inputs = json(await read(`${prefix}/author-inputs.json`)
			, `${prefix} author inputs`);
		const expectedPaths = [
			...fixturePaths, "lean-bridge.exports.json"
			, ...selection.reviewed ? ["api.binding-ir.json"] : []
		].sort();
		assert.deepEqual(inputs.map(item => item.path).sort(), expectedPaths);
		assert.ok(inputs.every(item => item.mode === 33188));
		const stable = inputs.map(({ path, mode, sha256: digest }) => ({
			path, mode, sha256: digest
		}));
		assert.equal(sha256(canonicalJson(stable)), build.authorInputsSha256);
		for(const path of fixturePaths)
		{
			const input = inputs.find(item => item.path === path);
			assert.ok(input, path);
			assert.equal(input.sha256, sha256(original(producerCommit, path)), path);
		}
		assert.equal(inputs.find(item => item.path === "lean-bridge.exports.json").sha256
			, sha256(canonicalJson(selection.configuration)));
		if(selection.reviewed)
			assert.equal(inputs.find(item => item.path === "api.binding-ir.json").sha256
				, sha256(canonicalJson(expected)));
		assert.deepEqual(await read(`${prefix}/${zeroPayloadCheckedRecordModule}.lean`)
			, original(producerCommit, `${zeroPayloadCheckedRecordModule}.lean`));
		const modelBytes = await read(`${prefix}/model.json`);
		const model = json(modelBytes, `${prefix} model`);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null
			, `${prefix} independently reconciles with reviewed Binding IR`);
		assert.equal(hashBindingIr(model.bindingIr), build.bindingIrSha256);
		assert.equal(model.bindingIrSha256, build.bindingIrSha256);
		assert.equal(sha256(modelBytes), build.modelSha256);
		assert.equal(model.profile, "native-library-v1");
		const receiptBytes = await read(`${prefix}/package-set-receipt.json`);
		receipt = json(receiptBytes, `${prefix} receipt`);
		validatePackageSetReceipt(receipt);
		assert.equal(sha256(receiptBytes), build.receiptSha256);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort()
			, zeroPayloadNativeProfiles);
		assert.deepEqual(build.archives, Object.fromEntries(
			receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [
				item.path, item.sha256
			]))
		));
	}
	const handoffBytes = await read("handoff/package-set-receipt.json");
	const handoffReceipt = json(handoffBytes, "handoff receipt");
	assert.deepEqual(handoffReceipt, receipt);
	assert.deepEqual(report.receipt, receipt);
	assert.equal(sha256(handoffBytes), report.builds[0].receiptSha256);
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString()
		, `${sha256(handoffBytes)}  package-set-receipt.json\n`);
	for(const pkg of receipt.packages) for(const artifact of pkg.artifacts)
		assert.equal(sha256(await read(`handoff/${artifact.path}`)), artifact.sha256
			, artifact.path);
	assert.deepEqual(report.reports.map(item => item.profile)
		, zeroPayloadNativeProfiles);
	for(const profile of zeroPayloadNativeProfiles)
	{
		const caller = await zeroPayloadNativeCaller(profile, route, path =>
			execFileSync("git", ["show", `${consumerCommit}:${path}`]
				, { maxBuffer: 16 * 1024 * 1024 }));
		const source = await read(`consumers/${profile}.${profile}`);
		assert.equal(source.toString(), caller.source, `${profile} caller source`);
		const item = json(await read(`${profile}/report.json`), `${profile} report`);
		assert.deepEqual(item, report.reports.find(value => value.profile === profile));
		exactKeys(item, [
			"schemaVersion", "route", "profile", "packages", "consumerSha256"
			, "checks", "calls", "rejections", "recoveries", "installed"
			, "relocated", "closure", "installedTree"
			, "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"
			, "relocatedInstallation", "immutableCallerAssertions", "repeatExecution"
		], `${profile} report keys`);
		assert.equal(item.schemaVersion, 1);
		assert.equal(item.route, route); assert.equal(item.profile, profile);
		assert.equal(item.consumerSha256, sha256(source));
		for(const key of ["checks", "calls", "rejections", "recoveries"])
			assert.equal(item[key], caller[key], `${profile} ${key}`);
		assert.deepEqual(item.installed, {
			checks: caller.checks, calls: caller.calls
			, rejections: caller.rejections, recoveries: caller.recoveries
		});
		assert.deepEqual(item.relocated, item.installed);
		for(const name of ["installed", "relocated"])
		{
			const stdout = (await read(`${profile}/${name}.stdout`)).toString();
			const observed = parseZeroPayloadNativeResult(stdout, caller
				, `${profile} ${name} stdout`);
			assert.equal(stdout, JSON.stringify({
				calls: caller.calls, checks: caller.checks
				, recoveries: caller.recoveries, rejections: caller.rejections
			}) + "\n", `${profile} ${name} stdout`);
			assert.deepEqual(item[name], observed);
		}
		for(const field of [
			"sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"
			, "relocatedInstallation", "immutableCallerAssertions", "repeatExecution"
		]) assert.equal(item[field], true, `${profile}/${field}`);
		const packages = receipt.packages.filter(pkg => pkg.target === profile);
		assert.deepEqual(item.packages, packages); assert.equal(packages.length, 1);
		assert.deepEqual(Object.keys(item.closure).sort()
			, ["packageFileSetSha256", "receiptSha256"]);
		const packageBytes = await read(`${profile}/lean-bridge-package.json`);
		const packageReceipt = json(packageBytes, `${profile} installed receipt`);
		assert.equal(packageReceipt.profile, "native-library-v1");
		assert.equal(packageReceipt.name, packages[0].name);
		assert.equal(packageReceipt.version, packages[0].version);
		assertZeroPayloadNativeInstalledBindingIr(packageReceipt, report, profile);
		assert.equal(item.closure.receiptSha256, sha256(packageBytes));
		assert.equal(item.closure.packageFileSetSha256, sha256(canonicalJson([
			...Object.keys(packageReceipt.files), "lean-bridge-package.json"
		].sort())));
	}
	return {
		route, reportSha256: sha256(reportBytes), receipt
		, profiles: zeroPayloadNativeProfiles
		, calls: report.reports.reduce((sum, item) => sum + item.calls, 0)
		, rejections: report.reports.reduce((sum, item) => sum + item.rejections, 0)
		, recoveries: report.reports.reduce((sum, item) => sum + item.recoveries, 0)
	};
};
