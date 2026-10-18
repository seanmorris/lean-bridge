/**
 * Reconcile original C# compiler decisions with the exact value-index contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { reviewedContractDifference, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	checkedRecordValueIndexFixtureRoot, checkedRecordValueIndexModule
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	assertCheckedRecordValueIndexProvenance
} from "./checked-record-value-index-browser-report.mjs";
import {
	checkedRecordValueIndexDotnetSelection
} from "./checked-record-value-index-dotnet-fixture.mjs";
import {
	checkedRecordValueIndexDotnetOriginal
} from "./checked-record-value-index-dotnet-generators.mjs";

const refinementsKey = "lean-lang.org/refinements";
const fixturePaths = Object.freeze([
	`${checkedRecordValueIndexModule}.lean`, "LICENSE", "lakefile.toml"
	, "lean-toolchain", "package.json"
]);

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
 * Authenticate two author builds, their complete inputs and exact indices.
 *
 * @param options - Independently selected run and original-record readers.
 * @param options.report - Original top-level report.
 * @param options.read - Read retained relative bytes.
 * @param options.json - Read canonical JSON records.
 * @param options.route - Exact ordinary/reviewed and full/result-only route.
 * @param options.producerCommit - Full frozen source revision.
 */
export const checkCheckedRecordValueIndexDotnetModels = async ({
	report, read, json, route, producerCommit
}) => {
	const selection = checkedRecordValueIndexDotnetSelection(route);
	const { configuration, expected } = selection;
	assert.deepEqual(await json("configuration.json"), configuration);
	const retainedExpected = await json("expected.binding-ir.json");
	assert.deepEqual(retainedExpected, expected);
	assertCheckedRecordValueIndexProvenance(retainedExpected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	const original = path => checkedRecordValueIndexDotnetOriginal(
		producerCommit, path
	);
	const inputs = {
		"lean-bridge.exports.json": Buffer.from(canonicalJson(configuration))
	};
	for(const path of fixturePaths)
		inputs[path] = original(`${checkedRecordValueIndexFixtureRoot}/${path}`);
	if(selection.reviewed)
		inputs["api.binding-ir.json"] = Buffer.from(canonicalJson(expected));
	let model, receipt;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, build = report.builds[attempt];
		const modelBytes = await read(prefix + "model.json");
		const receiptBytes = await read(prefix + "package-set-receipt.json");
		model = JSON.parse(modelBytes); receipt = JSON.parse(receiptBytes);
		assert.equal(modelBytes.toString(), canonicalJson(model));
		assert.equal(receiptBytes.toString(), canonicalJson(receipt));
		validatePackageSetReceipt(receipt); validateBindingIr(model.bindingIr);
		assert.deepEqual(receipt, report.receipt);
		assertCheckedRecordValueIndexProvenance(model.bindingIr);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null
			, `build-${attempt} independently reconciles with reviewed Binding IR`);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.profile, "native-library-v1");
		assert.equal(model.pointerBits, 64);
		assert.equal(model.schemaVersion, selection.reviewed ? 3 : 2);
		assert.equal(model.byteOrder, "little");
		assert.equal(model.moduleName, undefined);
		assert.deepEqual(model.exports.map(item => item.name).sort()
			, expected.declarations.map(item => item.source.declaration).sort());
		for(const item of model.exports)
		{
			const declaration = expected.declarations.find(value =>
				value.source.declaration === item.name
			);
			assert.ok(declaration, item.name);
			assert.deepEqual(item.refinements
				, nativeRefinements(expected, declaration), item.name);
		}
		const source = inputs[`${checkedRecordValueIndexModule}.lean`];
		const identity = model.sourceIdentity;
		assert.deepEqual(await read(prefix
			+ `${checkedRecordValueIndexModule}.lean`), source);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json")
			, configuration);
		assert.equal(identity.modules.length, 1);
		assert.equal(identity.modules[0].module, checkedRecordValueIndexModule);
		assert.deepEqual(identity.modules[0].source, {
			path: `${checkedRecordValueIndexModule}.lean`
			, bytes: source.length, sha256: sha256(source)
		});
		assert.equal(identity.exportConfigurationSource
			, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256
			, sha256(canonicalJson(configuration)));
		assert.equal(identity.extractorSha256
			, sha256(original("src/analyze/NativeExports.lean")));
		for(const key of ["leanCompilerSha256", "sourceTreeSha256"])
			assert.match(identity[key], /^[a-f0-9]{64}$/u);
		assert.deepEqual(identity.request.metadata.modules.map(
			item => item.sourceSha256), [sha256(source)]);
		assert.equal(identity.request.metadata.toolchain
			, inputs["lean-toolchain"].toString().trim());
		let request = configuration;
		if(selection.reviewed)
		{
			assert.deepEqual(await json(prefix + "api.binding-ir.json"), expected);
			assert.equal(identity.reviewedBindingIr.source
				, canonicalJson(expected));
			assert.equal(identity.reviewedBindingIr.sourceSha256
				, sha256(canonicalJson(expected)));
			assert.equal(identity.reviewedBindingIr.semanticSha256
				, hashBindingIr(expected));
			request = reviewedSourceSelection(identity.reviewedBindingIr);
		}
		else assert.equal(identity.reviewedBindingIr, undefined);
		for(const key of ["contracts", "exports", "specializations"])
			assert.deepEqual(identity.request[key], request[key]);
		for(const key of ["arities", "resources"])
			assert.deepEqual(identity.request[key], []);
		for(const key of ["modules", "exportModules"])
			assert.deepEqual(identity.request[key]
				, [checkedRecordValueIndexModule]);
		assert.equal(identity.request.profile, "native-library-v1");
		const snapshot = await json(prefix + "author-inputs.json");
		assert.deepEqual(snapshot.map(item => item.path), Object.keys(inputs).sort());
		const stable = snapshot.map(({ path, mode, sha256: digest }) => ({
			path, mode, sha256: digest
		}));
		assert.equal(sha256(canonicalJson(stable)), build.authorInputsSha256);
		for(const item of snapshot)
		{
			assert.equal(item.mode, 33188, item.path);
			assert.equal(item.sha256, sha256(inputs[item.path]), item.path);
			assert.ok(Number.isFinite(item.mtime) && item.mtime > 0);
			assert.ok(Number.isFinite(item.ctime) && item.ctime > 0);
		}
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.deepEqual(model.component, {
			id: "checkedrecordvalueindices@1.0.0"
			, name: "checkedrecordvalueindices", version: "1.0.0"
		});
		assert.equal(receipt.profiles.length, 1);
		assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.equal(receipt.packages.length, 1);
		assert.equal(receipt.packages[0].runtimeIdentity
			, receipt.profiles[0].runtimeIdentity);
		assert.deepEqual(build, {
			authorInputsSha256: build.authorInputsSha256
			, bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(item => [item.path, item.sha256])))
		});
	}
	return { model, receipt };
};
