/**
 * Authenticate the original reviewed finite-specialization C/C++ and npm observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { reviewedNativeSpecializationIr } from "./reviewed-native-specialization-fixture.mjs";

const root = "docs/evidence/reviewed-specializations-20261008";
const digest = value => {
	assert.match(value, /^[a-f0-9]{64}$/u);
	assert.notEqual(value, "0".repeat(64));
};
const reviewSha = () => hashBindingIr(reviewedNativeSpecializationIr());
const isolated = report => {
	assert.equal(report.path, "reviewed-source");
	assert.equal(report.reviewedBindingIrSha256, reviewSha());
	for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(report[flag], true, flag);
	for(const field of ["bindingIrSha256", "receiptSha256"]) digest(report[field]);
};
const checkNative = record => {
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.reproducible, true);
	assert.deepEqual(record.reports.map(row => row.profile), ["c", "cpp"]);
	assert.deepEqual(record.reports.map(row => row.checks), [2016, 2011]);
	const artifacts = {};
	for(const row of record.reports)
	{
		isolated(row);
		for(const field of ["modelSha256", "consumerSha256"]) digest(row[field]);
		assert.equal(row.packages.length, 1);
		const pkg = row.packages[0];
		assert.equal(pkg.target, row.profile);
		assert.equal(pkg.role, "component");
		assert.equal(pkg.name, "specialized");
		assert.equal(pkg.version, "1.0.0");
		assert.equal(pkg.artifacts.length, 1);
		const artifact = pkg.artifacts[0];
		assert.equal(artifact.path, `archives/specialized-1.0.0-${row.profile}.tar.gz`);
		digest(artifact.sha256);
		assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
		artifacts[artifact.path] = artifact.sha256;
	}
	assert.deepEqual(record.archives, artifacts);
	for(const field of ["bindingIrSha256", "modelSha256", "receiptSha256"])
		assert.equal(record.reports[0][field], record.reports[1][field]);
};
const checkNpm = report => {
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.profile, "npm");
	isolated(report);
	assert.equal(report.reproducible, true);
	assert.equal(report.independentBuilds, 2);
	assert.equal(report.checks, 6);
	assert.equal(report.rejections, 3);
	assert.equal(report.typescript.strict, true);
	assert.equal(report.typescript.skipLibCheck, false);
	for(const value of [report.bindingIrFileSha256, report.typescript.sourceSha256, report.typescript.declarationsSha256]) digest(value);
	validateComponentPackageReceipt(report.receipt);
	assert.equal(sha256(canonicalJson(report.receipt)), report.receiptSha256);
	assert.equal(report.receipt.bindingIrSha256, report.bindingIrSha256);
	assert.deepEqual(report.receipt.component, { id: "specialized@1.0.0", name: "specialized", version: "1.0.0" });
	assert.equal(report.receipt.package.archive, "specialized-1.0.0.tgz");
	assert.equal(report.receipt.policies.runtimeShared, true);
	assert.equal(report.receipt.policies.runtimeBinaryInComponent, false);
};

test("archived reviewed specializations retain exact reports, fresh-source identities and source-free callers", async () => {
	const bytes = await readFile(`${root}/receipt.json`);
	assert.equal(sha256(bytes), "ef9f5dfa718558abfc3080b8c518b12f740daf04acb1590d717d9459443be84e");
	const receipt = JSON.parse(bytes);
	assert.equal(receipt.revision, "fc8dbefc5a365b3b19c797ff95067656603c69b5");
	assert.deepEqual(receipt.scope.profiles, ["c", "cpp", "npm"]);
	assert.equal(receipt.scope.specializations, 10);
	assert.equal(receipt.scope.ordinaryExports, 1);
	assert.equal(receipt.scope.dispatch, "not measured");
	assert.equal(receipt.scope.browserExecution, false);
	assert.equal(receipt.scope.otherNativeHosts, false);
	for(const file of receipt.sourceFiles)
		assert.equal(sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)), file.sha256, file.path);
	for(const artifact of receipt.artifacts) assert.equal(sha256(await readFile(artifact.path)), artifact.sha256, artifact.path);
	const native = JSON.parse(await readFile(`${root}/c-cpp.json`)), npm = JSON.parse(await readFile(`${root}/npm.json`));
	checkNative(native); checkNpm(npm);
	for(const row of native.reports)
	{
		const path = `tests/fixtures/specialization-consumers/${row.profile}.${row.profile === "c" ? "c" : "cpp"}`;
		assert.equal(receipt.sourceFiles.find(file => file.path === path).sha256, row.consumerSha256);
		assert.equal(sha256(beforeFinRefinementSource(path, await readFile(path), row.consumerSha256)), row.consumerSha256);
	}
	const nativeLog = await readFile(`${root}/c-cpp.tap`, "utf8"), npmLog = await readFile(`${root}/npm.tap`, "utf8");
	assert.match(nativeLog, /# tests 17\n# suites 0\n# pass 16\n# fail 0\n# cancelled 0\n# skipped 1/u);
	assert.match(nativeLog, /ok \d+ - independently reviewed C and C\+\+ packages install every chosen specialization without its generic\n/u);
	assert.match(npmLog, /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0/u);
	assert.match(npmLog, /ok 1 - an independently reviewed npm package installs the chosen specializations for Node and strict TypeScript\n/u);
	assert.doesNotMatch(nativeLog + npmLog, /^not ok/gmu);
});

test("reviewed-specialization receipts refuse missing profiles, counts, isolation, identities and weakened type checks", async () => {
	const native = JSON.parse(await readFile(`${root}/c-cpp.json`)), npm = JSON.parse(await readFile(`${root}/npm.json`));
	const nativeMutants = [
		r => { r.reports.pop(); }, r => { r.reproducible = false; }
		, r => { r.reports[0].checks = 0; }
		, r => { r.reports[1].path = "ordinary-source"; }
		, r => { r.reports[0].sourceRemovedBeforeInstallation = false; }
		, r => { r.reports[0].compilerFreePath = false; }
		, r => { r.reports[1].offlineInstall = false; }
		, r => { r.reports[1].modelSha256 = "a".repeat(64); }
		, r => { r.reports[0].reviewedBindingIrSha256 = "a".repeat(64); }
		, r => { r.reports[0].packages[0].target = "cpp"; }
		, r => { r.archives["archives/specialized-1.0.0-c.tar.gz"] = "a".repeat(64); }
	];
	const npmMutants = [
		r => { r.reproducible = false; }, r => { r.independentBuilds = 1; }
		, r => { r.rejections = 0; }, r => { r.offlineInstall = false; }
		, r => { r.sourceRemovedBeforeInstallation = false; }
		, r => { r.typescript.strict = false; }
		, r => { r.typescript.skipLibCheck = true; }
		, r => { r.receipt.bindingIrSha256 = "a".repeat(64); }
		, r => { r.receiptSha256 = "a".repeat(64); }
	];
	for(const [original, check, changes] of [[native, checkNative, nativeMutants], [npm, checkNpm, npmMutants]])
		for(const change of changes)
		{ const changed = structuredClone(original); change(changed); assert.throws(() => check(changed)); }
});
