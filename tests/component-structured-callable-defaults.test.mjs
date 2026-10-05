/**
 * Finite typed recovery recipes for copied callback results.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { componentRecordDefinitions } from "../src/abi/component-records.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { componentStructuredCallableDefaults } from "../src/build/component-structured-callable-defaults.mjs";

const named = id => ({ kind: "named", id: `lean:${id}` });
const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
const uint32 = { kind: "primitive", name: "uint32" };
const fields = (...types) => types.map((type, index) => ({ name: `field${index}`, type }));
const branch = (name, ...types) => ({ name, fields: fields(...types) });

test("typed recovery recipes cover every current callback result without native constructor guesses", () => {
  const ir = structuredCallableReviewedIr({ recursive: true });
  const definitions = componentRecordDefinitions({ types: ir.types.filter(type => type.kind !== "callback") }, true);
  const defaults = componentStructuredCallableDefaults(definitions);
  for(const type of ir.types.filter(type => type.kind === "callback"))
    assert.ok(defaults.expression(type.callable.result.type));
  assert.equal(defaults.recipes.length, 4);
  assert.equal(defaults.recipes.find(item => item.id === "lean:Structured.Tree").branch, "leaf");
  assert.doesNotMatch(defaults.declarations.join("\n"), /unsafe|sorry|Inhabited|panic|lean_ctor|lean_box/);
});

test("recursive-first variants select a productive branch without recursively expanding a schema", () => {
  const type = { kind: "variant", id: "lean:Example.Tree", cases: [branch("next", named("Example.Tree")), branch("leaf", uint32)] };
  const defaults = componentStructuredCallableDefaults([type]);
  assert.equal(defaults.recipes.length, 1);
  assert.equal(defaults.recipes[0].branch, "leaf");
  assert.match(defaults.declarations[0], /Example\.Tree\.«leaf» \(0\)/);
});

test("mutually recursive definitions become productive through empty copied containers", () => {
  const types = [
    { kind: "record", id: "lean:Example.A", fields: fields(named("Example.B")) }
    , { kind: "alias", id: "lean:Example.B", target: apply("option", named("Example.A")) }
  ];
  const defaults = componentStructuredCallableDefaults(types);
  assert.deepEqual(defaults.recipes.map(item => item.id), ["lean:Example.B", "lean:Example.A"]);
  assert.match(defaults.recipes[0].body, /Option\.none/);
  assert.ok(defaults.recipes[1].body.includes(defaults.recipes[0].symbol));
  for(const constructor of ["array", "list", "option"])
    assert.ok(defaults.expression(apply(constructor, named("Example.A"))));
});

test("empty recursive payload types do not prevent finite Option, array, List and error values", () => {
  const type = { kind: "variant", id: "lean:Example.Empty", cases: [branch("again", named("Example.Empty"))] };
  const defaults = componentStructuredCallableDefaults([type]);
  assert.equal(defaults.recipes.length, 0);
  assert.throws(() => defaults.expression(named("Example.Empty")), /no finite recovery value/);
  assert.throws(() => defaults.expression(apply("tuple", uint32, named("Example.Empty"))), /no finite recovery value/);
  assert.equal(defaults.expression(apply("result", named("Example.Empty"), uint32)), "(_root_.Except.error (0))");
  assert.equal(defaults.expression(apply("option", named("Example.Empty"))), "_root_.Option.none");
  assert.equal(defaults.expression(apply("array", named("Example.Empty"))), "#[]");
  assert.equal(defaults.expression(apply("list", named("Example.Empty"))), "[]");
});

test("shared nominal recipes avoid exponential generated fallback source", () => {
  const types = Array.from({ length: 80 }, (_, index) => ({
    kind: "record", id: `lean:Example.Pair${index}`
    , fields: fields(...Array(2).fill(index ? named(`Example.Pair${index - 1}`) : uint32))
  }));
  const defaults = componentStructuredCallableDefaults(types);
  assert.equal(defaults.recipes.length, 80);
  assert.ok(defaults.declarations.join("\n").length < 20000);
  const declared = new Set();
  for(const item of defaults.recipes)
{
    for(const symbol of item.body.match(/callbackDefault_[a-f0-9]{20}/g) ?? []) assert.ok(declared.has(symbol));
    declared.add(item.symbol);
}
});

test("invalid descriptors fail before recovery declarations can be emitted", () => {
  assert.throws(() => componentStructuredCallableDefaults([{ kind: "alias", id: "lean:Example.A", target: named("Example.A") }]), /cyclic alias/);
  assert.throws(() => componentStructuredCallableDefaults([{ kind: "record", id: "lean:Example.A", fields: fields(named("Example.Unknown")) }]), /unknown nominal/);
  assert.throws(() => componentStructuredCallableDefaults([{ kind: "resource", id: "lean:Example.Resource", fields: [] }]), /identity/);
});

test("Fin recovery constructs checked values and never invents an inhabitant of Fin zero", () => {
  const nat = { kind: "primitive", name: "nat" }, fin = bound => ({ kind: "fin", bound });
  const defaults = componentStructuredCallableDefaults([]);
  assert.equal(defaults.expression(nat, fin("5")), "(⟨0, by decide⟩ : _root_.Fin 5)");
  assert.throws(() => defaults.expression(nat, fin("0")), /no finite recovery value/);
  for(const constructor of ["array", "list", "option"])
    assert.ok(defaults.expression(apply(constructor, nat), { kind: constructor, arguments: [fin("0")] }));
  assert.equal(defaults.expression(apply("result", nat, nat), { kind: "result", arguments: [fin("0"), fin("2")] }), "(_root_.Except.error ((⟨0, by decide⟩ : _root_.Fin 2)))");
  assert.throws(() => defaults.expression(apply("tuple", nat, nat), { kind: "tuple", arguments: [fin("0"), null] }), /no finite recovery value/);
  const record = { kind: "record", id: "lean:Example.Impossible", fields: fields(nat) };
  const nominal = componentStructuredCallableDefaults([record], [{ id: record.id, refinement: { kind: "record", fields: [fin("0")] } }]);
  assert.equal(nominal.declarations.length, 0);
  assert.throws(() => nominal.expression(named("Example.Impossible")), /no finite recovery value/);
});
