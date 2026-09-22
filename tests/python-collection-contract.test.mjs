/**
 * Python copied collections retain complete source shapes and host field names.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { copiedPythonConversions, copiedPythonHelpers, copiedPythonTypes } from "../src/backends/python/copied-conversions.mjs";
import { generateCopiedPythonPackage } from "../src/backends/python/copied-values.mjs";
import { auditPythonPackage } from "../src/backends/python/package-audit.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";

test("Python collections retain all independent fields with escaped host names", () => {
	const ir = collectionReviewedIr(), model = compileCopiedPythonModel(ir);
	assert.equal(model.surface.functions.length, 35); assert.equal(collectionSignatures.length, 35);
	assert.equal(model.surface.copies.filter(copy => copy.record).length, 7);
	const files = generateCopiedPythonPackage(ir), record = model.surface.copies.find(copy => copy.record?.name === "Primitives");
	assert.deepEqual(files, generateCopiedPythonPackage(structuredClone(ir)));
	assert.equal(auditPythonPackage(ir, files).exports.length, 43);
	const field = record.fields.find(field => field.name === "bytes");
	assert.equal(field.publicName, "bytes_");
	assert.equal(record.record.fields.find(field => field.name === "bytes").name, "bytes");
	for(const path of ["lean_collections/__init__.py", "lean_collections/__init__.pyi"])
	{
		assert.match(files[path], / {4}bytes_: bytes/);
		assert.match(files[path], / {4}char_: str/);
	}
	assert.match(files["lean_collections/_native.py"], /_to\d+\(value\.bytes_, scope\)/);
	assert.match(files["lean_collections/_native.py"], /bytes_=_from\d+\(value\.bytes_, scope\)/);
});

test("Python runtime type aliases bound repeated expansion without widening static types", () => {
	const ir = collectionReviewedIr(), model = compileCopiedPythonModel(ir), files = generateCopiedPythonPackage(ir);
	assert.equal(model.requiresTypeAliases, true);
	assert.ok(model.surface.copies.every(copy => copy.publicTypeCost <= 128 && copy.inputTypeCost <= 128));
	assert.match(files["lean_collections/__init__.py"], /from typing_extensions import TypeAliasType/);
	assert.match(files["lean_collections/__init__.py"], /_Array\d+ = _TypeAliasType\("_Array\d+", tuple\[_Array\d+, \.\.\.\] \| list\[_Array\d+\]\)/);
	assert.doesNotMatch(files["lean_collections/__init__.pyi"], /TypeAliasType|Any/);
	assert.match(files["lean_collections/__init__.pyi"], /_Array\d+ = tuple\[_Array\d+, \.\.\.\] \| list\[_Array\d+\]/);
	const leaf = { kind: "primitive", name: "uint32" };
	let product = leaf;
	for(let i = 0; i < 8; ++i) product = { kind: "apply", constructor: "tuple", arguments: [product, product] };
	ir.declarations = ir.declarations.filter(declaration => declaration.id === "lean:Collections.deep");
	ir.declarations[0].parameters[0].type = product;
	ir.declarations[0].result.type = product;
	const nested = compileCopiedPythonModel(ir), generated = generateCopiedPythonPackage(ir);
	assert.equal(nested.requiresTypeAliases, true);
	assert.ok(nested.surface.copies.some(copy => copy.publicExpression));
	assert.ok(nested.surface.copies.every(copy => copy.publicTypeCost <= 128 && copy.inputTypeCost <= 128));
	assert.ok(generated["lean_collections/__init__.pyi"].length < 6000);
	assert.match(generated["lean_collections/__init__.py"], /_Value\d+ = _TypeAliasType/);
	ir.declarations[0].parameters[0].type = leaf;
	ir.declarations[0].result.type = leaf;
	assert.equal(compileCopiedPythonModel(ir).requiresTypeAliases, false);
	assert.doesNotMatch(generateCopiedPythonPackage(ir)["lean_collections/__init__.py"], /typing_extensions|TypeAliasType/);
});

const hintsPython = process.env.LEAN_BRIDGE_MYPY_PYTHON ?? resolve("build/python-alias-typecheck/bin/python");
test("Python resolves complete 24-level collection annotations while retaining shallow shapes", { skip: !existsSync(hintsPython) }, async () => {
	const files = generateCopiedPythonPackage(collectionReviewedIr());
	const source = files["lean_collections/__init__.py"].replace("from . import _native\n", "");
	const fixture = await readFile("tests/fixtures/collection-consumers/python-hints.py", "utf8");
	const program = `import json, sys, types
api = types.ModuleType("lean_collections")
sys.modules[api.__name__] = api
exec(sys.argv[1], api.__dict__)
helpers = {"__name__": "hint_checks"}
exec(sys.argv[2], helpers)
print(json.dumps(helpers["check_hints"](api)))
`;
	const result = await processBuildRunner.capture({ command: hintsPython, args: ["-I", "-B", "-c", program, source, fixture], timeoutMs: 5000 });
	assert.equal(result.stderr, "");
	const observations = JSON.parse(result.stdout);
	assert.equal(observations.depth, 24); assert.equal(observations.shallow_primitives, 19);
	assert.ok(observations.type_hints_ms < 2000);
});

test("Python record field escaping rejects normalized member collisions", () => {
	for(const name of ["bytes", "type", "list", "dataclass"])
	{
		const ir = collectionReviewedIr(), record = ir.types.find(type => type.name === "Pair");
		record.fields[0].name = name;
		const model = compileCopiedPythonModel(ir);
		assert.equal(model.surface.copies.find(copy => copy.record?.name === "Pair").fields[0].publicName, `${name}_`);
		record.fields[1].name = `${name}_`;
		assert.throws(() => compileCopiedPythonModel(ir), /record field(?: name collides| is reserved or duplicated)/);
	}
});

test("Python rejects misaligned collection buffers before reading elements", async () => {
	const model = compileCopiedPythonModel(collectionReviewedIr());
	const copy = model.surface.copies.find(copy => copy.element?.scalarName === "uint32");
	const source = `import ctypes as _c
class LeanBridgeError(RuntimeError):
    def __init__(self, status, message):
        self.status = status
        super().__init__(message)
${copiedPythonHelpers}
${copiedPythonTypes(model)}
${copiedPythonConversions(model)}
backing = (_c.c_uint32 * 4)(1, 2, 3, 4)
scope = _Scope()
try:
    _from${copy.index}(_T${copy.index}(_c.addressof(backing) + 1, 1, None, None), scope)
except LeanBridgeError as error:
    assert error.status == 5 and 'misaligned' in str(error)
else:
    raise AssertionError('misaligned buffer was accepted')
finally:
    scope.close()
scope = _Scope()
try:
    assert _from${copy.index}(_T${copy.index}(1, 0, None, None), scope) == ()
    assert _from${copy.index}(_T${copy.index}(_c.addressof(backing), 4, None, None), scope) == (1, 2, 3, 4)
finally:
    scope.close()
print('aligned-and-empty-buffers-ok')
`;
	const result = await processBuildRunner.capture({ command: process.env.LEAN_BRIDGE_PYTHON ?? "python3", args: ["-I", "-B", "-c", source], timeoutMs: 5000 });
	assert.equal(result.stderr, ""); assert.equal(result.stdout, "aligned-and-empty-buffers-ok\n");
});

test("Python-only keywords retain native field meaning through escaped ctypes names", async () => {
	const ir = collectionReviewedIr(), record = ir.types.find(type => type.name === "Pair");
	record.fields[0].name = "from"; record.fields[1].name = "lambda";
	ir.declarations = ir.declarations.filter(declaration => declaration.id === "lean:Collections.recordMake");
	const model = compileCopiedPythonModel(ir), copy = model.surface.copies.find(copy => copy.record?.name === "Pair");
	assert.equal(model.requiresTypeAliases, false);
	assert.deepEqual(copy.fields.map(field => field.name), ["from", "lambda"]);
	assert.deepEqual(copy.fields.map(field => field.publicName), ["from_", "lambda_"]);
	const files = generateCopiedPythonPackage(ir);
	const publicSource = files["lean_collections/__init__.py"].replace("from . import _native\n", "");
	const conversions = `import ctypes as _c\n${copiedPythonHelpers}\n${copiedPythonTypes(model)}\n${copiedPythonConversions(model)}`;
	const program = `import ast, sys, types
for source in sys.argv[1:4]:
    ast.parse(source)
api = types.ModuleType('lean_collections')
sys.modules[api.__name__] = api
exec(sys.argv[1], api.__dict__)
exec(sys.argv[2], api.__dict__)
value = api.Pair(from_=7, lambda_='A\\0🌱')
scope = api._Scope()
try:
    encoded = api._to${copy.index}(value, scope)
    assert encoded.from_ == 7
    assert api._from${copy.index}(encoded, scope) == value
finally:
    scope.close()
print('keyword-fields-ok')
`;
	const result = await processBuildRunner.capture({ command: process.env.LEAN_BRIDGE_PYTHON ?? "python3", args: ["-I", "-B", "-c", program, publicSource, conversions, files["lean_collections/_native.py"]], timeoutMs: 5000 });
	assert.equal(result.stderr, ""); assert.equal(result.stdout, "keyword-fields-ok\n");
});

test("Python text decoding enforces its shared conversion budget and releases input scratch", async () => {
	const model = compileCopiedPythonModel(collectionReviewedIr()), copy = model.surface.copies.find(copy => copy.scalarName === "string");
	const program = `import ctypes as _c
${copiedPythonHelpers}
${copiedPythonTypes(model)}
${copiedPythonConversions(model)}
for _ in range(3):
    scope = _Scope()
    try:
        encoded = _to${copy.index}('x' * (3 * 1024 * 1024), scope)
        assert len(scope.owners) == 1
        try:
            _from${copy.index}(encoded, scope)
        except ValueError as error:
            assert str(error) == '16 MiB Python conversion limit exceeded'
        else:
            raise AssertionError('shared Python input/output budget was ignored')
    finally:
        scope.close()
    assert scope.owners == [] and scope.failure is None
    scope = _Scope()
    try:
        assert _from${copy.index}(_to${copy.index}('recovered', scope), scope) == 'recovered'
    finally:
        scope.close()
print('python-output-budget-ok')
`;
	const result = await processBuildRunner.capture({ command: process.env.LEAN_BRIDGE_PYTHON ?? "python3", args: ["-I", "-B", "-c", program], timeoutMs: 5000 });
	assert.equal(result.stderr, ""); assert.equal(result.stdout, "python-output-budget-ok\n");
});
