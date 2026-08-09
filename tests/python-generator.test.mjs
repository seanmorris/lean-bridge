import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
  PythonBindingGenerationError,
  generatePythonBindingPackage,
} from "../src/backends/python/generate.mjs";
import { auditPythonPackage } from "../src/backends/python/package-audit.mjs";

const run = promisify(execFile);
const clone = value => structuredClone(value);

const writePackage = async (directory, files) => {
  for (const [relativePath, source] of Object.entries(files)) {
    const destination = join(directory, relativePath);
    await mkdir(join(destination, ".."), { recursive: true });
    await writeFile(destination, source);
  }
};

test("the Python backend emits dataclasses, classes, exceptions, callables, and stubs", () => {
  const files = generatePythonBindingPackage(alpha.bindingIr);
  assert.deepEqual(files, generatePythonBindingPackage(clone(alpha.bindingIr)));
  const source = files["lean_alpha/__init__.py"];
  const stub = files["lean_alpha/__init__.pyi"];

  assert.match(source, /@dataclass\(frozen=True, slots=True\)\nclass Payload/);
  assert.match(source, /enabled: bool/);
  assert.match(source, /count: int/);
  assert.match(source, /label: str/);
  assert.match(source, /bytes: bytes/);
  assert.match(source, /values: tuple\[int, \.\.\.\]/);
  assert.match(source, /class Box/);
  assert.match(source, /def __enter__\(self\) -> "Box"/);
  assert.match(source, /def close\(self\) -> None/);
  assert.match(source, /def with_callback\(value: int, transform: Callable\[\[int\], int\]\)/);
  assert.match(source, /class Transform/);
  assert.match(source, /def __call__\(self, value: int\) -> int/);
  assert.match(source, /class DisposedResourceError\(LeanAlphaError\)/);
  assert.doesNotMatch(source, /\b(?:ccall|cwrap|WebAssembly|_bridge_)\b/i);
  assert.doesNotMatch(stub, /\bAny\b|\b(?:handle|token)\s*:/i);

  const audit = auditPythonPackage(alpha.bindingIr, files);
  assert.deepEqual(audit.capabilityGaps, []);
  assert.deepEqual(audit.exports, [
    "LeanAlphaError",
    "RuntimeUnavailableError",
    "UnexpectedError",
    "DisposedResourceError",
    "CallbackThrewError",
    "Ok",
    "Err",
    "Payload",
    "Box",
    "Transform",
    "round_trip",
    "with_callback",
    "make_adder",
  ]);

  const leaked = { ...files };
  leaked["lean_alpha/__init__.py"] += "\ndef dispatch(): pass\n";
  assert.throws(
    () => auditPythonPackage(alpha.bindingIr, leaked),
    error => error.code === "generic-dispatch",
  );
});

test("the generated Python package runs through ordinary native syntax", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-python-generator-"));
  try {
    await writePackage(directory, generatePythonBindingPackage(alpha.bindingIr));
    await writeFile(join(directory, "consumer.py"), `
from lean_alpha import (
    Box,
    DisposedResourceError,
    Payload,
    make_adder,
    round_trip,
    with_callback,
)
from lean_alpha._runtime import install_runtime


class FixtureRuntime:
    def __init__(self):
        self.initializations = 0
        self.box_disposals = 0
        self.transform_disposals = 0

    def initialize(self):
        self.initializations += 1

    def box_new(self, value):
        return value + 1

    def box_read(self, identity):
        return identity - 1

    def box_identity(self, identity):
        return identity

    def round_trip(self, payload):
        return Payload(
            not payload.enabled,
            payload.count + 1,
            payload.label,
            payload.bytes,
            payload.values,
        )

    def with_callback(self, value, transform):
        return transform(value + 1) + 1

    def make_adder(self, base):
        return base

    def dispose_box(self, identity):
        self.box_disposals += 1

    def call_transform(self, identity, value):
        return identity + value

    def dispose_transform(self, identity):
        self.transform_disposals += 1


runtime = FixtureRuntime()
install_runtime(runtime)
install_runtime(runtime)
assert runtime.initializations == 1

with Box(41) as box:
    assert box.read() == 41
    assert box.identity() is box
assert box.closed
assert runtime.box_disposals == 1
try:
    box.read()
except DisposedResourceError:
    pass
else:
    raise AssertionError("closed Box remained usable")

payload = Payload(False, 8, "typed", bytearray([0, 127, 255]), [1, 5, 13])
assert isinstance(payload.bytes, bytes)
assert isinstance(payload.values, tuple)
output = round_trip(payload)
assert output == Payload(True, 9, "typed", bytes([0, 127, 255]), (1, 5, 13))
assert with_callback(40, lambda value: value) == 42

with make_adder(2) as add_two:
    assert add_two(40) == 42
assert runtime.transform_disposals == 1

try:
    Box(-1)
except ValueError:
    pass
else:
    raise AssertionError("invalid UInt32 reached the runtime")
`);
    await run("python3", ["-B", "consumer.py"], {
      cwd: directory,
      env: { ...process.env, PYTHONPATH: directory },
    });
    await run("python3", ["-m", "compileall", "-q", "lean_alpha"], {
      cwd: directory,
      env: { ...process.env, PYTHONPATH: directory },
    });
    await run("python3", [
      "-c",
      "compile(open('lean_alpha/__init__.pyi', encoding='utf-8').read(), 'lean_alpha/__init__.pyi', 'exec')",
    ], { cwd: directory });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const addProperty = ir => {
  const read = ir.declarations.find(item => item.id === "lean:Alpha.Box.read");
  const getter = clone(read);
  getter.id = "bridge:Alpha.Box.value.get";
  getter.name = "value";
  getter.kind = "property";
  getter.overloadKey = "Box.value.get";
  getter.documentation = { summary: "Read the value property.", details: "" };
  getter.source.declaration = "Alpha.Box.value.get";

  const setter = clone(read);
  setter.id = "bridge:Alpha.Box.value.set";
  setter.name = "value";
  setter.kind = "property";
  setter.overloadKey = "Box.value.set(uint32)";
  setter.parameters = [{
    name: "value",
    type: { kind: "primitive", name: "uint32" },
    ownership: "copy",
    lifetime: null,
    mutability: "immutable",
    optional: false,
    default: null,
  }];
  setter.result = {
    type: { kind: "primitive", name: "unit" },
    ownership: "copy",
    lifetime: null,
  };
  setter.mutability = "write";
  setter.effects = ["writes-resource", "fails"];
  setter.documentation = { summary: "Write the value property.", details: "" };
  setter.source.declaration = "Alpha.Box.value.set";
  ir.declarations.push(getter, setter);
};

test("Python properties, iterators, async iterators, and awaitables use native protocols", () => {
  const property = clone(alpha.bindingIr);
  addProperty(property);
  let files = generatePythonBindingPackage(property);
  assert.match(files["lean_alpha/__init__.py"], /@property\n    def value\(self\) -> int/);
  assert.match(files["lean_alpha/__init__.py"], /@value\.setter/);
  assert.match(files["lean_alpha/__init__.pyi"], /@property\n    def value\(self\) -> int/);

  const promise = clone(alpha.bindingIr);
  let declaration = promise.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  declaration.resultMode = "promise";
  declaration.effects.push("async");
  files = generatePythonBindingPackage(promise);
  assert.match(files["lean_alpha/__init__.py"], /async def round_trip\(payload: Payload\) -> Payload/);
  assert.match(files["lean_alpha/__init__.py"], /result = await runtime\.round_trip\(payload\)/);

  const iterator = clone(alpha.bindingIr);
  declaration = iterator.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  declaration.resultMode = "iterator";
  files = generatePythonBindingPackage(iterator);
  assert.match(files["lean_alpha/__init__.py"], /def round_trip\(payload: Payload\) -> Iterator\[Payload\]/);
  assert.match(files["lean_alpha/__init__.py"], /return iter\(runtime\.round_trip\(payload\)\)/);

  const asyncIterator = clone(alpha.bindingIr);
  declaration = asyncIterator.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  declaration.resultMode = "async-iterator";
  declaration.effects.push("async");
  files = generatePythonBindingPackage(asyncIterator);
  assert.match(files["lean_alpha/__init__.py"], /def round_trip\(payload: Payload\) -> AsyncIterator\[Payload\]/);
});

test("Python variants and static methods use frozen tagged classes", () => {
  const ir = clone(alpha.bindingIr);
  ir.types.push({
    id: "bridge:Alpha.Lookup",
    name: "Lookup",
    kind: "variant",
    representation: "copied",
    mutability: "immutable",
    typeParameters: [],
    fields: [],
    target: null,
    resource: null,
    callable: null,
    cases: [
      {
        name: "Found",
        fields: [{
          name: "value",
          type: { kind: "primitive", name: "uint32" },
          mutability: "immutable",
          documentation: { summary: "The value.", details: "" },
        }],
        documentation: { summary: "A hit.", details: "" },
      },
      {
        name: "Missing",
        fields: [],
        documentation: { summary: "A miss.", details: "" },
      },
    ],
    host: null,
    documentation: { summary: "A lookup result.", details: "" },
    source: { producer: "bridge", declaration: "Alpha.Lookup", extensions: {} },
    assurance: [],
  });
  const method = clone(ir.declarations.find(item => item.name === "roundTrip"));
  method.id = "bridge:Alpha.Box.lookup";
  method.name = "lookup";
  method.kind = "static-method";
  method.owner = "lean:Alpha.Box";
  method.overloadKey = "Box.lookup(Payload)";
  method.result.type = { kind: "named", id: "bridge:Alpha.Lookup" };
  method.source.declaration = "Alpha.Box.lookup";
  ir.declarations.push(method);

  const files = generatePythonBindingPackage(ir);
  const source = files["lean_alpha/__init__.py"];
  const stub = files["lean_alpha/__init__.pyi"];
  assert.match(source, /class LookupFound:/);
  assert.match(source, /kind: ClassVar\[Literal\["Found"\]\] = "Found"/);
  assert.match(source, /Lookup = LookupFound \| LookupMissing/);
  assert.match(source, /@staticmethod\n    def lookup\(payload: Payload\) -> Lookup/);
  assert.match(stub, /@dataclass\(frozen=True\)\nclass LookupMissing/);
  assert.doesNotMatch(stub, /tag: int|handle|pointer/i);
});

test("Python finite generics expose overload stubs and private typed dispatch", () => {
  const ir = clone(alpha.bindingIr);
  const declaration = ir.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  declaration.name = "echo";
  declaration.overloadKey = "echo<T>(T)";
  declaration.typeParameters = [{ id: "T", representation: "copied", constraints: [] }];
  declaration.parameters = [{
    name: "value",
    type: { kind: "parameter", id: "T" },
    ownership: "copy",
    lifetime: null,
    mutability: "immutable",
    optional: false,
    default: null,
  }];
  declaration.result = {
    type: { kind: "parameter", id: "T" },
    ownership: "copy",
    lifetime: null,
  };
  declaration.source.extensions["lean-wasm.org/specializations"] = [
    { id: "uint32", type: { kind: "primitive", name: "uint32" } },
    { id: "string", type: { kind: "primitive", name: "string" } },
  ];
  const files = generatePythonBindingPackage(ir);
  assert.equal([...files["lean_alpha/__init__.pyi"].matchAll(/@overload/g)].length, 2);
  assert.match(files["lean_alpha/__init__.pyi"], /def echo\(value: int\) -> int/);
  assert.match(files["lean_alpha/__init__.pyi"], /def echo\(value: str\) -> str/);
  assert.match(files["lean_alpha/_runtime.py"], /def echo_uint32/);
  assert.match(files["lean_alpha/_runtime.py"], /def echo_string/);
  assert.doesNotMatch(files["lean_alpha/__init__.py"], /type_token|specialization:/);

  declaration.source.extensions["lean-wasm.org/specializations"].push({
    id: "int32",
    type: { kind: "primitive", name: "int32" },
  });
  assert.throws(
    () => generatePythonBindingPackage(ir),
    error => error.code === "ambiguous-generic-specialization",
  );
});
