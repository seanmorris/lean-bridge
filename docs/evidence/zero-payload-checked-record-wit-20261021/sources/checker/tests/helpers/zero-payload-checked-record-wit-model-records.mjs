/**
 * Reconcile original zero-payload checked-record WIT compiler decisions, sources and package receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedContractDifference, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { zeroPayloadBrowserSelection } from "./zero-payload-checked-record-browser-fixture.mjs";
import { zeroPayloadCheckedRecordFixture, zeroPayloadCheckedRecordModule } from "./zero-payload-checked-record-fixture.mjs";
import {
	zeroPayloadWitConfiguration, zeroPayloadWitTarget
} from "./zero-payload-checked-record-wit-fixture.mjs";
import { nominalSubtypeWitOriginal } from "./nominal-subtype-wit-generators.mjs";

/**
 * Compare both independent author roots with the frozen source and full review.
 *
 * @param options - Original selection and retained records.
 * @param options.report - Original complete installed report.
 * @param options.read - Selection-relative byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.route - Ordinary or independently reviewed source route.
 * @param options.mode - Full or constructor-free result-only API.
 * @param options.producerCommit - Full immutable producer revision.
 */
export const checkZeroPayloadWitModels = async ({ report, read, json, route, mode, producerCommit }) => {
	const selection = zeroPayloadBrowserSelection(route);
	const expected = selection.expected;
	const configuration = zeroPayloadWitConfiguration(route);
	assert.equal(mode, selection.resultOnly ? "result-only" : "full");
	assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	const original = path => nominalSubtypeWitOriginal(producerCommit, path);
	const inputs = { "lean-bridge.exports.json": Buffer.from(canonicalJson(configuration)) };
	for(const path of [`${zeroPayloadCheckedRecordModule}.lean`, "lakefile.toml", "lean-toolchain", "LICENSE", "package.json"])
		inputs[path] = original(`${zeroPayloadCheckedRecordFixture}/${path}`);
	if(selection.reviewed) inputs["api.binding-ir.json"] = Buffer.from(canonicalJson(expected));
	let model, receipt;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, build = report.builds[attempt];
		model = await json(prefix + "model.json");
		receipt = await json(prefix + "package-set-receipt.json");
		validatePackageSetReceipt(receipt); validateBindingIr(model.bindingIr);
		assert.deepEqual(receipt, report.receipt);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64);
		assert.equal(model.schemaVersion, selection.reviewed ? 3 : 2);
		assert.equal(model.byteOrder, "little"); assert.equal(model.moduleName, undefined);
		assert.equal(model.exports.length, selection.resultOnly ? 6 : 11);
		assert.deepEqual(model.exports.map(item => item.name).sort(), expected.declarations.map(item => item.id.slice(5)).sort());
		const source = inputs[`${zeroPayloadCheckedRecordModule}.lean`], identity = model.sourceIdentity;
		assert.deepEqual(await read(prefix + `${zeroPayloadCheckedRecordModule}.lean`), source);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json"), configuration);
		assert.equal(identity.modules.length, 1); assert.equal(identity.modules[0].module, zeroPayloadCheckedRecordModule);
		assert.deepEqual(identity.modules[0].source, { path: `${zeroPayloadCheckedRecordModule}.lean`, bytes: source.length, sha256: sha256(source) });
		assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.equal(identity.extractorSha256, sha256(original("src/analyze/NativeExports.lean")));
		for(const key of ["leanCompilerSha256", "sourceTreeSha256"]) assert.match(identity[key], /^[a-f0-9]{64}$/u);
		assert.deepEqual(identity.request.metadata.modules.map(item => item.sourceSha256), [sha256(source)]);
		assert.equal(identity.request.metadata.toolchain, inputs["lean-toolchain"].toString().trim());
		let request = configuration;
		if(selection.reviewed)
		{
			assert.deepEqual(await json(prefix + "api.binding-ir.json"), expected);
			assert.equal(identity.reviewedBindingIr.source, canonicalJson(expected));
			assert.equal(identity.reviewedBindingIr.sourceSha256, sha256(canonicalJson(expected)));
			assert.equal(identity.reviewedBindingIr.semanticSha256, hashBindingIr(expected));
			request = reviewedSourceSelection(identity.reviewedBindingIr);
		}
		else assert.equal(identity.reviewedBindingIr, undefined);
		for(const key of ["contracts", "exports", "specializations"]) assert.deepEqual(identity.request[key], request[key]);
		for(const key of ["arities", "resources"]) assert.deepEqual(identity.request[key], []);
		for(const key of ["modules", "exportModules"]) assert.deepEqual(identity.request[key], [zeroPayloadCheckedRecordModule]);
		assert.equal(identity.request.profile, "native-library-v1");
		const snapshot = await json(prefix + "author-inputs.json");
		assert.deepEqual(snapshot.map(item => item.path), Object.keys(inputs).sort());
		for(const item of snapshot)
		{
			assert.equal(item.sha256, sha256(inputs[item.path])); assert.equal(item.mode & 0o170000, 0o100000);
			assert.ok(Number.isFinite(item.mtime) && item.mtime > 0);
			assert.ok(Number.isFinite(item.ctime) && item.ctime > 0);
		}
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		const { name, version } = zeroPayloadWitTarget;
		assert.deepEqual(model.component, { id: `${name}@${version}`, name, version });
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role]), [["wit-wasi", "component"]]);
		assert.equal(receipt.packages[0].runtimeIdentity, receipt.profiles[0].runtimeIdentity);
		assert.deepEqual(build, { bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(await read(prefix + "model.json"))
			, receiptSha256: sha256(await read(prefix + "package-set-receipt.json"))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))) });
	}
	return { model, receipt };
};
