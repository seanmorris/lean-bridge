/**
 * Check primitive-base nominal Perl compiler decisions against the hand-authored Lean contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedContractDifference, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nominalPrimitiveSubtypeReview, nominalPrimitiveSubtypeFixture, nominalPrimitiveSubtypeModule } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypePerlConfiguration, nominalPrimitiveSubtypePerlModule } from "./nominal-primitive-subtype-perl-fixture.mjs";
import { nominalSubtypePerlOriginal as nominalPrimitiveSubtypePerlOriginal } from "./nominal-subtype-perl-generators.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
// Independent named-to-positional translation, without the producer's lowering.
const nativeTree = tree => {
	if(tree === null || ["fin", "subtype"].includes(tree.kind)) return tree;
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
 * Reconcile two independent builds, original author inputs and reviewed authority.
 *
 * @param options - Explicit selection and archive-relative readers.
 * @param options.report - Original top-level installed report.
 * @param options.read - Read original bytes, never historical absolute paths.
 * @param options.json - Read canonical JSON records.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.mode - Full or constructor-free result-only API.
 * @param options.producerCommit - Frozen Git revision.
 */
export const checkNominalPrimitiveSubtypePerlModels = async ({ report, read, json, route, mode, producerCommit }) => {
	const expected = nominalPrimitiveSubtypeReview(mode === "result-only"), configuration = nominalPrimitiveSubtypePerlConfiguration(route, mode);
	assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	const original = path => nominalPrimitiveSubtypePerlOriginal(producerCommit, path);
	const inputs = { "lean-bridge.exports.json": Buffer.from(canonicalJson(configuration)) };
	for(const path of [`${nominalPrimitiveSubtypeModule}.lean`, "lakefile.toml", "lean-toolchain", "LICENSE", "package.json"])
		inputs[path] = original(`${nominalPrimitiveSubtypeFixture}/${path}`);
	if(route === "reviewed") inputs["api.binding-ir.json"] = Buffer.from(canonicalJson(expected));
	let receipt, model;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, build = report.builds[attempt];
		model = await json(prefix + "model.json"); receipt = await json(prefix + "package-set-receipt.json");
		validatePackageSetReceipt(receipt); validateBindingIr(model.bindingIr);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64);
		assert.equal(model.schemaVersion, route === "reviewed" ? 3 : 2); assert.equal(model.byteOrder, "little");
		assert.equal(model.moduleName, nominalPrimitiveSubtypePerlModule);
		assert.deepEqual(model.exports.map(item => item.name).sort(), expected.declarations.map(item => item.id.slice(5)).sort());
		for(const declaration of expected.declarations)
		{
			const item = model.exports.find(item => item.name === declaration.id.slice(5));
			const tree = declaration.source.extensions["lean-lang.org/refinements"];
			if(tree === undefined)
			{
				assert.equal(declaration.id, `lean:${nominalPrimitiveSubtypeModule}.wordBits`);
				assert.equal(item.refinements, undefined);
				continue;
			}
			assert.deepEqual(item.refinements, { parameters: tree.parameters.map(nativeTree), result: nativeTree(tree.result) });
			// Results project base values; no result site may name an input constructor.
			assert.doesNotMatch(JSON.stringify(item.refinements.result), /"constructor":"[^"]/u);
		}
		const source = inputs[`${nominalPrimitiveSubtypeModule}.lean`];
		assert.deepEqual(await read(prefix + `${nominalPrimitiveSubtypeModule}.lean`), source);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json"), configuration);
		const identity = model.sourceIdentity;
		assert.equal(identity.modules.length, 1); assert.equal(identity.modules[0].module, nominalPrimitiveSubtypeModule);
		assert.deepEqual(identity.modules[0].source, { path: `${nominalPrimitiveSubtypeModule}.lean`, bytes: source.length, sha256: sha256(source) });
		assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.equal(identity.extractorSha256, sha256(original("src/analyze/NativeExports.lean")));
		digest(identity.leanCompilerSha256); digest(identity.sourceTreeSha256);
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
		for(const key of ["contracts", "exports", "specializations"])
			assert.deepEqual(identity.request[key], selection[key]);
		for(const key of ["arities", "resources"]) assert.deepEqual(identity.request[key], []);
		for(const key of ["modules", "exportModules"]) assert.deepEqual(identity.request[key], [nominalPrimitiveSubtypeModule]);
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
		assert.deepEqual(model.component, { id: "nominalprimitivesubtypes@1.0.0", name: "nominalprimitivesubtypes", version: "1.0.0" });
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(item => item.role).sort(), ["component", "runtime"]);
		assert.ok(receipt.packages.every(item => item.target === "cpan" && item.artifacts.length === 1));
		assert.ok(receipt.packages.every(item => item.runtimeIdentity === receipt.profiles[0].runtimeIdentity));
		assert.deepEqual(build, { bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(await read(prefix + "model.json"))
			, receiptSha256: sha256(await read(prefix + "package-set-receipt.json"))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))) });
	}
	return { model, receipt };
};
