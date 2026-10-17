/**
 * Reconcile recursive Rust compiler decisions with the independent contracts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { reviewedContractDifference, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { nativeGraphCarrierAbi } from "../../src/build/native-graph-model.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { mutualCheckedRecordRefinements } from "./mutual-checked-record-fixture.mjs";
import { recursiveCheckedRecordRefinements } from "./recursive-checked-record-fixture.mjs";
import {
	recursiveCheckedRecordRustConfiguration, recursiveCheckedRecordRustPackage
	, recursiveCheckedRecordRustReview
} from "./recursive-checked-record-rust-fixture.mjs";
import { recursiveCheckedRecordRustOriginal } from "./recursive-checked-record-rust-generators.mjs";

const refinements = {
	recursive: recursiveCheckedRecordRefinements
	, mutual: mutualCheckedRecordRefinements
};
const fixtureInputs = ["lakefile.toml", "lean-toolchain", "LICENSE", "package.json"];

/**
 * Authenticate both author roots, source identity and every refinement tree.
 *
 * @param options - Independently selected run and original-record readers.
 * @param options.report - Original top-level report.
 * @param options.read - Read retained relative bytes.
 * @param options.json - Read canonical JSON records.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.fixture - Recursive or mutually recursive graph.
 * @param options.producerCommit - Full frozen source revision.
 */
export const checkRecursiveCheckedRecordRustModels = async ({
	report, read, json, route, fixture, producerCommit
}) => {
	const expected = recursiveCheckedRecordRustReview(fixture);
	const configuration = recursiveCheckedRecordRustConfiguration(route, fixture);
	const { name, version, leanModule, root } = recursiveCheckedRecordRustPackage(fixture);
	assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]
		, "Both author roots reproduce the complete crate");
	const original = path => recursiveCheckedRecordRustOriginal(producerCommit, path);
	const inputs = { "lean-bridge.exports.json": Buffer.from(canonicalJson(configuration)) };
	for(const path of [`${leanModule}.lean`, ...fixtureInputs])
		inputs[path] = original(`${root}/${path}`);
	if(route === "reviewed")
		inputs["api.binding-ir.json"] = Buffer.from(canonicalJson(expected));
	const sourceInputs = Object.entries(inputs).sort(([a], [b]) => a.localeCompare(b))
		.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
	const treeSha256 = sha256(sourceInputs
		.map(item => item.sha256 + "  " + item.path + "\n").join(""));
	const license = sourceInputs.find(item => item.path === "LICENSE");
	const notices = {
		schemaVersion: 2, kind: "lean-bridge-source-notices"
		, packages: [{
			name
			, source: { kind: "root", sourceTreeSha256: treeSha256, inputs: sourceInputs }
			, configurationSource: canonicalJson(configuration)
			, notices: [{ ...license, payload: "source-notices/" + license.sha256 + ".txt" }]
		}]
	};
	let model, receipt;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		const build = report.builds[attempt];
		model = await json(prefix + "model.json");
		receipt = await json(prefix + "package-set-receipt.json");
		validatePackageSetReceipt(receipt);
		validateBindingIr(model.bindingIr);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.profile, "native-library-v1");
		assert.equal(model.pointerBits, 64);
		assert.equal(model.schemaVersion, route === "reviewed" ? 5 : 4);
		assert.equal(model.byteOrder, "little");
		assert.equal(model.moduleName, undefined);
		assert.deepEqual(model.component, { id: `${name}@${version}`, name, version });
		assert.equal(model.exports.length, 6);
		assert.deepEqual(model.exports.map(item => item.name).sort()
			, expected.declarations.map(item => item.id.slice(5)).sort());
		for(const item of model.exports)
		{
			assert.deepEqual(item.refinements, refinements[fixture][item.name], item.name);
			assert.doesNotMatch(JSON.stringify(item.refinements.result)
				, /"constructor":"[A-Za-z]+CheckedRecords\./u
				, `${item.name} result selects no constructor`);
		}
		nativeGraphCarrierAbi(model);
		const source = inputs[`${leanModule}.lean`];
		const identity = model.sourceIdentity;
		assert.deepEqual(Buffer.from(await read(prefix + `${leanModule}.lean`)), source);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json"), configuration);
		assert.equal(identity.modules.length, 1);
		assert.equal(identity.modules[0].module, leanModule);
		assert.deepEqual(identity.modules[0].source, {
			path: `${leanModule}.lean`, bytes: source.length, sha256: sha256(source)
		});
		assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.equal(identity.extractorSha256, sha256(original("src/analyze/NativeExports.lean")));
		assert.match(identity.leanCompilerSha256, /^[a-f0-9]{64}$/u);
		assert.equal(identity.sourceTreeSha256, treeSha256);
		assert.equal(identity.sourceNoticesSha256, sha256(canonicalJson(notices)));
		assert.equal(identity.lakeDependencies, undefined);
		assert.deepEqual(identity.request.metadata.modules.map(item => item.sourceSha256)
			, [sha256(source)]);
		assert.equal(identity.request.metadata.toolchain, inputs["lean-toolchain"].toString().trim());
		let selection = configuration;
		if(route === "reviewed")
		{
			assert.deepEqual(await json(prefix + "api.binding-ir.json"), expected);
			assert.equal(identity.reviewedBindingIr.source, canonicalJson(expected));
			assert.equal(identity.reviewedBindingIr.sourceSha256, sha256(canonicalJson(expected)));
			assert.equal(identity.reviewedBindingIr.semanticSha256, hashBindingIr(expected));
			selection = reviewedSourceSelection(identity.reviewedBindingIr);
		}
		else assert.equal(identity.reviewedBindingIr, undefined);
		for(const key of ["contracts", "exports", "specializations"])
			assert.deepEqual(identity.request[key], selection[key], key);
		for(const key of ["arities", "resources"]) assert.deepEqual(identity.request[key], []);
		for(const key of ["modules", "exportModules"])
			assert.deepEqual(identity.request[key], [leanModule]);
		assert.equal(identity.request.profile, "native-library-v1");
		const snapshot = await json(prefix + "author-inputs.json");
		assert.deepEqual(snapshot.map(item => item.path), Object.keys(inputs).sort());
		for(const item of snapshot)
		{
			assert.equal(item.sha256, sha256(inputs[item.path]));
			assert.equal(item.mode & 0o170000, 0o100000);
			assert.ok(Number.isFinite(item.mtime) && item.mtime > 0);
			assert.ok(Number.isFinite(item.ctime) && item.ctime > 0);
		}
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1);
		assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role])
			, [["cargo", "component"]]);
		assert.deepEqual(receipt, report.receipt);
		assert.equal(receipt.packages[0].runtimeIdentity, receipt.profiles[0].runtimeIdentity);
		assert.deepEqual(build, {
			bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(Buffer.from(await read(prefix + "model.json")))
			, receiptSha256: sha256(Buffer.from(await read(
				prefix + "package-set-receipt.json")))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(item => [item.path, item.sha256])))
		});
	}
	for(const path of [
		"model.json", "package-set-receipt.json", `${leanModule}.lean`
		, "lean-bridge.exports.json"
		, ...route === "reviewed" ? ["api.binding-ir.json"] : []
	]) assert.deepEqual(await read(`build-0/${path}`), await read(`build-1/${path}`), path);
	return { model, receipt };
};
