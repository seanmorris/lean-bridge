/**
 * Independently reconcile retained C/C++ value-index package records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { assertCheckedRecordValueIndexProvenance } from "./checked-record-value-index-browser-report.mjs";
import {
	checkedRecordValueIndexFixtureRoot
	, checkedRecordValueIndexModule
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexNativeCaller
	, checkedRecordValueIndexNativeProfiles
	, checkedRecordValueIndexNativeRoutes
	, checkedRecordValueIndexNativeSelection
	, parseCheckedRecordValueIndexNativeResult
} from "./checked-record-value-index-native-fixture.mjs";

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label);
const json = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};
const fixturePaths = Object.freeze([
	`${checkedRecordValueIndexModule}.lean`, "LICENSE", "lakefile.toml"
	, "lean-toolchain", "package.json"
]);
const refinementsKey = "lean-lang.org/refinements";
const original = (commit, path) => execFileSync("git", [
	"show", `${commit}:${checkedRecordValueIndexFixtureRoot}/${path}`
], { maxBuffer: 16 * 1024 * 1024 });

// Independently enrich reviewed named types with the positional record shape
// that the native projection must carry. Reviewed constructor selections name
// only the checked constructor; result records deliberately select none.
const recordRefinement = (expected, type, constructor) => {
	if(type?.kind !== "named") return null;
	const record = expected.types.find(item => item.id === type.id);
	assert.ok(record, type.id);
	assert.equal(record.kind, "record", type.id);
	return {
		kind: "checked-record", definition: record.source.declaration
		, constructor, fields: record.fields.map(field => field.name)
	};
};
const nativeRefinements = (expected, declaration) => {
	const selected = declaration.source.extensions?.[refinementsKey];
	const parameters = declaration.parameters.map((parameter, index) => {
		const refinement = selected?.parameters[index];
		if(refinement === null || refinement === undefined) return null;
		assert.equal(refinement.kind, "checked-record");
		return recordRefinement(
			expected, parameter.type, refinement.constructor);
	});
	return {
		parameters
		, result: recordRefinement(expected, declaration.result?.type, null)
	};
};

/**
 * Complete route-relative retained-file closure before controls are added.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 * @param receipt - Authenticated native package-set receipt.
 */
export const checkedRecordValueIndexNativeRecordPaths = (route, receipt) => {
	assert.ok(checkedRecordValueIndexNativeRoutes.includes(route));
	validatePackageSetReceipt(receipt);
	const build = [
		"author-inputs.json", "model.json", "package-set-receipt.json"
		, `${checkedRecordValueIndexModule}.lean`, "lean-bridge.exports.json"
		, ...route.endsWith("reviewed-ir") ? ["api.binding-ir.json"] : []
	];
	return [
		"configuration.json", "expected.binding-ir.json", "report.json"
		, "runtime.json"
		, ...[0, 1].flatMap(attempt => build.map(path => `build-${attempt}/${path}`))
		, ...checkedRecordValueIndexNativeProfiles.flatMap(profile => [
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
 * Authenticate one complete, independently built native route.
 *
 * @param read - Reader relative to the route record root.
 * @param options - Exact route, producer revision and measured runtime.
 * @param options.route - Exact full/result-only and ordinary/reviewed route.
 * @param options.producerCommit - Exact producing Git commit.
 * @param options.consumerCommit - Exact caller-producing Git commit.
 * @param options.runtime - Independently observed host/toolchain identity.
 * @param options.floor - Declared glibc compatibility floor.
 */
export const checkCheckedRecordValueIndexNativeReport = async (
	read, { route, producerCommit, consumerCommit, runtime, floor }
) => {
	assert.ok(checkedRecordValueIndexNativeRoutes.includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.match(consumerCommit, /^[a-f0-9]{40}$/u);
	assert.match(floor, /^2\.[0-9]+$/u);
	const selection = checkedRecordValueIndexNativeSelection(route);
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
	]);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.consumerCommit, consumerCommit);
	assert.deepEqual(report.runtime, runtime);
	assert.deepEqual(json(await read("runtime.json"), "runtime record")
		, runtime, "runtime record");
	assert.equal(report.declaredGlibcFloor, floor);
	assert.deepEqual(report.profiles, checkedRecordValueIndexNativeProfiles);
	assert.equal(report.independentBuilds, 2);
	for(const field of [
		"reproducible", "authorInputsUnchanged", "sourceCommitClean"
		, "sourceRemovedBeforeInstallation", "offlineInstall"
		, "compilerFreePath", "relocatedInstallation"
		, "immutableCallerAssertions"
	]) assert.equal(report[field], true, field);
	assert.deepEqual(report.negativeControls, {
		checkedRefusals: selection.resultOnly ? 0 : 4
		, shapeRefusals: selection.resultOnly ? 0 : 2
		, recoveries: selection.resultOnly ? 0 : 6
	});
	assert.deepEqual(report.configuration, selection.configuration);
	assert.deepEqual(json(await read("configuration.json"), "configuration")
		, selection.configuration);
	const expected = json(await read("expected.binding-ir.json"), "expected IR");
	assert.deepEqual(expected, selection.expected);
	assertCheckedRecordValueIndexProvenance(expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	let receipt;
	for(const [attempt, build] of report.builds.entries())
	{
		exactKeys(build, [
			"authorInputsSha256", "bindingIrSha256", "modelSha256"
			, "receiptSha256", "archives"
		]);
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
		assert.deepEqual(await read(`${prefix}/${checkedRecordValueIndexModule}.lean`)
			, original(producerCommit, `${checkedRecordValueIndexModule}.lean`));
		assert.deepEqual(json(await read(`${prefix}/lean-bridge.exports.json`)
			, `${prefix} configuration`), selection.configuration);
		if(selection.reviewed)
			assert.deepEqual(json(await read(`${prefix}/api.binding-ir.json`)
				, `${prefix} review`), expected);
		const modelBytes = await read(`${prefix}/model.json`);
		const model = json(modelBytes, `${prefix} model`);
		assertCheckedRecordValueIndexProvenance(model.bindingIr);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null
			, `${prefix} independently reconciles with reviewed Binding IR`);
		assert.equal(hashBindingIr(model.bindingIr), build.bindingIrSha256);
		assert.equal(model.bindingIrSha256, build.bindingIrSha256);
		assert.equal(sha256(modelBytes), build.modelSha256);
		assert.equal(model.profile, "native-library-v1");
		assert.deepEqual(model.exports.map(item => item.name).sort()
			, expected.declarations.map(item => item.source.declaration).sort());
		for(const item of model.exports)
		{
			const declaration = expected.declarations.find(value =>
				value.source.declaration === item.name);
			assert.ok(declaration, item.name);
			assert.deepEqual(item.refinements
				, nativeRefinements(expected, declaration), item.name);
		}
		const receiptBytes = await read(`${prefix}/package-set-receipt.json`);
		receipt = json(receiptBytes, `${prefix} receipt`);
		validatePackageSetReceipt(receipt);
		assert.equal(sha256(receiptBytes), build.receiptSha256);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort()
			, checkedRecordValueIndexNativeProfiles);
		assert.deepEqual(build.archives, Object.fromEntries(
			receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [
				item.path, item.sha256
			]
			))
		));
	}
	const handoffReceiptBytes = await read("handoff/package-set-receipt.json");
	const handoffReceipt = json(handoffReceiptBytes, "handoff receipt");
	assert.deepEqual(handoffReceipt, receipt);
	assert.deepEqual(report.receipt, receipt);
	assert.equal(sha256(handoffReceiptBytes), report.builds[0].receiptSha256);
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString()
		, `${sha256(handoffReceiptBytes)}  package-set-receipt.json\n`);
	for(const pkg of receipt.packages) for(const artifact of pkg.artifacts)
		assert.equal(sha256(await read(`handoff/${artifact.path}`)), artifact.sha256
			, artifact.path);
	assert.deepEqual(report.reports.map(item => item.profile)
		, checkedRecordValueIndexNativeProfiles);
	for(const profile of checkedRecordValueIndexNativeProfiles)
	{
		const caller = await checkedRecordValueIndexNativeCaller(
			profile, route, path => execFileSync("git", [
				"show", `${consumerCommit}:${path}`
			], { maxBuffer: 16 * 1024 * 1024 })
		);
		const source = await read(`consumers/${profile}.${profile}`);
		assert.equal(source.toString(), caller.source, `${profile} caller source`);
		const item = json(await read(`${profile}/report.json`), `${profile} report`);
		assert.deepEqual(item, report.reports.find(value => value.profile === profile));
		exactKeys(item, [
			"schemaVersion", "route", "profile", "packages", "consumerSha256"
			, "checks", "calls", "rejections", "recoveries", "installed"
			, "relocated", "closure", "sourceRemovedBeforeInstallation"
			, "offlineInstall", "compilerFreePath", "relocatedInstallation"
			, "immutableCallerAssertions", "repeatExecution"
		]);
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
			const observed = parseCheckedRecordValueIndexNativeResult(
				stdout, caller, `${profile} ${name} stdout`);
			assert.equal(stdout, JSON.stringify({
				calls: caller.calls, checks: caller.checks
				, recoveries: caller.recoveries, rejections: caller.rejections
			}) + "\n", `${profile} ${name} stdout`);
			assert.deepEqual(item[name], observed, `${profile} ${name} observation`);
		}
		for(const field of [
			"sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"
			, "relocatedInstallation", "immutableCallerAssertions", "repeatExecution"
		]) assert.equal(item[field], true, `${profile}/${field}`);
		const packages = receipt.packages.filter(pkg => pkg.target === profile);
		assert.deepEqual(item.packages, packages);
		assert.equal(packages.length, 1);
		assert.deepEqual(Object.keys(item.closure).sort()
			, ["packageFileSetSha256", "receiptSha256"]);
		const packageBytes = await read(`${profile}/lean-bridge-package.json`);
		const packageReceipt = json(packageBytes, `${profile} installed package receipt`);
		assert.equal(packageReceipt.profile, "native-library-v1");
		assert.equal(packageReceipt.name, packages[0].name);
		assert.equal(packageReceipt.version, packages[0].version);
		assert.equal(packageReceipt.bindingIrSha256, report.expectedBindingIrSha256
			, `${profile} installed binding IR`);
		assert.equal(item.closure.receiptSha256, sha256(packageBytes));
		assert.equal(item.closure.packageFileSetSha256, sha256(canonicalJson([
			...Object.keys(packageReceipt.files), "lean-bridge-package.json"
		].sort())));
	}
	return {
		route, reportSha256: sha256(reportBytes), receipt
		, profiles: checkedRecordValueIndexNativeProfiles
		, calls: report.reports.reduce((sum, item) => sum + item.calls, 0)
		, rejections: report.reports.reduce((sum, item) => sum + item.rejections, 0)
		, recoveries: report.reports.reduce((sum, item) => sum + item.recoveries, 0)
	};
};
