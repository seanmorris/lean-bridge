/**
 * Keep C callable admission distinct from unimplemented host projections.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";

test("only explicit C callable admission accepts all nineteen primitive signatures", () => {
	const ir = callableReviewedIr();
	assert.throws(() => compilePrimitiveCSurface(ir), { code: "unsupported-native-c-signature" });
	const surface = compilePrimitiveCSurface(ir, { callables: true });
	assert.equal(surface.callbacks.size, 38); assert.equal(surface.copies.length, 19);
	assert.equal(surface.functions.length, 58);
});

for(const [name, change] of Object.entries({
	"retained host callback": ir => { ir.declarations[0].parameters[1].lifetime.scope = "explicit"; }
	, "asynchronous callback": ir => { ir.types[0].callable.resultMode = "promise"; }
	, "unreported host failure": ir => { ir.declarations[0].failure.mode = "none"; }
	, "once-only callback": ir => { ir.types[0].callable.invocation = "once"; }
	, "immediate self-disposal": ir => { ir.types[0].callable.selfDisposal = "reject"; }
	, "callback copied container": ir => { ir.types[0].callable.result.type = { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "uint8" }] }; }
	, "reserved callback argument": ir => { ir.types[0].callable.parameters[0].name = "context"; }
	, "optional callback argument": ir => { ir.types[0].callable.parameters[0].optional = true; }
})) test(`C admission rejects ${name}`, () => {
	const ir = callableReviewedIr(); change(ir);
	assert.throws(() => compilePrimitiveCSurface(ir, { callables: true }), { code: "unsupported-native-c-signature" });
});

test("public C callable wrappers release failed allocations and reject null dynamic arguments", () => {
	const source = generateCBindingPackage(callableReviewedIr())["src/callables.c"];
	assert.match(source, /if \(owned == NULL\) \{\s+if \(callables_runtime->callback[0-9a-f]+_dispose/);
	assert.match(source, /if \(self == NULL \|\| out == NULL \|\| value1 == NULL\)/);
});
