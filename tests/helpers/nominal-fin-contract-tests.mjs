/**
 * Authenticate nominal constraints and exercise field validation independently.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { nominalRefinement } from "../../src/abi/refinements.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { generateCompilerAdapters, validateCompilerAdapterPlan } from "../../src/build/compiler-adapters.mjs";
import { generateComponentRecursiveAdapters } from "../../src/build/component-recursive-adapters.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { readTypeSurface } from "../../src/adoption/type-surface.mjs";
import { historicalTypeSurfaceCells as typeSurfaceCells } from "./historical-type-surface-cells.mjs";
import { beforeCallbackFinSource } from "./callback-fin-source-history.mjs";
import "./callback-coverage-repair-source-history-tests.mjs";

const fin = bound => ({ kind: "fin", bound });
const fixture = () => {
	const packet = { record: "Refinements.Packet", fields: { digit: "nat", digits: { array: "nat" }, impossible: { option: "nat" } } };
	const ir = corpusReviewedIr({ id: "refinements" }, [{ name: "Refinements.echo", parameters: [packet, packet], result: packet }]);
	ir.types[0].source.extensions["lean-lang.org/nominal-refinements"] = { kind: "record", fields: [fin("10"), { kind: "array", arguments: [fin("7")] }, { kind: "option", arguments: [fin("0")] }] };
	return ir;
};
const compile = ir => generateCompilerAdapters({ analysis: {
	bindingIr: { origin: "lean-elaborated", document: ir, semanticSha256: "1".repeat(64) }
	, exportCandidates: ir.declarations.map(item => ({ declaration: item.source.declaration, sourceModule: "Refinements", status: "exportable" }))
}
, componentPlan: { sha256: "2".repeat(64), document: { bindingIr: { semanticSha256: "1".repeat(64) } } } });

test("nominal Fin constructors are total and reject empty carriers before source dispatch", async () => {
	const generated = compile(fixture()), plan = generated.plan;
	assert.equal(plan.privateAbi.version, 8);
	await assertJsonSchema("compiler-adapter-plan", plan);
	const lean = generated.files["LeanBridgeGenerated.lean"];
	assert.match(lean, /let a0 ← \(if proof : \(a0\) < 10/);
	assert.match(lean, /: _root_\.Fin 0/);
	assert.match(lean, /value\.«digit»\)\.val/);
	assert.doesNotMatch(lean, /panic!|sorry|unsafeCast|axiom/);
	const c = generateComponentRecursiveAdapters(plan.privateAbi, plan);
	assert.match(c, /if \(!lean_is_array\(a0\) \|\| lean_array_size\(a0\) != 1\) \{ lean_dec\(a0\); lean_dec\(a1\); bridge_recursive_frame_clear\(frame\); frame->status = 5; return 5; \}/);
	assert.ok(c.indexOf("lean_array_size(a1) != 1") < c.indexOf(`${plan.exports[0].symbol}_lean(a0, a1)`));
	for(const mutate of [
		value => { value.nominalRefinements = []; }
		, value => { value.nominalRefinements.push(value.nominalRefinements[0]); }
		, value => { value.nominalRefinements[0].id = "lean:Missing"; }
		, value => { value.nominalRefinements[0].extra = true; }
		, value => { value.nominalRefinements[0].refinement = undefined; }
		, value => { value.nominalRefinements[0].refinement.fields = [null, null, null]; }
		, value => { value.nominalRefinements[0].refinement.fields.pop(); }
		, value => { value.nominalRefinements[0].refinement.fields[0] = fin("01"); }
		, value => { value.nominalRefinements[0].refinement.fields[1] = fin("7"); }
		, value => { value.nominalRefinements[0].refinement.fields[0] = { kind: "subtype", constructor: "Refinements.checked" }; }
	]) {
		const forged = structuredClone(plan); mutate(forged);
		assert.throws(() => validateCompilerAdapterPlan(forged), { code: "invalid-compiler-adapter-plan" });
	}
});

test("nominal Fin JS validators check fields after validating owned data shapes", async () => {
	const ir = fixture(), files = generateJavaScriptPackage(ir);
	const validators = await import(`data:text/javascript,${encodeURIComponent(files["internal/validators.mjs"])}`);
	const good = { digit: 9n, digits: [0n, 6n], impossible: { tag: "none" } };
	assert.equal(validators.assertPacket(good, "packet"), good);
	for(const value of [{ ...good, digit: 10n }, { ...good, digits: [7n] }, { ...good, impossible: { tag: "some", value: 0n } }])
		assert.throws(() => validators.assertPacket(value, "packet"), /below/);
	let reads = 0;
	const getter = { ...good };
	Object.defineProperty(getter, "digit", { get: () => { reads++; return 0n; }, enumerable: true });
	assert.throws(() => validators.assertPacket(getter, "packet"), /own data fields/);
	assert.equal(reads, 0);
	const sparse = []; sparse.length = 2;
	assert.throws(() => validators.assertPacket({ ...good, digits: sparse }, "packet"), /dense data array/);
	assert.throws(() => nominalRefinement(ir.types[0], { kind: "record", fields: Array(3) }));
	assert.throws(() => nominalRefinement(ir.types[0], { kind: "record", fields: [fin("10"), null, null], extra: true }));
});

test("nominal Fin components also reject invalid scalar refinements before dispatch", () => {
	const ir = fixture(), declaration = ir.declarations[0];
	declaration.parameters.push({ ...declaration.parameters[0], name: "digit", type: { kind: "primitive", name: "nat" } });
	declaration.source.extensions["lean-lang.org/refinements"] = { parameters: [null, null, fin("3")], result: null };
	const generated = compile(ir), plan = generated.plan, symbol = plan.exports[0].symbol;
	assert.match(generated.files["LeanBridgeGenerated.lean"], new RegExp(`@\\[export ${symbol}_refinement_2\\]`));
	const c = generateComponentRecursiveAdapters(plan.privateAbi, plan);
	assert.match(c, new RegExp(`if \\(!${symbol}_refinement_2\\(a2\\)\\) \\{ lean_dec\\(a0\\); lean_dec\\(a1\\); lean_dec\\(a2\\); bridge_recursive_frame_clear\\(frame\\); frame->status = 5; return 5;`));
	assert.ok(c.indexOf(`${symbol}_refinement_2(a2)`) < c.indexOf(`${symbol}_lean(a0, a1, a2)`));
});

test("nominal Fin constraints authenticate alias targets and exact variant branches", () => {
	const alias = { kind: "alias", target: { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "nat" }] } };
	assert.deepEqual(nominalRefinement(alias, { kind: "alias", target: { kind: "array", arguments: [fin("0")] } }),
		{ kind: "alias", target: { kind: "array", arguments: [fin("0")] } });
	for(const target of [null, fin("7"), { kind: "array", arguments: [null] }, { kind: "array", arguments: [{ kind: "subtype", constructor: "Refinements.checked" }] }])
		assert.throws(() => nominalRefinement(alias, { kind: "alias", target }));
	const variant = { kind: "variant", cases: [{ fields: [] }, { fields: [{ type: { kind: "primitive", name: "nat" } }] }] };
	assert.deepEqual(nominalRefinement(variant, { kind: "variant", cases: [[], [fin("0")]] }), { kind: "variant", cases: [[], [fin("0")]] });
	for(const cases of [[], [[fin("0")], []], [[], []], [[], [null]], Array(2)])
		assert.throws(() => nominalRefinement(variant, { kind: "variant", cases }));
});

test("nominal Fin installed evidence promotes only the two ordinary Node field cells", async () => {
	const { irSchema, consumers } = await readTypeSurface();
	// Check this milestone's authenticated inventory, not the support added later.
	const path = "docs/type-surface.v1.json";
	const source = beforeCallbackFinSource(path, await readFile(path, "utf8"));
	assert.equal(sha256(source), "63ad1461dd5ba00fe766618308441c7fc1fe3a8c2d19d80c8a091f4435a7e103");
	const document = JSON.parse(source);
	const cells = typeSurfaceCells(document, { irSchema, consumers }).filter(cell => cell.shape === "fin");
	const fields = cells.filter(cell => cell.position === "field" && cell.stages.installedExecution.state === "passed");
	assert.deepEqual(fields.map(cell => cell.profile).sort(), ["node-javascript", "node-typescript"]);
	for(const cell of fields)
	{
		assert.equal(cell.path, "ordinary-source");
		for(const stage of Object.values(cell.stages)) assert.deepEqual(stage.evidence, ["npm-nominal-fin-installed"]);
	}
	for(const cell of cells.filter(cell => cell.path === "reviewed-ir" || cell.position.startsWith("callback-") && !["node-javascript", "node-typescript"].includes(cell.profile)))
		assert.equal(cell.stages.installedExecution.state, "unreviewed", cell.id);
});

const callbackFinCoverage = [
	[["node-javascript", "node-typescript"], "ordinary-source", ["npm-callback-fin-installed"]]
	, [["node-javascript", "node-typescript"], "reviewed-ir", ["reviewed-callback-fin-npm-r1-installed", "reviewed-callback-fin-npm-r2-installed"]]
	, [["browser-javascript", "browser-react", "browser-worker"], "ordinary-source", ["browser-callback-fin-ordinary-installed"]]
	, [["c", "cpp"], "ordinary-source", ["native-callback-fin-ordinary-installed"]]
	, [["c", "cpp"], "reviewed-ir", ["reviewed-callback-fin-c-cpp-installed"]]
];

/**
 * Check each observed host, source route, position and stage against the recorded evidence.
 *
 * @param cells - Installed callback-Fin cells from the current inventory.
 */
const assertCallbackFinCoverage = cells => {
	const expected = new Map(callbackFinCoverage.flatMap(([profiles, path, evidence]) => profiles.flatMap(profile =>
		["callback-parameter", "callback-result"].map(position => [`${profile}/fin/${path}/${position}`, evidence]))));
	assert.deepEqual(cells.map(cell => cell.id).sort(), [...expected.keys()].sort());
	for(const cell of cells)
	{
		assert.equal(cell.id, `${cell.profile}/${cell.shape}/${cell.path}/${cell.position}`);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed", cell.id);
			assert.deepEqual(stage.evidence, expected.get(cell.id), cell.id);
		}
	}
};

const installedCallbackFinCells = async () => {
	const { document, irSchema, consumers } = await readTypeSurface();
	return typeSurfaceCells(document, { irSchema, consumers }).filter(cell => cell.shape === "fin" && cell.position.startsWith("callback-") && cell.stages.installedExecution.state === "passed");
};

test("Fin callback evidence matches every promoted host, source path, position and evidence set", async () => {
	assertCallbackFinCoverage(await installedCallbackFinCells());
});

test("callback Fin coverage rejects missing cells, extra hosts and evidence borrowed from another route", async () => {
	const cells = await installedCallbackFinCells();
	const mutations = [
		changed => { changed.pop(); }
		, changed => { changed.push(structuredClone(changed[0])); }
		, changed => { changed[0].profile = "php-native"; }
		, changed => { changed[0].path = "reviewed-ir"; }
		, changed => { changed[0].position = "field"; }
		, changed => { changed[0].stages.compilation.state = "unreviewed"; }
		, changed => { changed[0].stages.installedExecution.evidence = ["native-callback-fin-ordinary-installed"]; }
		, changed => { changed.find(cell => cell.id === "c/fin/reviewed-ir/callback-result").stages.installedExecution.evidence = ["native-callback-fin-ordinary-installed"]; }
	];
	for(const mutate of mutations)
	{
		const changed = structuredClone(cells); mutate(changed);
		assert.throws(() => assertCallbackFinCoverage(changed), assert.AssertionError);
	}
});
