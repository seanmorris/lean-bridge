/**
 * Bind reviewed npm observations to compiler records, receipts and exact installed callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { validateCompilerAdapterPlan } from "../../src/build/compiler-adapters.mjs";
import { validateComponentBuildPlan } from "../../src/build/component-plan.mjs";
import { createComponentPrivateAbi } from "../../src/build/component-callable-adapters.mjs";
import { validateComponentReleaseBundleManifest } from "../../src/release/component-release-bundle.mjs";
import { validateComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { reviewedSubtypeNpmCaller, reviewedSubtypeNpmTypescript, reviewedSubtypePackageChecks } from "./reviewed-subtype-package-fixture.mjs";
import { reviewedPackageKeys, reviewedSubtypePackageInputs } from "./reviewed-subtype-package-ci-common.mjs";

const bundled = {
	"binding-ir.json": "binding/binding-ir.json"
	, "compiler-adapters.json": "locks/compiler-adapters.json"
	, "component-build-plan.json": "locks/component-build-plan.json"
	, "provenance.json": "metadata/provenance.json"
	, "runtime-requirement.json": "metadata/runtime-requirement.json" };

/**
 * Require both independently built bundles and the exact executed JavaScript/TypeScript APIs.
 *
 * @param read - Original relative-record byte reader.
 */
export const assertReviewedSubtypeNpmRecords = async read => {
	const { json, review, source, configuration } = await reviewedSubtypePackageInputs("npm", read);
	const authorInputs = { "Subtypes.lean": source, "api.binding-ir.json": canonicalJson(review), "lean-bridge.exports.json": canonicalJson(configuration) };
	for(const name of ["lakefile.toml", "lean-toolchain", "LICENSE", "package.json"])
		authorInputs[name] = await readFile("tests/fixtures/onboarding/native-subtype/" + name, "utf8");
	const report = await json("report.json");
	reviewedPackageKeys(report, ["schemaVersion", "profile", "path", "bindingIrSha256", "bindingIrFileSha256", "privateAbi", "reviewedBindingIrSha256", "receipt", "receiptSha256", "corpusSha256", "consumerSha256", "checks", "rejections", "typescript", "reproducible", "independentBuilds", "offlineInstall", "sourceRemovedBeforeInstallation", "compilerFreePath", "dispatch"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.profile, "npm");
	assert.equal(report.path, "reviewed-source"); assert.equal(report.dispatch, "not measured");
	assert.equal(report.checks, reviewedSubtypePackageChecks.npm); assert.equal(report.rejections, 2024);
	assert.equal(report.independentBuilds, 2); assert.equal(report.privateAbi, 2);
	assert.equal(report.reviewedBindingIrSha256, hashBindingIr(review));
	for(const key of ["reproducible", "offlineInstall", "sourceRemovedBeforeInstallation", "compilerFreePath"]) assert.equal(report[key], true, key);
	let ir;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		ir = await json(prefix + "binding-ir.json");
		const adapters = await json(prefix + "compiler-adapters.json"), plan = await json(prefix + "component-build-plan.json");
		const bundle = await json(prefix + "component-release-bundle.json"), receipt = await json(prefix + "component-package-receipt.json");
		const provenance = await json(prefix + "provenance.json"), runtime = await json(prefix + "runtime-requirement.json");
		validateCompilerAdapterPlan(adapters); validateComponentBuildPlan(plan);
		validateComponentReleaseBundleManifest(bundle); validateComponentPackageReceipt(receipt);
		assert.equal(reviewedContractDifference(review, ir), null);
		assert.equal(report.bindingIrSha256, hashBindingIr(ir));
		assert.equal(report.bindingIrFileSha256, sha256(await read(prefix + "binding-ir.json")));
		assert.deepEqual(report.receipt, receipt);
		assert.equal(report.receiptSha256, sha256(await read(prefix + "component-package-receipt.json")));
		assert.equal(receipt.componentBundleSha256, sha256(await read(prefix + "component-release-bundle.json")));
		assert.equal(receipt.componentIdentitySha256, bundle.identitySha256);
		assert.equal(receipt.componentArtifactSha256, bundle.files.find(item => item.role === "component").sha256);
		assert.equal(bundle.componentArtifactManifestSha256, bundle.files.find(item => item.path === "metadata/component-artifact-manifest.json").sha256);
		assert.equal(receipt.bindingIrSha256, report.bindingIrSha256);
		assert.equal(bundle.bindingIrSemanticSha256, report.bindingIrSha256);
		assert.equal(plan.bindingIr.semanticSha256, report.bindingIrSha256);
		for(const component of [receipt.component, bundle.component, plan.component]) assert.deepEqual(component, ir.component);
		assert.equal(receipt.source.treeSha256, plan.source.treeSha256);
		assert.equal(plan.schemaVersion, 2);
		assert.deepEqual(plan.source.inputs, Object.keys(authorInputs).sort((a, b) => a.localeCompare(b)).map(path => ({ path, bytes: Buffer.byteLength(authorInputs[path]), sha256: sha256(authorInputs[path]) })));
		assert.equal(plan.source.toolchain, authorInputs["lean-toolchain"].trim());
		assert.deepEqual(plan.bindingIr.declarations, ir.declarations.map(item => item.id).sort());
		assert.deepEqual(plan.targets, ["npm"]);
		const planHash = sha256(await read(prefix + "component-build-plan.json"));
		assert.equal(adapters.componentPlanSha256, planHash);
		assert.equal(adapters.component, ir.component.id); assert.equal(adapters.privateAbi.version, 2);
		assert.deepEqual(adapters.privateAbi, createComponentPrivateAbi(ir));
		assert.deepEqual(adapters.imports, ["Subtypes"]);
		assert.deepEqual(adapters.exports.map(item => item.bindingId).sort(), plan.bindingIr.declarations);
		for(const item of adapters.exports)
		{
			const declaration = ir.declarations.find(value => value.id === item.bindingId);
			assert.deepEqual(item.refinements, declaration.source.extensions["lean-lang.org/refinements"]);
			assert.equal(item.sourceDeclaration, declaration.source.declaration);
			assert.equal(item.sourceModule, "Subtypes");
			assert.equal(item.sourceApplication, declaration.source.extensions["lean-lang.org/specialization"]?.application);
			assert.equal(item.symbol, "lean_bridge_" + sha256(`${ir.component.id}\0${item.bindingId}`).slice(0, 24));
			assert.equal(item.wrapper, "export_" + sha256(item.bindingId).slice(0, 20));
		}
		for(const [name, path] of Object.entries(bundled))
		{
			const bytes = await read(prefix + name), file = bundle.files.find(item => item.path === path);
			assert.ok(file, path); assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, sha256(bytes));
		}
		assert.equal(receipt.provenanceSha256, sha256(await read(prefix + "provenance.json")));
		assert.equal(provenance.schemaVersion, 1); assert.equal(provenance.component, ir.component.id);
		assert.equal(provenance.sourceTreeSha256, plan.source.treeSha256); assert.equal(provenance.componentPlanSha256, planHash);
		assert.equal(provenance.componentArtifactManifestSha256, bundle.componentArtifactManifestSha256);
		assert.equal(receipt.runtimeRequirementSha256, sha256(await read(prefix + "runtime-requirement.json")));
		assert.deepEqual(runtime, { schemaVersion: 1, kind: "lean-bridge-shared-runtime-requirement", artifactIncluded: false, ...plan.runtime, requiredImports: ["memory", "__indirect_function_table"] });
		assert.deepEqual(bundle.runtime, { kind: "content-addressed-peer", artifactIncluded: false, ...plan.runtime, requiredImports: runtime.requiredImports });
	}
	for(const name of [...Object.keys(bundled), "component-release-bundle.json", "component-package-receipt.json"])
		assert.deepEqual(await read("build-0/" + name), await read("build-1/" + name));
	const corpus = await readFile("tests/fixtures/reviewed-subtype-consumers/javascript.mjs", "utf8");
	const declarations = generateJavaScriptPackage(ir)["index.d.ts"];
	for(const [path, source] of Object.entries({ "index.mjs": reviewedSubtypeNpmCaller, "index.mts": reviewedSubtypeNpmTypescript, "check.mjs": corpus, "index.d.ts": declarations }))
		assert.equal(Buffer.from(await read(path)).toString(), source, path);
	assert.equal(report.consumerSha256, sha256(reviewedSubtypeNpmCaller));
	assert.equal(report.corpusSha256, sha256(corpus));
	assert.deepEqual(report.typescript, { strict: true, skipLibCheck: false, sourceSha256: sha256(reviewedSubtypeNpmTypescript), declarationsSha256: sha256(declarations) });
	return report;
};
