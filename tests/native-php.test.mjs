/**
 * Ordinary PHP packages execute compiled Lean after relocated Composer installation.
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
import { compilePhpPackageModel, generatePhpBindingPackage, renderPhpPackageLayout } from "../src/backends/php/generate.mjs";
import { compileCopiedPhpModel, validateOrdinaryPhpSettings } from "../src/backends/php/copied-model.mjs";
import { packageOrdinaryPhp } from "../src/release/native-composer.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { brickMathRepository } from "./helpers/brick-math.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_PHP_TEST === "1";
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const php = process.env.LEAN_BRIDGE_PHP ?? "php", composer = process.env.LEAN_BRIDGE_COMPOSER ?? "composer";
const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PERLS: '["/must/not/invoke/perl"]' };
const run = (command, args, cwd, env = environment) => processBuildRunner.capture({ command, args, cwd, env });
const phpArgs = ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "-d", "memory_limit=512M"];
const synthetic = () => createNativeModel({ ...nativeMetadataFixture(), component: { id: "example@1.0.0", name: "example", version: "1.0.0" } }).bindingIr;
const scalars = [
	["unit", "Unit", "null"], ["bool", "Bool", "true"]
	, ["u8", "UInt8", "255"], ["u16", "UInt16", "65535"]
	, ["u32", "UInt32", "4294967295"]
	, ["u64", "UInt64", "BigInteger::of('18446744073709551615')"]
	, ["i8", "Int8", "-128"], ["i16", "Int16", "-32768"]
	, ["i32", "Int32", "-2147483648"], ["i64", "Int64", "PHP_INT_MIN"]
	, ["nat", "Nat", `BigInteger::of('${(1n << 4096n) + 1n}')`]
	, ["integer", "Int", `BigInteger::of('-${1n << 4096n}')`]
	, ["f32", "Float32", "-0.0"], ["f64", "Float", "-0.0"]
	, ["text", "String", '"a\\0λ🌿"']
	, ["bytes", "ByteArray", 'Bytes::fromString("\\0\\xff\\x80")']
];
const ordered = name => name === "Clover" ? scalars : [...scalars].reverse();
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
  bits : ${name === "Clover" ? "UInt32" : "UInt64"}
structure EmptyValue where
${scalars.map(([label, type]) => `def echo_${label} (value : ${type}) := value\ndef array_${label} (value : Array ${type}) := value`).join("\n")}
def echo_record (value : Packet) := value
def choose (left right : Packet) (pick : Bool) := if pick then left else right
def echo_rows (value : Array (Array Leaf)) := value
def echo_word (value : Word) := value
def echo_empty (value : EmptyValue) := value
def array_empty (value : Array EmptyValue) := value
def matrix (value : Array UInt32) := #[value, value]
def grow (value : String) := #[value, value]
def replicate (count : UInt32) : Array UInt8 := Array.replicate count.toNat 7
def double_nat (value : Nat) := value + value
def answer : UInt32 := 42
def call_word (value : UInt32) (callback : UInt32 → UInt32) : UInt32 := callback (callback value)
def make_word (captured value : UInt32) : UInt32 := captured + value
theorem echo_rows_spec (value : Array (Array Leaf)) : echo_rows value = value := rfl
end ${name}
`);
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [name], exports: [...scalars.flatMap(([label]) => [`${name}.echo_${label}`, `${name}.array_${label}`]), ...["echo_record", "choose", "echo_rows", "echo_word", "echo_empty", "array_empty", "matrix", "grow", "replicate", "double_nat", "answer", "call_word", "make_word"].map(label => `${name}.${label}`)], arities: { [`${name}.make_word`]: 1 }, targets: { "php-native": { name: `example/${name.toLowerCase()}-api`, version: "2.0.0-RC.1" } } }));
};

test("ordinary PHP emits deterministic checked functions without public FFI", async t => {
	const ir = synthetic(), files = generatePhpBindingPackage(ir);
	assert.deepEqual(files, generatePhpBindingPackage(structuredClone(ir)));
	assert.deepEqual(files, renderPhpPackageLayout(compilePhpPackageModel(ir)));
	assert.match(files["src/Api.php"], /function increment\(mixed \$arg0\): int/);
	assert.doesNotMatch(files["src/Api.php"], /FFI|Alpha|pointer|dispatch/i);
	assert.match(files["src/Internal/Native.php"], /example_increment/);
	if(!enabled) return;
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-php-model-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	for(const [path, contents] of Object.entries(files))
	{
		await saveLakeFile(working, path, contents);
		if(path.endsWith(".php")) await run(php, ["-n", "-l", path], working);
	}
	await saveLakeFile(working, "integers.php", `<?php require 'src/Api.php';
foreach (${JSON.stringify(["0", "1", "4294967295", "18446744073709551615", String(1n << 4096n), "9".repeat(16384)])} as $text) {
    $round = LeanExample\\Internal\\IntegerCodec::decimal(LeanExample\\Internal\\IntegerCodec::limbs($text), false);
    if ($round !== $text) throw new RuntimeException('Integer conversion changed digits');
}
echo 'Exact integers';`);
	assert.equal((await run(php, ["-n", "integers.php"], working)).stdout.trim(), "Exact integers");
});

test("ordinary PHP admission rejects reserved names and noncanonical coordinates", () => {
	for(const name of ["match", "Echo", "dispatch"])
	{
		const ir = synthetic(); ir.declarations[0].name = name;
		assert.throws(() => compileCopiedPhpModel(ir), error => error.code === "unsupported-php-signature" && error.details.source.path === "Sample.lean");
	}
	for(const name of ["BigInteger", "Bytes", "Internal"])
	{
		const ir = synthetic();
		ir.types.push({ ...structuredClone(alpha.bindingIr.types.find(type => type.kind === "record")), id: "example:reserved", name, fields: [], assurance: [] });
		ir.declarations[0].parameters[0].type = { kind: "named", id: "example:reserved" };
		assert.throws(() => compileCopiedPhpModel(ir), /reserved|collid/);
	}
	for(const name of ["Null", "Empty", "Match"])
	{
		const ir = synthetic();
		ir.types.push({ ...structuredClone(alpha.bindingIr.types.find(type => type.kind === "record")), id: "example:keyword", name, fields: [], assurance: [] });
		ir.declarations[0].parameters[0].type = { kind: "named", id: "example:keyword" };
		assert.match(generatePhpBindingPackage(ir)["src/Api.php"], new RegExp(`final readonly class ${name}_\\b`));
	}
	for(const settings of [{ name: "../escape" }, { name: "Vendor/pkg" }, { name: "pkg" }, { version: "1.0" }, { version: "1.0.0-rc.1" }, { version: "1.0.0-RC.01" }, { version: ">=1.0.0" }]) assert.throws(() => validateOrdinaryPhpSettings(settings));
	validateOrdinaryPhpSettings({ name: "example/api", version: "2.0.0-RC.1" });
	const effectful = synthetic(); effectful.declarations[0].effects = ["nondeterministic"];
	assert.throws(() => compileCopiedPhpModel(effectful), /pure/);
});

const consumerSource = name => `<?php
// Deliberately weak caller mode: public checks must still reject coercion.
require __DIR__ . '/vendor/autoload.php';
use Brick\\Math\\BigInteger;
use Lean${name}\\{Bytes, Leaf, Packet, Word, EmptyValue, LeanBridgeError};
function check($condition, $message = 'Check failed') { if (!$condition) throw new RuntimeException($message); }
function same($left, $right) { check(get_debug_type($left) === get_debug_type($right) && $left == $right, 'Values differ'); }
function rejects($type, $call) {
    try { $call(); } catch (Throwable $error) {
        if ($error instanceof $type) return;
        throw $error;
    }
    throw new RuntimeException('Expected ' . $type);
}
${scalars.map(([label, , value]) => `$value = ${value};
same(Lean${name}\\echo_${label}($value), $value);
same(Lean${name}\\array_${label}([$value, $value]), [$value, $value]);
same(Lean${name}\\array_${label}([]), []);`).join("\n")}
$leaf = new Leaf(${ordered(name).map(([label, , value]) => `v_${label}: ${value}`).join(", ")});
$rows = [[$leaf], []];
$packet = new Packet(title: "packet\\0λ", leaf: $leaf, rows: $rows);
$result = Lean${name}\\echo_record($packet);
same($result, $packet);
check($result !== $packet && $result->leaf !== $leaf);
$rows[0] = [];
check(count($result->rows[0]) === 1);
rejects(Error::class, fn() => $result->rows[0] = []);
same(Lean${name}\\choose($packet, $packet, false), $packet);
same(Lean${name}\\echo_rows([[$leaf], []]), [[$leaf], []]);
$word = new Word(${name === "Clover" ? "4294967295" : "BigInteger::of('18446744073709551615')"});
same(Lean${name}\\echo_word($word), $word);
same(Lean${name}\\echo_empty(new EmptyValue()), new EmptyValue());
same(Lean${name}\\array_empty([new EmptyValue()]), [new EmptyValue()]);
same(Lean${name}\\matrix([1, 2, 3]), [[1, 2, 3], [1, 2, 3]]);
same(Lean${name}\\replicate(256), array_fill(0, 256, 7));
same(Lean${name}\\answer(), 42);
same(Lean${name}\\call_word(40, fn($value) => $value + 1), 42);
$adder = Lean${name}\\make_word(2);
try { same($adder(40), 42); same(Lean${name}\\call_word(40, $adder), 44); } finally { $adder->close(); }
same(Lean${name}\\echo_bool(false), false);
same(Lean${name}\\echo_nat(BigInteger::of('0')), BigInteger::of('0'));
same(Lean${name}\\echo_integer(BigInteger::of('0')), BigInteger::of('0'));
same(Lean${name}\\echo_integer(BigInteger::of('42')), BigInteger::of('42'));
same(Lean${name}\\echo_text(''), '');
same(Lean${name}\\echo_bytes(Bytes::fromString('')), Bytes::fromString(''));
foreach (['Lean${name}\\\\echo_f32', 'Lean${name}\\\\echo_f64'] as $echo) {
    check(is_nan($echo(NAN)));
    same($echo(INF), INF); same($echo(-INF), -INF);
    same(pack('d', $echo(-0.0)), pack('d', -0.0));
}
same(Lean${name}\\echo_f32(1 / 3), unpack('f', pack('f', 1 / 3))[1]);
same(Lean${name}\\echo_f32(1e300), INF);
foreach (['01' => '1', '-0' => '0', '+1' => '1', '1.0' => '1'] as $text => $expected) same((string) Lean${name}\\echo_nat(BigInteger::of($text)), $expected);
same((string) Lean${name}\\echo_nat(BigInteger::of(12)->plus(30)), '42');
rejects(ValueError::class, fn() => Lean${name}\\echo_nat(BigInteger::of(str_repeat('1', 16385))));
rejects(TypeError::class, fn() => Bytes::fromString(12));
${[8, 16, 32].map(bits => `rejects(ValueError::class, fn() => Lean${name}\\echo_u${bits}(-1));
rejects(ValueError::class, fn() => Lean${name}\\echo_u${bits}(${2 ** bits}));
rejects(ValueError::class, fn() => Lean${name}\\echo_i${bits}(${-(2 ** (bits-1)) - 1}));
rejects(ValueError::class, fn() => Lean${name}\\echo_i${bits}(${2 ** (bits-1)}));`).join("\n")}
rejects(ValueError::class, fn() => Lean${name}\\echo_u64(BigInteger::of('18446744073709551616')));
rejects(ValueError::class, fn() => Lean${name}\\echo_u64(BigInteger::of('-1')));
rejects(ValueError::class, fn() => Lean${name}\\echo_nat(BigInteger::of('-1')));
rejects(TypeError::class, fn() => Lean${name}\\echo_u64(1));
rejects(TypeError::class, fn() => Lean${name}\\echo_i64((float) PHP_INT_MAX));
foreach ([1.0, true, '1', null] as $bad) rejects(TypeError::class, fn() => Lean${name}\\echo_u32($bad));
rejects(TypeError::class, fn() => Lean${name}\\echo_f64(1));
rejects(TypeError::class, fn() => Lean${name}\\echo_bool(1));
rejects(TypeError::class, fn() => Lean${name}\\echo_unit(0));
rejects(TypeError::class, fn() => Lean${name}\\echo_bytes('text'));
rejects(TypeError::class, fn() => Lean${name}\\array_u32(['1']));
rejects(TypeError::class, fn() => Lean${name}\\array_u32([1 => 1]));
rejects(TypeError::class, fn() => Lean${name}\\echo_rows([[null]]));
rejects(TypeError::class, fn() => new Packet('title', $leaf, [[null]]));
$forged = (new ReflectionClass(Packet::class))->newInstanceWithoutConstructor();
foreach (['title' => 'bad', 'leaf' => $leaf, 'rows' => [[null]]] as $field => $value) (new ReflectionProperty(Packet::class, $field))->setValue($forged, $value);
rejects(TypeError::class, fn() => Lean${name}\\echo_record($forged));
$forgedInteger = (new ReflectionClass(BigInteger::class))->newInstanceWithoutConstructor();
(new ReflectionProperty(BigInteger::class, 'value'))->setValue($forgedInteger, 'invalid');
rejects(ValueError::class, fn() => Lean${name}\\echo_nat($forgedInteger));
rejects(ValueError::class, fn() => Lean${name}\\echo_text("\\xff"));
rejects(ValueError::class, fn() => Lean${name}\\echo_text(str_repeat('x', 16 * 1024 * 1024 + 1)));
rejects(ValueError::class, fn() => Lean${name}\\array_unit(array_fill(0, 600000, null)));
for ($i = 0; $i < 3; $i++) {
    rejects(LeanBridgeError::class, fn() => Lean${name}\\grow(str_repeat('x', 6 * 1024 * 1024)));
    rejects(LeanBridgeError::class, fn() => Lean${name}\\replicate(2100000));
    same(count(Lean${name}\\grow(str_repeat('x', 5000000))), 2);
    rejects(ValueError::class, fn() => Lean${name}\\replicate(600000));
    same(Lean${name}\\answer(), 42);
}
rejects(ValueError::class, fn() => Lean${name}\\double_nat(BigInteger::of(str_repeat('9', 16384))));
for ($i = 0; $i < 100; $i++) same(Lean${name}\\echo_record($packet), $packet);
echo 'Installed ${name}: all copied types, exact validation and recovery passed', PHP_EOL;
`;

test("ordinary PHP ZIPs reproduce and execute after offline Composer installation", { skip: !enabled, timeout: 900_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-php-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const packages = [], clean = { PATH: "/usr/bin:/bin", CC: "/missing/cc", LEAN_BRIDGE_LEAN_PREFIX: "/missing/lean", LEAN_BRIDGE_NATIVE_ROOT: "/must/not/use/overrides", COMPOSER_HOME: join(working, "composer-config"), COMPOSER_CACHE_DIR: join(working, "composer-cache"), COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1" };
	const install = async (consumer, entries) => {
		await mkdir(consumer);
		await saveLakeFile(consumer, "composer.json", canonicalJson({ name: "test/consumer", repositories: [{ "packagist.org": false }, await brickMathRepository(join(consumer, "feed")), ...entries.map(entry => ({ type: "package", package: entry }))], require: Object.fromEntries(entries.map(entry => [entry.name, entry.version])) }));
		await run(composer, ["--no-plugins", "--no-scripts", "--no-interaction", "install", "--prefer-dist"], consumer, clean);
	};
	for(const name of ["Clover", "Juniper"])
	{
		const source = join(working, name), relocated = `${source}-relocated`;
		await sourceProject(source, name); await cp(source, relocated, { recursive: true });
		const before = await lakeInputState(source), builds = [];
		for(const [index, projectRoot] of [source, relocated].entries())
			builds.push(await buildCanonicalProject({ projectRoot, outputRoot: join(working, `${name}-build${index}`), targets: ["php-native", "c"], environment }));
		assert.deepEqual(await lakeInputState(source), before);
		assert.deepEqual(builds[0].packages, builds[1].packages);
		t.diagnostic(canonicalJson({ project: name, archives: builds[0].packages.map(({ archive, sha256 }) => ({ path: archive, sha256 })) }).trim());
		await rename(source, `${source}-hidden`); await rename(relocated, `${relocated}-hidden`);
		const entry = JSON.parse(await readFile(join(builds[0].output, "packages/php-native/composer/composer.json"), "utf8"));
		const archive = builds[0].packages.find(pkg => pkg.archive.endsWith(".zip"));
		entry.dist = { type: "zip", url: `file://${join(builds[0].output, "archives", archive.archive)}` };
		packages.push(entry);
		const originalConsumer = join(working, `consumer-${name}`), consumer = `${originalConsumer}-moved`;
		await install(originalConsumer, [entry]); await rename(originalConsumer, consumer);
		await saveLakeFile(consumer, "main.php", consumerSource(name));
		assert.match((await run(php, [...phpArgs, "main.php"], consumer, clean)).stdout, /validation and recovery passed/);
		const model = compileCopiedPhpModel(JSON.parse(await readFile(join(builds[0].output, "native/component/binding-ir.json"), "utf8")));
		assert.equal(model.surface.functions.length, 45);
		const root = join(consumer, "vendor", entry.name), native = join(root, "src/Internal/Native.php"), original = await readFile(native, "utf8");
		const result = model.surface.copy(model.surface.functions.find(fn => fn.field === "echo_record").declaration.result.type);
		// Test-only edits inject failure after native output allocation, with observable cleanup.
		const injected = original.replace(`private static function from${result.index}(mixed $value, Scope $scope): mixed {`, `private static function from${result.index}(mixed $value, Scope $scope): mixed {\n        if (!empty($GLOBALS['failResult'])) throw new \\Error('injected result conversion failure');`)
			.replaceAll(`$ffi->${result.name}_clear(\\FFI::addr($out));`, `$ffi->${result.name}_clear(\\FFI::addr($out)); if ($out->title->data !== null || $out->rows->data !== null) throw new \\Error('Output owners not cleared'); $GLOBALS['clears'] = ($GLOBALS['clears'] ?? 0) + 1;`)
			.replace("$this->owners = [];", "$this->owners = []; $GLOBALS['closed'] = ($GLOBALS['closed'] ?? 0) + 1;");
		assert.notEqual(injected, original); await saveLakeFile(dirname(native), "Native.php", injected);
		await saveLakeFile(consumer, "failure.php", `<?php require 'main.php'; $GLOBALS['failResult'] = true; $GLOBALS['clears'] = $GLOBALS['closed'] = 0; rejects(Error::class, fn() => Lean${name}\\echo_record($packet)); check($GLOBALS['clears'] === 1 && $GLOBALS['closed'] === 1); $GLOBALS['failResult'] = false; same(Lean${name}\\echo_record($packet), $packet); echo 'Result failure cleared native output', PHP_EOL;`);
		assert.match((await run(php, [...phpArgs, "failure.php"], consumer, clean)).stdout, /failure cleared native output/);
		await saveLakeFile(dirname(native), "Native.php", original);
		const scratch = original.replace("$this->owners[] = $memory;", "$this->owners[] = $memory; if (!empty($GLOBALS['failScratch'])) { $GLOBALS['scratch'][] = \\WeakReference::create($memory); if (count($GLOBALS['scratch']) === 5) throw new \\Error('injected scratch allocation failure'); }");
		await saveLakeFile(dirname(native), "Native.php", scratch);
		await saveLakeFile(consumer, "scratch.php", `<?php require 'main.php'; $GLOBALS['failScratch'] = true; $GLOBALS['scratch'] = []; rejects(Error::class, fn() => Lean${name}\\echo_record($packet)); gc_collect_cycles(); foreach ($GLOBALS['scratch'] as $ref) check($ref->get() === null); $GLOBALS['failScratch'] = false; same(Lean${name}\\echo_record($packet), $packet); echo 'Scratch owners released', PHP_EOL;`);
		assert.match((await run(php, [...phpArgs, "scratch.php"], consumer, clean)).stdout, /Scratch owners released/);
		await saveLakeFile(dirname(native), "Native.php", original);
		if(name === "Clover")
		{
			const docs = join(working, "docs-consumer");
			await mkdir(join(docs, "releases"), { recursive: true });
			await cp(join(builds[0].output, "archives", archive.archive), join(docs, "releases", archive.archive));
			for(const file of ["composer.json", "main.php"]) await cp(new URL(`./fixtures/documentation/consumers/php-native/ordinary/${file}`, import.meta.url), join(docs, file));
			const config = JSON.parse(await readFile(join(docs, "composer.json"), "utf8"));
			config.repositories.unshift({ "packagist.org": false }, await brickMathRepository(join(docs, "feed")));
			await saveLakeFile(docs, "composer.json", canonicalJson(config));
			await run(composer, ["--no-plugins", "--no-scripts", "--no-interaction", "install", "--prefer-dist"], docs, clean);
			assert.match((await run(php, [...phpArgs, "main.php"], docs, clean)).stdout, /42; exact integers and copied arrays/);
		}
		const lib = join(root, `native/linux-x64/lib${name.toLowerCase()}.so`), bytes = await readFile(lib);
		bytes[bytes.length - 1] ^= 1; await saveLakeFile(dirname(lib), `lib${name.toLowerCase()}.so`, bytes);
		await assert.rejects(() => run(php, [...phpArgs, "main.php"], consumer, clean), error => /differs from compiled evidence/.test(error.details?.stdout + error.details?.stderr));
		const adapter = join(builds[0].output, "native/c-binding/lib", `lib${name.toLowerCase()}.so`), adapterBytes = await readFile(adapter);
		adapterBytes[adapterBytes.length - 1] ^= 1; await saveLakeFile(dirname(adapter), `lib${name.toLowerCase()}.so`, adapterBytes);
		await assert.rejects(() => packageOrdinaryPhp({ working: join(working, "bad-release"), nativeRoot: join(builds[0].output, "native/component"), runtimeRoot: join(builds[0].output, "native/runtime"), adapterRoot: join(builds[0].output, "native/c-binding"), leanPrefix, glibcMinimumVersion: "2.38", environment }), /drift/);
	}
	const composition = join(working, "composition"); await install(composition, packages);
	await saveLakeFile(composition, "main.php", `<?php require 'vendor/autoload.php';
if (LeanClover\\answer() !== 42 || LeanJuniper\\answer() !== 42) throw new RuntimeException('Wrong answers');
$integer = LeanClover\\echo_nat(Brick\\Math\\BigInteger::of('18446744073709551616'));
if ((string) LeanJuniper\\echo_nat($integer)->plus(1) !== '18446744073709551617') throw new RuntimeException('Integer cannot cross packages');
$adder = LeanJuniper\\make_word(2);
try { if (LeanClover\\call_word(40, $adder) !== 44) throw new RuntimeException('Closure cannot cross packages'); } finally { $adder->close(); }
$marker = new Error('cross-package error');
try { LeanClover\\call_word(1, fn($value) => LeanJuniper\\call_word($value, fn($inner) => throw $marker)); throw new RuntimeException('Missing failure'); }
catch (Error $error) { if ($error !== $marker) throw new RuntimeException('Callback error identity lost'); }
if (LeanClover\\call_word(1, fn($value) => LeanJuniper\\call_word($value, fn($inner) => $inner + 1)) !== 5) throw new RuntimeException('Nested callbacks failed');
$ffi = FFI::cdef('void lean_bridge_native_snapshot_read(void*);', __DIR__ . '/vendor/example/clover-api/native/linux-x64/liblean_bridge_native.so');
$data = $ffi->new('uint32_t[10]'); $ffi->lean_bridge_native_snapshot_read(FFI::addr($data));
if ($data[2] !== 1 || $data[3] !== 2 || $data[4] !== 2) throw new RuntimeException('Runtime not shared');
$pid = pcntl_fork();
if ($pid === 0) { try { LeanClover\\answer(); } catch (RuntimeException $error) { exit(0); } exit(1); }
pcntl_waitpid($pid, $status); if ($status !== 0) throw new RuntimeException('Fork not rejected');
echo 'Two Composer packages share one Lean runtime', PHP_EOL;
`);
	for(let i = 0; i < 3; i++) assert.match((await run(php, [...phpArgs, "main.php"], composition, clean)).stdout, /share one Lean runtime/);
	await assert.rejects(() => run(php, [...phpArgs, "main.php"], composition, { ...clean, LD_PRELOAD: join(composition, "vendor/example/clover-api/native/linux-x64/libleanshared.so") }), error => /foreign Lean runtime/.test(error.details?.stdout + error.details?.stderr));
	await saveLakeFile(composition, "foreign.php", "<?php $ffi = FFI::cdef('void *dlopen(const char *, int);', 'libdl.so.2'); $ffi->dlopen(__DIR__ . '/vendor/example/clover-api/native/linux-x64/libleanshared.so', 2); require 'main.php';");
	await assert.rejects(() => run(php, [...phpArgs, "foreign.php"], composition, clean), error => /foreign Lean runtime/.test(error.details?.stdout + error.details?.stderr));
	await assert.rejects(() => run(php, ["-n", "-d", "extension=ffi", "-d", "ffi.enable=0", "main.php"], composition, clean), error => /FFI|restricted/i.test(error.details?.stdout + error.details?.stderr));
	await run(composer, ["--no-plugins", "--no-scripts", "--no-interaction", "remove", "example/clover-api"], composition, clean);
	await saveLakeFile(composition, "remaining.php", "<?php require 'vendor/autoload.php'; if (LeanJuniper\\answer() !== 42) throw new RuntimeException('Remaining package failed'); echo '42';");
	assert.equal((await run(php, [...phpArgs, "remaining.php"], composition, clean)).stdout.trim(), "42");
});

test("ordinary PHP packaging failure leaves no partial release", { skip: !enabled, timeout: 180_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-php-failure-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const source = join(working, "source"); await sourceProject(source, "Failure");
	await assert.rejects(() => buildCanonicalProject({ projectRoot: source, outputRoot: join(working, "release"), targets: ["c", "php-native"], environment: { ...environment, LEAN_BRIDGE_PHP: "/missing/php" } }));
	assert.deepEqual(await readdir(working), ["source"]);
});
