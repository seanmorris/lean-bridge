import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

import {
  BindingIrCanonicalError,
  BindingIrCompatibilityError,
  canonicalizeBindingIr,
  diagnoseBindingIrVersion,
  hashBindingIr,
  migrateBindingIr,
  parseBindingIr,
} from "../src/binding-ir/canonical.mjs";
import {
  BindingIrContractError,
  validateBindingIr,
} from "../src/binding-ir/contract.mjs";
import {
  BindingIrFrontendError,
  createBindingIrFrontend,
} from "../src/binding-ir/frontend.mjs";

const fixture = JSON.parse(
  await readFile("poc/lean-link-spike/bindings/alpha.binding-ir.json", "utf8"),
);
const clone = value => structuredClone(value);
const execute = promisify(execFile);

const reverseObjectKeys = value => {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, child]) => [key, reverseObjectKeys(child)]),
    );
  }
  return value;
};

const contractError = (operation, code) => {
  assert.throws(operation, error => {
    assert.equal(error instanceof BindingIrContractError, true);
    assert.equal(error.code, code);
    return true;
  });
};

test("the Alpha fixture defines copied values and identity resources", () => {
  assert.equal(validateBindingIr(clone(fixture)).component.id, "poc/lean-alpha@0.0.0");
  assert.deepEqual(
    fixture.types.map(type => [type.name, type.representation]),
    [
      ["Payload", "copied"],
      ["Box", "identity"],
      ["Transform", "identity"],
    ],
  );
});

test("the JSON schema is closed and uses draft 2020-12", async () => {
  const schema = JSON.parse(await readFile("schema/binding-ir.schema.json", "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.schemaVersion.const, 2);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.declaration.additionalProperties, false);
  assert.equal(schema.$defs.typeDefinition.additionalProperties, false);
  assert.equal(schema.$defs.callable.additionalProperties, false);
});

test("unknown fields fail instead of silently changing binding semantics", () => {
  const top = clone(fixture);
  top.javascript = { className: "Box" };
  contractError(() => validateBindingIr(top), "unknown-property");

  const nested = clone(fixture);
  nested.declarations[0].parameters[0].ffiHint = "pointer";
  contractError(() => validateBindingIr(nested), "unknown-property");
});

test("copied values cannot acquire handles or lifetimes", () => {
  const candidate = clone(fixture);
  const parameter = candidate.declarations.find(item => item.name === "roundTrip").parameters[0];
  parameter.ownership = "borrow";
  parameter.lifetime = { scope: "call", anchor: null };
  contractError(() => validateBindingIr(candidate), "copied-ownership");
});

test("identity resources cannot cross the boundary as copied values", () => {
  const candidate = clone(fixture);
  const result = candidate.declarations.find(item => item.name === "box").result;
  result.ownership = "copy";
  result.lifetime = null;
  contractError(() => validateBindingIr(candidate), "identity-ownership");
});

test("every non-copy ownership mode declares a lifetime", () => {
  const candidate = clone(fixture);
  candidate.declarations.find(item => item.name === "read").receiver.lifetime = null;
  contractError(() => validateBindingIr(candidate), "missing-lifetime");
});

test("all named type references resolve within the component", () => {
  const candidate = clone(fixture);
  candidate.errors[0].payload = { kind: "named", id: "lean:Missing.ErrorPayload" };
  contractError(() => validateBindingIr(candidate), "unknown-type");
});

test("component and overload identities cannot drift", () => {
  const version = clone(fixture);
  version.component.version = "0.0.1";
  contractError(() => validateBindingIr(version), "component-version");

  const overload = clone(fixture);
  overload.declarations[1].overloadKey = overload.declarations[0].overloadKey;
  contractError(() => validateBindingIr(overload), "duplicate-id");
});

test("borrow anchors must resolve to a receiver or declared parameter", () => {
  const identity = clone(fixture);
  const identityResult = identity.declarations.find(item => item.name === "identity").result;
  identityResult.lifetime = { scope: "parameter", anchor: "missing" };
  contractError(() => validateBindingIr(identity), "borrow-anchor");

  const noReceiver = clone(fixture);
  const result = noReceiver.declarations.find(item => item.name === "box").result;
  result.ownership = "borrow";
  result.lifetime = { scope: "receiver", anchor: "receiver" };
  contractError(() => validateBindingIr(noReceiver), "borrow-anchor");
});

test("copied records reject identity-bearing fields", () => {
  const candidate = clone(fixture);
  candidate.types[0].fields.push({
    name: "box",
    type: { kind: "named", id: "lean:Alpha.Box" },
    mutability: "immutable",
    documentation: { summary: "An invalid identity field.", details: "" },
  });
  contractError(() => validateBindingIr(candidate), "record-field-representation");
});

test("asynchronous declarations must report their async effect", () => {
  const candidate = clone(fixture);
  candidate.declarations.find(item => item.name === "roundTrip").resultMode = "promise";
  contractError(() => validateBindingIr(candidate), "async-effect");
});

test("producer-specific metadata stays behind namespaced extension keys", () => {
  const candidate = clone(fixture);
  candidate.producers[0].extensions = { module: "Alpha" };
  contractError(() => validateBindingIr(candidate), "invalid-value");
});

const progressCallback = () => ({
  id: "bridge:Alpha.ProgressCallback",
  name: "ProgressCallback",
  kind: "callback",
  representation: "identity",
  mutability: "immutable",
  typeParameters: [],
  fields: [],
  target: null,
  resource: null,
  callable: {
    invocation: "many",
    reentry: "same-agent",
    selfDisposal: "reject",
    parameters: [
      {
        name: "value",
        type: { kind: "primitive", name: "uint32" },
        ownership: "copy",
        lifetime: null,
        mutability: "immutable",
        optional: false,
        default: null,
      },
    ],
    result: {
      type: { kind: "primitive", name: "unit" },
      ownership: "copy",
      lifetime: null,
    },
    effects: ["host-call"],
    failure: { mode: "none", errors: [], unexpected: "poison-runtime" },
    resultMode: "value",
  },
  documentation: {
    summary: "Receive progress from Lean.",
    details: "The callback may re-enter the same shared runtime.",
  },
  source: {
    producer: "bridge",
    declaration: "Alpha.ProgressCallback",
    extensions: { "lean-wasm.org/intrinsic": "host-callback" },
  },
  assurance: [],
});

test("callback types carry closed invocation and re-entry semantics", () => {
  const candidate = clone(fixture);
  candidate.types.push(progressCallback());
  assert.equal(validateBindingIr(candidate), candidate);

  const copied = clone(candidate);
  copied.types.at(-1).representation = "copied";
  contractError(() => validateBindingIr(copied), "callback-shape");

  const asynchronous = clone(candidate);
  asynchronous.types.at(-1).callable.resultMode = "promise";
  contractError(() => validateBindingIr(asynchronous), "async-effect");

  const receiverAnchor = clone(candidate);
  const parameter = receiverAnchor.types.at(-1).callable.parameters[0];
  parameter.type = { kind: "named", id: "lean:Alpha.Box" };
  parameter.ownership = "borrow";
  parameter.lifetime = { scope: "receiver", anchor: "receiver" };
  contractError(() => validateBindingIr(receiverAnchor), "borrow-anchor");
});

const schemaProducedFixture = {
  schemaVersion: 2,
  component: {
    id: "fixture/schema-math@1.0.0",
    name: "Schema Math",
    version: "1.0.0",
  },
  producers: [
    {
      id: "schema",
      adapter: "interface-schema",
      adapterVersion: 1,
      tool: "Fixture schema compiler",
      toolVersion: "1.0.0",
      extensions: { "example.test/schema": "math-v1" },
    },
  ],
  types: [],
  declarations: [
    {
      id: "schema:math.add",
      name: "add",
      kind: "function",
      overloadKey: "add(uint32,uint32)",
      typeParameters: [],
      receiver: null,
      parameters: ["left", "right"].map(name => ({
        name,
        type: { kind: "primitive", name: "uint32" },
        ownership: "copy",
        lifetime: null,
        mutability: "immutable",
        optional: false,
        default: null,
      })),
      result: {
        type: { kind: "primitive", name: "uint32" },
        ownership: "copy",
        lifetime: null,
      },
      mutability: "immutable",
      effects: [],
      failure: { mode: "none", errors: [], unexpected: "trap" },
      resultMode: "value",
      capabilities: [],
      assurance: [],
      documentation: {
        summary: "Add two unsigned 32-bit integers.",
        details: "This fixture is produced without Lean declarations or metadata.",
      },
      source: {
        producer: "schema",
        declaration: "math.add",
        extensions: { "example.test/pointer": "#/functions/add" },
      },
    },
  ],
  errors: [],
  capabilities: [],
  assurance: [],
  documentation: {
    summary: "A non-Lean producer fixture.",
    details: "It exercises the same semantic core through another frontend.",
  },
};

test("generic declarations use scoped representation constraints", () => {
  const candidate = clone(schemaProducedFixture);
  const declaration = candidate.declarations[0];
  declaration.id = "schema:identity.echo";
  declaration.name = "echo";
  declaration.overloadKey = "echo<T>(T)";
  declaration.typeParameters = [
    {
      id: "T",
      representation: "copied",
      constraints: ["constraint:copyable"],
    },
  ];
  declaration.parameters = [
    {
      name: "value",
      type: { kind: "parameter", id: "T" },
      ownership: "copy",
      lifetime: null,
      mutability: "immutable",
      optional: false,
      default: null,
    },
  ];
  declaration.result = {
    type: { kind: "parameter", id: "T" },
    ownership: "copy",
    lifetime: null,
  };
  declaration.documentation = {
    summary: "Return one copied value with the same semantic type.",
    details: "The producer constrains T to copied representations.",
  };
  declaration.source.declaration = "identity.echo";
  assert.equal(validateBindingIr(candidate), candidate);
});

test("a versioned non-Lean frontend produces the same semantic core", async () => {
  const frontend = createBindingIrFrontend({
    producerId: "schema",
    adapter: "interface-schema",
    adapterVersion: 1,
    analyze: async () => clone(schemaProducedFixture),
  });
  const ir = await frontend.analyze({ source: "ignored fixture input" });
  assert.equal(ir.declarations[0].id, "schema:math.add");
  assert.equal(Object.isFrozen(ir), true);
  assert.equal(Object.isFrozen(ir.declarations[0]), true);
});

test("the Lean frontend carries declaration and proof provenance through its namespace", async () => {
  const frontend = createBindingIrFrontend({
    producerId: "lean",
    adapter: "lean4",
    adapterVersion: 1,
    analyze: async () => clone(fixture),
  });
  const ir = await frontend.analyze({ module: "Alpha" });
  assert.equal(ir.types[0].source.declaration, "Alpha.Payload");
  assert.equal(ir.types[0].source.extensions["lean-lang.org/export"], "record");
  assert.deepEqual(
    ir.assurance.find(item => item.id === "assurance:Alpha.Payload.layout").assumptions,
    ["The bridge generator and target ABI adapter implement Binding IR version 2."],
  );
});

test("a frontend cannot claim another producer or adapter version", async () => {
  const frontend = createBindingIrFrontend({
    producerId: "schema",
    adapter: "interface-schema",
    adapterVersion: 2,
    analyze: async () => clone(schemaProducedFixture),
  });
  await assert.rejects(frontend.analyze(null), error => {
    assert.equal(error instanceof BindingIrFrontendError, true);
    assert.equal(error.code, "frontend-version");
    return true;
  });
});

test("canonical serialization ignores object insertion order", () => {
  const canonical = canonicalizeBindingIr(fixture);
  assert.equal(canonicalizeBindingIr(reverseObjectKeys(fixture)), canonical);
  assert.deepEqual(parseBindingIr(canonical), fixture);
  assert.equal(canonical.endsWith("\n"), false);
});

test("the Alpha semantic fixture has a stable reviewed content identity", () => {
  assert.equal(
    hashBindingIr(fixture),
    "a46003fa0dc2647587360b53a6d470b0fa38cd666ccb81be784db89def12b18d",
  );
  const changed = clone(fixture);
  changed.documentation.summary = "Changed semantic documentation.";
  assert.notEqual(hashBindingIr(changed), hashBindingIr(fixture));
});

test("canonical serialization rejects values that JSON cannot identify safely", () => {
  const nonfinite = clone(fixture);
  nonfinite.producers[0].extensions["lean-lang.org/invalid"] = Number.NaN;
  assert.throws(() => canonicalizeBindingIr(nonfinite), error => {
    assert.equal(error instanceof BindingIrCanonicalError, true);
    assert.equal(error.code, "invalid-number");
    return true;
  });

  const invalidUnicode = clone(fixture);
  invalidUnicode.producers[0].extensions["lean-lang.org/invalid"] = "\ud800";
  assert.throws(() => canonicalizeBindingIr(invalidUnicode), error => {
    assert.equal(error instanceof BindingIrCanonicalError, true);
    assert.equal(error.code, "invalid-unicode");
    return true;
  });
});

test("version diagnostics distinguish migration from consumer upgrades", () => {
  assert.deepEqual(diagnoseBindingIrVersion(fixture), {
    compatible: true,
    code: "exact-schema-version",
    actual: 2,
    supported: [2],
    relation: "exact",
    action: null,
  });
  assert.equal(diagnoseBindingIrVersion({ schemaVersion: 1 }).code, "migration-required");
  assert.equal(diagnoseBindingIrVersion({ schemaVersion: 3 }).code, "consumer-upgrade-required");
  assert.equal(diagnoseBindingIrVersion({ schemaVersion: 0 }).code, "invalid-schema-version");

  const legacy = clone(fixture);
  legacy.schemaVersion = 1;
  legacy.types = legacy.types.filter(type => type.kind !== "callback");
  legacy.declarations = legacy.declarations.filter(
    declaration => declaration.id !== "lean:Alpha.withCallback",
  );
  legacy.errors = legacy.errors.filter(error => error.id !== "error:callback-threw");
  legacy.assurance = legacy.assurance.filter(
    claim => claim.id !== "assurance:Alpha.withCallback.boundary",
  );
  legacy.types.forEach(type => delete type.callable);
  contractError(() => validateBindingIr(legacy), "unsupported-schema");
  const migrated = migrateBindingIr(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.types.map(type => type.callable), [null, null]);
  assert.equal(validateBindingIr(migrated), migrated);

  assert.throws(() => migrateBindingIr({ schemaVersion: 3 }), error => {
    assert.equal(error instanceof BindingIrCompatibilityError, true);
    assert.equal(error.code, "migration-unavailable");
    return true;
  });
});

test("the Binding IR CLI exposes validation, hashing, and machine-readable diagnostics", async () => {
  const file = "poc/lean-link-spike/bindings/alpha.binding-ir.json";
  const validated = await execute(process.execPath, ["scripts/binding-ir.mjs", "validate", file]);
  assert.match(validated.stdout, /valid schemaVersion=2 component=poc\/lean-alpha@0\.0\.0/);
  const hashed = await execute(process.execPath, ["scripts/binding-ir.mjs", "hash", file]);
  assert.equal(hashed.stdout.trim(), hashBindingIr(fixture));
  const diagnosed = await execute(process.execPath, ["scripts/binding-ir.mjs", "diagnose", file]);
  assert.equal(JSON.parse(diagnosed.stdout).compatible, true);
});
