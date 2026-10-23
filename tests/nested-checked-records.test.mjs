/**
 * Fresh-Lean acceptance for nested checked records with Fin and Subtype payload fields.
 * Synthetic mirror checks live separately in nested-checked-record-foundation.test.mjs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import "./helpers/promotion-doc-milestone-replay-repair-source-history-tests.mjs";
import "./helpers/nested-promotion-doc-milestone-repair-source-history-tests.mjs";
import "./helpers/nested-checked-record-npm-installed-tests.mjs";
import "./helpers/nested-checked-record-browser-ci-tests.mjs";
import "./helpers/nested-checked-record-browser-ci-workflow-tests.mjs";
import "./helpers/nested-checked-record-browser-promotion-tests.mjs";
import "./helpers/nested-checked-record-browser-promotion-history-tests.mjs";
import "./helpers/nested-checked-record-archive-gap-history-tests.mjs";
import "./helpers/nested-checked-record-native-correction-source-history-tests.mjs";
import "./helpers/nested-checked-record-native-archive-tests.mjs";
import "./helpers/nested-checked-record-native-ci-policy-tests.mjs";
import "./helpers/nested-checked-record-native-ci-shell-tests.mjs";
import "./helpers/nested-checked-record-native-ci-workflow-tests.mjs";
import "./helpers/nested-checked-record-native-promotion-tests.mjs";
import "./helpers/nested-checked-record-native-promotion-history-tests.mjs";
import "./helpers/nested-checked-record-python-tests.mjs";
import "./helpers/inherited-checked-record-promotion-tests.mjs";
import "./helpers/inherited-checked-record-promotion-source-history-tests.mjs";
import "./helpers/recursive-checked-record-promotion-tests.mjs";
import "./helpers/recursive-checked-record-promotion-source-history-tests.mjs";
import "./helpers/recursive-checked-record-documentation-closure-source-history-tests.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { reviewedContractDifference, reviewedSourceSelection, validateReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { createComponentBuildPlan } from "../src/build/component-plan.mjs";
import { generateCompilerAdapters, validateCompilerAdapterPlan } from "../src/build/compiler-adapters.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { prepareLakeEntryIntent } from "../src/build/lake-entry-intent.mjs";
import { elaborateLakeEntryModules } from "../src/build/lake-entry-elaboration.mjs";
import { resolveLakeBuildWorkspace } from "../src/build/lake-build-workspace.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { assertJsonSchema, jsonSchemaErrors } from "./helpers/json-schema.mjs";
import {
	nestedCheckedRecordConfiguration,
	nestedCheckedRecordFixture,
	nestedCheckedRecordModule,
	nestedCheckedRecordReview
} from "./helpers/nested-checked-record-fixture.mjs";
import {
	nestedCheckedRecordNpmPositions,
	nestedCheckedRecordNpmRoutes,
	nestedCheckedRecordNpmSelection
} from "./helpers/nested-checked-record-npm-fixture.mjs";

const enabled = process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_LEAN_TEST === "1";
const leanPrefix = join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const reviewInput = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
};
const exportNamed = (model, name) => model.exports.find(item => item.name === `${nestedCheckedRecordModule}.${name}`);

const compile = async (t, route, evaluate = false) => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-nested-checked-${route}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(nestedCheckedRecordFixture, projectRoot, { recursive: true });
	await writeFile(join(projectRoot, "lean-bridge.exports.json")
		, canonicalJson(nestedCheckedRecordConfiguration(route, ["c"])));
	if(route === "reviewed") await writeFile(join(projectRoot, "api.binding-ir.json")
		, canonicalJson(nestedCheckedRecordReview()));
	let captured;
	try
	{
		await buildElaboratedComponent({
			projectRoot, outputRoot: join(directory, "out"), leanPrefix, targets: ["c"]
			, profile: "native-library-v1", receiptName: "native-component.json"
			, createModel: input => createCompiledNativeModel(input, { nativeRefinements: true })
			, createAdapters: generateCompiledNativeLeanAdapters
			, compileComponent: async ({ model, adapters, metadata }) => {
				captured = { model, adapters, metadata };
				throw Object.assign(new Error("stop before C"), { code: "stop-before-c" });
			}
		});
	}
	catch(error)
	{
		if(error.code !== "stop-before-c")
			throw Object.assign(new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error })
				, { code: error.code });
	}
	assert.ok(captured);
	if(evaluate)
	{
		const source = await readFile(join(nestedCheckedRecordFixture, `${nestedCheckedRecordModule}.lean`), "utf8");
		const call = name => `${captured.adapters.module}.f_${exportNamed(captured.model, name).symbol}`;
		const evaluations = [
			[`[${call("inArray")} #[⟨2, 3⟩, ⟨4, 5⟩], ${call("inArray")} #[⟨2, 3⟩, ⟨4, 0⟩], ${call("inArray")} #[⟨2, 3⟩, ⟨10, 12⟩], ${call("inArray")} #[⟨2, 3⟩, ⟨7, 3⟩], ${call("inArray")} #[⟨2, 3⟩, ⟨4, 5⟩], ${call("second")} ⟨9, 0⟩]`
				, "[some 8, none, none, none, some 8, some 10]"]
			, [`(${call("produceArray")} 4).map (fun packet => (packet.«digit», packet.«word»))`
				, "#[(0, 5), (0, 6)]"]
		];
		const runtime = join(directory, "Runtime.lean");
		await writeFile(runtime, [source
			, captured.adapters.leanSource.replace(new RegExp(`^import ${nestedCheckedRecordModule}$`, "mu"), "")
			, ...evaluations.map(([expression]) => `#eval ${expression}`)].join("\n"));
		const checked = await processBuildRunner.capture({ command: join(leanPrefix, "bin/lean")
			, args: [runtime], cwd: directory, timeoutMs: 600_000 }).catch(error => {
			throw Object.assign(new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error })
				, { code: error.code });
			});
		assert.deepEqual(checked.stdout.trim().split("\n"), evaluations.map(([, expected]) => expected));
	}
	return captured;
};

const compileComponent = async (t, route, selection) => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-nested-component-${route}-${selection}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(nestedCheckedRecordFixture, projectRoot, { recursive: true });
	await writeFile(join(projectRoot, "lean-bridge.exports.json")
		, canonicalJson(nestedCheckedRecordConfiguration(route, ["npm"], selection)));
	const expected = nestedCheckedRecordReview(selection);
	if(route === "reviewed") await writeFile(join(projectRoot, "api.binding-ir.json"), canonicalJson(expected));
	const intent = await prepareLakeEntryIntent({ projectRoot });
	const workspace = await resolveLakeBuildWorkspace({ snapshot: intent.lakeSnapshot
		, modules: intent.document.modules.map(entry => entry.module), leanPrefix });
	let analysis;
	try
	{
		analysis = await elaborateLakeEntryModules({ inventory: await inspectLeanProject(projectRoot)
			, entries: intent.document.modules
			, workspace
			, leanPrefix
			, engineRoot: process.cwd()
			, reviewedBindingIr: intent.document.reviewedBindingIr });
	}
	finally
	{ await workspace.dispose(); }
	await assertJsonSchema("elaborated-export-metadata", analysis.elaboration.metadata);
	assert.equal(reviewedContractDifference(expected, analysis.bindingIr.document), null);
	const graph = JSON.parse(await readFile("poc/lean-link-spike/graph-lock.json", "utf8"));
	const componentPlan = createComponentBuildPlan({
		analysis, runtime: graph.runtime, targets: ["npm"]
		, lakeSnapshotSha256: intent.lakeSnapshot.sha256 });
	const generated = generateCompilerAdapters({ analysis, componentPlan });
	validateCompilerAdapterPlan(generated.plan);
	await assertJsonSchema("compiler-adapter-plan", generated.plan);
	const fixture = await readFile(join(nestedCheckedRecordFixture, `${nestedCheckedRecordModule}.lean`), "utf8");
	const source = generated.files["LeanBridgeGenerated.lean"];
	await writeFile(join(directory, "Generated.lean")
		, `${fixture}\n${source.replace(new RegExp(`^import ${nestedCheckedRecordModule}$`, "mu"), "")}`);
	const checked = await processBuildRunner.capture({ command: join(leanPrefix, "bin/lean")
		, args: ["-c", join(directory, "Generated.c"), "Generated.lean"]
		, cwd: directory
		, timeoutMs: 600_000 })
		.catch(error => {
			throw Object.assign(new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error })
				, { code: error.code });
		});
	assert.equal(checked.stdout, "");
	assert.equal(checked.stderr, "");
	return { analysis, plan: generated.plan, source };
};

test("the independent nested checked-record review selects only input constructors", async () => {
	const review = nestedCheckedRecordReview(), input = reviewInput(review);
	validateReviewedSource(input);
	await assertJsonSchema("lean-export-configuration", nestedCheckedRecordConfiguration("ordinary", ["c", "npm"]));
	await assertJsonSchema("lean-export-configuration", nestedCheckedRecordConfiguration("reviewed", ["c", "npm"]));
	const emptyCheckedRecord = nestedCheckedRecordConfiguration("ordinary", ["npm"]);
	emptyCheckedRecord.contracts[`${nestedCheckedRecordModule}.first`]
		.parameters[0].refinement.fields = [];
	assert.notEqual(await jsonSchemaErrors("lean-export-configuration", emptyCheckedRecord), null);
	const selection = reviewedSourceSelection(input);
	assert.equal(Object.keys(selection.contracts).length, 11);
	assert.equal(selection.contracts[`${nestedCheckedRecordModule}.first`].parameters[0].refinement.constructor
		, `${nestedCheckedRecordModule}.mkPacket`);
	assert.equal(selection.contracts[`${nestedCheckedRecordModule}.pair`].parameters[1].refinement.fields[1].refinement.constructor
		, `${nestedCheckedRecordModule}.normalizeWord`);
	assert.equal(selection.contracts[`${nestedCheckedRecordModule}.produceOption`], undefined);
	const first = review.declarations.find(item => item.name === "first").source.extensions["lean-lang.org/refinements"].parameters[0];
	const produced = review.declarations.find(item => item.name === "produceArray").source.extensions["lean-lang.org/refinements"].result.arguments[0];
	assert.equal(await jsonSchemaErrors("compiler-adapter-plan#/$defs/refinement", first), null);
	assert.equal(await jsonSchemaErrors("compiler-adapter-plan#/$defs/resultRefinement", produced), null);
	assert.notEqual(await jsonSchemaErrors("compiler-adapter-plan#/$defs/refinement", produced), null);
	for(const route of nestedCheckedRecordNpmRoutes)
	{
		const packageSelection = nestedCheckedRecordNpmSelection(route);
		validateReviewedSource(reviewInput(packageSelection.expected));
		await assertJsonSchema("lean-export-configuration", packageSelection.configuration);
		assert.equal(packageSelection.expected.declarations.length, packageSelection.resultOnly ? 2 : 13);
		assert.equal(Object.hasOwn(packageSelection.configuration, "exports"), !packageSelection.reviewed);
	}
	assert.deepEqual(nestedCheckedRecordNpmPositions["result-only"], [
		"produceOption.result?", "produceArray.result[*]"
	]);
	assert.deepEqual(nestedCheckedRecordNpmPositions.full, [
		"first.arg0", "second.arg0", "pair.arg0", "pair.arg1"
		, "inArray.arg0[*]", "inList.arg0[*]", "inOption.arg0?"
		, "inProduct.arg0.0", "inProduct.arg0.1"
		, "inExcept.arg0.ok", "inExcept.arg0.error"
		, "inHolder.arg0.packet", "inChoice.arg0.packet.value"
		, "echoArray.arg0[*]", "echoArray.result[*]"
		, "produceOption.result?", "produceArray.result[*]"
	]);
});

test("component plans preserve complete nested checked-record trees", async () => {
	const expected = nestedCheckedRecordReview();
	const generated = generateCompilerAdapters({ analysis: {
		bindingIr: { origin: "lean-elaborated", document: expected, semanticSha256: "1".repeat(64) }
		, exportCandidates: expected.declarations.map(declaration => ({
			declaration: declaration.source.declaration
			, sourceModule: nestedCheckedRecordModule
			, status: "exportable"
		}))
	}
	, componentPlan: { sha256: "2".repeat(64)
	, document: {
		bindingIr: { semanticSha256: "1".repeat(64) }
	} } });
	validateCompilerAdapterPlan(generated.plan);
	await assertJsonSchema("compiler-adapter-plan", generated.plan);
	assert.equal(generated.plan.privateAbi.version, 8);
	assert.deepEqual(generated.plan.privateAbi.types.find(type => type.id === `lean:${nestedCheckedRecordModule}.Packet`).erased
		, ["linked"]);
	assert.equal(generated.plan.exports.length, 13);
	for(const item of generated.plan.exports)
	{
		const declaration = expected.declarations.find(candidate => candidate.id === item.bindingId);
		assert.deepEqual(item.refinements, declaration.source.extensions["lean-lang.org/refinements"]);
	}
	const source = generated.files["LeanBridgeGenerated.lean"];
	assert.doesNotMatch(source, /\b(?:sorry|axiom|unsafe|partial|unsafeCast)\b|_root_\.(?:null|undefined)/u);
	for(const name of ["mkPacket", "normalizePacket", "mkWord", "normalizeWord"])
		assert.match(source, new RegExp(`_root_\\.${nestedCheckedRecordModule}\\.${name}`, "u"));
	const result = structuredClone(generated.plan);
	result.exports.find(item => item.sourceDeclaration.endsWith("produceArray"))
		.refinements.result.arguments[0].constructor = `${nestedCheckedRecordModule}.mkPacket`;
	assert.throws(() => validateCompilerAdapterPlan(result), { code: "invalid-compiler-adapter-plan" });
	assert.notEqual(await jsonSchemaErrors("compiler-adapter-plan", result), null);
});

test("fresh Lean reconciles ordinary and reviewed nested checked records and compiles their adapters"
	, { skip: !enabled, timeout: 1_800_000 }, async t => {
	const expected = nestedCheckedRecordReview();
	const ordinary = await compile(t, "ordinary", true), reviewed = await compile(t, "reviewed");
	for(const { model, metadata } of [ordinary, reviewed])
	{
		await assertJsonSchema("elaborated-export-metadata", metadata);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		const first = exportNamed(model, "first").refinements.parameters[0];
		assert.deepEqual(first, {
			kind: "checked-record", definition: `${nestedCheckedRecordModule}.Packet`
			, constructor: `${nestedCheckedRecordModule}.mkPacket`
			, fields: ["digit", "word"]
			, arguments: [{ kind: "fin", bound: "10" }
				, { kind: "subtype", constructor: `${nestedCheckedRecordModule}.mkWord` }] });
		assert.equal(exportNamed(model, "pair").refinements.parameters[1].constructor
			, `${nestedCheckedRecordModule}.normalizePacket`);
		assert.equal(exportNamed(model, "inArray").refinements.parameters[0].arguments[0].definition
			, `${nestedCheckedRecordModule}.Packet`);
		assert.equal(exportNamed(model, "inHolder").refinements.parameters[0].arguments[0].constructor
			, `${nestedCheckedRecordModule}.normalizePacket`);
		assert.equal(exportNamed(model, "inChoice").refinements.parameters[0].cases[1].arguments[0].constructor
			, `${nestedCheckedRecordModule}.mkPacket`);
		const produced = exportNamed(model, "produceArray").refinements.result.arguments[0];
		assert.equal(produced.constructor, null);
		assert.deepEqual(produced.arguments, [{ kind: "fin", bound: "10" }
			, { kind: "subtype", constructor: null }]);
	}
	assert.equal(ordinary.adapters.leanSource, reviewed.adapters.leanSource);
	}
);

test("fresh component metadata and adapters agree for full and result-only author routes"
	, { skip: !enabled, timeout: 1_800_000 }, async t => {
	for(const selection of ["result-only", "full"])
	{
		const ordinary = await compileComponent(t, "ordinary", selection);
		const reviewed = await compileComponent(t, "reviewed", selection);
		const expected = nestedCheckedRecordReview(selection);
		const count = selection === "full" ? 13 : 2;
		for(const item of [ordinary, reviewed])
		{
			assert.equal(item.plan.exports.length, count);
			assert.deepEqual(item.plan.exports.map(entry => entry.sourceDeclaration)
				, expected.declarations.map(declaration => declaration.source.declaration).toSorted());
			for(const entry of item.plan.exports)
			{
				const declaration = expected.declarations.find(candidate => candidate.id === entry.bindingId);
				assert.deepEqual(entry.refinements, declaration.source.extensions["lean-lang.org/refinements"]);
			}
		}
		assert.equal(ordinary.source, reviewed.source);
	}
	}
);
