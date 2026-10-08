/**
 * Reviewed generic record instantiations: a review restates the compiler's origin of each
 * alias-named record, fresh Lean must agree, and the review never selects a compilation.
 *
 * @file
 */
import assert from "node:assert/strict";
import "./helpers/reviewed-record-promotion-tests.mjs";
import "./helpers/reviewed-instantiation-source-history-tests.mjs";
import "./helpers/reviewed-instantiation-evidence-tests.mjs";
import "./helpers/reviewed-instantiation-archive-source-history-tests.mjs";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareLakeEntryIntent } from "../src/build/lake-entry-intent.mjs";
import { resolveLakeBuildWorkspace } from "../src/build/lake-build-workspace.mjs";
import { elaborateLakeEntryModules } from "../src/build/lake-entry-elaboration.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { refinementEngineTransport } from "./helpers/refinement-engine.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { readReviewedSource, reviewedContractDifference, reviewedSourceSelection, validateReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { composedGenericRecordReview, genericRecordInstantiationReview, instantiationKey, reviewedGenericRecordSignatures } from "./helpers/reviewed-instantiation-fixture.mjs";
import { genericRecordSpecializations, specializedGenericRecordCase, specializedGenericRecordConsumer } from "./helpers/generic-record-specializations.mjs";
import { checkGenericRecordNpmPackages, genericRecordEnvironment, genericRecordInstantiations, genericRecordProvenanceOnly, genericRecordTargets, installGenericRecordConsumer } from "./helpers/generic-record-packages.mjs";

const reviewInput = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
};
const type = (ir, name) => ir.types.find(item => item.id === `lean:GenericRecords.${name}`);
const extension = name => `lean:GenericRecords.${name}.source.extensions.${instantiationKey}`;
const exports = reviewedGenericRecordSignatures.map(signature => signature.name).sort();
const nat = { kind: "primitive", name: "nat" };
const doc = { summary: "Independent corpus contract.", details: "" };
// A plain reviewed record, outside every signature, that a test can name from an argument or field.
const plain = (id, fields, extensions = {}) => ({ ...structuredClone(type(genericRecordInstantiationReview(), "Marker"))
	, id: `lean:GenericRecords.${id}`, name: id
	, fields: Object.entries(fields).map(([name, value]) => ({ name, type: value, mutability: "immutable", documentation: doc }))
	, source: { producer: "corpusReview", declaration: `GenericRecords.${id}`, extensions } });
const finField = { kind: "record", fields: [{ kind: "fin", bound: "4" }] };

test("the author recipe keeps reviewed record origins separate from compilation choices", async () => {
	const text = await readFile("docs/lean/existing-package.md", "utf8");
	const section = text.split("For an alias of a closed generic record,")[1].split("Native targets and PHP-Wasm accept")[0];
	assert.deepEqual(JSON.parse(section.match(/```json\n([\s\S]*?)\n```/u)[1]), {
		structure: "Shop.Box", arguments: [{ kind: "primitive", name: "nat" }]
	});
	assert.match(section, /identity as `lean:Shop.NatBox`/u);
	assert.match(section, /does not select a compilation or supply executable Lean text/u);
	assert.match(section, /combine these records with finite function specializations/u);
	assert.match(section, /one to sixteen closed arguments, with nesting at most 32/u);
	assert.match(section, /Phantom arguments still participate in validation/u);
});

test("a review restates every generic record instantiation and its phantom argument without changing the selection", () => {
	const review = genericRecordInstantiationReview();
	validateReviewedSource(reviewInput(review));
	assert.deepEqual(Object.keys(genericRecordInstantiations).filter(name => type(review, name).source.extensions[instantiationKey]).sort(), Object.keys(genericRecordInstantiations).sort());
	// Marker reaches the review only through MarkerTag's instantiation.
	assert.ok(!canonicalJson([...review.declarations.map(item => [item.parameters, item.result]), type(review, "MarkerTag").fields]).includes("Marker\""));
	// Lean receives the same request with or without the restated facts.
	const selection = reviewedSourceSelection(reviewInput(review));
	assert.deepEqual(selection, { exports, arities: [] });
	const bare = genericRecordInstantiationReview();
	for(const item of bare.types) delete item.source.extensions[instantiationKey];
	assert.deepEqual(reviewedSourceSelection(reviewInput(bare)), selection);
	assert.ok(!canonicalJson(selection).includes("instantiation"));
});

// Each change below breaks one rule; the refusal names the exact path and reason.
const set = (name, change) => ir => change(type(ir, name).source.extensions[instantiationKey]);
const deep = set("MaybeBox", value => {
	let argument = nat;
	for(let depth = 0; depth < 33; depth++) argument = { kind: "apply", constructor: "option", arguments: [argument] };
	value.arguments = [argument];
});
const cycle = ir => {
	ir.types.push(plain("Loop", { next: { kind: "apply", constructor: "list", arguments: [{ kind: "named", id: "lean:GenericRecords.Loop" }] } }));
	type(ir, "MarkerTag").source.extensions[instantiationKey].arguments = [{ kind: "named", id: "lean:GenericRecords.Loop" }];
};
const refinedMarker = ir => { type(ir, "Marker").source.extensions["lean-lang.org/nominal-refinements"] = finField; };
const hiddenArgument = ir => {
	refinedMarker(ir);
	ir.types.push(plain("Hidden", { inner: { kind: "apply", constructor: "option", arguments: [{ kind: "named", id: "lean:GenericRecords.Marker" }] } }));
	type(ir, "MarkerTag").source.extensions[instantiationKey].arguments = [{ kind: "named", id: "lean:GenericRecords.Hidden" }];
};
const refinedRecord = ir => { type(ir, "NatBox").source.extensions["lean-lang.org/nominal-refinements"] = { kind: "record", fields: [{ kind: "fin", bound: "10" }, null] }; };
const hiddenField = ir => {
	ir.types.push(plain("Refined", { digit: nat }, { "lean-lang.org/nominal-refinements": finField }));
	type(ir, "MarkerTag").fields.push({ name: "refined", type: { kind: "named", id: "lean:GenericRecords.Refined" }, mutability: "immutable", documentation: doc });
};
// Leaf is reached once shallowly and once 32 options deep; the cached visit must keep its height.
const options = (count, value) => count ? { kind: "apply", constructor: "option", arguments: [options(count - 1, value)] } : value;
const leaf = { kind: "named", id: "lean:GenericRecords.Leaf" };
const leafFirst = order => ir => {
	ir.types.push(plain("Leaf", { n: nat }));
	const values = [leaf, options(32, leaf)];
	type(ir, "MarkerTag").source.extensions[instantiationKey].arguments = order ? values : values.toReversed();
};
const leafField = ir => {
	ir.types.push(plain("Leaf", { n: nat }));
	type(ir, "MarkerTag").source.extensions[instantiationKey].arguments = [leaf];
	type(ir, "MarkerTag").fields.push({ name: "deep", type: options(32, leaf), mutability: "immutable", documentation: doc });
};
// Two alias-named records whose origins name each other: neither field reaches the other.
const origin = (id, other) => plain(id, { n: nat }, { [instantiationKey]: { structure: "GenericRecords.Box", arguments: [{ kind: "named", id: `lean:GenericRecords.${other}` }] } });
const originCycle = ir => { ir.types.push(origin("OriginA", "OriginB"), origin("OriginB", "OriginA")); };
// The phantom argument's own origin hides the bound; its fields carry none.
const originBound = ir => {
	refinedMarker(ir);
	ir.types.push(origin("Wrapper", "Marker"));
	type(ir, "MarkerTag").source.extensions[instantiationKey].arguments = [{ kind: "named", id: "lean:GenericRecords.Wrapper" }];
};
const onAlias = ir => { type(ir, "Boxes").source.extensions[instantiationKey] = { structure: "List", arguments: [{ kind: "named", id: "lean:GenericRecords.NatBox" }] }; };
const onDeclaration = ir => { ir.declarations.find(item => item.id === "lean:GenericRecords.bump").source.extensions[instantiationKey] = structuredClone(type(ir, "NatBox").source.extensions[instantiationKey]); };

test("malformed, misplaced, cyclic and refined instantiations are refused at their path before compilation", () => {
	const cases = [
		["an extra key", set("NatBox", value => { value.universe = 0; }), extension("NatBox"), /exactly structure and arguments/u]
		, ["a structure equal to the alias", set("NatBox", value => { value.structure = "GenericRecords.NatBox"; }), `${extension("NatBox")}.structure`, /other than the record's alias/u]
		, ["a structure that is not a Lean name", set("NatBox", value => { value.structure = "Generic Records.Box"; }), `${extension("NatBox")}.structure`, /Lean name/u]
		, ["no arguments", set("NatBox", value => { value.arguments = []; }), `${extension("NatBox")}.arguments`, /1 to 16 arguments/u]
		, ["seventeen arguments", set("NatBox", value => { value.arguments = Array(17).fill(nat); }), `${extension("NatBox")}.arguments`, /1 to 16 arguments/u]
		, ["an option with two arguments", set("MaybeBox", value => { value.arguments = [{ kind: "apply", constructor: "option", arguments: [nat, nat] }]; }), `${extension("MaybeBox")}.arguments[0]`, /closed applications/u]
		, ["an unknown constructor", set("MaybeBox", value => { value.arguments = [{ kind: "apply", constructor: "set", arguments: [nat] }]; }), `${extension("MaybeBox")}.arguments[0]`, /closed applications/u]
		, ["an unknown primitive", set("NatBox", value => { value.arguments = [{ kind: "primitive", name: "nat64" }]; }), `${extension("NatBox")}.arguments[0]`, /primitives/u]
		, ["an inline callback", set("NatBox", value => { value.arguments = [{ kind: "callback", parameters: [nat], result: nat }]; }), `${extension("NatBox")}.arguments[0]`, /primitives/u]
		, ["a named id missing from the review", set("MarkerTag", value => { value.arguments = [{ kind: "named", id: "lean:GenericRecords.Ghost" }]; }), `${extension("MarkerTag")}.arguments[0]`, /reviewed alias, record or variant/u]
		, ["nesting deeper than 32", deep, `${extension("MaybeBox")}.arguments[0]${".arguments[0]".repeat(33)}`, /nesting exceeds 32/u]
		, ["a cycle through a named argument", cycle, `${extension("MarkerTag")}.arguments[0]`, /cycle/u]
		, ["a Fin bound on a phantom argument", refinedMarker, `${extension("MarkerTag")}.arguments[0]`, /argument cannot reach a Fin bound/u]
		, ["a Fin bound hidden behind a named argument", hiddenArgument, `${extension("MarkerTag")}.arguments[0]`, /argument cannot reach a Fin bound/u]
		, ["refined fields on the instantiated record", refinedRecord, extension("NatBox"), /no refined fields/u]
		, ["a Fin bound hidden behind a named field", hiddenField, "lean:GenericRecords.MarkerTag.refined.type", /no refined fields/u]
		, ["a shallow then deep reference to one definition", leafFirst(true), `${extension("MarkerTag")}.arguments[1]${".arguments[0]".repeat(32)}`, /nesting exceeds 32/u]
		, ["a deep then shallow reference to one definition", leafFirst(false), `${extension("MarkerTag")}.arguments[0]${".arguments[0]".repeat(32)}`, /nesting exceeds 32/u]
		, ["an argument reference reused deeper in a field", leafField, `lean:GenericRecords.MarkerTag.deep.type${".arguments[0]".repeat(32)}`, /nesting exceeds 32/u]
		, ["a cycle through instantiation arguments", originCycle, `${extension("OriginA")}.arguments[0]`, /cycle/u]
		, ["a Fin bound hidden in a named argument's own instantiation", originBound, `${extension("MarkerTag")}.arguments[0]`, /argument cannot reach a Fin bound/u]
		, ["an instantiation on an alias", onAlias, "lean:GenericRecords.Boxes.source.extensions", null]
		, ["an instantiation on a declaration", onDeclaration, "lean:GenericRecords.bump.source.extensions", null]];
	for(const [label, change, path, reason] of cases)
	{
		const ir = genericRecordInstantiationReview();
		change(ir);
		assert.throws(() => validateReviewedSource(reviewInput(ir)), error => {
			assert.equal(error.code, "reviewed-ir-build-unsupported", label);
			assert.equal(error.details.path, path, label);
			if(reason) assert.match(error.message, reason, label);
			return true;
		}, label);
	}
	// The same plain records are admitted when nothing instantiated reaches their bound.
	const ir = genericRecordInstantiationReview();
	ir.types.push(plain("Refined", { digit: nat }, { "lean-lang.org/nominal-refinements": finField }), plain("Hidden", { inner: { kind: "named", id: "lean:GenericRecords.Marker" } }));
	type(ir, "MarkerTag").source.extensions[instantiationKey].arguments = [{ kind: "named", id: "lean:GenericRecords.Hidden" }];
	validateReviewedSource(reviewInput(ir));
	// A 24-level diamond chain has 2^24 paths; each definition is explored once, and the chain is admitted.
	const chain = genericRecordInstantiationReview(), link = index => ({ kind: "named", id: `lean:GenericRecords.Chain${index}` });
	for(let index = 0; index < 24; index++) chain.types.push(plain(`Chain${index}`, index === 23 ? { n: nat } : { left: link(index + 1), right: link(index + 1) }));
	type(chain, "MarkerTag").source.extensions[instantiationKey].arguments = [link(0), options(7, link(0))];
	const started = performance.now();
	validateReviewedSource(reviewInput(chain));
	assert.ok(performance.now() - started < 5_000);
});

test("a review that drops or changes an instantiation differs from the compiler at the exact extension path", () => {
	const original = genericRecordInstantiationReview();
	const index = original.types.toSorted((a, b) => a.id.localeCompare(b.id)).findIndex(item => item.id === "lean:GenericRecords.BoxPair");
	const dropped = genericRecordInstantiationReview();
	delete type(dropped, "BoxPair").source.extensions[instantiationKey];
	assert.equal(reviewedContractDifference(dropped, original), `bindingIr.types[${index}].source.extensions.${instantiationKey}`);
	const swapped = genericRecordInstantiationReview();
	type(swapped, "BoxPair").source.extensions[instantiationKey].arguments.reverse();
	assert.equal(reviewedContractDifference(swapped, original), `bindingIr.types[${index}].source.extensions.${instantiationKey}.arguments[0].id`);
	assert.equal(reviewedContractDifference(genericRecordInstantiationReview(), original), null);
});

const enabled = process.env.LEAN_BRIDGE_REVIEWED_INSTANTIATION_TEST === "1";
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
const project = async (t, review = genericRecordInstantiationReview(), composed = false) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-instantiation-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project");
	await cp("tests/fixtures/onboarding/generic-records", root, { recursive: true });
	if(composed) await saveLakeFile(root, "GenericRecords.lean", await specializedGenericRecordCase.source());
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["GenericRecords"] }));
	await saveLakeFile(root, "api.binding-ir.json", canonicalJson(review));
	return root;
};

test("the independent review reconciles every instantiation with fresh Lean, which never receives one", { skip: !enabled, timeout: 1_200_000 }, async t => {
	const result = await inspect(await project(t));
	assert.deepEqual(result.adapterHints, []);
	const request = result.elaboration.request;
	assert.deepEqual(request.exports, exports);
	assert.equal(request.specializations, undefined);
	assert.ok(!canonicalJson(request).includes("instantiation"));
	const review = genericRecordInstantiationReview();
	for(const name of Object.keys(genericRecordInstantiations))
		assert.deepEqual(type(result.bindingIr.document, name).source.extensions[instantiationKey], type(review, name).source.extensions[instantiationKey], name);
	assert.deepEqual(type(result.bindingIr.document, "Marker").source.extensions, {});
});

test("fresh Lean contradictions stop a reviewed instantiation at the exact decision", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const mismatch = (name, field) => error => {
		const index = genericRecordInstantiationReview().types.toSorted((a, b) => a.id.localeCompare(b.id)).findIndex(item => item.id === `lean:GenericRecords.${name}`);
		assert.equal(error.code, "reviewed-ir-source-mismatch");
		assert.equal(error.details.field, `bindingIr.types[${index}].source.extensions.${instantiationKey}.${field}`);
		return true;
	};
	const cases = [
		["Box Nat restated as Box String", "NatBox", ir => { type(ir, "NatBox").source.extensions[instantiationKey].arguments = [{ kind: "primitive", name: "string" }]; }, "arguments[0].name"]
		, ["another structure for the second alias", "NatBoxAgain", ir => { type(ir, "NatBoxAgain").source.extensions[instantiationKey].structure = "GenericRecords.Tagged"; }, "structure"]
		, ["swapped named arguments", "BoxPair", ir => { type(ir, "BoxPair").source.extensions[instantiationKey].arguments.reverse(); }, "arguments[0].id"]
		, ["another defined record as the phantom argument", "MarkerTag", ir => { type(ir, "MarkerTag").source.extensions[instantiationKey].arguments = [{ kind: "named", id: "lean:GenericRecords.NatBox" }]; }, "arguments[0].id"]];
	for(const [label, name, change, field] of cases)
		await t.test(label, async t => {
			const review = genericRecordInstantiationReview();
			change(review);
			validateReviewedSource(reviewInput(review));
			await assert.rejects(async () => inspect(await project(t, review)), mismatch(name, field));
		});
});

test("a composed review specializes generics over alias-instantiated records, and Lean receives only closed names", { skip: !enabled, timeout: 1_200_000 }, async t => {
	const result = await inspect(await project(t, composedGenericRecordReview(), true));
	assert.deepEqual(result.adapterHints, []);
	const request = result.elaboration.request;
	assert.deepEqual(request.specializations, genericRecordSpecializations().toSorted((a, b) => a.name < b.name ? -1 : 1));
	assert.ok(!/instantiation|@_root_/u.test(canonicalJson(request)));
	// The namespaces keep two identities over one origin; the phantom Marker stays only an origin.
	specializedGenericRecordCase.assertIr(result.bindingIr.document, "GenericRecords");
	const review = composedGenericRecordReview();
	for(const item of result.bindingIr.document.declarations.filter(entry => entry.source.extensions["lean-lang.org/specialization"]))
		assert.deepEqual(item.source.extensions["lean-lang.org/specialization"], review.declarations.find(entry => entry.id === item.id).source.extensions["lean-lang.org/specialization"], item.id);
	// A namespaced alias restated over another argument stops at its own instantiation.
	const changed = composedGenericRecordReview();
	type(changed, "Left.LeftBox").source.extensions[instantiationKey].arguments = [{ kind: "primitive", name: "string" }];
	const index = changed.types.toSorted((a, b) => a.id.localeCompare(b.id)).findIndex(item => item.id === "lean:GenericRecords.Left.LeftBox");
	await assert.rejects(async () => inspect(await project(t, changed, true)), error => error.code === "reviewed-ir-source-mismatch"
		&& error.details.field === `bindingIr.types[${index}].source.extensions.${instantiationKey}.arguments[0].name`);
});

const profiles = process.env.LEAN_BRIDGE_REVIEWED_INSTANTIATION_PROFILES?.split(",").sort() ?? [];
assert.ok(profiles.every(profile => ["c", "cpp"].includes(profile)), "Reviewed instantiation acceptance covers C and C++ first");

const checkReviewedNative = async (t, composed) => {
	const reports = [], archives = [];
	const targets = Object.fromEntries(profiles.map(profile => genericRecordTargets[profile]));
	const environment = genericRecordEnvironment(profiles);
	const review = composed ? composedGenericRecordReview() : genericRecordInstantiationReview();
	const instantiated = { ...genericRecordInstantiations, ...composed ? { "Left.LeftBox": { structure: "Box" }, "Right.RightBox": { structure: "Box" } } : {} };
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-instantiation-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-instantiation-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/generic-records", projectRoot, { recursive: true });
		if(composed) await saveLakeFile(projectRoot, "GenericRecords.lean", await specializedGenericRecordCase.source());
		// Modules and package targets only: every export decision comes from the review.
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["GenericRecords"], targets }));
		await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
		t.diagnostic(`reviewed build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		// The native model keeps each alias-named record with the structure fresh Lean resolved.
		const records = model.types.filter(item => item.kind === "record");
		assert.deepEqual(records.map(item => item.name).sort(), Object.keys(instantiated).map(name => `GenericRecords.${name}`).sort());
		for(const item of records) assert.equal(item.provenance.structure, `GenericRecords.${instantiated[item.name.slice("GenericRecords.".length)].structure}`, item.name);
		for(const name of genericRecordProvenanceOnly) assert.ok(!model.types.some(item => item.name === `GenericRecords.${name}`), name);
		for(const name of Object.keys(instantiated))
			assert.deepEqual(type(model.bindingIr, name).source.extensions[instantiationKey], type(review, name).source.extensions[instantiationKey], name);
		assert.deepEqual(model.bindingIr.declarations.map(item => item.id).sort(), review.declarations.map(item => item.id).sort());
		if(composed) specializedGenericRecordCase.assertIr(model.bindingIr, "GenericRecords");
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking reviewed ${profile}`);
			const packages = receipt.packages.filter(pkg => pkg.target === genericRecordTargets[profile][0]);
			// The same public consumers as the configured build: the review changes no public name.
			const observation = await installGenericRecordConsumer({ profile, consumer, handoff, packages, environment, ...composed ? { specialized: true, source: specializedGenericRecordConsumer } : {} });
			delete observation.command;
			const identities = { bindingIrSha256: built.bindingIrSha256, reviewedBindingIrSha256: hashBindingIr(review), modelSha256: sha256(canonicalJson(model)) };
			const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
			const decisions = { instantiations: genericRecordInstantiations, ...composed ? { specializations: genericRecordSpecializations() } : {} };
			reports.push({ profile, path: "reviewed-source", ...observation, packages, ...decisions, ...identities, receiptSha256, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	const variable = composed ? "LEAN_BRIDGE_REVIEWED_INSTANTIATION_COMPOSED_REPORT" : "LEAN_BRIDGE_REVIEWED_INSTANTIATION_REPORT";
	const reportPath = resolve(process.env[variable] ?? `build/reviewed-instantiations/${composed ? "specialized-" : ""}${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
};

test("independently reviewed C and C++ packages install every alias-named generic record from source-free archives", { skip: !profiles.length, timeout: 2_400_000 }, t => checkReviewedNative(t, false));
test("a composed review installs C and C++ specializations over alias-instantiated records in two namespaces", { skip: !profiles.length, timeout: 2_400_000 }, t => checkReviewedNative(t, true));

const npm = process.env.LEAN_BRIDGE_REVIEWED_INSTANTIATION_NPM_TEST === "1";
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const npmFixture = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-instantiation-npm-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project");
	await cp("tests/fixtures/documentation/lean-author", root, { recursive: true });
	return { directory, root };
};

test("an independently reviewed npm package keeps every alias-named record for Node and strict TypeScript", { skip: !npm, timeout: 3_600_000 }, async t => {
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	const build = (projectRoot, outputRoot) => buildCanonicalProject({ projectRoot, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() });
	const review = genericRecordInstantiationReview({ module: "OnboardingSmall", component: "onboarding-small" });
	// The same Node and TypeScript callers as the configured build: the review changes no public name.
	const observation = await checkGenericRecordNpmPackages(t, { fixture: npmFixture, build, runtimeRoot, engineRoot, review });
	const reportPath = resolve(process.env.LEAN_BRIDGE_REVIEWED_INSTANTIATION_NPM_REPORT ?? "build/reviewed-instantiations/npm.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, profile: "npm", path: "reviewed-source", reviewedBindingIrSha256: hashBindingIr(review), instantiations: genericRecordInstantiations, ...observation }));
});

test("a composed review keeps npm specializations over alias-instantiated records for Node and strict TypeScript", { skip: !npm, timeout: 3_600_000 }, async t => {
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	const build = (projectRoot, outputRoot) => buildCanonicalProject({ projectRoot, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() });
	const review = composedGenericRecordReview({ module: "OnboardingSmall", component: "onboarding-small" });
	const observation = await checkGenericRecordNpmPackages(t, { fixture: npmFixture, build, runtimeRoot, engineRoot, review, specialized: specializedGenericRecordCase });
	const reportPath = resolve(process.env.LEAN_BRIDGE_REVIEWED_INSTANTIATION_COMPOSED_NPM_REPORT ?? "build/reviewed-instantiations/specialized-npm.json");
	const decisions = { instantiations: genericRecordInstantiations, specializations: genericRecordSpecializations("OnboardingSmall") };
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, profile: "npm", path: "reviewed-source", reviewedBindingIrSha256: hashBindingIr(review), ...decisions, ...observation }));
});
