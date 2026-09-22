/**
 * Installed compiler-backed recursive copies on both source paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { checkInstalledScalars } from "./helpers/component-scalar-install.mjs";
import { recursiveReviewedIr, recursiveSignatures } from "./helpers/recursive-fixture.mjs";

const shape = ir => {
	const fields = values => values.map(({ name, type }) => ({ name, type }));
	return {
		declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
		, types: ir.types.map(type => ({ id: type.id, kind: type.kind, target: type.target, fields: fields(type.fields), cases: type.cases.map(item => ({ name: item.name, fields: fields(item.fields) })) })).sort((a, b) => a.id.localeCompare(b.id))
	};
};

test("installed npm recursive copies preserve finite values and reject cycles and excess depth", { timeout: 600_000 }, async t => checkInstalledScalars(t, {
	name: "recursive", module: "Recursive", sourceDir: "npm-recursive"
	, consumer: "recursive-consumers/npm.mjs", signatures: recursiveSignatures
	, reviewedIr: recursiveReviewedIr, check: "checkRecursive"
	, reportDir: "recursive/npm"
	, requiredRuntimeSymbol: "bridge_recursive_abi", browserTimeout: 90_000
	, assertIr: ir => assert.deepEqual(shape(ir), shape(recursiveReviewedIr()))
	, assertResult: result => { assert.equal(result.primitives, 19); assert.ok(result.checks > 1000); assert.ok(result.rejections > 30); }
	, typescript: `import * as api from "recursive";
const tree: api.Tree = { kind: "branch", children: [] };
const forest: api.Forest = api.forest([tree]);
const named: api.TreeAlias = api.joinTrees(tree, forest[0]);
const envelope: api.Envelope = { tree: named, alternatives: [forest], fallback: { tag: "some", value: tree }, outcome: { ok: [tree, named] }, marker: { tag: "some", value: { tag: "none" } } };
if (api.envelope(envelope).tree.kind !== "branch") throw new Error("Recursive record mismatch");
const left: api.LeftTree = { kind: "next", right: { kind: "many", lefts: [{ kind: "leaf", value: 42 }] } };
api.left(left); api.right({ kind: "many", lefts: [left] });
let spine: api.Spine = { kind: "leaf", value: 42 };
for (let i = 0; i < 120; i++) spine = api.grow(spine);
if (api.spine(spine).kind !== "next") throw new Error("Recursive constructor mismatch");
// @ts-expect-error A recursive branch requires a list of Tree, not numbers.
const bad: api.Tree = { kind: "branch", children: [1] }; void bad;
// @ts-expect-error Mutually recursive values retain their own constructor fields.
const wrong: api.RightTree = { kind: "next", right: left }; void wrong;
// @ts-expect-error Never has no finite nullary constructor.
const impossible: api.Never = { kind: "again" }; void impossible;
`
}));
