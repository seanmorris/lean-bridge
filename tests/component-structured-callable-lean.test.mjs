/**
 * Typed Array carriers and copied codec roots for structured callback adapters.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { assertComponentRecursiveAbi } from "../src/abi/component-recursive-abi.mjs";
import { componentRecursiveTypes } from "../src/build/component-recursive-lean.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { descriptor, sourceExports } from "./helpers/npm-structured-callable-fixture.mjs";
import { componentStructuredCopiedView, componentStructuredCallableLeanSource } from "../src/build/component-structured-callable-lean.mjs";

const hostProjection = {
	name: "Structured.HostNull"
	, nullConstructor: "Structured.HostNull.null"
	, valueConstructor: "Structured.HostNull.value"
};
const hostNullIr = () => {
	const ir = structuredClone(structuredCallableReviewedIr());
	const replace = type => {
		if(type.kind !== "apply") return type;
		const arguments_ = type.arguments.map(replace);
		return type.constructor === "option" && arguments_[0]?.kind === "apply"
      && arguments_[0].constructor === "option" && arguments_[0].arguments[0]?.name === "unit"
			? { kind: "apply", constructor: "host-null", arguments: [arguments_[0]] }
			: { ...type, arguments: arguments_ };
	};
	for(const type of ir.types)
	{
		if(type.kind === "alias") type.target = replace(type.target);
		if(type.kind === "record") type.fields.forEach(field => { field.type = replace(field.type); });
		if(type.kind === "variant") type.cases.forEach(branch => branch.fields.forEach(field => { field.type = replace(field.type); }));
		if(type.kind === "callback")
		{
			type.callable.parameters.forEach(parameter => { parameter.type = replace(parameter.type); });
			type.callable.result.type = replace(type.callable.result.type);
		}
	}
	for(const item of ir.declarations)
	{
		item.parameters.forEach(parameter => { parameter.type = replace(parameter.type); });
		item.result.type = replace(item.result.type);
	}
	return ir;
};

test("copied root catalogs include callable payloads while excluding identity carriers", () => {
  const abi = descriptor(structuredCallableReviewedIr({ recursive: true }));
  const view = componentStructuredCopiedView(abi);
  assertComponentRecursiveAbi(view);
  const types = componentRecursiveTypes(view);
  assert.ok(types.some(type => type.id === "lean:Structured.Tree"));
  assert.ok(types.some(type => type.id === "lean:Structured.Payload"));
  for(const callback of abi.callbacks) assert.ok(!types.some(type => type.id === callback.id));
  assert.equal(view.exports[0].symbol, abi.exports[0].symbol);
});

test("all callback, closure and exported arguments use typed one-element Array carriers", () => {
  for(const recursive of [false, true])
{
    const ir = structuredCallableReviewedIr({ recursive }), abi = descriptor(ir);
    const exports = sourceExports(ir, abi);
    const source = componentStructuredCallableLeanSource(abi, exports).join("\n");
    assert.doesNotMatch(source, /undefined|unsafe|sorry|panic!|lean_ctor|Inhabited/);
    for(const signature of abi.callbacks)
{
      assert.ok(source.includes(`opaque invoke_${signature.key}`));
      assert.ok(source.includes(`def wrap_${signature.key}`));
      assert.ok(source.includes(`def apply_${signature.key}`));
}
    for(const item of exports) assert.ok(source.includes(`@[export ${item.symbol}_lean]`));
    assert.match(source, /\(_root_\.Array \(_root_\.Bool → _root_\.Structured\.Payload → _root_\.Structured\.Payload\)\)/);
    assert.match(source, /_root_\.Except \(_root_\.Array _root_\.String\) \(_root_\.Option _root_\.UInt32\)/);
    assert.match(source, /let closure ← carrierValue closure/);
    assert.match(source, /\| \.none => callbackDefault_[a-f0-9]{20}/);
    assert.match(source, /_root_\.Structured\.retainRecord a0/);
    assert.deepEqual(componentStructuredCallableLeanSource(abi, exports).join("\n"), source);
    assert.throws(() => componentStructuredCallableLeanSource(abi, exports.slice(1)), /count mismatch/);
    const changed = structuredClone(exports); changed[1] = changed[0];
    assert.throws(() => componentStructuredCallableLeanSource(abi, changed), /identity mismatch/);
}
});

test("structured callbacks use the exact compiler-authenticated HostNull wrapper and constructors", () => {
  const ir = hostNullIr(), abi = descriptor(ir), exports = sourceExports(ir, abi);
  assert.throws(() => componentStructuredCallableLeanSource(abi, exports), /HostNull.*projection/);
  const source = componentStructuredCallableLeanSource(abi, exports, { hostProjection }).join("\n");
  assert.match(source, /_root_\.Structured\.HostNull \(_root_\.Option _root_\.Unit\)/);
  assert.match(source, /_root_\.Structured\.HostNull\.null/);
  assert.match(source, /_root_\.Structured\.HostNull\.value/);
  assert.doesNotMatch(source, /unsafeCast|sorry|axiom/);
  assert.deepEqual(componentStructuredCallableLeanSource(abi, exports, { hostProjection }).join("\n"), source);
});
