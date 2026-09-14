/**
 * Ordinary RubyGems releases execute copied values after clean installation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { generateRubyBindingPackage, compileRubyPackageModel, renderRubyPackageLayout } from "../src/backends/ruby/generate.mjs";
import { compileCopiedRubyModel, validateOrdinaryRubySettings } from "../src/backends/ruby/copied-model.mjs";
import { rubyLiteral } from "../src/backends/ruby/copied-assets.mjs";
import { packageOrdinaryRuby } from "../src/release/native-rubygems.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_RUBY_TEST === "1";
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const ruby = process.env.LEAN_BRIDGE_RUBY ?? "ruby", gem = process.env.LEAN_BRIDGE_GEM ?? "gem";
const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PERLS: '["/must/not/invoke/perl"]' };
const run = (command, args, cwd, env = environment) => processBuildRunner.capture({ command, args, cwd, env });
const synthetic = () => createNativeModel({ ...nativeMetadataFixture(), component: { id: "example@1.0.0", name: "example", version: "1.0.0" } }).bindingIr;
const scalars = [
	["unit", "Unit", "API::UNIT"], ["bool", "Bool", "true"]
	, ["u8", "UInt8", "255"], ["u16", "UInt16", "65535"]
	, ["u32", "UInt32", "(1 << 32) - 1"], ["u64", "UInt64", "(1 << 64) - 1"]
	, ["i8", "Int8", "-128"], ["i16", "Int16", "-32768"]
	, ["i32", "Int32", "-(1 << 31)"], ["i64", "Int64", "-(1 << 63)"]
	, ["nat", "Nat", "(1 << 4096) + 1"], ["integer", "Int", "-(1 << 4096)"]
	, ["f32", "Float32", "-0.0"], ["f64", "Float", "-0.0"]
	, ["text", "String", '"a\\0λ🌿"'], ["bytes", "ByteArray", '"\\0\\xff\\x80".b']
];
const ordered = name => name === "Willow" ? scalars : [...scalars].reverse();
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
  bits : ${name === "Willow" ? "UInt32" : "UInt64"}
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
def answer : UInt32 := 42
end ${name}
`);
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [name], exports: [...scalars.flatMap(([label]) => [`${name}.echo_${label}`, `${name}.array_${label}`]), ...["echo_record", "choose", "echo_rows", "echo_word", "echo_empty", "array_empty", "matrix", "grow", "answer"].map(label => `${name}.${label}`)], targets: { rubygems: { name: `${name.toLowerCase()}-api`, version: "2.0.0.rc.1" } } }));
};

test("ordinary Ruby generation is source-named, deterministic and keeps Fiddle private", () => {
	const ir = synthetic(), files = generateRubyBindingPackage(ir);
	assert.deepEqual(files, generateRubyBindingPackage(structuredClone(ir)));
	assert.deepEqual(files, renderRubyPackageLayout(compileRubyPackageModel(ir)));
	assert.match(files["lib/lean_bridge/example.rb"], /def increment\(arg0\)/);
	assert.doesNotMatch(files["lib/lean_bridge/example.rb"], /Alpha|Fiddle|Pointer/);
	assert.match(files["lib/lean_bridge/example/native.rb"], /example_increment/);
	assert.equal(rubyLiteral('#{abort "injected"} #@instance #$global'), '"\\#{abort \\"injected\\"} \\#@instance \\#$global"');
});

test("ordinary Ruby admission rejects reserved names and normalized gem versions", () => {
	for(const name of ["send", "object_id", "module_function"])
	{
		const ir = synthetic(); ir.declarations[0].name = name;
		assert.throws(() => compileCopiedRubyModel(ir), error => error.code === "unsupported-ruby-signature" && error.details.source.path === "Sample.lean");
	}
	for(const settings of [{ name: "../escape" }, { name: "UPPER" }, { version: "1.0" }, { version: "1.0.0-rc.1" }, { version: ">= 1.0.0" }]) assert.throws(() => validateOrdinaryRubySettings(settings));
	validateOrdinaryRubySettings({ name: "example-api", version: "2.0.0.rc.1" });
});

const consumerSource = (name, resultCopy) => `require "lean_bridge/${name.toLowerCase()}"
API = LeanBridge::${name}
def check(value); raise "assertion failed" unless value; end
def rejects(type)
  begin
    yield
  rescue type
    return
  end
  raise "expected #{type}"
end
${scalars.map(([label, , value]) => `value = ${value}
check(API.echo_${label}(value) == value)
check(API.array_${label}([value, value]) == [value, value])
check(API.array_${label}([]) == [])`).join("\n")}
leaf = API::Leaf.new(${ordered(name).map(([label, , value]) => `v_${label}: ${value}`).join(", ")})
packet = API::Packet.new(title: "packet\\0λ", leaf: leaf, rows: [[leaf], []])
result = API.echo_record(packet)
check(result.title == packet.title && result.frozen? && result.rows != nil)
${scalars.map(([label, , value]) => `check(result.leaf.v_${label} == ${value})
check(result.rows[0][0].v_${label} == ${value})`).join("\n")}
check(!result.equal?(packet) && !result.rows.equal?(packet.rows) && !result.rows[0].equal?(packet.rows[0]))
check(API.choose(packet, packet, false).title == packet.title)
check(API.echo_rows([[leaf], []])[0][0].v_nat == (1 << 4096) + 1)
check(API.echo_word(API::Word.new(bits: (1 << ${name === "Willow" ? 32 : 64}) - 1)).bits == (1 << ${name === "Willow" ? 32 : 64}) - 1)
check(API.echo_empty(API::Empty.new).instance_of?(API::Empty))
check(API.array_empty([API::Empty.new]).length == 1)
matrix = API.matrix([1, 2, 3]); matrix[0][0] = 9; check(matrix[1][0] == 1)
check(API.answer == 42 && API.echo_bool(false) == false)
check(API.echo_nat(0) == 0 && API.echo_integer(0) == 0 && API.echo_integer(1 << 200) == 1 << 200)
check(API.echo_text("") == "" && API.echo_bytes("").encoding == Encoding::BINARY)
check(API.echo_f32(Float::NAN).nan? && API.echo_f64(Float::NAN).nan?)
check(API.echo_f32(Float::INFINITY).infinite? == 1 && API.echo_f64(-Float::INFINITY).infinite? == -1)
check((1.0 / API.echo_f32(-0.0)).infinite? == -1 && (1.0 / API.echo_f64(-0.0)).infinite? == -1)
check(API.echo_f32(1.0 / 3) == [1.0 / 3].pack("e").unpack1("e"))
${[8, 16, 32, 64].map(bits => `rejects(RangeError) { API.echo_u${bits}(-1) }
rejects(RangeError) { API.echo_u${bits}(1 << ${bits}) }
rejects(RangeError) { API.echo_i${bits}(-(1 << ${bits - 1}) - 1) }
rejects(RangeError) { API.echo_i${bits}(1 << ${bits - 1}) }`).join("\n")}
rejects(RangeError) { API.echo_nat(-1) }
rejects(TypeError) { API.echo_u32(1.0) }
rejects(TypeError) { API.echo_f64(1) }
rejects(TypeError) { API.echo_bool(1) }
rejects(TypeError) { API.echo_unit(nil) }
rejects(TypeError) { API.echo_text(nil) }
rejects(TypeError) { API.array_u32([nil]) }
rejects(TypeError) { API.echo_rows([[nil]]) }
rejects(EncodingError) { API.echo_text("\\xff".force_encoding(Encoding::UTF_8)) }
rejects(EncodingError) { API.echo_text("text".encode(Encoding::UTF_16LE)) }
rejects(RangeError) { API.echo_text("x" * (16 * 1024 * 1024 + 1)) }
rejects(RangeError) { API.array_unit(Array.new(2_100_000, API::UNIT)) }
3.times { rejects(RangeError) { API.grow("x" * (6 * 1024 * 1024)) } }
4.times.map { Thread.new { 100.times { check(API.echo_record(packet).leaf.v_u64 == (1 << 64) - 1) } } }.each(&:value)
GC.start; GC.compact
check(API.echo_record(packet).title == packet.title)

# Fault injection is test-only reflection into the private conversion module.
native = API.const_get(:Native)
scope_class = native.const_get(:Scope)
allocated = []
inject_scratch_failure = true
scope_class.prepend(Module.new do
  define_method(:allocate) do |*args, **kwargs|
    pointer = super(*args, **kwargs)
    allocated << pointer
    raise NoMemoryError, "injected scratch failure" if inject_scratch_failure && allocated.length == 3
    pointer
  end
end)
rejects(NoMemoryError) { API.echo_record(packet) }
check(allocated.all?(&:freed?))
allocated.clear
inject_scratch_failure = false
cleared = 0
native.const_get(:CLEAR${resultCopy}).define_singleton_method(:call) do |*args|
  cleared += 1
  super(*args)
end
native.singleton_class.prepend(Module.new do
  define_method(:from${resultCopy}) { |*| raise NoMemoryError, "injected result allocation failure" }
end)
rejects(NoMemoryError) { API.echo_record(packet) }
check(cleared == 1 && allocated.all?(&:freed?))
puts "Installed ${name}: copied values, exact types, cleanup and concurrency passed"
`;

test("ordinary gems reproduce and run without Lean or an extension build", { skip: !enabled, timeout: 900_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-ruby-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const homes = [];
	for(const name of ["Willow", "Aspen"])
	{
		const source = join(working, name), relocated = `${source}-relocated`;
		await sourceProject(source, name); await cp(source, relocated, { recursive: true });
		const before = await lakeInputState(source), builds = [];
		for(const [index, projectRoot] of [source, relocated].entries())
			builds.push(await buildCanonicalProject({ projectRoot, outputRoot: join(working, `${name}-build${index}`), targets: ["rubygems", "c"], environment: { ...environment, RUBYOPT: "-r/missing/ambient.rb", RUBYLIB: "/missing/ruby" } }));
		assert.deepEqual(await lakeInputState(source), before);
		assert.deepEqual(builds[0].packages, builds[1].packages);
		t.diagnostic(canonicalJson({ project: name, archives: builds[0].packages.map(({ archive, sha256 }) => ({ path: archive, sha256 })) }).trim());
		await rename(source, `${source}-hidden`); await rename(relocated, `${relocated}-hidden`);
		const home = join(working, `gems-${name}`), consumer = join(working, `consumer-${name}`);
		const clean = { PATH: "/usr/bin:/bin", GEM_HOME: home, GEM_PATH: home, CC: "/missing/cc", LEAN_BRIDGE_LEAN_PREFIX: "/missing/lean", LEAN_BRIDGE_NATIVE_ROOT: "/must/not/use/overrides" };
		const archive = builds[0].packages.find(pkg => pkg.archive.endsWith(".gem"));
		await mkdir(consumer); await run(gem, ["install", join(builds[0].output, "archives", archive.archive), "--local", "--install-dir", home, "--no-document"], consumer, clean);
		const model = compileCopiedRubyModel(JSON.parse(await readFile(join(builds[0].output, "native/component/binding-ir.json"), "utf8")));
		const resultCopy = model.surface.copy(model.surface.functions.find(fn => fn.field === "echo_record").declaration.result.type).index;
		await saveLakeFile(consumer, "consumer.rb", consumerSource(name, resultCopy));
		assert.match((await run(ruby, ["consumer.rb"], consumer, clean)).stdout, /cleanup and concurrency passed/);
		homes.push(home);
		const bad = join(working, `bad-${name}`), packageRoot = join(builds[0].output, "packages/rubygems/package");
		await cp(join(packageRoot, "lib"), join(bad, "lib"), { recursive: true });
		const lib = join(bad, "lib/lean_bridge", name.toLowerCase(), "native/linux-x64", `lib${name.toLowerCase()}.so`);
		const bytes = await readFile(lib); bytes[bytes.length - 1] ^= 1; await saveLakeFile(dirname(lib), `lib${name.toLowerCase()}.so`, bytes);
		await assert.rejects(() => run(ruby, ["-I", join(bad, "lib"), "-r", `lean_bridge/${name.toLowerCase()}`, "-e", "abort 'should not load'"], consumer, clean), error => /differs from compiled evidence/.test(error.details?.stderr));
		const adapter = join(builds[0].output, "native/c-binding/lib", `lib${name.toLowerCase()}.so`);
		const original = await readFile(adapter); original[original.length - 1] ^= 1; await saveLakeFile(dirname(adapter), `lib${name.toLowerCase()}.so`, original);
		await assert.rejects(() => packageOrdinaryRuby({ working: join(working, "bad-release"), nativeRoot: join(builds[0].output, "native/component"), runtimeRoot: join(builds[0].output, "native/runtime"), adapterRoot: join(builds[0].output, "native/c-binding"), leanPrefix, glibcMinimumVersion: "2.38", environment }), /drift/);
	}
	await saveLakeFile(working, "composition.rb", `gem "willow-api"
gem "aspen-api"
start = Queue.new
threads = ["willow", "aspen"].map { |name| Thread.new { start.pop; require "lean_bridge/#{name}" } }
2.times { start << true }
threads.each(&:value)
raise unless LeanBridge::Willow.answer == 42 && LeanBridge::Aspen.answer == 42
library = LeanBridge::Willow.const_get(:Native).const_get(:LIBRARY)
Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) do |memory|
  Fiddle::Function.new(library["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID).call(memory)
  raise "runtime not shared" unless memory[8, 12].unpack("L<L<L<") == [1, 2, 2]
end
puts "Two installed gems share one Lean runtime"
`);
	for(let attempt = 0; attempt < 5; attempt++) assert.match((await run(ruby, ["composition.rb"], working, { PATH: "/usr/bin:/bin", GEM_HOME: homes[0], GEM_PATH: homes.join(":") })).stdout, /share one Lean runtime/);
});

test("ordinary gem packaging failure leaves no partial release", { skip: !enabled, timeout: 180_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-ruby-failure-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const source = join(working, "source"); await sourceProject(source, "Failure");
	await assert.rejects(() => buildCanonicalProject({ projectRoot: source, outputRoot: join(working, "release"), targets: ["c", "rubygems"], environment: { ...environment, LEAN_BRIDGE_RUBY: "/missing/ruby" } }));
	assert.deepEqual(await readdir(working), ["source"]);
});
