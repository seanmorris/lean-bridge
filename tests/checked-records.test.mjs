/**
 * Checked records (VO #1220): records with proof fields cross as payload-only mirrors. At a
 * parameter, only the site's checked constructor builds the record, inside the generated Lean
 * adapter; at a result, Lean has produced the proofs and the record is projected to its mirror.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { assertRefinement } from "../src/abi/refinements.mjs";
import { componentRecordDefinitions } from "../src/abi/component-records.mjs";
import { snapshotComponentCopiedGraph } from "../src/abi/component-recursive.mjs";
import { validateNativeType } from "../src/analyze/native-types.mjs";
import { reviewedContractDifference, reviewedSourceSelection, validateReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { createComponentBuildPlan } from "../src/build/component-plan.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { prepareLakeEntryIntent } from "../src/build/lake-entry-intent.mjs";
import { resolveLakeBuildWorkspace } from "../src/build/lake-build-workspace.mjs";
import { elaborateLakeEntryModules } from "../src/build/lake-entry-elaboration.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { generateNativePrimitiveC } from "../src/backends/c/native-primitives.mjs";
import { checkedRecordContracts, checkedRecordFixture, checkedRecordRefusalSource, checkedRecordRefusals, checkedRecordReview, erasedProofsKey, instantiationKey, refinementsKey } from "./helpers/checked-record-fixture.mjs";

const lean = process.env.LEAN_BRIDGE_CHECKED_RECORD_LEAN_TEST === "1";
const module = "CheckedRecords";
const leanPrefix = join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const reviewInput = review => {
	const source = canonicalJson(review);
	return { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(review) };
};
const named = name => ({ kind: "named", id: `lean:${module}.${name}` });
const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } };

test("an independent checked-record review is valid and selects each parameter's constructor", () => {
	const review = checkedRecordReview();
	validateReviewedSource(reviewInput(review));
	const selection = reviewedSourceSelection(reviewInput(review));
	// Only exports with a checked parameter carry a contract; a Lean-produced result selects nothing.
	const expected = Object.fromEntries(Object.entries(checkedRecordContracts()).filter(([name]) => name !== `${module}.repeated`));
	assert.equal(canonicalJson(selection.contracts), canonicalJson(expected));
	assert.equal(selection.contracts[`${module}.firstOf`].parameters[0].refinement.constructor, `${module}.mkTriple`);
	assert.equal(selection.contracts[`${module}.smallest`].parameters[0].refinement.constructor, `${module}.sortedTriple`);
	// The site choice is reconciled: swapping two sites' constructors is a different contract.
	const swapped = checkedRecordReview();
	const site = name => swapped.declarations.find(item => item.id === `lean:${module}.${name}`).source.extensions[refinementsKey].parameters[0];
	[site("firstOf").constructor, site("smallest").constructor] = [site("smallest").constructor, site("firstOf").constructor];
	assert.notEqual(reviewedContractDifference(review, swapped), null);
});

test("malformed checked-record reviews are refused before Lean runs", () => {
	const mutate = edit => {
		const review = checkedRecordReview();
		const find = id => [...review.types, ...review.declarations].find(item => item.id === `lean:${module}.${id}`);
		edit(find);
		return review;
	};
	const cases = [
		["no erased names", find => { find("Interval").source.extensions[erasedProofsKey].fields = []; }]
		, ["a duplicate erased name", find => { find("Percent").source.extensions[erasedProofsKey].fields = ["above", "above"]; }]
		, ["an erased name that is also a payload field", find => { find("Triple").source.extensions[erasedProofsKey].fields = ["data"]; }]
		, ["an extra erased-proofs key", find => { find("Interval").source.extensions[erasedProofsKey].statement = "lo ≤ hi"; }]
		, ["a checked parameter without its constructor", find => { find("width").source.extensions[refinementsKey].parameters = [null]; }]
		, ["a constructor at a Lean-produced result", find => { find("scale").source.extensions[refinementsKey].result = { kind: "checked-record", constructor: `${module}.mkTriple` }; }]
		, ["a constructor on an unchecked parameter", find => { find("scale").source.extensions[refinementsKey].parameters[0] = { kind: "checked-record", constructor: `${module}.mkTriple` }; }]
		, ["a value index that is not decimal", find => { find("Triple").source.extensions[instantiationKey].arguments[0].value = "03"; }]
		, ["a value index of another type", find => { find("Triple").source.extensions[instantiationKey].arguments[0].type = { kind: "primitive", name: "int" }; }]
		, ["an extra value-index key", find => { find("Percent").source.extensions[instantiationKey].arguments[1].bound = "101"; }]];
	for(const [label, edit] of cases) assert.throws(() => validateReviewedSource(reviewInput(mutate(edit))), { code: "reviewed-ir-build-unsupported" }, label);
	// The refinement tree itself admits a checked record only at a top-level named site.
	assert.throws(() => assertRefinement({ kind: "checked-record", constructor: `${module}.mkTriple` }, named("Triple"), 1), TypeError);
	assert.throws(() => assertRefinement({ kind: "checked-record", constructor: `${module}.mkTriple` }, { kind: "primitive", name: "nat" }), TypeError);
	assert.throws(() => assertRefinement({ kind: "checked-record", constructor: `${module}.mkTriple`, bound: "3" }, named("Triple")), TypeError);
});

test("native metadata keeps erased proofs at top-level sites and value indices in provenance", () => {
	const field = name => ({ name, projection: `${module}.Interval.${name}`, type: nat });
	const record = { kind: "record"
		, name: `${module}.Interval`
		, lean: `${module}.Interval`
		, constructor: `${module}.Interval.mk`
		, fields: [field("lo"), field("hi")]
		, erased: ["ordered"]
		, abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } };
	const checked = { kind: "refinement", base: record, predicate: { kind: "checked-record", constructor: `${module}.mkInterval` }, abi: record.abi };
	const indexed = argument => ({ ...record, constructor: `${module}.Sized.mk`, provenance: { structure: `${module}.Sized`, arguments: [argument] } });
	validateNativeType(checked, 0, false, "parameter");
	validateNativeType(record, 0, false, "result");
	validateNativeType(indexed({ kind: "value", type: nat, value: "3" }), 0, false, "result");
	const refused = [
		["a bare checked record at a parameter", () => validateNativeType(record, 0, false, "parameter")]
		, ["a constructor at a result", () => validateNativeType(checked, 0, false, "result")]
		, ["a checked record inside an array", () => validateNativeType({ kind: "array", element: record, abi: record.abi })]
		, ["a constructor over a record without erased proofs", () => validateNativeType({ ...checked, base: { ...record, erased: undefined } }, 0, false, "parameter")]
		, ["an erased name that is a payload field", () => validateNativeType({ ...record, erased: ["lo"] }, 0, false, "result")]
		, ["a value index of another type", () => validateNativeType(indexed({ kind: "value", type: { ...nat, name: "int", lean: "Int" }, value: "3" }), 0, false, "result")]];
	for(const [label, check] of refused) assert.throws(check, TypeError, label);
});

test("private recursive descriptors bind erased proof names and refuse other component ABIs", () => {
	const review = checkedRecordReview();
	const definitions = componentRecordDefinitions(review, true);
	assert.deepEqual(definitions.map(item => [item.id, item.erased]), [[`lean:${module}.Interval`, ["ordered"]], [`lean:${module}.Percent`, ["above", "below"]], [`lean:${module}.Triple`, ["sized"]]]);
	assert.throws(() => componentRecordDefinitions(review), /unsupported record semantics/u);
	const abi = createComponentPrivateAbi(review);
	assert.equal(abi.version, 8);
	assert.deepEqual(abi.types.find(item => item.id === `lean:${module}.Percent`).erased, ["above", "below"]);
	const graph = types => snapshotComponentCopiedGraph({ schemaVersion: 1, root: { kind: "primitive", name: "unit" }, types });
	const interval = definitions.find(item => item.id === `lean:${module}.Interval`);
	for(const erased of [[], ["ordered", "ordered"], ["lo"], [7]]) assert.throws(() => graph([{ ...interval, erased }]), TypeError, JSON.stringify(erased));
});

/**
 * Elaborate a fixture copy, build its native model and compile the generated Lean adapters,
 * stopping before any C or package step.
 *
 * @param t - Test context.
 * @param options - Extra source, exports with contracts, or an independent review.
 * @param options.extra - Declarations appended inside the namespace.
 * @param options.contracts - Export contracts selecting each site's constructor.
 * @param options.review - Independent reviewed Binding IR instead of contracts.
 */
const nativeModel = async (t, { extra = "", contracts = checkedRecordContracts(), review } = {}) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-records-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(checkedRecordFixture, projectRoot, { recursive: true });
	const source = await readFile(join(checkedRecordFixture, "CheckedRecords.lean"), "utf8");
	await writeFile(join(projectRoot, "CheckedRecords.lean"), source.replace("end CheckedRecords", `${extra}\nend CheckedRecords`));
	const targets = { c: { name: "checkedrecords", version: "1.0.0" } };
	await writeFile(join(projectRoot, "lean-bridge.exports.json"), canonicalJson(review ? { schemaVersion: 1, modules: [module], targets }
		: { schemaVersion: 1, modules: [module], exports: Object.keys(contracts), contracts, targets }));
	if(review) await writeFile(join(projectRoot, "api.binding-ir.json"), canonicalJson(review));
	let captured;
	const options = { projectRoot
		, outputRoot: join(directory, "out")
		, leanPrefix
		, targets: ["c"]
		, profile: "native-library-v1"
		, receiptName: "native-component.json"
		, createModel: input => createCompiledNativeModel(input, { nativeRefinements: true })
		, createAdapters: generateCompiledNativeLeanAdapters
		, compileComponent: async ({ model, adapters }) => { captured = { model, adapters }; throw Object.assign(new Error("stop before C"), { code: "stop-before-c" }); } };
	await assert.rejects(() => buildElaboratedComponent(options), error => {
		if(error.code !== "stop-before-c") throw error;
		return true;
	});
	return captured;
};
const exportNamed = (model, name) => model.exports.find(item => item.name === `${module}.${name}`);

test("fresh Lean compiles native C and C++ mirror adapters for checked records", { skip: !lean, timeout: 900_000 }, async t => {
	const { model, adapters } = await nativeModel(t);
	// The public contract restates exactly what the independent review states.
	assert.equal(reviewedContractDifference(checkedRecordReview(), model.bindingIr), null);
	const source = adapters.leanSource;
	// Every carrier and raw entry is mirror-typed; nothing but a site's constructor builds a source record.
	assert.doesNotMatch(source, /_root_\.CheckedRecords\.(Interval|Sized|Bounded|Triple|Percent)\.mk|\(_root_\.CheckedRecords\.(Interval|Triple|Percent)\)|⟨/u);
	for(const [name, constructors] of [["Interval", ["mkInterval"]], ["Triple", ["mkTriple", "sortedTriple"]], ["Percent", ["mkPercent"]]])
	{
		assert.match(source, new RegExp(`structure LbErased\\.CheckedRecords\\.${name} where`, "u"), name);
		assert.match(source, new RegExp(`def LbErased\\.CheckedRecords\\.${name}\\.erase \\(value : _root_\\.CheckedRecords\\.${name}\\)`, "u"), name);
		assert.equal(source.match(new RegExp(`def LbErased\\.CheckedRecords\\.${name}\\.via_[0-9a-f]{16} `, "gu"))?.length, constructors.length, name);
		for(const constructor of constructors) assert.match(source, new RegExp(`  _root_\\.CheckedRecords\\.${constructor} value\\.`, "u"), constructor);
		assert.match(source, new RegExp(`_make\\] *\\ndef f_lb_t[0-9a-f]+_make [^\\n]*: LbErased\\.CheckedRecords\\.${name} :=\\n  LbErased\\.CheckedRecords\\.${name}\\.mk`, "u"), name);
	}
	// A result-only checked record still registers its mirror and erases Lean's value to it.
	const repeated = exportNamed(model, "repeated");
	assert.deepEqual(repeated.refinements, { parameters: [null], result: { kind: "checked-record", definition: `${module}.Triple`, constructor: null, fields: ["data"] } });
	assert.match(source, new RegExp(`def f_${repeated.symbol} \\(a0 : _root_\\.Nat\\) : LbErased\\.CheckedRecords\\.Triple :=\\n  \\(let _bridgeResult := _root_\\.CheckedRecords\\.repeated a0; \\(LbErased\\.CheckedRecords\\.Triple\\.erase`, "u"));
	// The C wrapper pre-checks each checked parameter in order and names the reviewed parameter.
	const c = generateNativePrimitiveC(model, { initializer: "initialize_LeanBridgeNative0123456789abcdef" });
	const ordered = [["span", ["arg0 was rejected by CheckedRecords.mkInterval", "arg1 was rejected by CheckedRecords.mkInterval"]]
		, ["scale", ["arg1 was rejected by CheckedRecords.mkTriple"]]
		, ["smallest", ["arg0 was rejected by CheckedRecords.sortedTriple"]]];
	for(const [name, messages] of ordered)
	{
		const call = c.slice(c.indexOf(`lb_call_${name}(`), c.indexOf("\n}", c.indexOf(`lb_call_${name}(`)));
		const positions = messages.map(message => call.indexOf(JSON.stringify(message)));
		assert.ok(positions.every(position => position > 0) && positions.every((position, i) => i === 0 || position > positions[i - 1]), name);
		assert.ok(positions.at(-1) < call.indexOf(`${exportNamed(model, name).symbol}(`, positions.at(-1)), `${name} checks before it dispatches`);
	}
	assert.ok(!c.includes("checkedrecords_repeated_refinement"));
	// Raw entries keep the private C signatures of ordinary records.
	assert.match(adapters.header, new RegExp(`lean_object \\* ${exportNamed(model, "span").symbol}\\(lean_object \\* a0, lean_object \\* a1\\);`, "u"));
	assert.match(adapters.header, new RegExp(`uint8_t ${exportNamed(model, "span").symbol}_refinement_1\\(lean_object \\* value\\);`, "u"));
});

test("raw Lean entries refuse invalid payloads and keep normalization inside Lean", { skip: !lean, timeout: 900_000 }, async t => {
	const { model, adapters } = await nativeModel(t);
	const call = name => `${adapters.module}.f_${exportNamed(model, name).symbol}`;
	const evaluations = [
		[`[${call("firstOf")} ⟨#[3, 1, 2]⟩, ${call("smallest")} ⟨#[3, 1, 2]⟩, ${call("firstOf")} ⟨#[1, 2]⟩, ${call("smallest")} ⟨#[1, 2]⟩]`, "[some 3, some 1, none, none]"]
		, [`[${call("span")} ⟨1, 5⟩ ⟨2, 9⟩, ${call("span")} ⟨1, 5⟩ ⟨9, 2⟩, ${call("span")} ⟨5, 1⟩ ⟨2, 9⟩]`, "[some 8, none, none]"]
		, [`(${call("span")}_refinement_1 ⟨9, 2⟩, ${call("span")}_refinement_1 ⟨2, 9⟩)`, "(0, 1)"]
		, [`((${call("scale")} 2 ⟨#[1, 2, 3]⟩).map (·.«data»), (${call("scale")} 2 ⟨#[1]⟩).map (·.«data»))`, "(some #[2, 4, 6], none)"]
		// A Lean-produced result passed back as an input re-enters only through its site's constructor.
		, [`(${call("scale")} 2 ⟨#[3, 1, 2]⟩).bind ${call("smallest")}`, "some 2"]
		, [`(${call("repeated")} 4).«data»`, "#[4, 4, 4]"]
		, [`[${call("complement")} ⟨40⟩, ${call("complement")} ⟨101⟩, ${call("total")} ⟨#[1, 2, 3]⟩, ${call("width")} ⟨3, 10⟩]`, "[some 60, none, some 6, some 7]"]];
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-raw-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const fixture = await readFile(join(checkedRecordFixture, "CheckedRecords.lean"), "utf8");
	await writeFile(join(directory, "Raw.lean"), [fixture, adapters.leanSource.replace(/^import CheckedRecords$/mu, ""), ...evaluations.map(([expression]) => `#eval ${expression}`)].join("\n"));
	const run = await processBuildRunner.capture({ command: join(leanPrefix, "bin/lean"), args: ["Raw.lean"], cwd: directory, timeoutMs: 600_000 });
	assert.deepEqual(run.stdout.trim().split("\n"), evaluations.map(([, expected]) => expected));
});

test("the independent review reconciles exactly with fresh Lean", { skip: !lean, timeout: 900_000 }, async t => {
	const review = checkedRecordReview();
	const { model } = await nativeModel(t, { review });
	assert.equal(reviewedContractDifference(review, model.bindingIr), null);
	assert.deepEqual(exportNamed(model, "smallest").refinements.parameters, [{ kind: "checked-record", definition: `${module}.Triple`, constructor: `${module}.sortedTriple`, fields: ["data"] }]);
});

test("reconciliation refuses a dropped erased name, a changed index and a reordered payload, and Lean refuses a foreign constructor", { skip: !lean, timeout: 1_800_000 }, async t => {
	const mutate = edit => {
		const review = checkedRecordReview();
		edit(id => [...review.types, ...review.declarations].find(item => item.id === `lean:${module}.${id}`));
		return review;
	};
	const mismatches = [
		["a dropped erased name", find => { find("Percent").source.extensions[erasedProofsKey].fields = ["above"]; }]
		, ["a changed value index", find => { find("Triple").source.extensions[instantiationKey].arguments[0].value = "4"; }]
		, ["a reordered payload", find => { find("Interval").fields.reverse(); }]];
	for(const [label, edit] of mismatches)
		await assert.rejects(() => nativeModel(t, { review: mutate(edit) }), { code: "reviewed-ir-source-mismatch" }, label);
	const foreign = mutate(find => { find("total").source.extensions[refinementsKey].parameters[0].constructor = `${module}.mkInterval`; });
	await assert.rejects(() => nativeModel(t, { review: foreign }), error => {
		assert.match(JSON.stringify(error.details ?? error.message), /checked record constructor (must take exactly the payload fields|input lo must be named data)/u);
		return true;
	});
});

test("every refused checked-record site reports its own diagnostic", { skip: !lean, timeout: 900_000 }, async t => {
	const refusals = checkedRecordRefusals();
	const contracts = Object.fromEntries(Object.entries(refusals).map(([name, { contract }]) => [name, contract]));
	let details;
	await assert.rejects(() => nativeModel(t, { extra: checkedRecordRefusalSource, contracts }), error => {
		details = error.details;
		return true;
	});
	const projections = new Map((details?.projections ?? []).map(item => [item.declaration, item.expression]));
	for(const [name, { pattern }] of Object.entries(refusals)) assert.match(projections.get(name) ?? JSON.stringify(details), pattern, name);
});

test("npm recursive-ABI adapters carry checked-record mirrors and compile with fresh Lean", { skip: !lean, timeout: 900_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-npm-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(checkedRecordFixture, projectRoot, { recursive: true });
	const contracts = checkedRecordContracts();
	await writeFile(join(projectRoot, "lean-bridge.exports.json"), canonicalJson({ schemaVersion: 1, modules: [module], exports: Object.keys(contracts), contracts }));
	// The component profile elaborates with fresh Lean, then the ordinary npm plan is built from it.
	const intent = await prepareLakeEntryIntent({ projectRoot });
	const workspace = await resolveLakeBuildWorkspace({ snapshot: intent.lakeSnapshot, modules: intent.document.modules.map(entry => entry.module), leanPrefix });
	let analysis;
	try
	{ analysis = await elaborateLakeEntryModules({ inventory: await inspectLeanProject(projectRoot), entries: intent.document.modules, workspace, leanPrefix, engineRoot: process.cwd() }); }
	finally
	{ await workspace.dispose(); }
	assert.equal(reviewedContractDifference(checkedRecordReview(), analysis.bindingIr.document), null);
	// The same plan the Lake entry engine builds from this analysis and its captured snapshot.
	const graph = JSON.parse(await readFile("poc/lean-link-spike/graph-lock.json", "utf8"));
	const componentPlan = createComponentBuildPlan({ analysis, runtime: graph.runtime, targets: ["npm"], lakeSnapshotSha256: intent.lakeSnapshot.sha256 });
	const { plan, files } = generateCompilerAdapters({ analysis, componentPlan });
	assert.equal(plan.privateAbi.version, 8);
	assert.deepEqual(plan.privateAbi.types.map(item => [item.id, item.erased]), [[`lean:${module}.Interval`, ["ordered"]], [`lean:${module}.Percent`, ["above", "below"]], [`lean:${module}.Triple`, ["sized"]]]);
	const source = files["LeanBridgeGenerated.lean"];
	// No carrier holds a source record, and no source record is constructed.
	assert.doesNotMatch(source, /_root_\.CheckedRecords\.(Interval|Sized|Bounded|Triple|Percent)\.mk|_root_\.Array _root_\.CheckedRecords\.(Interval|Triple|Percent)/u);
	assert.match(source, /\(_root_\.Array LbErased\.CheckedRecords\.Triple\)\) : \(_root_\.Array LbErased\.CheckedRecords\.Triple\) :=\n {2}carrierResult \(do/u);
	assert.match(source, /_root_\.CheckedRecords\.repeated a0; \(LbErased\.CheckedRecords\.Triple\.erase/u);
	// Lean compiles the generated module with the fixture it imports.
	const fixture = await readFile(join(checkedRecordFixture, "CheckedRecords.lean"), "utf8");
	await writeFile(join(directory, "Generated.lean"), `${fixture}\n${source.replace(/^import CheckedRecords$/mu, "")}`);
	const run = await processBuildRunner.capture({ command: join(leanPrefix, "bin/lean"), args: ["-c", join(directory, "Generated.c"), "Generated.lean"], cwd: directory, timeoutMs: 600_000 });
	assert.equal(run.stderr, "");
	assert.match(await readFile(join(directory, "Generated.c"), "utf8"), new RegExp(`LEAN_EXPORT lean_object\\* ${plan.exports.find(item => item.sourceDeclaration === `${module}.span`).symbol}_lean\\(lean_object\\*, lean_object\\*\\)`, "u"));
});
