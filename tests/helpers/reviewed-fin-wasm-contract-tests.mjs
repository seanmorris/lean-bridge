/**
 * The Fin-only contract and shared consumer cannot borrow checks from Subtype or the harness.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference, reviewedSourceSelection, validateReviewedSource } from "../../src/analyze/reviewed-source.mjs";
import { reviewedFinWasmIr, reviewedFinWasmWide } from "./reviewed-fin-wasm-fixture.mjs";
import { executeCorpus } from "../fixtures/reviewed-fin-wasm/javascript.mjs";
import { reviewedFinWasmBuildFacts, reviewedFinWasmExpected } from "./reviewed-fin-wasm-install.mjs";
import { reviewedFinWasmTypeScript } from "./reviewed-fin-wasm-typescript.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { reviewedFinWasmMismatches, reviewedFinWasmRefusal } from "./reviewed-fin-wasm-mismatches.mjs";
import { reviewedFinBrowserProfiles, validateReviewedFinBrowserObservation } from "./reviewed-fin-wasm-browser.mjs";

const input = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
};

test("the independent reviewed Wasm Fin selections keep scalar and structural signatures separate", () => {
	for(const selection of ["scalar", "structural"])
	{
		const document = reviewedFinWasmIr(selection), review = input(document);
		validateReviewedSource(review);
		assert.equal(document.declarations.length, selection === "scalar" ? 6 : 9);
		assert.deepEqual(reviewedSourceSelection(review).exports, document.declarations.map(item => item.source.declaration).sort());
		assert.deepEqual(reviewedSourceSelection(review).arities, []);
		assert.deepEqual(document.types, [], "bare Fin aliases fold into their uses");
		assert.ok(!review.source.includes('"kind":"subtype"'));
		const declaration = name => document.declarations.find(item => item.name === name);
		const refinements = name => declaration(name).source.extensions["lean-lang.org/refinements"];
		assert.deepEqual(refinements("never"), { parameters: [{ kind: "fin", bound: "0" }], result: null });
		assert.deepEqual(refinements("only"), { parameters: [{ kind: "fin", bound: "1" }], result: null });
		assert.equal(refinements("huge").parameters[0].bound, reviewedFinWasmWide);
		assert.equal(refinements("huge").result.bound, reviewedFinWasmWide);
		assert.deepEqual(refinements("tenth"), { parameters: [null], result: { kind: "fin", bound: "10" } });
		if(selection === "structural")
		{
			const tree = refinements("nested").parameters[0];
			assert.equal(tree.kind, "list");
			assert.equal(tree.arguments[0].kind, "option");
			assert.equal(tree.arguments[0].arguments[0].kind, "tuple");
			assert.deepEqual(tree.arguments[0].arguments[0].arguments[1], {
				kind: "result"
				, arguments: [{ kind: "fin", bound: "5" }, { kind: "fin", bound: "2" }]
			});
		}
		const changed = reviewedFinWasmIr(selection);
		changed.declarations.find(item => item.name === "huge").source.extensions["lean-lang.org/refinements"].parameters[0].bound = "10";
		assert.match(reviewedContractDifference(changed, document), /source\.extensions\.lean-lang\.org\/refinements/u);
	}
	assert.throws(() => reviewedFinWasmIr("all"), /Unknown reviewed Wasm Fin selection/u);
	const modified = reviewedFinWasmIr("scalar");
	modified.declarations[0].source.extensions["lean-lang.org/refinements"].parameters[0].bound = "9";
	assert.equal(reviewedFinWasmIr("scalar").declarations[0].source.extensions["lean-lang.org/refinements"].parameters[0].bound, "10");
});

const faithfulApi = (selection = "structural") => {
	const fin = bound => value => {
		if(typeof value !== "bigint" || value < 0n || value >= bound) throw new RangeError("Fin bound");
		return value;
	};
	const array = element => values => {
		if(!Array.isArray(values)) throw new TypeError("array");
		return values.map(element);
	};
	const api = {
		mirror: value => 9n - fin(10n)(value)
		, never: fin(0n)
		, only: value => fin(1n)(value) + 7n
		, huge: fin(BigInt(reviewedFinWasmWide))
		, tenth: value => value % 10n
		, label: (before, digit, after) => before + String(fin(10n)(digit)) + after
		, rows: values => array(array(fin(10n)))(values).reverse()
		, empty: array(fin(0n))
		, nested: values => array(item => {
			if(item.tag === "none") return item;
			fin(3n)(item.value[0]);
			if("ok" in item.value[1]) fin(5n)(item.value[1].ok);
			else fin(2n)(item.value[1].error);
			return item;
		})(values).reverse()
	};
	return { ...api, raw: (name, args) => {
		try
		{ return api[name](...args); }
		catch
		{ throw new Error(`component call failed (${selection === "scalar" ? 6 : 5})`); }
	} };
};

test("the shared Fin consumer rejects permissive public or raw substitutes", () => {
	for(const selection of ["scalar", "structural"])
	{
		const request = { module: "reviewed-fin", selection }, api = faithfulApi(selection);
		const observed = executeCorpus(request, api);
		assert.deepEqual({ checks: observed.checks, rejections: observed.rejections }, reviewedFinWasmExpected[selection]);
		assert.equal(observed.module, request.module);
		assert.equal(observed.selection, selection);
		assert.throws(() => executeCorpus(request, { ...api, mirror: () => 0n }), /failed: mirror endpoints/u);
		assert.throws(() => executeCorpus(request, { ...api, never: () => 0n }), /accepted: never public bound/u);
		const lenient = (name, args) => {
			try
			{ return api.raw(name, args); }
			catch
			{ return 0n; }
		};
		assert.throws(() => executeCorpus(request, { ...api, raw: lenient }), /accepted: mirror raw bound/u);
		const wrongFailure = (name, args) => {
			try
			{ return api.raw(name, args); }
			catch
			{ throw new Error("unrelated transport failure"); }
		};
		assert.throws(() => executeCorpus(request, { ...api, raw: wrongFailure }), /wrong rejection: mirror raw bound/u);
		const wrongAbi = faithfulApi(selection === "scalar" ? "structural" : "scalar");
		assert.throws(() => executeCorpus(request, wrongAbi), /wrong rejection: mirror raw bound/u);
		if(selection === "structural")
		{
			assert.throws(() => executeCorpus(request, { ...api, empty: values => values }), /accepted: empty public bound/u);
			assert.throws(() => executeCorpus(request, { ...api, raw: (name, args) => name === "empty" ? args[0] : api.raw(name, args) }), /accepted: empty raw bound/u);
		}
	}
	assert.throws(() => executeCorpus({ module: "reviewed-fin", selection: "missing" }, faithfulApi()), /Unknown Fin selection/u);
});

test("Fin Wasm receipt checks reject changed review, source, private ABI and lowered bounds", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-wasm-facts-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const source = await readFile("tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean");
	for(const selection of ["scalar", "structural"])
	{
		// Synthetic evidence tests only the verifier. Installed tests supply fresh Lean output.
		const ir = reviewedFinWasmIr(selection), review = input(ir);
		const metadata = {
			reviewedBindingIr: review, leanCompilerSha256: "a".repeat(64)
			, metadata: { modules: [{ name: "ReviewedFin", sourceSha256: sha256(source) }] } };
		const plan = { privateAbi: { version: selection === "scalar" ? 2 : 6 }
			, exports: ir.declarations.map(item => ({ sourceDeclaration: item.source.declaration, refinements: item.source.extensions["lean-lang.org/refinements"] })) };
		const save = async (document = ir, compiled = metadata, lowered = plan) => {
			await saveLakeFile(root, "binding/binding-ir.json", canonicalJson(document));
			await saveLakeFile(root, "metadata/lake-entry-exports.json", canonicalJson(compiled));
			await saveLakeFile(root, "locks/compiler-adapters.json", canonicalJson(lowered));
		};
		await save();
		assert.equal((await reviewedFinWasmBuildFacts(root, selection, true)).reviewedSourceSha256, review.sourceSha256);
		await assert.rejects(reviewedFinWasmBuildFacts(root, selection, false));
		const changedIr = structuredClone(ir);
		changedIr.declarations[0].source.extensions["lean-lang.org/refinements"].result.bound = "11";
		await save(changedIr);
		await assert.rejects(reviewedFinWasmBuildFacts(root, selection, true));
		const wrongSource = structuredClone(metadata);
		wrongSource.metadata.modules[0].sourceSha256 = "b".repeat(64);
		await save(ir, wrongSource);
		await assert.rejects(reviewedFinWasmBuildFacts(root, selection, true));
		const wrongReview = structuredClone(metadata);
		wrongReview.reviewedBindingIr.source += " ";
		await save(ir, wrongReview);
		await assert.rejects(reviewedFinWasmBuildFacts(root, selection, true));
		await save(ir, metadata, { ...plan, privateAbi: { version: 9 } });
		await assert.rejects(reviewedFinWasmBuildFacts(root, selection, true));
		const wrongBound = structuredClone(plan);
		wrongBound.exports[0].refinements.parameters[0].bound = "11";
		await save(ir, metadata, wrongBound);
		await assert.rejects(reviewedFinWasmBuildFacts(root, selection, true));
		const ordinary = structuredClone(metadata);
		delete ordinary.reviewedBindingIr;
		await save(ir, ordinary);
		assert.equal(Object.hasOwn(await reviewedFinWasmBuildFacts(root, selection, false), "reviewedSourceSha256"), false);
	}
});

test("Fin TypeScript consumers state exact public signatures and reject erased number representations", () => {
	for(const selection of ["scalar", "structural"])
	{
		const source = reviewedFinWasmTypeScript(selection);
		assert.doesNotMatch(source, /\bany\b/u);
		assert.match(source, /Expect<Equal<typeof api\.mirror, Scalar>>/u);
		assert.match(source, /api\.label\("prefix", 9, "suffix"\)/u);
		assert.match(source, /executeCorpus\(request, await loadApi\(\)\)/u);
		assert.equal(source.includes("type Items ="), selection === "structural");
	}
	assert.throws(() => reviewedFinWasmTypeScript("missing"), /Unknown Fin selection/u);
});

test("Wasm Fin mismatch probes are admissible reviews but differ at exact compiled constraint sites", () => {
	const erased = ir => ir.declarations.map(item => ({ name: item.name, parameters: item.parameters, result: item.result }));
	for(const selection of ["scalar", "structural"])
	{
		const expected = reviewedFinWasmIr(selection), cases = reviewedFinWasmMismatches(selection);
		assert.equal(cases.length, selection === "scalar" ? 10 : 8);
		assert.equal(new Set(cases.map(item => item.label)).size, cases.length);
		for(const { label, ir, expectedField } of cases)
		{
			validateReviewedSource(input(ir));
			assert.deepEqual(erased(ir), erased(expected), label);
			assert.match(reviewedContractDifference(ir, expected), /source\.extensions\.lean-lang\.org\/refinements/u, label);
			assert.equal(expectedField, reviewedContractDifference(ir, expected), label);
		}
		assert.deepEqual(reviewedFinWasmIr(selection), expected);
	}
	assert.deepEqual(reviewedFinWasmMismatches(), reviewedFinWasmMismatches("structural"));
	assert.throws(() => reviewedFinWasmMismatches("missing"), /Unknown Wasm Fin mismatch selection/u);
});

test("Wasm Fin refusals distinguish observed fields from predicted differences and require exact fields", () => {
	const expectedField = reviewedFinWasmMismatches("scalar")[0].expectedField;
	const base = { code: "reviewed-ir-source-mismatch", message: "Reviewed contract does not match the freshly compiled Lean API" };
	const observed = { ...base, details: { field: expectedField } };
	const envelope = { ...base, details: { engine: { code: base.code } } };
	assert.deepEqual(reviewedFinWasmRefusal(observed, expectedField), { expectedField, fieldObserved: true });
	assert.deepEqual(reviewedFinWasmRefusal(envelope, expectedField), { expectedField, fieldObserved: false });
	for(const error of [
		{ ...observed, code: "build-failed" }
		, { ...observed, message: "another failure" }
		, { ...observed, details: { field: expectedField + ".other" } }
		, { ...envelope, details: { ...envelope.details, field: null } }
		, { ...base, details: {} }
		, { ...base, details: { engine: { code: "build-failed" } } }
	]) assert.throws(() => reviewedFinWasmRefusal(error, expectedField));
});

test("both reviewed Wasm ABIs reconcile changed bounds only after matching review builds and before publication", async () => {
	const source = await readFile("tests/helpers/reviewed-fin-wasm-install.mjs", "utf8");
	assert.ok(source.includes("reviewedFinWasmMismatches(selection).entries()"));
	assert.ok(source.includes("configuration(selection, true)"));
	assert.ok(source.includes("const mismatches = reviewed ? await checkMismatches(t, producers, selection) : [];"));
	assert.ok(source.includes("await assert.rejects(lstat(outputRoot), { code: \"ENOENT\" });"));
	assert.ok(source.indexOf("assert.deepEqual(facts[0], facts[1])") < source.indexOf("const mismatches = reviewed ?"));
	assert.ok(source.indexOf("const mismatches = reviewed ?") < source.indexOf("await rm(producers"));
});

test("the eight earlier structural Wasm refusal inputs remain byte-identical to their archived identities", async () => {
	const bytes = await readFile("docs/evidence/reviewed-fin-npm-20261007/reviewed-structural.json");
	assert.equal(sha256(bytes), "eb908163d52e8dfc3d24a7327eec6e7e9c366715030ab6284fe33b7c22d4af19");
	const report = JSON.parse(bytes);
	assert.deepEqual(reviewedFinWasmMismatches("structural").map(({ label, ir }) => ({ label, reviewedSourceSha256: sha256(canonicalJson(ir)) }))
		, report.mismatches.map(({ label, reviewedSourceSha256 }) => ({ label, reviewedSourceSha256 })));
});

test("Fin browser observations require the selected corpus, real realm and every rejection", () => {
	assert.deepEqual(reviewedFinBrowserProfiles, ["browser-javascript", "browser-react", "browser-worker"]);
	for(const profile of reviewedFinBrowserProfiles) for(const selection of ["scalar", "structural"])
	{
		const expected = reviewedFinWasmExpected[selection];
		const result = { schemaVersion: 1, profile, module: "reviewed-fin"
			, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
			, results: { module: "reviewed-fin", selection, ...expected }
			, hostVersion: "test-validator-only" };
		const validate = value => validateReviewedFinBrowserObservation(value, profile, selection, expected);
		validate(result);
		for(const replacement of [{ profile: "node-javascript" }
			, { module: "another-package" }, { hostVersion: "" }
			, { realm: result.realm === "window" ? "dedicated-worker" : "window" }
			, { results: { ...result.results, checks: expected.checks - 1 } }
			, { results: { ...result.results, rejections: expected.rejections - 1 } }
			, { results: { ...result.results, selection: selection === "scalar" ? "structural" : "scalar" } }])
			assert.throws(() => validate({ ...result, ...replacement }));
	}
});

test("CI requires all four Fin npm selections and all three browser engines", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const step = workflow.split(/(?=^ {6}- )/mu).find(item => item.includes("id: reviewed_fin_npm\n"));
	assert.ok(step);
	assert.doesNotMatch(step, /continue-on-error/u);
	for(const gate of ["LEAN_BRIDGE_REVIEWED_FIN_WASM_TEST", "LEAN_BRIDGE_REVIEWED_FIN_WASM_BROWSER_TEST"])
		assert.ok(step.includes(`${gate}: "1"`));
	assert.ok(step.includes("LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: chromium,firefox,webkit"));
	assert.ok(step.includes("LEAN_BRIDGE_LAKE_ENGINE: build/locked-lake-engine/bin/lean-bridge-component-engine"));
	assert.ok(step.includes("node --test --test-concurrency=1 --test-name-pattern='Fin runs in source-free installed npm packages' tests/generic-records.test.mjs"));
	for(const selection of ["scalar", "structural"]) for(const route of ["ordinary", "reviewed"])
		assert.ok(step.includes(`test -s build/reviewed-fin-wasm/${route}-${selection}.json`));
	assert.ok(workflow.includes("path: build/reviewed-fin-wasm/*.json\n          if-no-files-found: error"));
	assert.ok(workflow.includes("steps.reviewed_fin_npm.outcome != 'success'"));
	assert.equal(workflow.match(/steps\.reviewed_fin_npm\.outcome == 'success'/gu)?.length, 2);
});
