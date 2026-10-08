/**
 * Checked records (VO #1220): records with proof fields cross as payload-only mirrors. At a
 * parameter, only the site's checked constructor builds the record, inside the generated Lean
 * adapter; at a result, Lean has produced the proofs and the record is projected to its mirror.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { assertJsonSchema, jsonSchemaErrors } from "./helpers/json-schema.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { refinementEngineTransport } from "./helpers/refinement-engine.mjs";
import { assertCheckedRecordReport, checkCheckedRecordNpmPackages } from "./helpers/checked-record-packages.mjs";
import { checkedRecordDispatchColumns, checkedRecordDispatchExpected, checkedRecordDispatchInterposer, checkedRecordDispatchProbe } from "./helpers/checked-record-dispatch.mjs";
import { relabelCheckedRecordDiagnostics, checkedRecordContracts, checkedRecordFixture, checkedRecordRefusalSource, checkedRecordRefusals, checkedRecordReview, erasedProofsKey, instantiationKey, refinementsKey } from "./helpers/checked-record-fixture.mjs";

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

test("published metadata schemas admit erased proofs, value indices and checked-record sites exactly", async () => {
	const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const nativeNat = { kind: "primitive", name: "nat", lean: "Nat", abi };
	const data = { name: "data", projection: `${module}.Sized.data`, type: { kind: "array", element: nativeNat, abi } };
	const native = { kind: "record"
		, name: `${module}.Triple`
		, lean: `${module}.Triple`
		, constructor: `${module}.Sized.mk`
		, provenance: { structure: `${module}.Sized`, arguments: [{ kind: "value", type: nativeNat, value: "3" }] }
		, fields: [data]
		, erased: ["sized"]
		, abi };
	const nativeSite = { kind: "refinement", base: native, predicate: { kind: "checked-record", constructor: `${module}.mkTriple` }, abi };
	const nat = { kind: "primitive", name: "nat" };
	const component = { kind: "record"
		, name: `${module}.Triple`
		, provenance: { structure: `${module}.Sized`, arguments: [{ kind: "value", type: nat, value: "3" }] }
		, fields: [{ name: "data", type: { kind: "array", element: nat } }]
		, erased: ["sized"] };
	const componentSite = { kind: "refinement", base: component, predicate: { kind: "checked-record", constructor: `${module}.mkTriple` } };
	const copied = "elaborated-export-metadata#/$defs/copiedType";
	const finSite = { kind: "refinement", base: nativeNat, predicate: { kind: "fin", bound: "10" }, abi };
	const subtypeSite = { kind: "refinement", base: { ...nativeNat, name: "string", lean: "String" }, predicate: { kind: "subtype", constructor: `${module}.checkedWord` }, abi };
	const valid = [["native-metadata-type", native], ["native-metadata-type", nativeSite], ["native-metadata-type", finSite], ["native-metadata-type", subtypeSite], [copied, component], [copied, componentSite]];
	for(const [reference, value] of valid)
		assert.equal(await jsonSchemaErrors(reference, value), null, `${reference} ${value.kind}`);
	const malformed = [
		["native-metadata-type", { ...native, erased: [] }, "no erased names"]
		, ["native-metadata-type", { ...native, erased: ["sized", "sized"] }, "a duplicate erased name"]
		, ["native-metadata-type", { ...native, erased: ["1sized"] }, "an erased name that is not an identifier"]
		, ["native-metadata-type", { ...native, provenance: { ...native.provenance, arguments: [{ kind: "value", type: nativeNat, value: "03" }] } }, "a non-decimal index"]
		, ["native-metadata-type", { ...native, provenance: { ...native.provenance, arguments: [{ kind: "value", type: { ...nativeNat, name: "int", lean: "Int" }, value: "3" }] } }, "an Int index"]
		, ["native-metadata-type", { ...native, provenance: { ...native.provenance, arguments: [{ kind: "value", type: nativeNat, value: "3", bound: "3" }] } }, "an extra index key"]
		, ["native-metadata-type", { ...nativeSite, predicate: { ...nativeSite.predicate, bound: "3" } }, "an extra predicate key"]
		, ["native-metadata-type", { ...nativeSite, predicate: { kind: "checked", constructor: `${module}.mkTriple` } }, "an unknown predicate kind"]
		, [copied, { ...componentSite, base: nat }, "a checked-record predicate over a scalar"]
		, [copied, { ...componentSite, base: { ...component, erased: undefined } }, "a checked-record predicate over a record without erased proofs"]
		, [copied, { ...component, erased: [] }, "no erased names"]
		, [copied, { ...component, provenance: { ...component.provenance, arguments: [{ kind: "value", type: nat, value: "-3" }] } }, "a negative index"]
		, [copied, { ...component, provenance: { ...component.provenance, arguments: [{ kind: "value", type: { kind: "primitive", name: "string" }, value: "3" }] } }, "a String index"]
		// Each predicate keeps its own base: Fin over Nat, Subtype over a primitive, checked-record over a record with erased proofs.
		, ["native-metadata-type", { ...nativeSite, base: nativeNat }, "a checked-record predicate over Nat"]
		, ["native-metadata-type", { ...nativeSite, base: { ...native, erased: undefined } }, "a checked-record predicate over a record without erased proofs"]
		, ["native-metadata-type", { kind: "refinement", base: { ...nativeNat, name: "string", lean: "String" }, predicate: { kind: "fin", bound: "10" }, abi }, "a Fin predicate over String"]
		, ["native-metadata-type", { kind: "refinement", base: native, predicate: { kind: "subtype", constructor: `${module}.mkTriple` }, abi }, "a Subtype predicate over a record"]
		, ["native-metadata-type", { ...native, fields: [] }, "erased proofs without a payload"]
		, [copied, { ...component, fields: [] }, "erased proofs without a payload"]];
	for(const [reference, value, label] of malformed) assert.notEqual(await jsonSchemaErrors(reference, JSON.parse(JSON.stringify(value))), null, `${reference}: ${label}`);
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

test("installed checked-record reports and reviewed consumers refuse contradictory or unreviewed evidence", async () => {
	const install = { profile: "c", sourceRemovedBeforeInstallation: true };
	const valid = [{ route: "ordinary", path: "ordinary-source", reproducible: true, independentBuilds: 2, contracts: {}, reports: [install] }
		, { route: "reviewed", path: "reviewed-source", reproducible: true, independentBuilds: 2, reviewedBindingIrSha256: "0".repeat(64), reports: [install] }
		, { route: "result-only", path: "ordinary-source", reproducible: true, independentBuilds: 2, contracts: {}, sourceRemovedBeforeInstallation: true }];
	for(const report of valid) assertCheckedRecordReport(report);
	const mutants = [
		["not reproducible", { ...valid[0], reproducible: false }]
		, ["one build", { ...valid[0], independentBuilds: 1 }]
		, ["source present at install", { ...valid[0], reports: [{ ...install, sourceRemovedBeforeInstallation: false }] }]
		, ["no installs", { ...valid[0], reports: [] }]
		, ["reviewed route with contracts", { ...valid[1], contracts: {} }]
		, ["ordinary route without contracts", { ...valid[0], contracts: undefined }]
		, ["reviewed path on an ordinary route", { ...valid[0], path: "reviewed-source" }]
		, ["an unknown route", { ...valid[0], route: "graph" }]];
	for(const [label, report] of mutants) assert.throws(() => assertCheckedRecordReport(report), assert.AssertionError, label);
	// The reviewed consumers name each checked parameter by the review, and only reviewed sites relabel.
	for(const [profile, extension] of [["c", "c"], ["cpp", "cpp"]])
	{
		const source = await readFile(`tests/fixtures/checked-record-consumers/${profile}.${extension}`, "utf8");
		const relabeled = relabelCheckedRecordDiagnostics(source, profile);
		assert.equal([...relabeled.matchAll(/"value\d+ was rejected by /gu)].length, [...source.matchAll(/"arg\d+ was rejected by /gu)].length, profile);
		assert.equal(relabeled.replace(/"value(\d+) was rejected by /gu, '"arg$1 was rejected by '), source, profile);
	}
	const line = name => `CHECK(rejected(checkedrecords_${name}, &error, "arg0 was rejected by CheckedRecords.mkInterval"));`;
	for(const [label, text] of [["a wrong constructor", line("total(&t, out")], ["an unknown export", line("missing(&t, out")], ["two calls", `${line("width(&a, out")} checkedrecords_span(&a, &b, out, &error);`]])
		assert.throws(() => relabelCheckedRecordDiagnostics(text, "c"), TypeError, label);
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
		, compileComponent: async ({ model, adapters, metadata }) => { captured = { model, adapters, metadata }; throw Object.assign(new Error("stop before C"), { code: "stop-before-c" }); } };
	await assert.rejects(() => buildElaboratedComponent(options), error => {
		if(error.code !== "stop-before-c") throw error;
		return true;
	});
	return captured;
};
const exportNamed = (model, name) => model.exports.find(item => item.name === `${module}.${name}`);

test("fresh Lean compiles native C and C++ mirror adapters for checked records", { skip: !lean, timeout: 900_000 }, async t => {
	const { model, adapters, metadata } = await nativeModel(t);
	await assertJsonSchema("elaborated-export-metadata", metadata);
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

/**
 * Elaborate a fixture copy in the component profile, build the Lake entry engine's npm plan from
 * it, generate the compiler adapters and compile the generated module with fresh Lean.
 *
 * @param t - Test context.
 * @param contracts - Export contracts; their keys are the selected exports.
 */
const npmAdapters = async (t, contracts) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-npm-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(checkedRecordFixture, projectRoot, { recursive: true });
	await writeFile(join(projectRoot, "lean-bridge.exports.json"), canonicalJson({ schemaVersion: 1, modules: [module], exports: Object.keys(contracts), contracts }));
	const intent = await prepareLakeEntryIntent({ projectRoot });
	const workspace = await resolveLakeBuildWorkspace({ snapshot: intent.lakeSnapshot, modules: intent.document.modules.map(entry => entry.module), leanPrefix });
	let analysis;
	try
	{ analysis = await elaborateLakeEntryModules({ inventory: await inspectLeanProject(projectRoot), entries: intent.document.modules, workspace, leanPrefix, engineRoot: process.cwd() }); }
	finally
	{ await workspace.dispose(); }
	await assertJsonSchema("elaborated-export-metadata", analysis.elaboration.metadata);
	// The same plan the Lake entry engine builds from this analysis and its captured snapshot.
	const graph = JSON.parse(await readFile("poc/lean-link-spike/graph-lock.json", "utf8"));
	const componentPlan = createComponentBuildPlan({ analysis, runtime: graph.runtime, targets: ["npm"], lakeSnapshotSha256: intent.lakeSnapshot.sha256 });
	const { plan, files } = generateCompilerAdapters({ analysis, componentPlan });
	const source = files["LeanBridgeGenerated.lean"];
	// No carrier holds a source record, and no source record is constructed.
	assert.doesNotMatch(source, /_root_\.CheckedRecords\.(Interval|Sized|Bounded|Triple|Percent)\.mk|_root_\.Array _root_\.CheckedRecords\.(Interval|Triple|Percent)/u);
	// Lean compiles the generated module with the fixture it imports.
	const fixture = await readFile(join(checkedRecordFixture, "CheckedRecords.lean"), "utf8");
	await writeFile(join(directory, "Generated.lean"), `${fixture}\n${source.replace(/^import CheckedRecords$/mu, "")}`);
	const run = await processBuildRunner.capture({ command: join(leanPrefix, "bin/lean"), args: ["-c", join(directory, "Generated.c"), "Generated.lean"], cwd: directory, timeoutMs: 600_000 });
	assert.equal(run.stderr, "");
	return { analysis, plan, source, generatedC: await readFile(join(directory, "Generated.c"), "utf8") };
};

test("npm recursive-ABI adapters carry checked-record mirrors and compile with fresh Lean", { skip: !lean, timeout: 900_000 }, async t => {
	const { analysis, plan, source, generatedC } = await npmAdapters(t, checkedRecordContracts());
	assert.equal(reviewedContractDifference(checkedRecordReview(), analysis.bindingIr.document), null);
	assert.equal(plan.privateAbi.version, 8);
	assert.deepEqual(plan.privateAbi.types.map(item => [item.id, item.erased]), [[`lean:${module}.Interval`, ["ordered"]], [`lean:${module}.Percent`, ["above", "below"]], [`lean:${module}.Triple`, ["sized"]]]);
	assert.match(source, /\(_root_\.Array LbErased\.CheckedRecords\.Triple\)\) : \(_root_\.Array LbErased\.CheckedRecords\.Triple\) :=\n {2}carrierResult \(do/u);
	assert.match(source, /_root_\.CheckedRecords\.repeated a0; \(LbErased\.CheckedRecords\.Triple\.erase/u);
	assert.match(generatedC, new RegExp(`LEAN_EXPORT lean_object\\* ${plan.exports.find(item => item.sourceDeclaration === `${module}.span`).symbol}_lean\\(lean_object\\*, lean_object\\*\\)`, "u"));
});

test("a package whose only checked record is a Lean-produced result still registers and erases its mirror", { skip: !lean, timeout: 1_800_000 }, async t => {
	// Nat -> Triple alone: no checked parameter, no constructor and no refinement extension anywhere.
	const contracts = { [`${module}.repeated`]: checkedRecordContracts()[`${module}.repeated`] };
	const { model, adapters, metadata } = await nativeModel(t, { contracts });
	await assertJsonSchema("elaborated-export-metadata", metadata);
	assert.deepEqual(model.exports.map(item => [item.name, item.refinements]), [[`${module}.repeated`
		, { parameters: [null], result: { kind: "checked-record", definition: `${module}.Triple`, constructor: null, fields: ["data"] } }]]);
	assert.equal(model.bindingIr.declarations[0].source.extensions[refinementsKey], undefined);
	assert.deepEqual(model.bindingIr.types.map(type => [type.id, type.source.extensions[erasedProofsKey]]), [[`lean:${module}.Triple`, { fields: ["sized"] }]]);
	const native = adapters.leanSource;
	assert.match(native, /structure LbErased\.CheckedRecords\.Triple where\n {2}«data» : \(_root_\.Array _root_\.Nat\)/u);
	assert.match(native, new RegExp(`def f_${model.exports[0].symbol} \\(a0 : _root_\\.Nat\\) : LbErased\\.CheckedRecords\\.Triple :=\\n {2}\\(let _bridgeResult := _root_\\.CheckedRecords\\.repeated a0; \\(LbErased\\.CheckedRecords\\.Triple\\.erase`, "u"));
	assert.doesNotMatch(native, /via_[0-9a-f]{16}|_refinement_|_root_\.CheckedRecords\.Sized\.mk|⟨/u);
	const { plan, source } = await npmAdapters(t, contracts);
	assert.equal(plan.privateAbi.version, 8);
	assert.deepEqual(plan.privateAbi.types.map(item => [item.id, item.erased]), [[`lean:${module}.Triple`, ["sized"]]]);
	assert.equal(plan.exports[0].refinements ?? null, null);
	assert.match(source, /structure LbErased\.CheckedRecords\.Triple where/u);
	assert.match(source, /: \(_root_\.Array LbErased\.CheckedRecords\.Triple\) :=\n {2}carrierResult \(do\n {4}let a0 ← carrierValue a0\n {4}pure \(\(let _bridgeResult := _root_\.CheckedRecords\.repeated a0; \(LbErased\.CheckedRecords\.Triple\.erase/u);
	assert.doesNotMatch(source, /via_[0-9a-f]{16}|_refinement_/u);
});

const profiles = process.env.LEAN_BRIDGE_CHECKED_RECORD_PROFILES?.split(",").sort() ?? [];
assert.ok(profiles.every(profile => ["c", "cpp"].includes(profile)), "Checked-record acceptance covers C and C++ first");
assert.equal(new Set(profiles).size, profiles.length, "Duplicate checked-record profile");
const coordinate = { name: "checkedrecords", version: "1.0.0" };
const targets = { c: ["c", coordinate], cpp: ["cpp", coordinate] };
const resultOnly = { [`${module}.repeated`]: checkedRecordContracts()[`${module}.repeated`] };

/**
 * A tampered copy of a verified receipt must fail verification: one artifact digest changes.
 *
 * @param handoff - Directory holding the verified receipt and its artifacts.
 * @param receiptName - Receipt filename.
 * @param verify - Receipt verifier.
 */
const assertTamperedReceipt = async (handoff, receiptName, verify) => {
	const tampered = `${handoff}-tampered`;
	await cp(handoff, tampered, { recursive: true });
	const receipt = JSON.parse(await readFile(join(tampered, receiptName), "utf8"));
	const artifact = receipt.packages?.[0]?.artifacts?.[0] ?? receipt.package;
	artifact.sha256 = artifact.sha256.replace(/^./u, value => value === "0" ? "1" : "0");
	await writeFile(join(tampered, receiptName), canonicalJson(receipt));
	await assert.rejects(() => verify({ receiptPath: join(tampered, receiptName) }));
	await rm(tampered, { recursive: true, force: true });
};

/**
 * Count real dispatch in the installed C package with a test-only interposer: public refusals reach
 * neither the adapter nor the source, and direct adapter calls still refuse inside Lean.
 *
 * @param consumer - Consumer root containing the installed C package.
 * @param packages - Installed C packages.
 * @param make - Exported symbol of the Interval payload-mirror constructor.
 */
const observeDispatch = async (consumer, packages, make) => {
	const root = join(consumer, "c"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}-c`), lib = join(installed, "lib");
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(lib, "pkgconfig"), PKG_CONFIG_PATH: "" };
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	await saveLakeFile(root, "interposer.c", checkedRecordDispatchInterposer());
	await saveLakeFile(root, "probe.c", checkedRecordDispatchProbe(make));
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], root, compile);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/u);
	await runCopied("/usr/bin/cc", [...strict, "-isystem", join(leanPrefix, "include"), "probe.c", ...flags, "-lleanshared", "-o", "probe"], root, compile);
	const run = await runCopied(join(root, "probe"), [], root, { ...copiedCleanEnvironment, LD_PRELOAD: join(root, "libdispatch.so") });
	assert.equal(run.stderr, "");
	const observed = run.stdout.trim().split("\n").map(line => {
		const [step, status, ...counts] = line.split(" ");
		return [step, Number(status), counts.map(Number)];
	});
	assert.deepEqual(observed, checkedRecordDispatchExpected);
	const positiveControl = "valid public and raw calls increment constructor, pre-validator, adapter and source counts";
	const unmeasured = ["C++ dispatch (it calls the same C entries)", "resident memory"];
	return { columns: checkedRecordDispatchColumns, observed, interposer: "LD_PRELOAD", positiveControl, unmeasured };
};

/**
 * Build a route from two independent author roots, delete each root after its handoff copy, install
 * the first handoff's C and C++ packages offline and run the consumers.
 *
 * @param t - Test context.
 * @param options - Route selection.
 * @param options.route - "ordinary", "reviewed" or "result-only".
 * @param options.contracts - Export contracts for configured routes.
 * @param options.review - Independent review for the reviewed route.
 * @param options.source - Consumer source by profile and extension.
 * @param options.dispatch - Also count C dispatch through the interposer.
 */
const checkNativeRoute = async (t, { route, contracts, review, source, dispatch = false }) => {
	const reports = [], archives = [], identities = [];
	const selected = Object.fromEntries(profiles.map(profile => targets[profile]));
	const environment = nativeFixtureEnvironment(profiles);
	let dispatched = null;
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), `lean-bridge-checked-record-${route}-author-`));
		const consumer = await mkdtemp(join(tmpdir(), `lean-bridge-checked-record-${route}-consumer-`));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp(checkedRecordFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(review ? { schemaVersion: 1, modules: [module], targets: selected }
			: { schemaVersion: 1, modules: [module], exports: Object.keys(contracts), contracts, targets: selected }));
		if(review) await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
		t.diagnostic(`${route} build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(selected), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		// The expected contract is the independent review, never the generated model.
		if(route !== "result-only") assert.equal(reviewedContractDifference(checkedRecordReview(), model.bindingIr), null);
		identities.push({ bindingIrSha256: built.bindingIrSha256, modelBindingIrSha256: hashBindingIr(model.bindingIr), modelSha256: sha256(canonicalJson(model)) });
		const make = `lb_t${model.types.find(type => type.kind === "record" && type.lean === `${module}.Interval`)?.key}_make`;
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await assertTamperedReceipt(handoff, "package-set-receipt.json", verifyPackageSetReceipt);
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		await assert.rejects(lstat(directory), { code: "ENOENT" });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			t.diagnostic(`${route}: installing and checking ${profile}`);
			const packages = receipt.packages.filter(pkg => pkg.target === targets[profile][0]);
			const observation = await installCopiedConsumer({ profile, consumer, handoff, packages, environment, fixture: { source, wit: [], success: "checked-record-ok" } });
			delete observation.command;
			if(dispatch && profile === "c") dispatched = await observeDispatch(consumer, packages, make);
			const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
			reports.push({ profile, path: route === "reviewed" ? "reviewed-source" : "ordinary-source", ...observation, packages, ...identities[0], receiptSha256, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	// Two independent author roots give byte-identical archives and the same model.
	assert.deepEqual(archives[1], archives[0]);
	assert.deepEqual(identities[1], identities[0]);
	return { route, reports, archives: archives[0], reproducible: true, independentBuilds: 2, ...(dispatched ? { dispatch: dispatched } : {}) };
};
const nativeReport = async (variable, name, report) => {
	const reportPath = resolve(process.env[variable] ?? `build/checked-records/${name}-${profiles.join("-")}.json`);
	assertCheckedRecordReport(report);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, ...report }));
};
const nativeSource = prefix => (name, extension) => readFile(`tests/fixtures/checked-record-consumers/${prefix}${name}.${extension}`, "utf8");

test("relocated source-free C and C++ packages build checked records only through each site's constructor", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const report = await checkNativeRoute(t, { route: "ordinary", contracts: checkedRecordContracts(), source: nativeSource(""), dispatch: profiles.includes("c") });
	await nativeReport("LEAN_BRIDGE_CHECKED_RECORD_REPORT", "ordinary", { ...report, contracts: checkedRecordContracts() });
});

test("independently reviewed C and C++ packages name each checked parameter by its reviewed name", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const review = checkedRecordReview();
	const source = async (name, extension) => relabelCheckedRecordDiagnostics(await nativeSource("")(name, extension), name, review);
	const report = await checkNativeRoute(t, { route: "reviewed", review, source });
	await nativeReport("LEAN_BRIDGE_CHECKED_RECORD_REVIEWED_REPORT", "reviewed", { ...report, reviewedBindingIrSha256: hashBindingIr(review) });
});

test("a relocated C and C++ package whose only checked record is a Lean-produced result returns its payload", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const report = await checkNativeRoute(t, { route: "result-only", contracts: resultOnly, source: nativeSource("result-only-") });
	await nativeReport("LEAN_BRIDGE_CHECKED_RECORD_RESULT_ONLY_REPORT", "result-only", { ...report, contracts: resultOnly });
});

const npm = process.env.LEAN_BRIDGE_CHECKED_RECORD_NPM_TEST === "1";
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const npmBuild = () => {
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	// Only the Nix command transport is substituted: the locked engine when configured, else the pinned local engine.
	return (projectRoot, outputRoot) => buildCanonicalProject({ projectRoot, outputRoot, engineRoot: process.cwd(), environment, targets: ["npm"], runner: refinementEngineTransport() });
};
const npmReport = async (variable, name, report) => {
	const reportPath = resolve(process.env[variable] ?? `build/checked-records/${name}.json`);
	assertCheckedRecordReport(report);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, profile: "npm", ...report }));
};

test("a relocated source-free npm package builds checked records only through each site's constructor", { skip: !npm, timeout: 3_600_000 }, async t => {
	const contracts = checkedRecordContracts("OnboardingSmall");
	const observation = await checkCheckedRecordNpmPackages(t, { build: npmBuild(), runtimeRoot, engineRoot: process.cwd(), contracts });
	await npmReport("LEAN_BRIDGE_CHECKED_RECORD_NPM_REPORT", "npm", { route: "ordinary", path: "ordinary-source", contracts, ...observation });
});

test("an independently reviewed npm package builds checked records only through each site's constructor", { skip: !npm, timeout: 3_600_000 }, async t => {
	const review = checkedRecordReview({ module: "OnboardingSmall", component: "onboarding-small" });
	const observation = await checkCheckedRecordNpmPackages(t, { build: npmBuild(), runtimeRoot, engineRoot: process.cwd(), review });
	await npmReport("LEAN_BRIDGE_CHECKED_RECORD_REVIEWED_NPM_REPORT", "reviewed-npm", { route: "reviewed", path: "reviewed-source", reviewedBindingIrSha256: hashBindingIr(review), ...observation });
});

test("a relocated npm package whose only checked record is a Lean-produced result returns its payload", { skip: !npm, timeout: 3_600_000 }, async t => {
	const contracts = { "OnboardingSmall.repeated": checkedRecordContracts("OnboardingSmall")["OnboardingSmall.repeated"] };
	const observation = await checkCheckedRecordNpmPackages(t, { build: npmBuild(), runtimeRoot, engineRoot: process.cwd(), contracts, resultOnly: true });
	await npmReport("LEAN_BRIDGE_CHECKED_RECORD_RESULT_ONLY_NPM_REPORT", "result-only-npm", { route: "result-only", path: "ordinary-source", contracts, ...observation });
});
