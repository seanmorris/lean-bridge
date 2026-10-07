/**
 * Checked Fin inside products and Except values of native packages (VO #1441).
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { finProductEnvironment, finProductRefinements, finProductTargets, installFinProductConsumer } from "./helpers/fin-product-install.mjs";
import { finProductDispatchColumns, finProductDispatchExpected, finProductDispatchInterposer, finProductDispatchProbe } from "./helpers/fin-product-dispatch.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { finProductReviewedIr } from "./helpers/reviewed-fin-product-fixture.mjs";
import { validateReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateCopiedNativeCalls } from "../src/backends/c/native-copied-values.mjs";
import { generatePerlBindingPackage } from "../src/backends/perl/generate.mjs";
import { nativeFinBoundPaths, nativeFinContainerNote } from "../src/backends/native/fin-refinements.mjs";
import { reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { generateCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";

const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { ...heap, heap: false } };
const text = { kind: "primitive", name: "string", lean: "String", abi: heap };
const fin = bound => ({ kind: "refinement", base: nat, predicate: { kind: "fin", bound }, abi: nat.abi });
const binary = (kind, a, b) => ({ kind, arguments: [a, b], abi: heap });
const leaf = bound => ({ kind: "fin", bound });
const huge = "184467440737095516170";
const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };

// One export whose parameter is the given type; the result is unrefined unless supplied.
const model = (parameter, result = nat, options = {}) => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = parameter; projection.result = result;
	return createNativeModel({ ...input, ...options, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } }, { refinements: true });
};
// A product of a bounded Nat and an Except whose ok branch is Fin 3 and error branch Fin 2.
const mixed = () => model(binary("tuple", fin("10"), binary("result", fin("3"), fin("2"))));

test("native refinement trees keep both product components and both Except branches", () => {
	assert.deepEqual(mixed().exports[0].refinements, { parameters: [{ kind: "tuple", arguments: [leaf("10"), { kind: "result", arguments: [leaf("3"), leaf("2")] }] }], result: null });
	// An unrefined component or branch stays null; a product without any bound carries no tree.
	assert.deepEqual(model(binary("tuple", nat, fin("1"))).exports[0].refinements.parameters[0], { kind: "tuple", arguments: [null, leaf("1")] });
	assert.deepEqual(model(binary("result", text, fin(huge))).exports[0].refinements.parameters[0], { kind: "result", arguments: [null, leaf(huge)] });
	assert.equal(model(binary("tuple", nat, text)).exports[0].refinements, undefined);
	// Results are documented only; Lean produces them.
	assert.deepEqual(model(nat, binary("result", fin("10"), text)).exports[0].refinements, { parameters: [null], result: { kind: "result", arguments: [leaf("10"), null] } });
	// Products nest with the earlier structural containers, in both directions.
	const nested = { kind: "list", element: { kind: "option", element: binary("tuple", fin("3"), binary("result", nat, fin("2"))), abi: heap }, abi: heap };
	assert.deepEqual(model(nested).exports[0].refinements.parameters[0]
		, { kind: "list", arguments: [{ kind: "option", arguments: [{ kind: "tuple", arguments: [leaf("3"), { kind: "result", arguments: [null, leaf("2")] }] }] }] });
	assert.deepEqual(model(binary("tuple", { kind: "array", element: fin("0"), abi: heap }, nat)).exports[0].refinements.parameters[0]
		, { kind: "tuple", arguments: [{ kind: "array", arguments: [leaf("0")] }, null] });
});

test("documentation paths name product components and the active Except branch", () => {
	const tree = { kind: "list", arguments: [{ kind: "option", arguments: [{ kind: "tuple", arguments: [leaf("3"), { kind: "result", arguments: [leaf("5"), leaf("2")] }] }] }] };
	assert.deepEqual(nativeFinBoundPaths(tree, "arg0"), ["arg0[*]?.0 < 3", "arg0[*]?.1.ok < 5", "arg0[*]?.1.error < 2"]);
	assert.deepEqual(nativeFinBoundPaths({ kind: "result", arguments: [null, leaf("1")] }, "result"), ["result.error < 1"]);
	// Packages without product or result bounds keep their earlier sentences byte for byte.
	const natType = { kind: "primitive", name: "nat" };
	const parameters = [{ type: { kind: "apply", constructor: "array", arguments: [natType] } }];
	const declaration = refinements => ({ id: "lean:Sample.f", parameters, result: { type: natType }, source: { extensions: { "lean-lang.org/refinements": refinements } } });
	assert.equal(nativeFinContainerNote([declaration({ parameters: [{ kind: "array", arguments: [leaf("10")] }], result: null })], "Ruby gems")
		, "Fin inside arrays, lists and options is checked element by element before Lean runs; an empty array or an absent option is valid even for Fin 0. Bounds below list every element as name[*] and a present option value as name?. Fin inside records, variants, callbacks or reviewed Binding IR is not supported in Ruby gems.");
	const ir = mixed().bindingIr;
	const note = nativeFinContainerNote(ir.declarations, "Ruby gems");
	assert.match(note, /^Fin inside arrays, lists, options, products and Except values is checked before Lean runs: /);
	assert.match(note, /both product components and only the active Except branch\. An empty array, an absent option or an inactive branch is valid even for Fin 0\./);
	assert.match(note, /product components as name\.0 and name\.1, and the active branch as name\.ok or name\.error\. Fin inside records, variants or callbacks is not supported in Ruby gems\.$/);
});

test("the independent product review passes reviewed admission and states every compiled bound", () => {
	const review = finProductReviewedIr(), source = canonicalJson(review);
	validateBindingIr(review);
	validateReviewedSource({ schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(review) });
	// Declarations carry their product and Except trees; the alias pair's bounds live on the Digit alias.
	for(const declaration of review.declarations)
	{
		const expected = finProductRefinements[declaration.id.slice("lean:".length)];
		const stated = declaration.source.extensions["lean-lang.org/refinements"] ?? null;
		if(declaration.id === "lean:FinProducts.aliased") assert.equal(stated, null);
		else assert.deepEqual(stated, expected, declaration.id);
	}
	assert.deepEqual(review.types.find(type => type.id === "lean:FinProducts.Digit").source.extensions["lean-lang.org/nominal-refinements"], { kind: "alias", target: leaf("10") });
	assert.deepEqual(review.types.find(type => type.id === "lean:FinProducts.DigitPair").source.extensions, {});
});

test("generated host documentation lists product and Except bound paths", () => {
	const ir = mixed().bindingIr;
	const readmes = [
		["Ruby gems", generateCopiedRubyPackage(ir)["README.md"]]
		, ["NuGet packages", generateCopiedDotnetPackage(ir)["README.md"]]
		, ["Maven packages", generateCopiedJvmPackage(ir)["README.md"]]];
	for(const [host, readme] of readmes)
	{
		assert.match(readme, /Fin inside arrays, lists, options, products and Except values is checked before Lean runs/u, host);
		assert.match(readme, /arg0\.0 < 10; arg0\.1\.ok < 3; arg0\.1\.error < 2/u, host);
		assert.doesNotMatch(readme, /products and Except values[^\n]*reviewed Binding IR is not supported/u, host);
	}
});

test("C adapters compare both components and only the active branch on caller limbs before Lean runs", () => {
	const value = mixed(), calls = generateCopiedNativeCalls(value, compilePrimitiveCSurface(value.bindingIr, { compounds: true }));
	const call = calls.slice(calls.indexOf("static sample_status lb_call_increment("), calls.indexOf("\n}\n", calls.indexOf("static sample_status lb_call_increment(")));
	const first = call.indexOf("lb_fin_below((&arg0->fst)->data, (&arg0->fst)->length, lb_fin_increment_0_0, 1)) return lb_invalid(error, \"arg0 is not below its Fin 10 bound\");");
	const ok = call.indexOf("if ((&arg0->snd)->is_ok) {\n    if (!lb_fin_below((&(&arg0->snd)->ok)->data, (&(&arg0->snd)->ok)->length, lb_fin_increment_0_1, 1)) return lb_invalid(error, \"arg0 is not below its Fin 3 bound\");\n  }");
	const error = call.indexOf("if (!(&arg0->snd)->is_ok) {\n    if (!lb_fin_below((&(&arg0->snd)->error)->data, (&(&arg0->snd)->error)->length, lb_fin_increment_0_2, 1)) return lb_invalid(error, \"arg0 is not below its Fin 2 bound\");\n  }");
	const dispatch = call.indexOf("lean_object *checked = ");
	// Every comparison follows the copy check and precedes the only conversion into Lean.
	assert.ok(call.indexOf("_check(arg0, &budget)") < first && first < ok && ok < error && error < dispatch, call);
	assert.equal(call.indexOf("_in(arg0)"), call.indexOf("lean_object *checked = ") + call.slice(dispatch).indexOf("_in(arg0)"));
	for(const [name, limbs] of [["lb_fin_increment_0_0", "0xau"], ["lb_fin_increment_0_1", "0x3u"], ["lb_fin_increment_0_2", "0x2u"]])
		assert.ok(calls.includes(`static const uint32_t ${name}[1] = {${limbs}};`), name);
	// A bound wider than 64 bits (10 * 2^64 + 10) becomes its exact limbs; Fin 0 compares against no limbs.
	const wide = model(binary("tuple", fin(huge), fin("0"))), wideCalls = generateCopiedNativeCalls(wide, compilePrimitiveCSurface(wide.bindingIr, { compounds: true }));
	assert.ok(wideCalls.includes("static const uint32_t lb_fin_increment_0_0[3] = {0xau, 0x0u, 0xau};"));
	assert.ok(wideCalls.includes("if (!lb_fin_below((&arg0->snd)->data, (&arg0->snd)->length, NULL, 0)) return lb_invalid(error, \"arg0 is not below its Fin 0 bound\");"));
});

test("Lean adapters construct every Fin of both components and the active branch before one source call", () => {
	const lean = generateNativeLeanAdapters(mixed()).leanSource, symbol = mixed().exports[0].symbol;
	const section = lean.slice(lean.indexOf(`@[export ${symbol}]`), lean.indexOf("\n\n", lean.indexOf(`@[export ${symbol}]`)));
	assert.match(section, /: \(_root_\.Option _root_\.Nat\) :=/);
	assert.ok(section.includes("let _bridgeValue0a ← (if proof : ((a0).fst) < 10 then _root_.Option.some (⟨((a0).fst), proof⟩ : _root_.Fin 10) else _root_.Option.none)"));
	assert.ok(section.includes("match ((a0).snd) with | .ok _bridgeValue1 => ((if proof : (_bridgeValue1) < 3 then _root_.Option.some (⟨(_bridgeValue1), proof⟩ : _root_.Fin 3) else _root_.Option.none)).map _root_.Except.ok"));
	assert.ok(section.includes("| .error _bridgeValue1 => ((if proof : (_bridgeValue1) < 2 then _root_.Option.some (⟨(_bridgeValue1), proof⟩ : _root_.Fin 2) else _root_.Option.none)).map _root_.Except.error"));
	assert.ok(section.includes("| .some _bridgeSubtype0 =>\n    _root_.Option.some (_root_.Sample.increment _bridgeSubtype0)\n  | .none =>\n    _root_.Option.none"));
	assert.equal((section.match(/_root_\.Sample\.increment/g) ?? []).length, 1);
});

test("Perl XS walks both components and the active branch, naming each path", () => {
	const files = generatePerlBindingPackage(model(binary("tuple", fin("10"), binary("result", fin("3"), fin("2"))), nat, { moduleName: "LeanBridge::Sample" }), receipt);
	const xs = files["Component.xs"], body = xs.slice(xs.indexOf("\nincrement(...)"), xs.indexOf("XSRETURN(1);", xs.indexOf("\nincrement(...)")));
	assert.match(body, /lean_inc\(a0\); lean_object \*v0_0 = lbp_keep\(scope, lb_t[0-9a-f]+_get0\(a0\)\);\s+\{ lean_object \*bound = lean_cstr_to_nat\("10"\); int below = lean_nat_lt\(v0_0, bound\); lean_dec\(bound\);\s+if \(!below\) croak\("%s\.0 is not below its Fin 10 bound", "arg0"\); \}/);
	assert.match(body, /lean_inc\(a0\); lean_object \*v0_1 = lbp_keep\(scope, lb_t[0-9a-f]+_get1\(a0\)\);/);
	// The Except is opened through its typed accessors: get0 on the active ok branch, get1 otherwise.
	assert.match(body, /if \(lb_t[0-9a-f]+_has\(v0_1\)\) \{ lean_inc\(v0_1\); lean_object \*v1 = lbp_keep\(scope, lb_t[0-9a-f]+_get0\(v0_1\)\);[^]*croak\("%s\.1\.ok is not below its Fin 3 bound", "arg0"\); \} \} else \{ lean_inc\(v0_1\); lean_object \*v1 = lbp_keep\(scope, lb_t[0-9a-f]+_get1\(v0_1\)\);[^]*croak\("%s\.1\.error is not below its Fin 2 bound", "arg0"\);/);
	// Every bound precedes the guarded adapter; messages are assembled only on rejection.
	assert.ok(body.indexOf("croak(\"%s.1.error") < body.indexOf("lean_object *checked = "));
	assert.doesNotMatch(xs, /snprintf|SvPVf|newSVpvf|sv_catpvf/);
	assert.match(files["lib/LeanBridge/Sample.pm"], /Checked Lean Fin bounds: arg0\.0 < 10; arg0\.1\.ok < 3; arg0\.1\.error < 2\./);
});

test("reviewed product and Except bounds must equal the freshly compiled tree", () => {
	const compiled = mixed().bindingIr, key = "lean-lang.org/refinements";
	const path = `bindingIr.declarations[0].source.extensions.${key}`;
	assert.equal(reviewedContractDifference(structuredClone(compiled), compiled), null);
	const mutations = [
		["tightened component", tree => { tree.parameters[0].arguments[0].bound = "9"; }]
		, ["loosened branch", tree => { tree.parameters[0].arguments[1].arguments[0].bound = "4"; }]
		, ["bound moved to the other branch", tree => { tree.parameters[0].arguments[1].arguments = [leaf("2"), leaf("3")]; }]
		, ["bound moved to the other component", tree => { tree.parameters[0].arguments = [tree.parameters[0].arguments[1], tree.parameters[0].arguments[0]]; }]
		, ["dropped branch", tree => { tree.parameters[0].arguments[1].arguments[1] = null; }]];
	for(const [label, mutate] of mutations)
	{
		const reviewed = structuredClone(compiled);
		mutate(reviewed.declarations[0].source.extensions[key]);
		assert.ok(reviewedContractDifference(reviewed, compiled)?.startsWith(path), label);
	}
	validateBindingIr(compiled);
});

const profiles = process.env.LEAN_BRIDGE_FIN_PRODUCT_PROFILES?.split(",").sort() ?? [];
const reviewedProfiles = process.env.LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_PROFILES?.split(",").sort() ?? [];
for(const selection of [profiles, reviewedProfiles])
{
	assert.equal(new Set(selection).size, selection.length, "Duplicate Fin product profile");
	assert.ok(selection.every(profile => Object.hasOwn(finProductTargets, profile)), "Unknown or empty Fin product profile");
}
const fixture = "tests/fixtures/onboarding/native-fin-products";
const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", ruby: "rb", "php-native": "php", "wit-wasi": "c", perl: "pl" };

test("every native profile has a Fin product consumer and a target", async () => {
	assert.deepEqual(Object.keys(finProductTargets).sort(), Object.keys(extensions).sort());
	for(const [profile, extension] of Object.entries(extensions)) await access(`tests/fixtures/fin-product-consumers/${profile}.${extension}`);
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
	await saveLakeFile(root, "interposer.c", finProductDispatchInterposer());
	await saveLakeFile(root, "probe.c", finProductDispatchProbe());
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], root, compile);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/);
	await runCopied("/usr/bin/cc", [...strict, "-isystem", join(leanPrefix, "include"), "probe.c", ...flags, "-lleanshared", "-o", "probe"], root, compile);
	// Without the interposer the probe refuses to report, so a missing counter cannot pass.
	await assert.rejects(() => runCopied(join(root, "probe"), [], root, copiedCleanEnvironment), /interposer is not loaded/u);
	const run = await runCopied(join(root, "probe"), [], root, { ...copiedCleanEnvironment, LD_PRELOAD: join(root, "libdispatch.so") });
	assert.equal(run.stderr, "");
	const observed = run.stdout.trim().split("\n").map(line => {
		const [step, status, ...counts] = line.split(" ");
		return [step, Number(status), counts.map(Number)];
	});
	assert.deepEqual(observed, finProductDispatchExpected);
	return { columns: finProductDispatchColumns, observed, interposer: "LD_PRELOAD", positiveControl: "valid public and raw calls increment source and adapter counts" };
};

const checkInstalledFinProducts = async (t, profiles, reviewed = false) => {
	const reports = [], archives = [];
	const targets = Object.fromEntries(profiles.map(profile => finProductTargets[profile]));
	const environment = finProductEnvironment(profiles);
	// CI exports the Ruby toolchain; local runs use the pinned MRI 3.3 beside the other toolchains.
	if(profiles.includes("ruby"))
	{
		environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
		environment.LEAN_BRIDGE_GEM ??= join(dirname(environment.LEAN_BRIDGE_RUBY), "gem");
	}
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-product-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-fin-product-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp(fixture, projectRoot, { recursive: true });
		// The reviewed route selects its exports from the authored Binding IR; the ordinary route names them.
		const reviewedSource = reviewed ? canonicalJson(finProductReviewedIr()) : null;
		if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", reviewedSource);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["FinProducts"], ...(reviewed ? {} : { exports: Object.keys(finProductRefinements) }), targets }));
		t.diagnostic(`build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		if(reviewed)
		{
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, reviewedSource);
			assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, sha256(reviewedSource));
		}
		// Lean elaboration supplies every bound; the model carries exactly the expected trees.
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), finProductRefinements);
		for(const item of model.exports) for(const parameter of item.parameters) assert.ok(!JSON.stringify(parameter.type).includes('"refinement"'), item.name);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		const dependencies = attempt === 0 && profiles.includes("rust")
			? await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory, handoff: join(consumer, "dependencies"), environment }) : undefined;
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking ${profile}`);
			const target = finProductTargets[profile][0];
			const packages = receipt.packages.filter(pkg => pkg.target === target);
			const { command, ...observation } = await installFinProductConsumer({ profile, consumer, handoff, packages, dependencies, environment });
			void command;
			const dispatch = profile === "c" ? { dispatch: await observeDispatch(consumer, packages, environment.LEAN_BRIDGE_LEAN_PREFIX) } : {};
			reports.push({ profile, ...observation, packages
				, path: reviewed ? "reviewed-ir" : "ordinary-source"
				, ...dispatch
				, ...(reviewed ? { reviewedSourceSha256: model.sourceIdentity.reviewedBindingIr.sourceSha256 } : {})
				, refinements: finProductRefinements
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	// Two unrelated author roots produce byte-identical archives.
	assert.deepEqual(archives[1], archives[0]);
	const configuredReport = process.env[reviewed ? "LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_REPORT" : "LEAN_BRIDGE_FIN_PRODUCT_REPORT"];
	const reportPath = resolve(configuredReport ?? `build/native-fin-products/${reviewed ? "reviewed-" : ""}${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
};

test("relocated source-free native packages check Fin inside products and the active Except branch", { skip: !profiles.length, timeout: 2_400_000 }, t => checkInstalledFinProducts(t, profiles));

test("independently reviewed native packages check product and Except bounds after source-free installation", { skip: !reviewedProfiles.length, timeout: 2_400_000 }, t => checkInstalledFinProducts(t, reviewedProfiles, true));

test("the independent product review passes reviewed admission, and changed bounds are refused against fresh Lean", { skip: !reviewedProfiles.includes("c"), timeout: 1_800_000 }, async t => {
	const review = finProductReviewedIr(), source = canonicalJson(review);
	validateReviewedSource({ schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(review) });
	const declaration = (ir, name) => ir.declarations.find(item => item.id === `lean:FinProducts.${name}`).source.extensions["lean-lang.org/refinements"];
	const cases = [
		["tightened component", ir => { declaration(ir, "first").parameters[0].arguments[0].bound = "9"; }]
		, ["loosened branch", ir => { declaration(ir, "both").parameters[0].arguments[1].bound = "4"; }]
		, ["swapped branches", ir => { declaration(ir, "both").parameters[0].arguments.reverse(); }]
		, ["moved to the other component", ir => { declaration(ir, "second").parameters[0].arguments.reverse(); }]];
	for(const [label, mutate] of cases) await t.test(label, async () => {
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-product-reviewed-"));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
		await cp(fixture, projectRoot, { recursive: true });
		const ir = finProductReviewedIr(); mutate(ir);
		await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(ir));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["FinProducts"], targets: Object.fromEntries([finProductTargets.c]) }));
		await assert.rejects(() => buildCanonicalProject({ projectRoot, outputRoot, targets: ["c"], environment: finProductEnvironment(["c"]) }), error => {
			assert.equal(error.code, "reviewed-ir-source-mismatch", label);
			assert.match(error.details.field, /source\.extensions\.lean-lang\.org\/refinements/u, label);
			return true;
		});
		await assert.rejects(() => access(outputRoot), label);
	});
});
