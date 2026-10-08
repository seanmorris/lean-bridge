/**
 * Fresh Lean checks the constructors selected by an independent Subtype review.
 * These checks stop before native linking; installed acceptance is separate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildElaboratedComponent } from "../../src/build/elaborated-component.mjs";
import { createNativeModel } from "../../src/build/native-model.mjs";
import { reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { reviewedSubtypeExtraSource, reviewedSubtypeIr } from "./reviewed-subtype-fixture.mjs";

const key = "lean-lang.org/refinements";
const half = ir => ir.declarations.find(item => item.name === "half");

test("independent Subtype reviews select typed constructors, authenticate specializations and reject unsafe decisions in fresh Lean", {
	skip: process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_LEAN_TEST !== "1"
	, timeout: 900_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-subtypes-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project"), outputRoot = join(directory, "component");
	const fixture = "tests/fixtures/onboarding/native-subtype";
	await cp(fixture, projectRoot, { recursive: true });
	await saveLakeFile(projectRoot, "Subtypes.lean", `${await readFile(join(fixture, "Subtypes.lean"), "utf8")}${reviewedSubtypeExtraSource}`);
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Subtypes"] }));
	const cases = [
		["all primitive sites and two generic specializations", () => {}, null]
		, ["alternate normalizing constructor", ir => { half(ir).source.extensions[key].parameters[0].constructor = "Subtypes.normalizedEven"; }, null]
		, ["wrong input base", ir => { half(ir).source.extensions[key].parameters[0].constructor = "Subtypes.checkedWord"; }, /input must equal the subtype base/u]
		, ["wrong output subtype", ir => { half(ir).source.extensions[key].parameters[0].constructor = "Subtypes.wrongEven"; }, /return Option of the exact subtype/u]
		, ["unsafe constructor", ir => { half(ir).source.extensions[key].parameters[0].constructor = "Subtypes.unsafeEven"; }, /unsafe, partial or foreign implementation contract/u]
		, ["partial constructor", ir => { half(ir).source.extensions[key].parameters[0].constructor = "Subtypes.partialEven"; }, /unsafe, partial or foreign implementation contract/u]
		, ["foreign constructor", ir => { half(ir).source.extensions[key].parameters[0].constructor = "Subtypes.foreignEven"; }, /unsafe, partial or foreign implementation contract/u]
		, ["constructor outside the source closure", ir => { half(ir).source.extensions[key].parameters[0].constructor = "Option.some"; }, /must belong to a selected module/u]
		, ["missing constructor", ir => { delete half(ir).source.extensions[key]; }, /require a configured checked constructor/u]
		, ["contradictory Fin bound", ir => { ir.declarations.find(item => item.name === "mix").source.extensions[key].parameters[1].bound = "11"; }, /reviewed-ir-source-mismatch/u]
		, ["contradictory transport", ir => { half(ir).parameters[0].type.name = "int"; }, /reviewed-ir-source-mismatch/u]
	];
	const identities = [];
	for(const [name, change, failure] of cases) await t.test(name, async () => {
		const review = reviewedSubtypeIr(true); change(review);
		await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
		const before = await lakeInputState(projectRoot);
		let checked = false;
		const createModel = input => {
			const selected = reviewedSourceSelection(input.sourceIdentity.reviewedBindingIr);
			assert.deepEqual(input.sourceIdentity.request.contracts, selected.contracts);
			assert.deepEqual(input.sourceIdentity.request.specializations, selected.specializations);
			identities.push(input.sourceIdentity.request.metadata.invocationIdentitySha256);
			return createNativeModel(input, { refinements: true });
		};
		const options = { projectRoot, outputRoot
			, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
			, targets: ["c"], profile: "native-library-v1"
			, receiptName: "native-component.json", createModel
			, compileComponent: async ({ model, adapters }) => {
				assert.equal(failure, null, `${name}: invalid review reached the linker`);
				assert.equal(model.schemaVersion, 3);
				assert.equal(model.exports.length, 11);
				for(const item of model.exports)
					assert.deepEqual(item.refinements, review.declarations.find(declaration => declaration.id === `lean:${item.name}`).source.extensions[key]);
				assert.match(adapters.leanSource, /Subtypes\.normalizedEven/u);
				assert.match(adapters.leanSource, /Subtypes\.checkedByte/u);
				checked = true;
				throw Object.assign(new Error("Checked through Lean adapter compilation"), { code: "test-checked" });
			}
		};
		await assert.rejects(() => buildElaboratedComponent(options), error => {
			if(failure) assert.match(JSON.stringify({ code: error.code, message: error.message, details: error.details }), failure, name);
			else assert.equal(error.code, "test-checked", JSON.stringify({ name, message: error.message, details: error.details }));
			return true;
		});
		assert.equal(checked, failure === null);
		await assert.rejects(() => lstat(outputRoot), { code: "ENOENT" });
		assert.deepEqual(await lakeInputState(projectRoot), before);
	});
	assert.notEqual(identities[0], identities[1], "changing the constructor changes compilation identity");
});
