/**
 * Reconcile original nested checked-record Python compiler decisions with the independent contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedContractDifference, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nestedCheckedRecordFixture, nestedCheckedRecordModule } from "./nested-checked-record-fixture.mjs";
import { nestedCheckedRecordPythonConfiguration, nestedCheckedRecordPythonReview } from "./nested-checked-record-python-fixture.mjs";
import { nominalSubtypePythonOriginal as nestedCheckedRecordPythonOriginal } from "./nominal-subtype-python-generators.mjs";

// Independent named-to-positional translation, without using producer lowering.
const nativeTree = tree => {
	if(tree === null || ["fin", "subtype"].includes(tree.kind)) return tree;
	if(tree.kind === "checked-record") return {
		kind: "checked-record", definition: tree.name, constructor: tree.constructor
		, fields: tree.fields.map(field => field.name)
		, arguments: tree.fields.map(field => nativeTree(field.refinement))
	};
	if(tree.kind === "record") return { kind: "record", definition: tree.name
		, fields: tree.fields.map(field => field.name)
		, arguments: tree.fields.map(field => nativeTree(field.refinement)) };
	if(tree.kind === "variant") return { kind: "variant", definition: tree.name
		, cases: tree.cases.map(branch => ({ name: branch.name
			, fields: branch.fields.map(field => field.name)
			, arguments: branch.fields.map(field => nativeTree(field.refinement)) })) };
	return { kind: tree.kind, arguments: tree.arguments.map(nativeTree) };
};

/**
 * Authenticate two author builds, complete source inputs and per-use constructors.
 *
 * @param options - Independently selected run and original-record readers.
 * @param options.report - Original top-level report.
 * @param options.read - Read retained relative bytes, never historical absolute paths.
 * @param options.json - Read canonical JSON records.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.mode - Full or constructor-free result-only API.
 * @param options.producerCommit - Full frozen source revision.
 */
export const checkNestedCheckedRecordPythonModels = async ({ report, read, json, route, mode, producerCommit }) => {
	const expected = nestedCheckedRecordPythonReview(mode), configuration = nestedCheckedRecordPythonConfiguration(route, mode);
	assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	const original = path => nestedCheckedRecordPythonOriginal(producerCommit, path);
	const inputs = { "lean-bridge.exports.json": Buffer.from(canonicalJson(configuration)) };
	for(const path of [`${nestedCheckedRecordModule}.lean`, "lakefile.toml", "lean-toolchain", "LICENSE", "package.json"])
		inputs[path] = original(`${nestedCheckedRecordFixture}/${path}`);
	if(route === "reviewed") inputs["api.binding-ir.json"] = Buffer.from(canonicalJson(expected));
	let model, receipt;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, build = report.builds[attempt];
		model = await json(prefix + "model.json"); receipt = await json(prefix + "package-set-receipt.json");
		validatePackageSetReceipt(receipt); validateBindingIr(model.bindingIr);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64);
		assert.equal(model.schemaVersion, route === "reviewed" ? 3 : 2); assert.equal(model.byteOrder, "little");
		assert.equal(model.moduleName, undefined);
		assert.equal(model.exports.length, mode === "full" ? 13 : 2);
		assert.deepEqual(model.exports.map(item => item.name).sort(), expected.declarations.map(item => item.id.slice(5)).sort());
		for(const declaration of expected.declarations)
		{
			const item = model.exports.find(item => item.name === declaration.id.slice(5));
			// Every nested export carries a refinement tree, including constructor-free results.
			const tree = declaration.source.extensions["lean-lang.org/refinements"]; assert.ok(tree, declaration.id);
			assert.deepEqual(item.refinements, { parameters: tree.parameters.map(nativeTree), result: nativeTree(tree.result) });
			assert.doesNotMatch(JSON.stringify(item.refinements.result), /NestedCheckedRecords\.(?:mk|normalize)(?:Packet|Word)"/u);
		}
		const source = inputs[`${nestedCheckedRecordModule}.lean`], identity = model.sourceIdentity;
		assert.deepEqual(await read(prefix + `${nestedCheckedRecordModule}.lean`), source);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json"), configuration);
		assert.equal(identity.modules.length, 1); assert.equal(identity.modules[0].module, nestedCheckedRecordModule);
		assert.deepEqual(identity.modules[0].source, { path: `${nestedCheckedRecordModule}.lean`, bytes: source.length, sha256: sha256(source) });
		assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.equal(identity.extractorSha256, sha256(original("src/analyze/NativeExports.lean")));
		for(const key of ["leanCompilerSha256", "sourceTreeSha256"]) assert.match(identity[key], /^[a-f0-9]{64}$/u);
		assert.deepEqual(identity.request.metadata.modules.map(item => item.sourceSha256), [sha256(source)]);
		assert.equal(identity.request.metadata.toolchain, inputs["lean-toolchain"].toString().trim());
		let selection = configuration;
		if(route === "reviewed")
		{
			assert.deepEqual(await json(prefix + "api.binding-ir.json"), expected);
			assert.equal(identity.reviewedBindingIr.source, canonicalJson(expected));
			assert.equal(identity.reviewedBindingIr.sourceSha256, sha256(canonicalJson(expected)));
			assert.equal(identity.reviewedBindingIr.semanticSha256, hashBindingIr(expected));
			selection = reviewedSourceSelection(identity.reviewedBindingIr);
		} else assert.equal(identity.reviewedBindingIr, undefined);
		for(const key of ["contracts", "exports", "specializations"]) assert.deepEqual(identity.request[key], selection[key]);
		for(const key of ["arities", "resources"]) assert.deepEqual(identity.request[key], []);
		for(const key of ["modules", "exportModules"]) assert.deepEqual(identity.request[key], [nestedCheckedRecordModule]);
		assert.equal(identity.request.profile, "native-library-v1");
		const snapshot = await json(prefix + "author-inputs.json");
		assert.deepEqual(snapshot.map(item => item.path), Object.keys(inputs).sort());
		for(const item of snapshot)
		{
			assert.equal(item.sha256, sha256(inputs[item.path])); assert.equal(item.mode & 0o170000, 0o100000);
			assert.ok(Number.isFinite(item.mtime) && item.mtime > 0); assert.ok(Number.isFinite(item.ctime) && item.ctime > 0);
		}
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.deepEqual(model.component, { id: "nestedcheckedrecords@1.0.0", name: "nestedcheckedrecords", version: "1.0.0" });
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.equal(receipt.packages.length, 1);
		assert.equal(receipt.packages[0].runtimeIdentity, receipt.profiles[0].runtimeIdentity);
		assert.deepEqual(build, { bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(await read(prefix + "model.json"))
			, receiptSha256: sha256(await read(prefix + "package-set-receipt.json"))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))) });
	}
	return { model, receipt };
};
