/**
 * Checked Fin inside record and variant fields of native packages (VO #1442).
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import "./helpers/native-fin-records-source-history-tests.mjs";
import { generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateCopiedNativeCalls } from "../src/backends/c/native-copied-values.mjs";
import { generatePerlBindingPackage } from "../src/backends/perl/generate.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { nativeFinBoundPaths } from "../src/backends/native/fin-refinements.mjs";
import { finRecordCompilerModel, finRecordNat, finRecordShape } from "./helpers/fin-record-model.mjs";
import { finRecordRefinements, finRecordTargets, finRecordWitPatterns, installFinRecordConsumer } from "./helpers/fin-record-install.mjs";
import { finRecordDispatchColumns, finRecordDispatchExpected, finRecordDispatchInterposer, finRecordDispatchProbe } from "./helpers/fin-record-dispatch.mjs";
import { assertReviewedFinChangesRefused, checkInstalledFinFixture, finFixtureProfiles } from "./helpers/fin-fixture-installed.mjs";
import { finRecordReviewedIr } from "./helpers/reviewed-fin-record-fixture.mjs";
import { reviewedContractDifference, validateReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";

const fin = bound => ({ kind: "fin", bound });
const tile = { kind: "record", definition: "FinRecords.Tile", fields: ["digit", "count"], arguments: [fin("5"), null] };
const shapeCases = [
	{ name: "circle", fields: ["radius"], arguments: [fin("10")] }
	, { name: "label", fields: ["text"], arguments: [null] }
	, { name: "empty", fields: [], arguments: [] }];
const shape = { kind: "variant", definition: "FinRecords.Shape", cases: shapeCases };
/** Checked refinement trees the native model must carry for every export. */
const expected = {
	tileExcept: { parameters: [{ kind: "result", arguments: [tile, shape] }], result: null }
	, tileList: { parameters: [{ kind: "list", arguments: [tile] }], result: null }
	, tilePair: { parameters: [{ kind: "tuple", arguments: [tile, shape] }], result: null }
	, tileSum: { parameters: [tile], result: null }
	, tiles: { parameters: [{ kind: "array", arguments: [tile] }], result: null }
	, bump: { parameters: [tile], result: tile }
	, gateOpen: { parameters: [{ kind: "variant", definition: "FinRecords.Gate", cases: [{ name: "closed", fields: [], arguments: [] }, { name: "never", fields: ["value"], arguments: [fin("0")] }] }], result: null }
	, lateSum: { parameters: [{ kind: "record", definition: "FinRecords.Late", fields: ["label", "items", "digit"], arguments: [null, null, fin("5")] }], result: null }
	, makeShape: { parameters: [null], result: shape }
	, maybeShape: { parameters: [{ kind: "option", arguments: [shape] }], result: null }
	, nestSum: { parameters: [{ kind: "record", definition: "FinRecords.Nest", fields: ["inner", "tag"], arguments: [tile, fin("3")] }], result: null }
	, shapeSize: { parameters: [shape], result: null }
	, slotCount: { parameters: [{ kind: "record", definition: "FinRecords.Slot", fields: ["maybe", "count"], arguments: [{ kind: "option", arguments: [fin("0")] }, null] }], result: null } };

test("record and variant fields carry their bounds in site trees and per-definition Binding IR", () => {
	const model = finRecordCompilerModel();
	assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name.split(".").at(-1), item.refinements])), expected);
	assert.deepEqual(Object.fromEntries(Object.entries(finRecordRefinements).map(([name, value]) => [name.split(".").at(-1), value])), expected);
	for(const pattern of finRecordWitPatterns) assert.match(compileCopiedWitModel(model.bindingIr).wit, pattern);
	// The Binding IR keeps npm's shape: bounds live on each definition; declaration trees stop at nominal types.
	const nominal = Object.fromEntries(model.bindingIr.types.map(type => [type.id, type.source.extensions["lean-lang.org/nominal-refinements"] ?? null]));
	assert.deepEqual(nominal, {
		"lean:FinRecords.Tile": { kind: "record", fields: [fin("5"), null] }
		, "lean:FinRecords.Gate": { kind: "variant", cases: [[], [fin("0")]] }
		, "lean:FinRecords.Late": { kind: "record", fields: [null, null, fin("5")] }
		, "lean:FinRecords.Nest": { kind: "record", fields: [null, fin("3")] }
		, "lean:FinRecords.Shape": { kind: "variant", cases: [[fin("10")], [null], []] }
		, "lean:FinRecords.Slot": { kind: "record", fields: [{ kind: "option", arguments: [fin("0")] }, null] } });
	for(const declaration of model.bindingIr.declarations) assert.equal(declaration.source.extensions["lean-lang.org/refinements"], undefined, declaration.id);
	// Paths name each field and, for a variant, the case whose field is checked.
	assert.deepEqual(expected.nestSum.parameters.flatMap(tree => nativeFinBoundPaths(tree, "arg0")), ["arg0.inner.digit < 5", "arg0.tag < 3"]);
	assert.deepEqual(nativeFinBoundPaths(expected.maybeShape.parameters[0], "arg0"), ["arg0?.circle.radius < 10"]);
	assert.deepEqual(nativeFinBoundPaths(expected.gateOpen.parameters[0], "arg0"), ["arg0.never.value < 0"]);
});

test("C adapters check record fields and only the active variant case on caller limbs before Lean runs", () => {
	const model = finRecordCompilerModel();
	const calls = generateCopiedNativeCalls(model, compilePrimitiveCSurface(model.bindingIr, { wordBits: model.pointerBits, callables: true, structuredCallables: true, compounds: true, lists: true, variants: true }));
	const call = name => { const start = calls.indexOf(`static finrecords_status lb_call_${name}(`); return calls.slice(start, calls.indexOf("\n}\n", start)); };
	const ordered = (text, ...parts) => {
		let cursor = -1;
		for(const part of parts)
		{
			const next = text.indexOf(part, cursor + 1);
			assert.ok(next > cursor, `${part}\n${text}`);
			cursor = next;
		}
	};
	// A nested record is walked through its own fields; every comparison precedes the only conversion into Lean.
	ordered(call("nest_sum"), "_check(arg0, &budget)"
		, "if (!lb_fin_below((&(&arg0->inner)->digit)->data, (&(&arg0->inner)->digit)->length, lb_fin_nest_sum_0_0, 1)) return lb_invalid(error, \"arg0 is not below its Fin 5 bound\");"
		, "if (!lb_fin_below((&arg0->tag)->data, (&arg0->tag)->length, lb_fin_nest_sum_0_1, 1)) return lb_invalid(error, \"arg0 is not below its Fin 3 bound\");"
		, "lean_object *checked = ", "_in(arg0)");
	// The bound after heap fields is compared before any of them is converted.
	ordered(call("late_sum"), "_check(arg0, &budget)", "lb_fin_below((&arg0->digit)->data", "lean_object *checked = ", "_in(arg0)");
	// Only the active case is compared; Fin 0 compares against no limbs, so a present value always fails.
	ordered(call("shape_size"), "if (arg0->kind == 0u) {", "(&arg0->cases.circle.radius)->data", "lean_object *checked = ");
	assert.doesNotMatch(call("shape_size"), /kind == [12]u/u);
	ordered(call("gate_open"), "if (arg0->kind == 1u) {", "if (!lb_fin_below((&arg0->cases.never.value)->data, (&arg0->cases.never.value)->length, NULL, 0)) return lb_invalid(error, \"arg0 is not below its Fin 0 bound\");");
	ordered(call("slot_count"), "if ((&arg0->maybe)->has_value) {", "(&(&arg0->maybe)->value)->data, (&(&arg0->maybe)->value)->length, NULL, 0)");
	ordered(call("maybe_shape"), "if (arg0->has_value) {", "if ((&arg0->value)->kind == 0u) {", "(&(&arg0->value)->cases.circle.radius)->data");
	ordered(call("tiles"), "for (size_t k2 = 0; k2 < arg0->length; ++k2) {", "(&(&arg0->data[k2])->digit)->data");
	// Lists, products and Except values of refined records and variants compose with the same walk.
	ordered(call("tile_list"), "for (size_t k2 = 0; k2 < arg0->length; ++k2) {", "(&(&arg0->data[k2])->digit)->data", "lean_object *checked = ");
	ordered(call("tile_pair"), "(&(&arg0->fst)->digit)->data", "if ((&arg0->snd)->kind == 0u) {", "(&(&arg0->snd)->cases.circle.radius)->data", "lean_object *checked = ");
	ordered(call("tile_except"), "if (arg0->is_ok) {", "(&(&arg0->ok)->digit)->data", "if (!arg0->is_ok) {", "if ((&arg0->error)->kind == 0u) {", "(&(&arg0->error)->cases.circle.radius)->data", "lean_object *checked = ");
});

test("Lean adapters pass refined records and variants as erased mirrors checked once before one source call", () => {
	const model = finRecordCompilerModel(), lean = generateNativeLeanAdapters(model).leanSource;
	const mirrors = [...lean.matchAll(/^(?:structure|inductive) (LbErased\.FinRecords\.\w+) where$/gmu)].map(match => match[1]).sort();
	assert.deepEqual(mirrors, ["Gate", "Late", "Nest", "Shape", "Slot", "Tile"].map(name => `LbErased.FinRecords.${name}`));
	// Every Fin is constructed inside its decidable check; nested mirrors check through their own definitions.
	assert.ok(lean.includes("def LbErased.FinRecords.Nest.check (value : LbErased.FinRecords.Nest) : _root_.Option _root_.FinRecords.Nest := do\n  let a0 ← (LbErased.FinRecords.Tile.check (value.«inner»))\n  let a1 ← (if proof : (value.«tag») < 3 then _root_.Option.some (⟨(value.«tag»), proof⟩ : _root_.Fin 3) else _root_.Option.none)\n  pure (_root_.FinRecords.Nest.mk a0 a1)"));
	assert.ok(lean.includes("  | .«never» a0 => do let b0 ← (if proof : (a0) < 0 then _root_.Option.some (⟨(a0), proof⟩ : _root_.Fin 0) else _root_.Option.none); pure (_root_.FinRecords.Gate.never b0)"));
	// Results are erased through the same definitions after one source call.
	const symbol = name => model.exports.find(item => item.name === `Sample.${name}`).symbol;
	const section = name => lean.slice(lean.indexOf(`@[export ${symbol(name)}]`), lean.indexOf("\n\n", lean.indexOf(`@[export ${symbol(name)}]`)));
	assert.match(section("bump"), /def f_\w+ \(a0 : LbErased\.FinRecords\.Tile\) : \(_root_\.Option LbErased\.FinRecords\.Tile\) :=\n {2}match \(LbErased\.FinRecords\.Tile\.check \(a0\)\) with/u);
	assert.ok(section("bump").includes("(let _bridgeResult := _root_.Sample.bump _bridgeSubtype0; (LbErased.FinRecords.Tile.erase (_bridgeResult)))"));
	for(const name of Object.keys(expected)) assert.ok((section(name).match(new RegExp(`_root_\\.Sample\\.${name} `, "gu")) ?? []).length === 1, name);
	// No Fin is built outside a decidable branch, and no default stands in for a rejected value.
	assert.doesNotMatch(lean, /panic|Fin\.ofNat|default/u);
});

test("records and variants without bounds keep their helpers byte for byte", () => {
	// An unrefined record crosses as itself: no mirror, the source constructor and its projections.
	const plain = finRecordShape("Plain", [["digit", finRecordNat], ["count", finRecordNat]]);
	const model = finRecordCompilerModel({}, { plainSum: [plain, finRecordNat] }), source = generateNativeLeanAdapters(model).leanSource;
	const key = model.types.find(type => type.kind === "record").key;
	assert.doesNotMatch(source, /LbErased/u);
	assert.ok(source.includes(`@[export lb_t${key}_make]\ndef f_lb_t${key}_make (a0 : _root_.Nat) (a1 : _root_.Nat) : _root_.FinRecords.Plain :=\n  _root_.FinRecords.Plain.mk a0 a1\n`));
	assert.ok(source.includes(`@[export lb_t${key}_get0]\ndef f_lb_t${key}_get0 (value : _root_.FinRecords.Plain) : _root_.Nat :=\n  _root_.FinRecords.Plain.digit value\n`));
	assert.equal(model.exports[0].refinements, undefined);
});

test("Perl XS walks record fields and the active case, naming each path", () => {
	const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };
	const files = generatePerlBindingPackage(finRecordCompilerModel({ moduleName: "LeanBridge::FinRecords" }), receipt), xs = files["Component.xs"];
	const body = name => xs.slice(xs.indexOf(`\n${name}(...)`), xs.indexOf("lean_object *checked = ", xs.indexOf(`\n${name}(...)`)));
	assert.match(body("nest_sum"), /croak\("%s\.inner\.digit is not below its Fin 5 bound", "arg0"\)[^]*croak\("%s\.tag is not below its Fin 3 bound", "arg0"\)/u);
	assert.match(body("shape_size"), /uint32_t t0 = lb_t\w+_tag\(a0\);\s+if \(t0 == 0u\) \{[^]*croak\("%s\.circle\.radius is not below its Fin 10 bound", "arg0"\)/u);
	assert.doesNotMatch(body("shape_size"), /t0 == [12]u/u);
	assert.match(body("gate_open"), /if \(t0 == 1u\) \{[^]*croak\("%s\.never\.value is not below its Fin 0 bound", "arg0"\)/u);
	assert.match(body("slot_count"), /croak\("%s\.maybe\? is not below its Fin 0 bound", "arg0"\)/u);
	assert.match(body("tiles"), /croak\("%s\[%zu\]\.digit is not below its Fin 5 bound", "arg0", \(size_t\)k0\)/u);
	assert.match(body("tile_list"), /croak\("%s\[%zu\]\.digit is not below its Fin 5 bound", "arg0", \(size_t\)k0\)/u);
	assert.match(body("tile_pair"), /croak\("%s\.0\.digit is not below its Fin 5 bound", "arg0"\)[^]*croak\("%s\.1\.circle\.radius is not below its Fin 10 bound", "arg0"\)/u);
	assert.match(body("tile_except"), /croak\("%s\.ok\.digit is not below its Fin 5 bound", "arg0"\)[^]*croak\("%s\.error\.circle\.radius is not below its Fin 10 bound", "arg0"\)/u);
	assert.match(files["lib/LeanBridge/FinRecords.pm"], /Checked Lean Fin bounds: arg0\.inner\.digit < 5; arg0\.tag < 3\./u);
});

test("hosts reading only the Binding IR document record and variant bounds from their definitions", () => {
	const readme = generateCopiedRubyPackage(finRecordCompilerModel().bindingIr)["README.md"];
	assert.match(readme, /Fin inside arrays, lists, options, products, Except values, records and variants is checked before Lean runs/u);
	assert.match(readme, /a record field as name\.field and a field of the active variant case as name\.Case\.field\. Fin inside callbacks or generic record instantiations is not supported in Ruby gems\./u);
	for(const line of ["nest_sum: arg0.inner.digit < 5; arg0.tag < 3", "maybe_shape: arg0?.circle.radius < 10", "bump: arg0.digit < 5; result.digit < 5", "make_shape: result.circle.radius < 10", "slot_count: arg0.maybe? < 0", "gate_open: arg0.never.value < 0", "tiles: arg0[*].digit < 5", "late_sum: arg0.digit < 5", "tile_list: arg0[*].digit < 5", "tile_pair: arg0.0.digit < 5; arg0.1.circle.radius < 10", "tile_except: arg0.ok.digit < 5; arg0.error.circle.radius < 10"])
		assert.ok(readme.includes(`.${line}\n`), line);
});

const profiles = finFixtureProfiles("LEAN_BRIDGE_FIN_RECORD_PROFILES", finRecordTargets);
const reviewedProfiles = finFixtureProfiles("LEAN_BRIDGE_REVIEWED_FIN_RECORD_PROFILES", finRecordTargets);
// The compiler-shaped model names its exports Sample.*; the reviewed fixture uses the Lean module's names.
const compiledForReview = () => JSON.parse(JSON.stringify(finRecordCompilerModel().bindingIr)
	.replaceAll("lean:Sample.", "lean:FinRecords.").replaceAll('"declaration":"Sample.', '"declaration":"FinRecords.').replaceAll('"overloadKey":"Sample.', '"overloadKey":"FinRecords.'));
const nominalKey = "lean-lang.org/nominal-refinements";

test("the independent record review passes reviewed admission and equals the compiled contract", () => {
	const review = finRecordReviewedIr(), source = canonicalJson(review);
	validateBindingIr(review);
	validateReviewedSource({ schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(review) });
	assert.equal(reviewedContractDifference(review, compiledForReview()), null);
	for(const declaration of review.declarations) assert.equal(declaration.source.extensions["lean-lang.org/refinements"], undefined, declaration.id);
});

test("reviewed record and variant field bounds must equal the freshly compiled definitions", () => {
	const compiled = compiledForReview();
	const definition = (ir, name) => ir.types.find(type => type.id === `lean:FinRecords.${name}`).source.extensions[nominalKey];
	const mutations = [
		["tightened field", ir => { definition(ir, "Tile").fields[0].bound = "4"; }]
		, ["bound moved to the other field", ir => { definition(ir, "Tile").fields.reverse(); }]
		, ["loosened nested record's own bound", ir => { definition(ir, "Nest").fields[1].bound = "4"; }]
		, ["tightened case field", ir => { definition(ir, "Shape").cases[0][0].bound = "9"; }]
		, ["loosened Fin 0 case", ir => { definition(ir, "Gate").cases[1][0].bound = "1"; }]
		, ["loosened option field", ir => { definition(ir, "Slot").fields[0].arguments[0].bound = "1"; }]];
	for(const [label, mutate] of mutations)
	{
		const reviewed = finRecordReviewedIr();
		mutate(reviewed);
		assert.match(reviewedContractDifference(reviewed, compiled) ?? "", /^bindingIr\.types\[\d+\]\.source\.extensions\.lean-lang\.org\/nominal-refinements/u, label);
	}
	// A definition the review leaves unbounded is a difference too, not an erased bound.
	const unbounded = finRecordReviewedIr();
	delete unbounded.types.find(type => type.id === "lean:FinRecords.Tile").source.extensions[nominalKey];
	assert.match(reviewedContractDifference(unbounded, compiled) ?? "", /^bindingIr\.types\[\d+\]\.source\.extensions/u);
});
const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", ruby: "rb", "php-native": "php", "wit-wasi": "c", perl: "pl" };

test("every native profile has a Fin record consumer and a target", async () => {
	assert.deepEqual(Object.keys(finRecordTargets).sort(), Object.keys(extensions).sort());
	for(const [profile, extension] of Object.entries(extensions)) await access(`tests/fixtures/fin-record-consumers/${profile}.${extension}`);
});

/**
 * Count real dispatch in the installed C package with a test-only interposer: public
 * rejections reach neither Lean symbol, raw adapter rejections reach only the adapter,
 * and valid raw calls reach the adapter and the source.
 *
 * @param consumer - Consumer root containing the installed C package.
 * @param packages - Installed C packages.
 * @param leanPrefix - Pinned Lean installation providing lean.h for raw adapter values.
 */
const observeDispatch = async (consumer, packages, leanPrefix) => {
	const root = join(consumer, "c"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}-c`), lib = join(installed, "lib");
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(lib, "pkgconfig"), PKG_CONFIG_PATH: "" };
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	await saveLakeFile(root, "interposer.c", finRecordDispatchInterposer());
	await saveLakeFile(root, "probe.c", finRecordDispatchProbe());
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], root, compile);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/u);
	await runCopied("/usr/bin/cc", [...strict, "-isystem", join(leanPrefix, "include"), "probe.c", ...flags, "-lleanshared", "-o", "probe"], root, compile);
	// Without the interposer the probe refuses to report, so a missing counter cannot pass.
	await assert.rejects(() => runCopied(join(root, "probe"), [], root, copiedCleanEnvironment), /interposer is not loaded/u);
	const run = await runCopied(join(root, "probe"), [], root, { ...copiedCleanEnvironment, LD_PRELOAD: join(root, "libdispatch.so") });
	assert.equal(run.stderr, "");
	const observed = run.stdout.trim().split("\n").map(line => {
		const [step, status, ...counts] = line.split(" ");
		return [step, Number(status), counts.map(Number)];
	});
	assert.deepEqual(observed, finRecordDispatchExpected);
	return { columns: finRecordDispatchColumns, observed, interposer: "LD_PRELOAD", positiveControl: "valid public and raw calls increment source and adapter counts" };
};

const report = { variable: "LEAN_BRIDGE_FIN_RECORD_REPORT", reviewedVariable: "LEAN_BRIDGE_REVIEWED_FIN_RECORD_REPORT", directory: "build/native-fin-records" };
const observe = async ({ profile, consumer, packages, environment }) => profile === "c" ? { dispatch: await observeDispatch(consumer, packages, environment.LEAN_BRIDGE_LEAN_PREFIX) } : {};
const spec = {
	fixture: "tests/fixtures/onboarding/native-fin-records"
	, module: "FinRecords", label: "fin-record", report, observe
	, targets: finRecordTargets
	, refinements: finRecordRefinements
	, reviewedIr: finRecordReviewedIr
	, install: installFinRecordConsumer
};

test("relocated source-free native packages check Fin inside record fields and the active variant case", { skip: !profiles.length, timeout: 2_400_000 }, t => checkInstalledFinFixture(t, spec, profiles));

test("independently reviewed native packages check record and variant field bounds after source-free installation", { skip: !reviewedProfiles.length, timeout: 2_400_000 }, t => checkInstalledFinFixture(t, spec, reviewedProfiles, true));

test("changed record and variant reviews are refused against fresh Lean before any output", { skip: !reviewedProfiles.includes("c"), timeout: 1_800_000 }, async t => {
	const nominal = /types\[\d+\]\.source\.extensions\.lean-lang\.org\/nominal-refinements/u;
	const definition = (ir, name) => ir.types.find(type => type.id === `lean:FinRecords.${name}`).source.extensions[nominalKey];
	await assertReviewedFinChangesRefused(t, spec, [
		["tightened field", ir => { definition(ir, "Tile").fields[0].bound = "4"; }, nominal]
		, ["bound moved to the other field", ir => { definition(ir, "Tile").fields.reverse(); }, nominal]
		, ["loosened nested record's own bound", ir => { definition(ir, "Nest").fields[1].bound = "4"; }, nominal]
		, ["tightened case field", ir => { definition(ir, "Shape").cases[0][0].bound = "9"; }, nominal]
		, ["loosened Fin 0 case", ir => { definition(ir, "Gate").cases[1][0].bound = "1"; }, nominal]]);
});
