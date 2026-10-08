/**
 * Reviewed specialization decisions: a review chooses closed type names, fresh Lean computes the application.
 *
 * @file
 */
import assert from "node:assert/strict";
import "./helpers/reviewed-specialization-ci-hotfix-source-history-tests.mjs";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import "./helpers/reviewed-specialization-admission-source-history-tests.mjs";
import { inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareLakeEntryIntent } from "../src/build/lake-entry-intent.mjs";
import { resolveLakeBuildWorkspace } from "../src/build/lake-build-workspace.mjs";
import { elaborateLakeEntryModules } from "../src/build/lake-entry-elaboration.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { assertReviewedSourceConfiguration, readReviewedSource, reconcileReviewedSource, reviewedContractDifference, reviewedSourceSelection, validateReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { nativeFinReviewedIr } from "./helpers/reviewed-fin-fixture.mjs";
import { lakeWorkspaceFixture, lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { shopSpecializationReview, shopSpecializations } from "./helpers/reviewed-specialization-fixture.mjs";
import { reviewedNativeSpecializationIr, reviewedNativeSpecializations } from "./helpers/reviewed-native-specialization-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { refinementEngineTransport } from "./helpers/refinement-engine.mjs";
import { installSpecializationConsumer, nativeSpecializationEnvironment, nativeSpecializationSignatures, nativeSpecializationTargets } from "./helpers/native-specialization-install.mjs";

const key = "lean-lang.org/specialization";
// Application text as the compiler prints it; the review records it and fresh Lean must agree.
const decisions = [
	["Spec.echoNat", "Spec.echo", ["Nat"], "@Spec.echo.{0} Nat", ["nat"], "nat"]
	, ["Spec.echoText", "Spec.echo", ["String"], "@Spec.echo.{0} String", ["string"], "string"]
	, ["Spec.chooseWord", "Spec.choose", ["UInt32"], "@Spec.choose.{0} UInt32 Spec.instInhabitedUInt32", ["bool", "uint32"], "uint32"]
	, ["Spec.firstTextWord", "Spec.first", ["String", "UInt32"], "@Spec.first.{0, 0} String UInt32", ["string", "uint32"], "string"]];
/** A schema-valid review: four specializations of three generics beside one ordinary export. */
const reviewed = () => {
	const signatures = [...decisions.map(([name, , , , parameters, result]) => ({ name, parameters, result })), { name: "Spec.plain", parameters: ["uint32"], result: "uint32" }];
	const ir = corpusReviewedIr({ id: "spec" }, signatures);
	for(const declaration of ir.declarations)
	{
		const decision = decisions.find(([name]) => declaration.id === `lean:${name}`);
		if(!decision) continue;
		const [name, generic, types, application] = decision;
		declaration.source.declaration = generic;
		declaration.source.extensions[key] = { name, declaration: generic, types, application };
	}
	validateBindingIr(ir);
	return ir;
};
const reviewInput = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
};
const declaration = (ir, name) => ir.declarations.find(item => item.id === `lean:Spec.${name}`);
const unsupported = { code: "reviewed-ir-build-unsupported" };
const configuration = { schemaVersion: 1, modules: ["Spec"] };
const selected = [
	{ name: "Spec.chooseWord", declaration: "Spec.choose", types: ["UInt32"] }
	, { name: "Spec.echoNat", declaration: "Spec.echo", types: ["Nat"] }
	, { name: "Spec.echoText", declaration: "Spec.echo", types: ["String"] }
	, { name: "Spec.firstTextWord", declaration: "Spec.first", types: ["String", "UInt32"] }];
const exports = ["Spec.chooseWord", "Spec.echoNat", "Spec.echoText", "Spec.firstTextWord", "Spec.plain"];
const identity = (request = {}) => ({
	request: { modules: ["Spec"], exportModules: ["Spec"], exports, resources: [], arities: [], specializations: selected, ...request }
	, exportConfigurationSource: canonicalJson(configuration)
	, exportConfigurationSha256: sha256(canonicalJson(configuration)) });

test("a review selects closed specializations beside ordinary exports, never their application text", () => {
	const review = reviewInput(reviewed());
	validateReviewedSource(review);
	const selection = reviewedSourceSelection(review);
	assert.deepEqual(selection, { exports, arities: [], specializations: selected });
	// Two specializations of one generic keep distinct public names over one source declaration.
	assert.deepEqual(selection.specializations.filter(item => item.declaration === "Spec.echo").map(item => item.name), ["Spec.echoNat", "Spec.echoText"]);
	assert.ok(!canonicalJson(selection).includes("instInhabitedUInt32"));
	// A review without specializations keeps the earlier selection shape exactly.
	const plain = corpusReviewedIr({ id: "spec" }, [{ name: "Spec.plain", parameters: ["uint32"], result: "uint32" }]);
	assert.deepEqual(reviewedSourceSelection(reviewInput(plain)), { exports: ["Spec.plain"], arities: [] });
	const fin = nativeFinReviewedIr(), finBefore = canonicalJson(fin);
	assert.deepEqual(reviewedSourceSelection(reviewInput(fin)), {
		exports: fin.declarations.map(item => item.source.declaration).sort()
		, arities: []
	});
	assert.equal(canonicalJson(fin), finBefore);
});

test("the author recipe names the independently reviewed specialization and its compiled application", async () => {
	const source = await readFile("docs/lean/existing-package.md", "utf8");
	const section = source.split("For a schema-3 finite specialization,")[1].split("### Describe the downstream packages")[0];
	const example = JSON.parse(section.match(/```json\n([\s\S]*?)\n```/u)[1]);
	const declaration = shopSpecializationReview().declarations.find(item => item.id === "lean:Shop.keepText");
	assert.deepEqual(example, declaration.source.extensions[key]);
	assert.match(section, /never executes application text from the review/u);
	assert.match(section, /installed gates are prepared but have not run/u);
});

test("malformed, extra, colliding and indirect specialization decisions are refused before compilation", () => {
	const cases = [
		["extra field", ir => { declaration(ir, "echoNat").source.extensions[key].universe = "0"; }]
		, ["missing application", ir => { delete declaration(ir, "echoNat").source.extensions[key].application; }]
		, ["null application", ir => { declaration(ir, "echoNat").source.extensions[key].application = null; }]
		, ["empty application", ir => { declaration(ir, "echoNat").source.extensions[key].application = ""; }]
		, ["control character in application", ir => { declaration(ir, "echoNat").source.extensions[key].application = "@Spec.echo Nat\n#eval 0"; }]
		, ["oversized application", ir => { declaration(ir, "echoNat").source.extensions[key].application = "x".repeat(4097); }]
		, ["decision named for another export", ir => { declaration(ir, "echoNat").source.extensions[key].name = "Spec.echoText"; }]
		, ["decision for another generic", ir => { declaration(ir, "echoNat").source.extensions[key].declaration = "Spec.choose"; }]
		, ["no closed types", ir => { declaration(ir, "echoNat").source.extensions[key].types = []; }]
		, ["nine closed types", ir => { declaration(ir, "echoNat").source.extensions[key].types = Array(9).fill("Nat"); }]
		, ["an application in place of a type name", ir => { declaration(ir, "echoNat").source.extensions[key].types = ["List Nat"]; }]
		, ["a non-string type", ir => { declaration(ir, "echoNat").source.extensions[key].types = [{ kind: "primitive", name: "nat" }]; }]
		, ["a decision array", ir => { declaration(ir, "echoNat").source.extensions[key] = [declaration(ir, "echoNat").source.extensions[key]]; }]
		, ["a specialization of a specialization", ir => {
			const item = declaration(ir, "echoText");
			item.source.declaration = "Spec.echoNat"; item.source.extensions[key].declaration = "Spec.echoNat";
		}]
		, ["a specialization of an ordinary reviewed export", ir => {
			const item = declaration(ir, "echoText");
			item.source.declaration = "Spec.plain"; item.source.extensions[key].declaration = "Spec.plain";
		}]
		, ["a decision that names its own generic", ir => {
			const item = declaration(ir, "echoText");
			item.id = "lean:Spec.echo"; item.source.extensions[key].name = "Spec.echo";
		}]
		, ["a decision on a type definition", ir => {
			const reviewedType = corpusReviewedIr({ id: "spec" }, [{ name: "Spec.box", parameters: [{ record: "Spec.Box", fields: { value: "nat" } }], result: "nat" }]).types[0];
			reviewedType.source.extensions[key] = { name: "Spec.Box", declaration: "Spec.Box", types: ["Nat"], application: "Spec.Box" };
			ir.types.push(reviewedType);
		}]
		// Without the decision, the generic source declaration cannot name a different export.
		, ["a different export name without a decision", ir => { delete declaration(ir, "echoNat").source.extensions[key]; }]];
	// Each case is refused for its own reason, not by an earlier unrelated check.
	const decision = /lean:Spec\.echoNat\.source\.extensions\.lean-lang\.org\/specialization$/u, name = /lean:Spec\.echoNat\.source\.declaration$/u;
	const closedTypes = /one to eight closed type names/u;
	const reasons = {
		"extra field": decision
		, "missing application": decision
		, "null application": decision
		, "empty application": decision
		, "control character in application": decision
		, "oversized application": decision
		, "decision for another generic": decision
		, "decision named for another export": name
		, "a decision array": name
		, "a different export name without a decision": name
		, "no closed types": closedTypes
		, "nine closed types": closedTypes
		, "an application in place of a type name": closedTypes
		, "a non-string type": closedTypes
		, "a decision that names its own generic": closedTypes
		, "a specialization of a specialization": /not other specializations/u
		, "a specialization of an ordinary reviewed export": /not other exports/u
		, "a decision on a type definition": /lean:Spec\.Box\.source\.extensions$/u };
	assert.deepEqual(Object.keys(reasons).sort(), cases.map(([label]) => label).sort());
	for(const [label, mutate] of cases)
	{
		const ir = reviewed();
		mutate(ir);
		assert.throws(() => validateReviewedSource(reviewInput(ir)), error => error.code === unsupported.code && reasons[label].test(error.message), label);
	}
	// Two declarations cannot share one specialization name, whatever their arguments.
	const duplicate = reviewed(), copy = structuredClone(declaration(duplicate, "echoNat"));
	copy.source.extensions[key].types = ["Int"]; copy.overloadKey = "Spec.echoNat.again";
	duplicate.declarations.push(copy);
	assert.throws(() => validateReviewedSource(reviewInput(duplicate)), /duplicate lean:Spec\.echoNat/u);
	// The configuration file still cannot carry specializations for a reviewed build.
	assert.throws(() => assertReviewedSourceConfiguration({ ...configuration, specializations: selected }), { code: "export-configuration-reviewed-ir" });
	assert.throws(() => assertReviewedSourceConfiguration({ ...configuration, exports }), { code: "export-configuration-reviewed-ir" });
	assertReviewedSourceConfiguration(configuration);
});

test("the export configuration's count limit applies to reviewed specializations", () => {
	const many = Array.from({ length: 129 }, (_, index) => [`Spec.echo${index}`, "Spec.echo", ["Nat"], "@Spec.echo.{0} Nat", ["nat"], "nat"]);
	const ir = corpusReviewedIr({ id: "spec" }, many.map(([name, , , , parameters, result]) => ({ name, parameters, result })));
	for(const [index, item] of ir.declarations.entries())
	{
		const [name, generic, types, application] = many.find(([value]) => item.id === `lean:${value}`) ?? many[index];
		item.source.declaration = generic; item.source.extensions[key] = { name, declaration: generic, types, application };
	}
	assert.throws(() => validateReviewedSource(reviewInput(ir)), error => error.code === "reviewed-ir-build-unsupported" && /at most 128/u.test(error.message));
	ir.declarations.splice(128);
	assert.equal(reviewedSourceSelection(reviewInput(ir)).specializations.length, 128);
});

test("fresh Lean decides the application, and closed arguments must match the authorized selection", () => {
	const review = reviewInput(reviewed());
	// The freshly compiled document here is a schema-valid synthetic projection, not installed evidence.
	const compiled = reviewed();
	compiled.declarations.forEach(item => { item.source.extensions["lean-lang.org/theorem-references"] = []; });
	assert.ok(reconcileReviewedSource(review, compiled, identity()));
	// The selection reaching Lean must be the review's closed choice, never absent or changed.
	const changedTypes = selected.map(item => item.name === "Spec.echoNat" ? { ...item, types: ["Int"] } : item);
	const requests = [{ specializations: undefined }, { specializations: selected.slice(1) }, { specializations: changedTypes }, { exports: exports.filter(name => name !== "Spec.plain") }];
	for(const request of requests)
		assert.throws(() => reconcileReviewedSource(review, compiled, identity(request)), { code: "reviewed-ir-source-mismatch" }, canonicalJson(request));
	// Lean printing another application, closed argument or generic contradicts the review at that exact path.
	const index = compiled.declarations.toSorted((a, b) => a.id.localeCompare(b.id)).findIndex(item => item.id === "lean:Spec.chooseWord");
	const contradictions = [
		["application", item => { item.application = "@Spec.choose.{0} UInt32 instInhabitedUInt32"; }]
		, ["types", item => { item.types = ["Spec.Word"]; }]
		, ["declaration", item => { item.declaration = "Spec.pick"; }]];
	for(const [field, mutate] of contradictions)
	{
		const changed = structuredClone(compiled);
		mutate(declaration(changed, "chooseWord").source.extensions[key]);
		assert.throws(() => reconcileReviewedSource(review, changed, identity()), error => error.code === "reviewed-ir-source-mismatch"
			&& error.details.field === `bindingIr.declarations[${index}].source.extensions.${key}.${field}`.concat(field === "types" ? "[0]" : ""), field);
	}
});

test("a review that chooses another valid specialization is an API change, refused only against the authenticated review", () => {
	const original = reviewed(), changed = reviewed();
	Object.assign(declaration(changed, "echoNat").source.extensions[key], { types: ["String"], application: "@Spec.echo.{0} String" });
	const nat = declaration(changed, "echoNat");
	nat.parameters[0].type = { kind: "primitive", name: "string" }; nat.result.type = { kind: "primitive", name: "string" };
	// Fresh Lean agrees with the changed review, so the build itself has no contradiction.
	const request = { specializations: selected.map(item => item.name === "Spec.echoNat" ? { ...item, types: ["String"] } : item) };
	assert.ok(reconcileReviewedSource(reviewInput(changed), structuredClone(changed), identity(request)));
	// Against the independently authenticated review, the changed choice is a visible public API difference.
	assert.match(reviewedContractDifference(changed, original), /^bindingIr\.declarations\[\d+\]\.(?:parameters|result|source)/u);
	assert.equal(reviewedContractDifference(original, reviewed()), null);
});

const enabled = process.env.LEAN_BRIDGE_REVIEWED_SPECIALIZATION_TEST === "1";
const engineRoot = process.cwd();
// Elaborate the captured project with its review, exactly as compiler analysis and builds do.
const inspect = async root => {
	const intent = await prepareLakeEntryIntent({ projectRoot: root });
	const leanPrefix = (await processBuildRunner.capture({ command: join(engineRoot, ".toolchains/elan/bin/lean"), args: ["--print-prefix"], cwd: engineRoot })).stdout.trim();
	const workspace = await resolveLakeBuildWorkspace({ snapshot: intent.lakeSnapshot, modules: intent.document.modules.map(module => module.module), leanPrefix });
	try
	{
		const inventory = await inspectLeanProject(root);
		const reviewedBindingIr = await readReviewedSource(root, inventory) ?? undefined;
		return await elaborateLakeEntryModules({ inventory, reviewedBindingIr, entries: intent.document.modules, workspace, leanPrefix, engineRoot });
	}
	finally
	{ await workspace.dispose(); }
};
const shopProject = async (t, { source, review = shopSpecializationReview() } = {}) => {
	const context = await lakeWorkspaceFixture(t);
	await saveLakeFile(context.root, "Shop.lean", source ?? await readFile("tests/fixtures/reviewed-specializations/Shop.lean", "utf8"));
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Shop"] }));
	await saveLakeFile(context.root, "api.binding-ir.json", canonicalJson(review));
	return context;
};

test("a reviewed project specializes generics through fresh Lean, with stable public names after relocation", { skip: !enabled, timeout: 1_200_000 }, async t => {
	const context = await shopProject(t), before = await lakeInputState(context.workspace);
	const first = await inspect(context.root);
	assert.deepEqual(first.adapterHints, []);
	// Lean received the closed choices only; the instance it resolved appears solely in its own output.
	const request = first.elaboration.request;
	assert.deepEqual(request.specializations, shopSpecializations.map(([name, declaration, types]) => ({ name, declaration, types })).toSorted((a, b) => a.name < b.name ? -1 : 1));
	assert.deepEqual(request.exports, ["Shop.firstTextWord", "Shop.keepText", "Shop.keepWord", "Shop.pickWord", "Shop.plain"]);
	assert.ok(!canonicalJson(request).includes("instInhabitedUInt32_shop"));
	const declarations = first.bindingIr.document.declarations;
	for(const [name, declaration, types, application] of shopSpecializations)
	{
		const item = declarations.find(entry => entry.id === `lean:${name}`);
		assert.equal(item.source.declaration, declaration, name);
		assert.deepEqual(item.source.extensions[key], { name, declaration, types, application }, name);
	}
	// The ordinary export beside the specializations keeps its own source identity.
	assert.equal(declarations.find(entry => entry.id === "lean:Shop.plain").source.extensions[key], undefined);
	const moved = join(context.directory, "moved");
	await cp(context.workspace, moved, { recursive: true });
	const relocated = await inspect(join(moved, "project"));
	assert.deepEqual(relocated.bindingIr.document, first.bindingIr.document);
	assert.deepEqual(relocated.elaboration.request.specializations, request.specializations);
	assert.deepEqual(await lakeInputState(context.workspace), before);
});

test("fresh Lean contradictions stop a reviewed specialization at the exact decision", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const mismatch = field => error => error.code === "reviewed-ir-source-mismatch" && new RegExp(`^bindingIr\\.declarations\\[\\d+\\]\\.${field}$`, "u").test(error.details.field);
	const source = await readFile("tests/fixtures/reviewed-specializations/Shop.lean", "utf8");
	await t.test("changed source closure", async t => {
		// Without the local instance, Lean resolves the core default, and the reviewed application no longer holds.
		const changed = source.split("\n").filter(line => !line.includes("Inhabited UInt32 := ⟨37⟩") && !line.includes("core default of zero")).join("\n");
		assert.notEqual(changed, source);
		await assert.rejects(async () => inspect((await shopProject(t, { source: changed })).root), mismatch(`source\\.extensions\\.${key.replaceAll(".", "\\.")}\\.application`));
	});
	await t.test("application text the compiler never printed", async t => {
		const review = shopSpecializationReview();
		review.declarations.find(item => item.id === "lean:Shop.pickWord").source.extensions[key].application = "(@_root_.Shop.pick.{0} (@_root_.UInt32) (@_root_.instInhabitedUInt32))";
		await assert.rejects(async () => inspect((await shopProject(t, { review })).root), mismatch(`source\\.extensions\\.${key.replaceAll(".", "\\.")}\\.application`));
	});
	await t.test("closed argument that disagrees with the reviewed signature", async t => {
		// The review chooses UInt32 but keeps the Word alias in its signature; Lean decides the parameter type.
		const review = shopSpecializationReview();
		Object.assign(review.declarations.find(item => item.id === "lean:Shop.keepWord").source.extensions[key], { types: ["UInt32"], application: "(@_root_.Shop.keep.{0} (@_root_.UInt32))" });
		await assert.rejects(async () => inspect((await shopProject(t, { review })).root), mismatch("parameters\\[0\\]\\.type\\.(?:kind|id|name)"));
	});
	await t.test("specialization name that collides with a source declaration", async t => {
		const review = shopSpecializationReview(), item = review.declarations.find(entry => entry.id === "lean:Shop.keepText");
		item.id = "lean:Shop.keep_eq"; item.name = "keep_eq"; item.overloadKey = "Shop.keep_eq"; item.source.extensions[key].name = "Shop.keep_eq";
		await assert.rejects(async () => inspect((await shopProject(t, { review })).root), error => error.code === "lean-metadata-extractor-failed" && /specialization name already exists/u.test(JSON.stringify(error.details)));
	});
});

const profiles = process.env.LEAN_BRIDGE_REVIEWED_SPECIALIZATION_PROFILES?.split(",").sort() ?? [];
assert.ok(profiles.every(profile => ["c", "cpp"].includes(profile)), "Reviewed specialization acceptance covers C and C++ first");
const fixture = "tests/fixtures/onboarding/native-specializations";
const reviewedDecisions = () => Object.fromEntries(reviewedNativeSpecializations.map(([name, declaration, types, application]) => [name, { name, declaration, types, application }]));
const type = value => value.kind === "primitive" ? value.name : value.kind === "array" ? { array: type(value.element) } : value.kind;

test("the independent native review reconciles with fresh Lean and leaves no configured decision", { skip: !enabled, timeout: 1_200_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-specialization-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project");
	await cp(fixture, root, { recursive: true });
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Specialized"] }));
	await saveLakeFile(root, "api.binding-ir.json", canonicalJson(reviewedNativeSpecializationIr()));
	const result = await inspect(root);
	assert.deepEqual(result.adapterHints, []);
	const decisions = reviewedDecisions();
	for(const item of result.bindingIr.document.declarations)
		assert.deepEqual(item.source.extensions[key], decisions[item.id.slice("lean:".length)], item.id);
	assert.deepEqual(result.elaboration.request.exports, Object.keys(nativeSpecializationSignatures).sort());
});

test("independently reviewed C and C++ packages install every chosen specialization without its generic", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const reports = [], archives = [];
	const targets = Object.fromEntries(profiles.map(profile => nativeSpecializationTargets[profile]));
	const environment = nativeSpecializationEnvironment(profiles);
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-specialization-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-specialization-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp(fixture, projectRoot, { recursive: true });
		// Modules and package targets only: every export decision comes from the review.
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Specialized"], targets }));
		await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(reviewedNativeSpecializationIr()));
		t.diagnostic(`reviewed build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, [item.parameters.map(parameter => type(parameter.type)), type(item.result)]])), nativeSpecializationSignatures);
		const decisions = reviewedDecisions();
		for(const item of model.bindingIr.declarations) assert.deepEqual(item.source.extensions[key], decisions[item.id.slice("lean:".length)], item.id);
		for(const name of ["echo", "choose", "first", "duplicate"])
			assert.ok(!model.bindingIr.declarations.some(item => item.id === `lean:Specialized.${name}`), name);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		await rm(directory, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking reviewed ${profile}`);
			const packages = receipt.packages.filter(pkg => pkg.target === nativeSpecializationTargets[profile][0]);
			// The same public consumers as the configured specializations: the review changes no public name.
			const observation = await installSpecializationConsumer({ profile, consumer, handoff, packages, environment });
			delete observation.command;
			const identities = { bindingIrSha256: built.bindingIrSha256, reviewedBindingIrSha256: hashBindingIr(reviewedNativeSpecializationIr()), modelSha256: sha256(canonicalJson(model)) };
			const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
			reports.push({ profile, path: "reviewed-source", ...observation, packages, ...identities, receiptSha256, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	const reportPath = resolve(process.env.LEAN_BRIDGE_REVIEWED_SPECIALIZATION_REPORT ?? `build/reviewed-specializations/${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});

const npm = process.env.LEAN_BRIDGE_REVIEWED_SPECIALIZATION_NPM_TEST === "1";
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
// Exact results of the chosen applications, including the local Inhabited UInt32 instance and UInt32 wrapping.
const nodeConsumer = `import * as api from "specialized";
let checks = 0, rejections = 0;
const check = (ok, label) => { if(!ok) throw new Error("failed: " + label); checks++; };
const rejected = (call, label) => { try { call(); } catch { rejections++; return; } throw new Error("accepted: " + label); };
check(api.echoWord(4294967295) === 4294967295 && api.echoText("h\u00e9llo \u{1F642}") === "h\u00e9llo \u{1F642}" && api.echoNat(2n ** 200n) === 2n ** 200n, "echo");
check(JSON.stringify(api.echoWords([0, 42, 4294967295])) === "[0,42,4294967295]", "echoWords");
check(api.chooseWord(false, 5) === 37 && api.chooseWord(true, 5) === 5, "chooseWord instance");
check(api.chooseText(false, "x") === "" && api.chooseText(true, "x") === "x", "chooseText");
check(api.chooseWords(false, [1]).length === 0 && api.chooseWords(true, [1])[0] === 1, "chooseWords");
check(api.firstTextWord("a", 5) === "a" && api.doubleWord(2147483648) === 0 && api.doubleNat(2n ** 70n) === 2n ** 71n && api.plain(4) === 7, "others");
rejected(() => api.echoWord(-1), "negative UInt32"); rejected(() => api.echoNat(1), "Nat must be bigint"); rejected(() => api.chooseWord(0, 1), "Bool must be boolean");
console.log(JSON.stringify({ checks, rejections }));
`;
const typescript = `import * as api from "specialized";
const word: api.Word = api.echoWord(1);
const words: api.Words = api.echoWords([1, 2]);
const nat: bigint = api.echoNat(1n) + api.doubleNat(2n);
const text: string = api.chooseText(false, "x") + api.firstTextWord("a", 1);
const chosen: api.Words = api.chooseWords(true, words);
// @ts-expect-error UInt32 stays a number.
api.echoWord(1n);
// @ts-expect-error The specialized choose takes a Bool first.
api.chooseWord(1, 1);
void word; void nat; void text; void chosen;
`;

// Consumers see only the copied handoff and a compiler-free PATH holding Node.
const clean = { PATH: "/unavailable", CC: "/unavailable/compiler", CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN: "/unavailable/lean", LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: "" };
const consumerRun = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 300_000 });

test("an independently reviewed npm package installs the chosen specializations for Node and strict TypeScript", { skip: !npm, timeout: 3_600_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-specialization-npm-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	const producers = join(directory, "producers"), roots = [join(producers, "project"), join(producers, "relocated")], releases = [], facts = [];
	for(const [index, projectRoot] of roots.entries())
	{
		await cp(fixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Specialized"] }));
		await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(reviewedNativeSpecializationIr()));
		const before = await lakeInputState(projectRoot), outputRoot = join(producers, `build-${index}`);
		await buildCanonicalProject({ projectRoot, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() })
			.catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		const irBytes = await readFile(join(outputRoot, "bundle/binding/binding-ir.json")), ir = JSON.parse(irBytes), decisions = reviewedDecisions();
		for(const item of ir.declarations) assert.deepEqual(item.source.extensions[key], decisions[item.id.slice("lean:".length)], item.id);
		facts.push({ bindingIrSha256: hashBindingIr(ir), bindingIrFileSha256: sha256(irBytes) });
		const release = await buildComponentNpmPackages({ bundleRoot: join(outputRoot, "bundle"), runtimeRoot, outputRoot: join(producers, `npm-${index}`) });
		await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
		assert.equal(release.report.bindingIrSha256, facts[index].bindingIrSha256);
		assert.deepEqual(await lakeInputState(projectRoot), before);
		releases.push(release);
	}
	// Two author roots produce the same IR, receipt and archive bytes.
	assert.deepEqual(facts[1], facts[0]);
	assert.deepEqual(releases[1].report, releases[0].report);
	for(const name of ["componentArchive", "runtimeArchive"]) assert.deepEqual(await readFile(releases[1][name]), await readFile(releases[0][name]));
	const reproducible = true;
	// Hand over only the release; then remove every author root and build output.
	const receipt = releases[0].report, handoff = join(directory, "handoff");
	await mkdir(handoff);
	for(const name of [receipt.package.archive, receipt.runtime.archive, "component-package-receipt.json", "verify-component-package-receipt.mjs"])
		await cp(join(releases[0].output, name), join(handoff, name));
	await rm(producers, { recursive: true, force: true });
	await assert.rejects(lstat(producers), { code: "ENOENT" });
	const sourceRemovedBeforeInstallation = true;
	await verifyComponentPackageReceipt({ receiptPath: join(handoff, "component-package-receipt.json") });
	const consumer = join(directory, "consumer"), bin = join(consumer, "bin");
	await mkdir(bin, { recursive: true });
	await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(consumer, "package.json", canonicalJson({ private: true, type: "module" }));
	for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(consumer, name, "");
	const npmCli = await realpath(join(process.execPath, "../../bin/npm")), env = { ...clean, PATH: bin };
	const configuration = ["--userconfig", join(consumer, "user.npmrc"), "--globalconfig", join(consumer, "global.npmrc"), "--cache", join(consumer, "empty-cache")];
	const archives = [join(handoff, receipt.runtime.archive), join(handoff, receipt.package.archive)];
	await consumerRun(process.execPath, [npmCli, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", ...configuration, ...archives], consumer, env);
	await saveLakeFile(consumer, "index.mjs", nodeConsumer);
	const run = await consumerRun(process.execPath, ["index.mjs"], consumer, env).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	assert.equal(run.stderr, "");
	const result = JSON.parse(run.stdout.trim());
	assert.deepEqual(result, { checks: 6, rejections: 3 });
	// The TypeScript compiler is a consumer-side tool; neither the bridge nor Lean runs here.
	await saveLakeFile(consumer, "index.mts", typescript);
	const compiler = join(engineRoot, "node_modules/typescript/lib/tsc.js");
	await consumerRun(process.execPath, [compiler, "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"], consumer, env)
		.catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	const reportPath = resolve(process.env.LEAN_BRIDGE_REVIEWED_SPECIALIZATION_NPM_REPORT ?? "build/reviewed-specializations/npm.json");
	const receiptSha256 = sha256(await readFile(join(handoff, "component-package-receipt.json")));
	const identities = { ...facts[0], reviewedBindingIrSha256: hashBindingIr(reviewedNativeSpecializationIr()), receipt, receiptSha256 };
	const declarations = await readFile(join(consumer, "node_modules/specialized/index.d.ts"));
	const typescriptFacts = { strict: true, skipLibCheck: false, sourceSha256: sha256(typescript), declarationsSha256: sha256(declarations) };
	const flags = { independentBuilds: 2, reproducible, sourceRemovedBeforeInstallation, compilerFreePath: true, offlineInstall: true };
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, profile: "npm", path: "reviewed-source", ...identities, ...flags, ...result, typescript: typescriptFacts }));
});

test("CI runs the reviewed C/C++ and npm specialization gates against fresh Lean and keeps both reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const native = "          LEAN_BRIDGE_REVIEWED_SPECIALIZATION_TEST=1 LEAN_BRIDGE_REVIEWED_SPECIALIZATION_PROFILES=c,cpp node --test --test-concurrency=1 tests/reviewed-specializations.test.mjs\n          test -s build/reviewed-specializations/c-cpp.json\n";
	const npmGate = "          LEAN_BRIDGE_REVIEWED_SPECIALIZATION_NPM_TEST=1 node --test --test-name-pattern='independently reviewed npm package' tests/reviewed-specializations.test.mjs\n          test -s build/reviewed-specializations/npm.json\n";
	for(const command of [native, npmGate]) assert.equal(workflow.split(command).length, 2, command);
	// Each gate follows the configured acceptance it mirrors, in the same step.
	assert.ok(workflow.indexOf(native) > workflow.indexOf("          LEAN_BRIDGE_SPECIALIZATION_PROFILES=c,cpp node --test tests/native-specializations.test.mjs\n"));
	assert.ok(workflow.indexOf(npmGate) > workflow.indexOf("          test -s build/generic-records/specialized-npm.json\n"));
	assert.ok(workflow.includes("            build/native-specializations/c-cpp.json\n            build/reviewed-specializations/c-cpp.json\n"));
	assert.ok(workflow.includes("          name: reviewed-specializations-npm-${{ github.sha }}\n          path: build/reviewed-specializations/npm.json\n          if-no-files-found: error\n"));
});
