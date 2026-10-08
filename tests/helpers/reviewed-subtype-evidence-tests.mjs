/**
 * Authenticate installed reviewed Subtype decisions, exact callers and preserved failed attempts.
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
import { reviewedSubtypeInstalledIr, reviewedSubtypeNativeConsumer } from "./reviewed-subtype-installed-fixture.mjs";

const root = "docs/evidence/reviewed-subtype-20261008";
const revision = "145c0f93aaef8d39ccc134c13bedf166822b35b7";
const receiptSha256 = "9c14cc972f8404ec417ec499f4fe5450b13d5368100aeff8f8f7842817b4a146";
const nativeIdentity = {
	bindingIrSha256: "59eb0b7da11e84148b2c9dd57547bf5bd46e9d24a9fe60825730f5f0a500e08e"
	, modelSha256: "035ac17dc15598e6b009cf103aecca3ef7d8d85b3ac411c2f909c9e0f31fedf9"
	, receiptSha256: "73cf5461c60c3dc5e6f4ad80135c66103ab1caba9417b3d4a25f6dcb72b18946"
};
const artifacts = {
	c: { bytes: 53847184, path: "archives/subtypes-1.0.0-c.tar.gz", sha256: "078b78ca5ba150aa3668a98b5a4b6fc7f31138dc4ec491067e07d3a15b83d085" }
	, cpp: { bytes: 51777790, path: "archives/subtypes-1.0.0-cpp.tar.gz", sha256: "0478ce9256c7035f1984d5ab1904d8eb61dd9c5137e19d9adf2395ceade56d31" }
};
const npmScript = 'import * as api from "subtypes";\nimport { runtime } from "./node_modules/subtypes/internal/runtime.mjs";\nimport { checkReviewedSubtype } from "./check.mjs";\nconsole.log(JSON.stringify(checkReviewedSubtype(api, (name, args) => runtime.call("lean:Subtypes." + name, args))));\n';
const digest = value => { assert.match(value, /^[a-f0-9]{64}$/u); assert.notEqual(value, "0".repeat(64)); };
const reviewSha = () => hashBindingIr(reviewedSubtypeInstalledIr());
const isolated = row => {
	assert.equal(row.path, "reviewed-source");
	assert.equal(row.reviewedBindingIrSha256, reviewSha());
	assert.equal(row.dispatch, "not measured");
	for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(row[key], true, key);
	for(const key of ["bindingIrSha256", "receiptSha256", "consumerSha256"]) digest(row[key]);
};
const checkNative = (report, consumers) => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(row => row.profile), ["c", "cpp"]);
	assert.deepEqual(report.reports.map(row => row.checks), [2033, 2026]);
	for(const row of report.reports)
	{
		isolated(row);
		for(const [key, value] of Object.entries(nativeIdentity)) assert.equal(row[key], value, key);
		assert.equal(row.consumerSha256, consumers[row.profile]);
		assert.deepEqual(row.packages, [{ target: row.profile
			, ecosystem: row.profile
			, name: "subtypes"
			, version: "1.0.0"
			, profile: "native-library-v1"
			, role: "component"
			, requires: []
			, runtimeDelivery: "embedded"
			, runtimeIdentity: "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
			, artifacts: [artifacts[row.profile]] }]);
	}
	assert.deepEqual(report.archives, Object.fromEntries(Object.values(artifacts).map(item => [item.path, item.sha256])));
};
const checkNpm = (report, corpusSha256) => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.profile, "npm"); isolated(report);
	assert.deepEqual([report.checks, report.rejections, report.privateAbi, report.independentBuilds], [2036, 2024, 2, 2]);
	assert.equal(report.reproducible, true);
	assert.equal(report.corpusSha256, corpusSha256);
	assert.equal(report.consumerSha256, sha256(npmScript));
	assert.equal(report.bindingIrFileSha256, "8a1e2239ef91bc80ba3b3055f6585e08d6d0f822a070491c73ff58bbe9b8db0c");
	assert.equal(report.bindingIrSha256, "fe7b0f36cf21b4ee30b100b98ddb7c53210d1387509e9aaac7205f1379640b4d");
	assert.deepEqual(report.typescript, { strict: true, skipLibCheck: false
		, sourceSha256: "570c9a8450c86e0129dbf9cbae98865ebb72d4f2c7b985017f6c6f5ccd46c833"
		, declarationsSha256: "db0719763299c92c0203219a3bf97748bdd2c3208b248a8108cd8cba7f3594ea" });
	validateComponentPackageReceipt(report.receipt);
	assert.equal(sha256(canonicalJson(report.receipt)), report.receiptSha256);
	assert.equal(report.receiptSha256, "0ba16b5649d98f0be10f15bbf36be73a276978a7d9c6b025f00a5fe8622800b2");
	assert.equal(report.receipt.bindingIrSha256, report.bindingIrSha256);
	assert.deepEqual(report.receipt.component, { id: "subtypes@1.0.0", name: "subtypes", version: "1.0.0" });
	assert.equal(report.receipt.package.archive, "subtypes-1.0.0.tgz");
	assert.equal(report.receipt.policies.runtimeShared, true);
	assert.equal(report.receipt.policies.runtimeBinaryInComponent, false);
};
const inputs = async () => ({
	native: JSON.parse(await readFile(`${root}/c-cpp.json`, "utf8"))
	, npm: JSON.parse(await readFile(`${root}/npm.json`, "utf8"))
	, consumers: Object.fromEntries(await Promise.all(["c", "cpp"].map(async profile => [profile, sha256(await reviewedSubtypeNativeConsumer(profile))])))
	, corpusSha256: sha256(await readFile("tests/fixtures/reviewed-subtype-consumers/javascript.mjs"))
});

test("the reviewed Subtype archive authenticates both installed routes and exact independently reviewed decisions", async () => {
	const bytes = await readFile(`${root}/receipt.json`); assert.equal(sha256(bytes), receiptSha256);
	const receipt = JSON.parse(bytes);
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.planNode, 1444);
	assert.equal(receipt.execution, "local"); assert.equal(receipt.revision, revision);
	assert.deepEqual(receipt.scope.profiles, ["c", "cpp", "npm"]);
	assert.equal(receipt.scope.sourcePath, "reviewed-source");
	assert.equal(receipt.scope.exports, 12); assert.equal(receipt.scope.privateNpmAbi, 2);
	assert.equal(receipt.scope.dispatch, "not measured");
	for(const key of ["browserExecution", "otherNativeHosts", "nestedSubtypes"]) assert.equal(receipt.scope[key], false);
	assert.deepEqual(receipt.producerEnvironment, { nodeVersion: "v22.23.3", nativeGlibcFloor: "2.36", cpu: 3, concurrency: 1 });
	assert.equal(receipt.sourceFiles.length, 21);
	assert.equal(new Set(receipt.sourceFiles.map(file => file.path)).size, 21);
	for(const file of receipt.sourceFiles)
		assert.equal(sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)), file.sha256, file.path);
	assert.equal(receipt.artifacts.length, 8);
	assert.equal(new Set(receipt.artifacts.map(file => file.path)).size, 8);
	for(const file of receipt.artifacts) assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
	const { native, npm, consumers, corpusSha256 } = await inputs();
	checkNative(native, consumers); checkNpm(npm, corpusSha256);
	const review = reviewedSubtypeInstalledIr(), decisions = name => review.declarations.find(item => item.id === `lean:Subtypes.${name}`).source.extensions["lean-lang.org/refinements"];
	assert.equal(review.declarations.length, receipt.scope.exports);
	assert.equal(decisions("firstEven").parameters[0].constructor, "Subtypes.checkedEven");
	assert.equal(decisions("secondEven").parameters[0].constructor, "Subtypes.normalizedEven");
	assert.deepEqual(review.declarations.find(item => item.id === "lean:Subtypes.zeroEven").parameters, []);
	assert.equal(decisions("zeroEven").result.constructor, "Subtypes.checkedEven");
	const tap = await readFile(`${root}/ordinary.tap`, "utf8"), queue = await readFile(`${root}/ordinary.queue`, "utf8");
	assert.doesNotMatch(tap, /^not ok /mu);
	for(const line of ["# tests 1", "# pass 1", "# fail 0", "# skipped 0", "exit=0"])
		assert.equal(tap.split("\n").filter(value => value === line).length, 2, line);
	assert.match(tap, /^ok 1 - source-free reviewed C and C\+\+ archives execute each checked constructor and distinct generic choices$/mu);
	assert.match(tap, /^ok 1 - source-free reviewed npm archives execute checked Subtype constructors for Node and strict TypeScript$/mu);
	assert.match(queue, new RegExp(`^revision=${revision}$`, "mu"));
	assert.match(queue, /cpu=3 concurrency=1/u);
	assert.match(queue, /LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.36/u);
	assert.match(queue, /^end c-cpp .* exit=0$/mu); assert.match(queue, /^end npm .* exit=0$/mu);
	assert.match(queue, /^all steps passed /mu);
	assert.deepEqual(receipt.logs, { native: { passed: 1, failed: 0, skipped: 0 }, npm: { passed: 1, failed: 0, skipped: 0 } });
});

test("the reviewed Subtype archive preserves the original link and diagnostic failures without implying npm execution", async () => {
	const receipt = JSON.parse(await readFile(`${root}/receipt.json`, "utf8"));
	assert.deepEqual(receipt.predecessors.map(item => [item.revision, item.npmExecuted]), [["f9cda04", false], ["a22a4da", false]]);
	for(const name of ["failed-link", "failed-label"])
	{
		const tap = await readFile(`${root}/${name}.tap`, "utf8"), queue = await readFile(`${root}/${name}.queue`, "utf8");
		assert.match(tap, /^# pass 0$/mu); assert.match(tap, /^# fail 1$/mu); assert.match(tap, /^exit=1$/mu);
		assert.doesNotMatch(queue, /^start npm /mu); assert.doesNotMatch(queue, /^all steps passed /mu);
		assert.match(tap, name === "failed-link" ? /undefined reference to .*lean_bridge_test_foreign_even/u : /arg0 was rejected by Subtypes\.checkedWord/u);
	}
});

test("reviewed Subtype receipts refuse missing hosts, wrong callers, weakened isolation and invented success", async () => {
	const { native, npm, consumers, corpusSha256 } = await inputs();
	const nativeMutants = [
		r => { r.reports.pop(); }, r => { r.reproducible = false; }
		, r => { r.reports[0].checks--; }, r => { r.reports[1].checks--; }
		, r => { r.reports[0].consumerSha256 = consumers.cpp; }
		, r => { r.reports[1].path = "ordinary-source"; }
		, r => { r.reports[0].reviewedBindingIrSha256 = "a".repeat(64); }
		, r => { r.reports[0].sourceRemovedBeforeInstallation = false; }
		, r => { r.reports[1].compilerFreePath = false; }
		, r => { r.reports[0].offlineInstall = false; }
		, r => { r.reports[0].dispatch = { observed: true }; }
		, r => { r.reports[1].packages[0].artifacts[0].sha256 = "a".repeat(64); }
		, r => { r.reports[0].bindingIrSha256 = "a".repeat(64); }
		, r => { r.reports[0].receiptSha256 = "a".repeat(64); }
	];
	const npmMutants = [
		r => { r.privateAbi = 7; }, r => { r.checks--; }, r => { r.rejections--; }
		, r => { r.reproducible = false; }, r => { r.independentBuilds = 1; }
		, r => { r.sourceRemovedBeforeInstallation = false; }
		, r => { r.offlineInstall = false; }
		, r => { r.compilerFreePath = false; }, r => { r.typescript.strict = false; }
		, r => { r.typescript.skipLibCheck = true; }
		, r => { r.consumerSha256 = "a".repeat(64); }
		, r => { r.corpusSha256 = "a".repeat(64); }
		, r => { r.reviewedBindingIrSha256 = "a".repeat(64); }
		, r => { r.receipt.bindingIrSha256 = "a".repeat(64); }
		, r => { r.receiptSha256 = "a".repeat(64); }
		, r => { r.dispatch = { observed: true }; }
	];
	for(const [original, check, mutants] of [[native, value => checkNative(value, consumers), nativeMutants], [npm, value => checkNpm(value, corpusSha256), npmMutants]])
		for(const mutate of mutants)
		{ const changed = structuredClone(original); mutate(changed); assert.throws(() => check(changed)); }
});
