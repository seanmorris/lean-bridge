/**
 * Reconcile original recursive checked-record compiler decisions with the independent contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedContractDifference, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { mutualCheckedRecordRefinements } from "./mutual-checked-record-fixture.mjs";
import { recursiveCheckedRecordRefinements } from "./recursive-checked-record-fixture.mjs";
import {
	recursiveCheckedRecordPhpConfiguration, recursiveCheckedRecordPhpPackage
	, recursiveCheckedRecordPhpReview
} from "./recursive-checked-record-php-fixture.mjs";

const refinements = { recursive: recursiveCheckedRecordRefinements, mutual: mutualCheckedRecordRefinements };
const fixtureInputs = ["lakefile.toml", "lean-toolchain", "LICENSE", "package.json"];

/**
 * Authenticate both author builds, complete source inputs and per-use constructors.
 *
 * @param options - Independently selected run and original-record readers.
 * @param options.report - Original top-level report.
 * @param options.read - Read retained relative bytes.
 * @param options.json - Read canonical JSON records.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.fixture - Recursive or mutual module.
 * @param options.producerCommit - Full frozen source revision.
 */
export const checkRecursiveCheckedRecordPhpModels = async ({ report, read, json, route, fixture, producerCommit }) => {
	const expected = recursiveCheckedRecordPhpReview(fixture);
	const configuration = recursiveCheckedRecordPhpConfiguration(route, fixture);
	const { version, leanModule, root } = recursiveCheckedRecordPhpPackage(fixture);
	// The Composer vendor prefix belongs to the package, not to the compiled component.
	const name = `${fixture}checkedrecords`;
	assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0], "Both author roots reproduce the Composer package");
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`]
		, { maxBuffer: 64 * 1024 * 1024 });
	const inputs = { "lean-bridge.exports.json": Buffer.from(canonicalJson(configuration)) };
	for(const path of [`${leanModule}.lean`, ...fixtureInputs]) inputs[path] = original(`${root}/${path}`);
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
		assert.equal(model.schemaVersion, route === "reviewed" ? 5 : 4); assert.equal(model.byteOrder, "little");
		assert.deepEqual(model.component, { id: `${name}@${version}`, name, version });
		assert.deepEqual(model.exports.map(item => item.name).sort()
			, expected.declarations.map(item => item.id.slice(5)).sort());
		for(const item of model.exports)
		{
			// The compiler keeps each export's named refinement tree, including constructor-free results.
			assert.deepEqual(item.refinements, refinements[fixture][item.name], item.name);
			assert.doesNotMatch(JSON.stringify(item.refinements.result)
				, /"constructor":"[A-Za-z]+CheckedRecords\./u, `${item.name} result selects no constructor`);
		}
		const source = inputs[`${leanModule}.lean`], identity = model.sourceIdentity;
		assert.deepEqual(Buffer.from(await read(prefix + `${leanModule}.lean`)), source);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json"), configuration);
		assert.equal(identity.modules.length, 1); assert.equal(identity.modules[0].module, leanModule);
		assert.deepEqual(identity.modules[0].source
			, { path: `${leanModule}.lean`, bytes: source.length, sha256: sha256(source) });
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
		}
		else assert.equal(identity.reviewedBindingIr, undefined);
		for(const key of ["contracts", "exports", "specializations"])
			assert.deepEqual(identity.request[key], selection[key], key);
		for(const key of ["arities", "resources"]) assert.deepEqual(identity.request[key], []);
		for(const key of ["modules", "exportModules"]) assert.deepEqual(identity.request[key], [leanModule]);
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
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role]), [["php-native", "component"]]);
		assert.equal(receipt.packages[0].runtimeIdentity, receipt.profiles[0].runtimeIdentity);
		assert.deepEqual(build, {
			archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(item => [item.path, item.sha256])))
			, bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(Buffer.from(await read(prefix + "model.json")))
			, receiptSha256: sha256(Buffer.from(await read(prefix + "package-set-receipt.json")))
		});
	}
	return { model, receipt };
};

const replaceLeaf = (value, predicate, mutate) => {
	if(!value || typeof value !== "object") return false;
	if(predicate(value))
	{
		mutate(value); return true;
	}
	return Object.values(value).some(child => replaceLeaf(child, predicate, mutate));
};

/**
 * Coordinated compiler-model mutations that every retained build must refuse.
 * Each mutation asserts that it found a leaf to change, so it cannot pass vacuously.
 *
 * @param fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordPhpModelMutations = fixture => {
	const prefix = { recursive: "RecursiveCheckedRecords", mutual: "MutualCheckedRecords" }[fixture];
	assert.ok(prefix);
	const trees = model => model.exports.map(item => item.refinements);
	return [
		["wrong native word width", model => { model.pointerBits = 32; }]
		, ["omitted export", model => { model.exports.pop(); }]
		, ["changed extractor", model => { model.sourceIdentity.extractorSha256 = "0".repeat(64); }]
		, ["changed Fin bound", model => {
			assert.ok(replaceLeaf(trees(model), item => item.kind === "fin", item => { item.bound = "4"; }));
		}]
		, ["invented result constructor", model => {
			assert.ok(replaceLeaf(trees(model).map(item => item.result), item => item.kind === "checked-record"
				, item => { item.constructor = `${prefix}.mk${fixture === "mutual" ? "Envelope" : "Packet"}`; }));
		}]
		, ["unreviewed parameter constructor", model => {
			assert.ok(replaceLeaf(trees(model).map(item => item.parameters), item => item.kind === "subtype"
				&& item.constructor !== null, item => { item.constructor = `${prefix}.unreviewed`; }));
		}]
		, ["swapped per-site constructor", model => {
			assert.ok(replaceLeaf(trees(model).map(item => item.parameters), item => item.kind === "checked-record"
				&& item.constructor?.includes(".normalize"), item => { item.constructor = item.constructor.replace(".normalize", ".mk"); }));
		}]
	];
};
