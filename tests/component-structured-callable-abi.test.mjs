/**
 * Closed structured callback descriptors and exact public binding semantics.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { componentStructuredCallableSignatureText, assertComponentStructuredCallableAbi,
	assertComponentStructuredCallableBindings } from "../src/abi/component-structured-callables.mjs";
import { descriptor } from "./helpers/npm-structured-callable-fixture.mjs";
const callback = ir => ir.types.find(type => type.kind === "callback").callable;
const copiedExport = ir => ir.declarations.find(item => item.name === "makeRecord");
const hostExport = ir => ir.declarations.find(item => item.name === "callRecord");
const uint32 = { kind: "primitive", name: "uint32" };

test("staged descriptors authenticate eight acyclic shapes and a finite recursive graph independently", () => {
  for(const recursive of [false, true])
{
    const ir = structuredCallableReviewedIr({ recursive }), abi = descriptor(ir);
    assertComponentStructuredCallableAbi(abi);
    assertComponentStructuredCallableBindings(abi, ir);
    assert.equal(abi.callbacks.length, recursive ? 16 : 14);
    assert.equal(abi.exports.length, recursive ? 29 : 26);
    assert.equal(abi.types.length, recursive ? 4 : 3);
    assert.deepEqual(descriptor(structuredClone(ir)), abi);
}
});

test("copied definitions are part of signature identity without depending on descriptor key order", () => {
  const abi = descriptor(structuredCallableReviewedIr({ recursive: true }));
  const signature = abi.callbacks.find(item => item.result.id === "lean:Structured.Payload");
  const source = componentStructuredCallableSignatureText(signature, abi.types);
  assert.equal(componentStructuredCallableSignatureText({ result: signature.result, parameters: signature.parameters }, abi.types.toReversed()), source);
  const changed = structuredClone(abi.types);
  changed.find(type => type.id === "lean:Structured.Payload").fields[0].type = uint32;
  assert.notEqual(componentStructuredCallableSignatureText(signature, changed), source);
  const ir = structuredCallableReviewedIr();
  for(const declaration of ir.declarations)
    for(const item of [...declaration.parameters, declaration.result])
      if(item.type.kind === "named") item.type = { id: item.type.id, kind: item.type.kind };
  assertComponentStructuredCallableBindings(descriptor(structuredCallableReviewedIr()), ir);
});

test("closed tables reject accessors, holes, unknown types and callback identities inside copies", () => {
  const original = descriptor(structuredCallableReviewedIr({ recursive: true }));
  let accessed = 0;
  const forbidden = () => { accessed++; throw new Error("accessor evaluated"); };
  const id = original.callbacks[0].id;
  const mutations = [
    value => { value.extra = true; }
    , value => { value.version = 3; }
    , value => { value.dispatch = "scalar-callable-frame-v1"; }
    , value => { Object.defineProperty(value, Symbol("extra"), { value: true }); }
    , value => { Object.defineProperty(value, "types", { get: forbidden }); }
    , value => { Object.defineProperty(value.callbacks, 0, { get: forbidden }); }
    , value => { Object.defineProperty(value.callbacks[0], "parameters", { get: forbidden }); }
    , value => { Object.defineProperty(value.callbacks[0].parameters, 0, { get: forbidden }); }
    , value => { delete value.callbacks[0]; }
    , value => { value.callbacks = []; }
    , value => { value.callbacks[1].id = value.callbacks[0].id; }
    , value => { value.callbacks[1].key = value.callbacks[0].key; }
    , value => { value.callbacks[0].id = value.types[0].id; }
    , value => { value.callbacks[0].key = "not-a-key"; }
    , value => { value.callbacks[0].parameters = []; }
    , value => { value.callbacks[0].parameters = Array(17).fill(uint32); }
    , value => { value.callbacks[0].result = { kind: "named", id }; }
    , value => { value.callbacks[0].parameters[0] = { kind: "apply", constructor: "array", arguments: [{ kind: "named", id }] }; }
    , value => { value.types.find(type => type.kind === "record").fields[0].type = { kind: "named", id }; }
    , value => { value.types.find(type => type.kind === "alias").target = { kind: "named", id }; }
    , value => { value.types.find(type => type.kind === "alias").target = { kind: "named", id: "lean:Structured.Alias" }; }
    , value => { value.types.push({ kind: "resource", id: "lean:Resource", fields: [] }); }
    , value => { value.exports[0].resultMode = "promise"; }
    , value => { value.exports[0].parameters = Array(33).fill(uint32); }
    , value => { value.exports[0].parameters = Array(1); }
    , value => { value.exports[0].parameters[0] = { kind: "named", id: "lean:Unknown" }; }
    , value => { Object.defineProperty(value.exports[0].parameters[0], "kind", { get: forbidden }); }
    , value => { value.exports[1].symbol = value.exports[0].symbol; }
    , value => { value.exports[1].bindingId = value.exports[0].bindingId; }
    , value => { value.exports = []; }
    , value => { value.exports = value.exports.filter(item => ![...item.parameters, item.result].some(type => type.id === id)); }
  ];
  for(const [index, mutate] of mutations.entries())
{
    const changed = structuredClone(original); mutate(changed);
    assert.throws(() => assertComponentStructuredCallableAbi(changed), { code: "invalid-component-structured-callable-abi" }, `mutation ${index}`);
}
  assert.equal(accessed, 0);
});

test("public binding checks preserve copied ownership, nominal meaning and synchronous callback lifetimes", () => {
  const ir = structuredCallableReviewedIr(), abi = descriptor(ir);
  for(const [index, mutate] of [
    value => { copiedExport(value).parameters[0].ownership = "borrow"; }
    , value => { copiedExport(value).parameters[0].lifetime = { scope: "call", anchor: null }; }
    , value => { copiedExport(value).result.ownership = "copy"; }
    , value => { copiedExport(value).result.lifetime.scope = "call"; }
    , value => { hostExport(value).parameters[1].ownership = "lease"; }
    , value => { hostExport(value).parameters[1].lifetime.scope = "runtime"; }
    , value => { hostExport(value).parameters[1].lifetime.anchor = "value0"; }
    , value => { hostExport(value).effects = []; }
    , value => { copiedExport(value).effects = ["host-call", "fails"]; }
    , value => { callback(value).result.ownership = "lease"; }
    , value => { callback(value).parameters[0].optional = true; }
    , value => { callback(value).parameters[0].mutability = "mutable"; }
    , value => { callback(value).parameters[0].default = []; }
    , value => { callback(value).parameters[0].type = uint32; }
    , value => { callback(value).resultMode = "promise"; }
    , value => { callback(value).invocation = "once"; }
    , value => { callback(value).reentry = "disallowed"; }
    , value => { callback(value).selfDisposal = "reject"; }
    , value => { callback(value).failure.unexpected = "ignore"; }
    , value => { callback(value).failure.errors = []; }
    , value => { callback(value).effects = ["host-call"]; }
    , value => { value.types.find(type => type.name === "Payload").fields[0].type = uint32; }
    , value => { value.types.find(type => type.name === "Alias").target = uint32; }
    , value => { value.types.find(type => type.name === "Packet").cases.reverse(); }
    , value => { value.types.pop(); }
    , value => { value.types.push(structuredClone(value.types[0])); }
    , value => { value.declarations.pop(); }
    , value => { value.declarations[1].id = value.declarations[0].id; }
    , value => { hostExport(value).parameters[0].type = { kind: "named", id: "lean:Structured.Packet" }; }
  ].entries()) {
    const changed = structuredClone(ir); mutate(changed);
    assert.throws(() => assertComponentStructuredCallableBindings(abi, changed), undefined, `mutation ${index}`);
  }
});
