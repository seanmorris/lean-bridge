/**
 * Bind fresh reviewed C/C++ reports to both builds and the independently authored API.
 * Archive verification and actual execution belong to the producer, not this reader.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { reviewedSubtypeNativeConsumer } from "./reviewed-subtype-installed-fixture.mjs";
import { reviewedSubtypePackageChecks } from "./reviewed-subtype-package-fixture.mjs";
import { reviewedPackageKeys, reviewedSubtypePackageInputs } from "./reviewed-subtype-package-ci-common.mjs";

/**
 * Check both reproduced builds and the C and C++ source-free installed callers.
 *
 * @param read - Original relative-record byte reader.
 */
export const assertReviewedSubtypeCFamilyRecords = async read => {
	const { json, review, source, configuration } = await reviewedSubtypePackageInputs("c-cpp", read);
	const report = await json("report.json");
	reviewedPackageKeys(report, ["schemaVersion", "reports", "archives", "reproducible"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(item => item.profile), ["c", "cpp"]);
	let receipt, model;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		model = await json(prefix + "model.json"); receipt = await json(prefix + "package-set-receipt.json");
		validatePackageSetReceipt(receipt);
		assert.equal(model.schemaVersion, 3); assert.equal(model.profile, "native-library-v1");
		assert.equal(model.exports.length, 12);
		assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.pointerBits, 64); assert.equal(model.byteOrder, "little");
		assert.deepEqual(model.exports.map(item => "lean:" + item.name).sort(), review.declarations.map(item => item.id).sort());
		for(const item of model.exports)
		{
			const declaration = review.declarations.find(value => value.id === "lean:" + item.name);
			assert.equal(item.module, "Subtypes");
			assert.equal(item.symbol, "lb_" + sha256(`${model.component.id}\0${item.name}`).slice(0, 24));
			assert.deepEqual(item.refinements, declaration.source.extensions["lean-lang.org/refinements"]);
			assert.deepEqual(item.specialization, declaration.source.extensions["lean-lang.org/specialization"]);
			assert.deepEqual(item.parameters.map(parameter => ({ kind: parameter.type.kind, name: parameter.type.name })), declaration.parameters.map(parameter => parameter.type));
			assert.deepEqual({ kind: item.result.kind, name: item.result.name }, declaration.result.type);
		}
		const identity = model.sourceIdentity;
		assert.equal(identity.reviewedBindingIr.source, canonicalJson(review));
		assert.equal(identity.reviewedBindingIr.sourceSha256, sha256(canonicalJson(review)));
		assert.equal(identity.reviewedBindingIr.semanticSha256, hashBindingIr(review));
		const selection = reviewedSourceSelection(identity.reviewedBindingIr);
		for(const key of ["contracts", "exports", "specializations"]) assert.deepEqual(identity.request[key], selection[key]);
		for(const key of ["arities", "resources"]) assert.deepEqual(identity.request[key], []);
		for(const key of ["modules", "exportModules"]) assert.deepEqual(identity.request[key], ["Subtypes"]);
		assert.equal(identity.request.profile, "native-library-v1");
		assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.equal(identity.modules.length, 1); assert.equal(identity.modules[0].module, "Subtypes");
		assert.deepEqual(identity.modules[0].source, { path: "Subtypes.lean", bytes: Buffer.byteLength(source), sha256: sha256(source) });
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].id, model.profile);
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort(), ["c", "cpp"]);
		assert.deepEqual(report.archives, Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		for(const item of report.reports)
		{
			assert.equal(item.bindingIrSha256, model.bindingIrSha256);
			assert.equal(item.modelSha256, sha256(await read(prefix + "model.json")));
			assert.equal(item.receiptSha256, sha256(await read(prefix + "package-set-receipt.json")));
		}
	}
	for(const path of ["model.json", "package-set-receipt.json"])
		assert.deepEqual(await read("build-0/" + path), await read("build-1/" + path));
	for(const item of report.reports)
	{
		reviewedPackageKeys(item, ["profile", "path", "checks", "consumerSha256", "offlineInstall", "compilerFreePath", "packages", "bindingIrSha256", "reviewedBindingIrSha256", "modelSha256", "receiptSha256", "sourceRemovedBeforeInstallation", "dispatch"]);
		assert.equal(item.path, "reviewed-source"); assert.equal(item.dispatch, "not measured");
		assert.equal(item.checks, reviewedSubtypePackageChecks[item.profile]);
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(item[key], true, key);
		assert.equal(item.reviewedBindingIrSha256, hashBindingIr(review));
		assert.deepEqual(item.packages, receipt.packages.filter(pkg => pkg.target === item.profile));
		const caller = await reviewedSubtypeNativeConsumer(item.profile);
		assert.equal(Buffer.from(await read(`consumer.${item.profile}`)).toString(), caller);
		assert.equal(item.consumerSha256, sha256(caller));
	}
	return report;
};
