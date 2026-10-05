/**
 * Ordinary Python wheels execute copied values after relocated offline installation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { compilePythonPackageModel, generatePythonBindingPackage, renderPythonPackageLayout } from "../src/backends/python/generate.mjs";
import { compileCopiedPythonModel, validateOrdinaryPythonSettings } from "../src/backends/python/copied-model.mjs";
import { packageOrdinaryPython } from "../src/release/native-pypi.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_PYTHON_TEST === "1";
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const python = process.env.LEAN_BRIDGE_PYTHON ?? "python3";
const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PERLS: '["/must/not/invoke/perl"]' };
const run = (command, args, cwd, env = environment) => processBuildRunner.capture({ command, args, cwd, env });
const synthetic = () => createNativeModel({ ...nativeMetadataFixture(), component: { id: "example@1.0.0", name: "example", version: "1.0.0" } }).bindingIr;
const scalars = [
	["unit", "Unit", "None"], ["bool", "Bool", "True"]
	, ["u8", "UInt8", "255"], ["u16", "UInt16", "65535"]
	, ["u32", "UInt32", "(1 << 32) - 1"], ["u64", "UInt64", "(1 << 64) - 1"]
	, ["i8", "Int8", "-128"], ["i16", "Int16", "-32768"]
	, ["i32", "Int32", "-(1 << 31)"], ["i64", "Int64", "-(1 << 63)"]
	, ["nat", "Nat", "(1 << 4096) + 1"], ["integer", "Int", "-(1 << 4096)"]
	, ["f32", "Float32", "-0.0"], ["f64", "Float", "-0.0"]
	, ["text", "String", '"a\\0λ🌿"'], ["bytes", "ByteArray", 'b"\\0\\xff\\x80"']
];
const ordered = name => name === "Iris" ? scalars : [...scalars].reverse();
const sourceProject = async (root, name) => {
	await saveLakeFile(root, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(root, "lakefile.toml", `name = "${name.toLowerCase()}"\n[[lean_lib]]\nname = "${name}"\n`);
	await saveLakeFile(root, `${name}.lean`, `namespace ${name}
structure Leaf where
${ordered(name).map(([label, type]) => `  v_${label} : ${type}`).join("\n")}
structure Packet where
  title : String
  leaf : Leaf
  rows : Array (Array Leaf)
structure Word where
  bits : ${name === "Iris" ? "UInt32" : "UInt64"}
structure Empty where
${scalars.map(([label, type]) => `def echo_${label} (value : ${type}) := value\ndef array_${label} (value : Array ${type}) := value`).join("\n")}
def echo_record (value : Packet) := value
def choose (left right : Packet) (pick : Bool) := if pick then left else right
def echo_rows (value : Array (Array Leaf)) := value
def echo_word (value : Word) := value
def echo_empty (value : Empty) := value
def array_empty (value : Array Empty) := value
def matrix (value : Array UInt32) := #[value, value]
def grow (value : String) := #[value, value]
def replicate (count : UInt32) : Array UInt8 := Array.replicate count.toNat 7
def answer : UInt32 := 42
theorem echo_rows_spec (value : Array (Array Leaf)) : echo_rows value = value := rfl
end ${name}
`);
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [name], exports: [...scalars.flatMap(([label]) => [`${name}.echo_${label}`, `${name}.array_${label}`]), ...["echo_record", "choose", "echo_rows", "echo_word", "echo_empty", "array_empty", "matrix", "grow", "replicate", "answer"].map(label => `${name}.${label}`)], targets: { pypi: { name: `${name.toLowerCase()}-api`, version: "2.0.0rc1" } } }));
};

test("ordinary Python emits deterministic typed functions without public ctypes", async t => {
	const ir = synthetic(), files = generatePythonBindingPackage(ir);
	assert.deepEqual(files, generatePythonBindingPackage(structuredClone(ir)));
	assert.deepEqual(files, renderPythonPackageLayout(compilePythonPackageModel(ir)));
	assert.match(files["lean_example/__init__.py"], /def increment\(arg0: int\) -> int/);
	assert.doesNotMatch(files["lean_example/__init__.py"], /ctypes|Alpha|Pointer|Any/);
	assert.match(files["lean_example/_native.py"], /example_increment/);
	const shadow = synthetic(); shadow.declarations[0].parameters[0].name = "scope";
	assert.match(generatePythonBindingPackage(shadow)["lean_example/_native.py"], /def _call0\(_arg0\)/);
	const deep = synthetic(); let type = { kind: "primitive", name: "uint32" };
	for(let i = 0; i < 30; i++) type = { kind: "apply", constructor: "array", arguments: [type] };
	deep.declarations[0].parameters[0].type = type; deep.declarations[0].result.type = type;
	assert.ok(generatePythonBindingPackage(deep)["lean_example/__init__.pyi"].length < 12000);
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-python-model-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	for(const [path, contents] of Object.entries(files)) await saveLakeFile(working, path, contents);
	await run(python, ["-I", "-B", "-c", 'import ast, pathlib; [ast.parse(p.read_text()) for p in pathlib.Path(".").rglob("*.py*")]'], working);
});

test("ordinary Python admission rejects reserved names and noncanonical coordinates", () => {
	for(const name of ["nonlocal", "tuple", "dispatch"])
	{
		const ir = synthetic(); ir.declarations[0].name = name;
		assert.throws(() => compileCopiedPythonModel(ir), error => error.code === "unsupported-python-signature" && error.details.source.path === "Sample.lean");
	}
	for(const name of ["ValueError", "RuntimeError", "ImportError", "max", "enumerate"])
	{
		const ir = synthetic();
		ir.types.push({ ...structuredClone(alpha.bindingIr.types.find(type => type.kind === "record")), id: "example:reserved", name, fields: [], assurance: [] });
		ir.declarations[0].parameters[0].type = { kind: "named", id: "example:reserved" };
		assert.throws(() => compileCopiedPythonModel(ir), error => error.code === "unsupported-python-signature");
	}
	for(const settings of [{ name: "../escape" }, { name: "UPPER" }, { name: "x_y" }, { version: "1.0" }, { version: "1.0.0-rc.1" }, { version: "1.0.0rc01" }, { version: "1.0.0+build.001" }, { version: ">=1.0.0" }]) assert.throws(() => validateOrdinaryPythonSettings(settings));
	validateOrdinaryPythonSettings({ name: "example-api", version: "2.0.0rc1" });
	const effectful = synthetic(); effectful.declarations[0].effects = ["nondeterministic"];
	assert.throws(() => compileCopiedPythonModel(effectful), /pure/);
});

const consumerSource = (name, resultCopy, growCopy) => `import concurrent.futures
import ctypes
import dataclasses
import gc
import math
import struct
import typing
import weakref
import lean_${name.toLowerCase()} as api
from lean_${name.toLowerCase()} import _native as native

def rejects(kind, call):
    try:
        call()
    except kind:
        return
    raise AssertionError("Expected " + kind.__name__)

${scalars.map(([label, , value]) => `value = ${value}
assert api.echo_${label}(value) == value
assert api.array_${label}([value, value]) == (value, value)
assert api.array_${label}((value,)) == (value,)
assert api.array_${label}([]) == ()`).join("\n")}
leaf = api.Leaf(${ordered(name).map(([label, , value]) => `v_${label}=${value}`).join(", ")})
packet = api.Packet(title="packet\\0λ", leaf=leaf, rows=[[leaf], []])
result = api.echo_record(packet)
assert result.title == packet.title and dataclasses.is_dataclass(result)
${scalars.map(([label, , value]) => `assert result.leaf.v_${label} == ${value}
assert result.rows[0][0].v_${label} == ${value}`).join("\n")}
assert result is not packet and result.leaf is not leaf
assert type(result.rows) is tuple and type(result.rows[0]) is tuple
packet.rows[0].clear()
assert len(result.rows[0]) == 1
packet = api.Packet(title=packet.title, leaf=leaf, rows=[[leaf], []])
rejects(dataclasses.FrozenInstanceError, lambda: setattr(result, "title", "changed"))
assert api.choose(packet, packet, False).title == packet.title
assert api.echo_rows([[leaf], []])[0][0].v_nat == (1 << 4096) + 1
assert api.echo_word(api.Word(bits=(1 << ${name === "Iris" ? 32 : 64}) - 1)).bits == (1 << ${name === "Iris" ? 32 : 64}) - 1
assert api.echo_empty(api.Empty()) == api.Empty()
assert api.array_empty([api.Empty()]) == (api.Empty(),)
assert api.matrix([1, 2, 3]) == ((1, 2, 3), (1, 2, 3))
assert api.replicate(256) == (7,) * 256
assert api.answer() == 42 and api.echo_bool(False) is False
assert api.echo_nat(0) == 0 and api.echo_integer(0) == 0 and api.echo_integer(1 << 200) == 1 << 200
assert api.echo_text("") == "" and api.echo_bytes(b"") == b""
for echo in [api.echo_f32, api.echo_f64]:
    assert math.isnan(echo(float("nan")))
    assert echo(float("inf")) == float("inf") and echo(-float("inf")) == -float("inf")
    assert math.copysign(1, echo(-0.0)) == -1
assert api.echo_f32(1 / 3) == struct.unpack("f", struct.pack("f", 1 / 3))[0]
assert api.echo_f32(1e300) == float("inf")
${[8, 16, 32, 64].map(bits => `rejects(ValueError, lambda: api.echo_u${bits}(-1))
rejects(ValueError, lambda: api.echo_u${bits}(1 << ${bits}))
rejects(ValueError, lambda: api.echo_i${bits}(-(1 << ${bits - 1}) - 1))
rejects(ValueError, lambda: api.echo_i${bits}(1 << ${bits - 1}))`).join("\n")}
rejects(ValueError, lambda: api.echo_nat(-1))
rejects(TypeError, lambda: api.echo_u32(1.0))
rejects(TypeError, lambda: api.echo_u32(True))
rejects(TypeError, lambda: api.echo_f64(1))
rejects(TypeError, lambda: api.echo_bool(1))
rejects(TypeError, lambda: api.echo_unit(0))
rejects(TypeError, lambda: api.echo_text(None))
rejects(TypeError, lambda: api.echo_bytes("text"))
rejects(TypeError, lambda: api.array_u32([None]))
rejects(TypeError, lambda: api.echo_rows([[None]]))
rejects(UnicodeEncodeError, lambda: api.echo_text("\\ud800"))
rejects(ValueError, lambda: api.echo_text("x" * (16 * 1024 * 1024 + 1)))
rejects(ValueError, lambda: api.array_unit([None] * 2_100_000))
for _ in range(3):
    rejects(api.LeanBridgeError, lambda: api.grow("x" * (6 * 1024 * 1024)))
    rejects(api.LeanBridgeError, lambda: api.replicate(2_100_000))
    rejects(ValueError, lambda: api.grow("x" * 2_000_000))
    assert api.answer() == 42
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as workers:
    assert all(item.title == packet.title for item in workers.map(lambda _: api.echo_record(packet), range(200)))
for name in api.__all__:
    if name != "LeanBridgeError":
        typing.get_type_hints(getattr(api, name))

# Test-only hooks prove scratch release and native cleanup on Python exceptions.
allocations = []
scopes = []
original_allocate = native._Scope.allocate
original_close = native._Scope.close
def failing_allocate(self, *args):
    value = original_allocate(self, *args)
    allocations.append(weakref.ref(value))
    if len(allocations) == 3:
        raise MemoryError("injected scratch allocation failure")
    return value
def close(self):
    original_close(self)
    scopes.append(self)
native._Scope.allocate = failing_allocate
native._Scope.close = close
rejects(MemoryError, lambda: api.echo_record(packet))
native._Scope.allocate = original_allocate
gc.collect()
assert all(reference() is None for reference in allocations)
assert all(not scope.owners for scope in scopes)
clears = []
original_clear = native._clear${resultCopy}
original_from = native._from${resultCopy}
def checked_clear(value):
    original_clear(value)
    assert not value._obj.title.data and not value._obj.rows.data
    clears.append(True)
def failing_from(*args):
    raise MemoryError("injected Python result allocation failure")
native._clear${resultCopy} = checked_clear
native._from${resultCopy} = failing_from
rejects(MemoryError, lambda: api.echo_record(packet))
assert clears == [True] and all(not scope.owners for scope in scopes)
native._from${resultCopy} = original_from
native._clear${resultCopy} = original_clear
assert api.echo_record(packet).title == packet.title
clears.clear()
original_grow_clear = native._clear${growCopy}
def checked_grow_clear(value):
    original_grow_clear(value)
    assert not value._obj.data and value._obj.length == 0
    clears.append(True)
native._clear${growCopy} = checked_grow_clear
rejects(ValueError, lambda: api.grow("x" * 2_000_000))
assert clears == [True]
print("Installed ${name}: copied values, exact types, cleanup and concurrency passed")
`;

test("ordinary wheels reproduce and execute after relocation and offline installation", { skip: !enabled, timeout: 900_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-python-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const wheels = [];
	const clean = { PATH: "/usr/bin:/bin", CC: "/missing/cc", LEAN_BRIDGE_LEAN_PREFIX: "/missing/lean", LEAN_BRIDGE_NATIVE_ROOT: "/must/not/use/overrides" };
	for(const name of ["Iris", "Lotus"])
	{
		const source = join(working, name), relocated = `${source}-relocated`;
		await sourceProject(source, name); await cp(source, relocated, { recursive: true });
		const before = await lakeInputState(source), builds = [];
		for(const [index, projectRoot] of [source, relocated].entries())
			builds.push(await buildCanonicalProject({ projectRoot, outputRoot: join(working, `${name}-build${index}`), targets: ["pypi", "c"], environment: { ...environment, PYTHONPATH: "/missing/ambient", PYTHONHOME: "/missing/home" } }));
		assert.deepEqual(await lakeInputState(source), before);
		assert.deepEqual(builds[0].packages, builds[1].packages);
		t.diagnostic(canonicalJson({ project: name, archives: builds[0].packages.map(({ archive, sha256 }) => ({ path: archive, sha256 })) }).trim());
		await rename(source, `${source}-hidden`); await rename(relocated, `${relocated}-hidden`);
		const consumer = join(working, `consumer-${name}`), home = join(consumer, "venv"), interpreter = join(home, "bin/python");
		const archive = builds[0].packages.find(pkg => pkg.archive.endsWith(".whl")), wheel = join(builds[0].output, "archives", archive.archive);
		const wheelCheck = `import base64, csv, hashlib, io, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as wheel:
    paths = wheel.namelist()
    assert len(paths) == len(set(paths))
    record = next(path for path in paths if path.endswith(".dist-info/RECORD"))
    rows = list(csv.reader(io.StringIO(wheel.read(record).decode())))
    assert sorted(row[0] for row in rows) == sorted(paths)
    for path, digest, length in rows:
        if path == record:
            assert digest == length == ""
        else:
            content = wheel.read(path)
            expected = base64.urlsafe_b64encode(hashlib.sha256(content).digest()).rstrip(b"=").decode()
            assert digest == "sha256=" + expected and int(length) == len(content)
    assert not any(path.endswith(".pyc") for path in paths)
`;
		await run(python, ["-I", "-c", wheelCheck, wheel], working, clean);
		await mkdir(consumer); await run(python, ["-I", "-m", "venv", home], consumer, clean);
		await run(interpreter, ["-I", "-m", "pip", "--isolated", "install", "--no-index", "--no-deps", "--no-cache-dir", wheel], consumer, clean);
		wheels.push(wheel);
		const model = compileCopiedPythonModel(JSON.parse(await readFile(join(builds[0].output, "native/component/binding-ir.json"), "utf8")));
		const resultCopy = model.surface.copy(model.surface.functions.find(fn => fn.field === "echo_record").declaration.result.type).index;
		const growCopy = model.surface.copy(model.surface.functions.find(fn => fn.field === "grow").declaration.result.type).index;
		await saveLakeFile(consumer, "consumer.py", consumerSource(name, resultCopy, growCopy));
		assert.match((await run(interpreter, ["-I", "consumer.py"], consumer, clean)).stdout, /cleanup and concurrency passed/);
		if(name === "Iris")
		{
			await cp(new URL("./fixtures/documentation/consumers/python/ordinary.py", import.meta.url), join(consumer, "example.py"));
			assert.match((await run(interpreter, ["-I", "example.py"], consumer, clean)).stdout, /42; exact integers and copied arrays/);
		}
		const packageRoot = join(builds[0].output, "packages/pypi/wheel"), bad = join(working, `bad-${name}`);
		await cp(packageRoot, bad, { recursive: true });
		const lib = join(bad, `lean_${name.toLowerCase()}/native/linux-x64/lib${name.toLowerCase()}.so`), bytes = await readFile(lib);
		bytes[bytes.length - 1] ^= 1; await saveLakeFile(dirname(lib), `lib${name.toLowerCase()}.so`, bytes);
		await assert.rejects(() => run(interpreter, ["-I", "-c", 'import sys; sys.path.insert(0, sys.argv[1]); __import__(sys.argv[2])', bad, `lean_${name.toLowerCase()}`], consumer, clean), error => /differs from compiled evidence/.test(error.details?.stderr));
		const adapter = join(builds[0].output, "native/c-binding/lib", `lib${name.toLowerCase()}.so`), original = await readFile(adapter);
		original[original.length - 1] ^= 1; await saveLakeFile(dirname(adapter), `lib${name.toLowerCase()}.so`, original);
		await assert.rejects(() => packageOrdinaryPython({ working: join(working, "bad-release"), nativeRoot: join(builds[0].output, "native/component"), runtimeRoot: join(builds[0].output, "native/runtime"), adapterRoot: join(builds[0].output, "native/c-binding"), leanPrefix, glibcMinimumVersion: "2.38", environment }), /drift/);
	}
	const home = join(working, "composition-venv"), interpreter = join(home, "bin/python");
	await run(python, ["-I", "-m", "venv", home], working, clean);
	await run(interpreter, ["-I", "-m", "pip", "--isolated", "install", "--no-index", "--no-deps", "--no-cache-dir", ...wheels], working, clean);
	await saveLakeFile(working, "composition.py", `import concurrent.futures, ctypes, importlib, os, threading
barrier = threading.Barrier(2)
def load(name):
    barrier.wait()
    return importlib.import_module(name)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as workers:
    first, second = workers.map(load, ["lean_iris", "lean_lotus"])
assert first.answer() == second.answer() == 42
snapshot = first._native._LIBRARY["lean_bridge_native_snapshot_read"]
snapshot.argtypes = [ctypes.c_void_p]
snapshot.restype = None
data = (ctypes.c_uint32 * 10)()
snapshot(data)
assert list(data)[2:5] == [1, 2, 2]
pid = os.fork()
if pid == 0:
    try:
        first.answer()
    except RuntimeError:
        os._exit(0)
    os._exit(1)
assert os.waitpid(pid, 0)[1] == 0
print("Two installed wheels share one Lean runtime")
`);
	for(let attempt = 0; attempt < 3; attempt++) assert.match((await run(interpreter, ["-I", "composition.py"], working, clean)).stdout, /share one Lean runtime/);
	await assert.rejects(() => run(interpreter, ["-I", "-c", 'import lean_iris; lean_iris._native._state.identity = "0" * 64; import lean_lotus'], working, clean), error => /Incompatible Lean runtime identities/.test(error.details?.stderr));
	await assert.rejects(() => run(interpreter, ["-I", "-c", 'import lean_iris; lean_iris._native._state.failed = True; import lean_lotus'], working, clean), error => /loading failed earlier/.test(error.details?.stderr));
	await run(interpreter, ["-I", "-m", "pip", "--isolated", "uninstall", "-y", "iris-api"], working, clean);
	assert.equal((await run(interpreter, ["-I", "-c", "from lean_lotus import answer; print(answer())"], working, clean)).stdout.trim(), "42");
});

test("ordinary Python packaging failure leaves no partial release", { skip: !enabled, timeout: 180_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-python-failure-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const source = join(working, "source"); await sourceProject(source, "Failure");
	await assert.rejects(() => buildCanonicalProject({ projectRoot: source, outputRoot: join(working, "release"), targets: ["c", "pypi"], environment: { ...environment, LEAN_BRIDGE_PYTHON: "/missing/python" } }));
	assert.deepEqual(await readdir(working), ["source"]);
});
