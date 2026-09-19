/**
 * Real Lean copied APIs deliberately reuse module names across two packages.
 *
 * @file
 */
import { canonicalJson } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const phpWasmOrdinaryScalars = [
	["unit", "Unit", "null"], ["bool", "Bool", "true"]
	, ["u8", "UInt8", "255"], ["u16", "UInt16", "65535"]
	, ["u32", "UInt32", "BigInteger::of('4294967295')"]
	, ["u64", "UInt64", "BigInteger::of('18446744073709551615')"]
	, ["i8", "Int8", "-128"], ["i16", "Int16", "-32768"]
	, ["i32", "Int32", "-2147483647 - 1"]
	, ["i64", "Int64", "BigInteger::of('-9223372036854775808')"]
	, ["nat", "Nat", `BigInteger::of('${(1n << 4096n) + 1n}')`]
	, ["integer", "Int", `BigInteger::of('-${1n << 4096n}')`]
	, ["f32", "Float32", "-0.0"], ["f64", "Float", "-0.0"]
	, ["text", "String", '"a\\0λ🌿"']
	, ["bytes", "ByteArray", 'Bytes::fromString("\\0\\xff\\x80")']
];
const fields = name => name === "Willow" ? phpWasmOrdinaryScalars : [...phpWasmOrdinaryScalars].reverse();
const big = value => `BigInteger::of('${value}')`;
const integerEdges = [31n, 32n, 53n, 63n].flatMap(bits => {
	const value = 1n << bits;
	return [value - 1n, value, value + 1n];
});
export const phpWasmPrimitiveVectors = [
	["unit", ["null"]], ["bool", ["false", "true"]]
	, ["u8", ["0", "1", "127", "128", "255"]]
	, ["u16", ["0", "1", "32767", "32768", "65535"]]
	, ["u32", [0n, 1n, 2147483647n, 2147483648n, 2147483649n, 4294967295n].map(big)]
	, ["u64", [0n, 1n, ...integerEdges, (1n << 64n) - 1n].map(big)]
	, ["i8", ["-128", "-1", "0", "127"]]
	, ["i16", ["-32768", "-1", "0", "32767"]]
	, ["i32", ["-2147483647 - 1", "-1", "0", "2147483647"]]
	, ["i64", [-(1n << 63n), -9007199254740993n, -2147483649n, -1n, 0n, 1n, 2147483648n, 9007199254740993n, (1n << 63n) - 1n].map(big)]
	, ["nat", [0n, 1n, ...integerEdges, (1n << 64n) - 1n, 1n << 64n, (1n << 64n) + 1n, (1n << 4096n) + 1n].map(big)]
	, ["integer", [-(1n << 4096n), -(1n << 64n) - 1n, -9007199254740993n, -1n, 0n, 1n, ...integerEdges, (1n << 64n) + 1n, (1n << 4096n) + 1n].map(big)]
	, ["f32", ["NAN", "INF", "-INF", "0.0", "-0.0", "1 / 3", "2.0 ** -149", "-(2.0 ** -149)"]]
	, ["f64", ["NAN", "INF", "-INF", "0.0", "-0.0", "1 / 3", "2.0 ** -1074", "-(2.0 ** -1074)"]]
	, ["text", ['""', '"\\0"', '"a\\0λ🌿"']]
	, ["bytes", ["Bytes::fromString('')", 'Bytes::fromString("\\0\\xff\\x80")', "Bytes::fromString(implode('', array_map('chr', range(0, 255))))"]]
].flatMap(([label, values]) => values.map(value => ({ label, value
	, expected: label === "f32" ? `unpack('f', pack('f', ${value}))[1]` : value })));
/**
 * Create a pure Lean API with no hand-written native implementation.
 *
 * @param root - Temporary source root.
 * @param name - Component discriminator and public namespace suffix.
 * @param options - Additional callable composition fixtures.
 * @param options.callables - Include synchronous callbacks and returned functions.
 */
export const createPhpWasmOrdinaryProject = async (root, name, { callables = false } = {}) => {
	await saveLakeFile(root, "LICENSE", `Source notice fixture: ${name}\n`);
	await saveLakeFile(root, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(root, "lakefile.toml", `name = "${name.toLowerCase()}"\n[[lean_lib]]\nname = "SharedApi"\n`);
	await saveLakeFile(root, "SharedApi.lean", `namespace SharedApi
structure Leaf where
${fields(name).map(([label, type]) => `  v_${label} : ${type}`).join("\n")}
structure Packet where
  title : String
  leaf : Leaf
  rows : Array (Array Leaf)
structure Word where
  bits : ${name === "Willow" ? "UInt32" : "UInt64"}
structure EmptyValue where
${phpWasmOrdinaryScalars.map(([label, type]) => `def echo_${label} (value : ${type}) := value\ndef array_${label} (value : Array ${type}) := value`).join("\n")}
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
def nat_low_word (value : Nat) : UInt32 := value.toUInt32
def answer : UInt16 := ${name === "Willow" ? 17 : 29}
${callables ? "def call_word (value : UInt32) (callback : UInt32 → UInt32) : UInt32 := callback (callback value)\ndef make_word (captured value : UInt32) : UInt32 := captured + value" : ""}
theorem echo_rows_spec (value : Array (Array Leaf)) : echo_rows value = value := rfl
end SharedApi
`);
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["SharedApi"], exports: [...phpWasmOrdinaryScalars.flatMap(([label]) => [`SharedApi.echo_${label}`, `SharedApi.array_${label}`]), ...["echo_record", "choose", "echo_rows", "echo_word", "echo_empty", "array_empty", "matrix", "grow", "replicate", "double_nat", "nat_low_word", "answer", ...callables ? ["call_word", "make_word"] : []].map(label => `SharedApi.${label}`)], ...callables ? { arities: { "SharedApi.make_word": 1 } } : {}, targets: { "php-wasm": { npm: { name: `@example/${name.toLowerCase()}-php-wasm`, version: "2.0.0-RC.1" }, composer: { name: `example/${name.toLowerCase()}-php-wasm`, version: "2.0.0-RC.1" } } } }));
};

/**
 * Exercise exact copied values through weak and strict PHP callers.
 *
 * @param name - Component discriminator and public namespace suffix.
 * @param options - Caller strictness; generated validation must not depend on it.
 * @param options.strict - Enable PHP strict_types in the consumer file.
 * @param options.callables - Exercise the additional callable exports.
 */
export const phpWasmOrdinaryConsumer = (name, { strict = false, callables = false } = {}) => `<?php
declare(strict_types=${strict ? 1 : 0});
namespace Test${name};
require_once '/${name}/src/Api.php';
use Brick\\Math\\BigInteger;
use Lean${name}\\{Bytes, Leaf, Packet, Word, EmptyValue};
function check($condition, $message = 'Check failed') { if (!$condition) throw new \\RuntimeException($message); }
function same($a, $b) {
    check(get_debug_type($a) === get_debug_type($b), 'Value types differ');
    if (is_float($a)) { check(is_nan($a) ? is_nan($b) : pack('d', $a) === pack('d', $b), 'Float bits differ'); return; }
    if ($a instanceof BigInteger || $a instanceof Bytes) { check((string) $a === (string) $b, 'Copied contents differ'); return; }
    if (is_object($a)) { same(get_object_vars($a), get_object_vars($b)); return; }
    if (is_array($a)) {
        check(array_keys($a) === array_keys($b), 'Array keys differ');
        foreach ($a as $key => $value) same($value, $b[$key]);
        return;
    }
    check($a === $b, 'Values differ');
}
function rejects($call, $class = \\Throwable::class) {
    try { $call(); } catch (\\Throwable $error) { check($error instanceof $class, get_class($error) . ': ' . $error->getMessage()); return; }
    throw new \\RuntimeException('Expected rejection');
}
check(PHP_INT_SIZE === 4);
rejects(fn() => same([BigInteger::of('1')], [BigInteger::of('2')]));
rejects(fn() => same(Bytes::fromString('a'), Bytes::fromString('b')));
rejects(fn() => same([-0.0], [0.0]));
same([NAN], [NAN]);
function leafValue($label, $value) {
    $fields = [${fields(name).map(([label, , value]) => `'v_${label}' => ${value}`).join(", ")}];
    $fields['v_' . $label] = $value;
    return new Leaf(...$fields);
}
function exactValue($label, $value, $expected) {
    $call = 'Lean${name}\\\\echo_' . $label;
    $array = 'Lean${name}\\\\array_' . $label;
    same($call($value), $expected);
    same($array([$value, $value]), [$expected, $expected]);
    $leaf = leafValue($label, $value); $expectedLeaf = leafValue($label, $expected);
    same(\\Lean${name}\\echo_rows([[$leaf], []]), [[$expectedLeaf], []]);
    same(\\Lean${name}\\echo_record(new Packet(title: 'boundary', leaf: $leaf, rows: [[$leaf]])),
        new Packet(title: 'boundary', leaf: $expectedLeaf, rows: [[$expectedLeaf]]));
}
${phpWasmPrimitiveVectors.map(({ label, value, expected }) => `exactValue('${label}', ${value}, ${expected});`).join("\n")}
foreach ([str_repeat('9', 16384), '-' . str_repeat('9', 16384)] as $text) {
    $value = BigInteger::of($text);
    exactValue('integer', $value, $value);
    if ($text[0] !== '-') exactValue('nat', $value, $value);
}
${phpWasmOrdinaryScalars.map(([label, , value]) => `$value = ${value};
same(\\Lean${name}\\echo_${label}($value), $value);
same(\\Lean${name}\\array_${label}([$value, $value]), [$value, $value]);
same(\\Lean${name}\\array_${label}([]), []);`).join("\n")}
$leaf = new Leaf(${fields(name).map(([label, , value]) => `v_${label}: ${value}`).join(", ")});
$packet = new Packet(title: "packet\\0λ", leaf: $leaf, rows: [[$leaf], []]);
$result = \\Lean${name}\\echo_record($packet);
same($result, $packet); check($result !== $packet && $result->leaf !== $leaf && $result->rows[0][0] !== $leaf);
rejects(fn() => $result->rows = []);
$other = new Packet(title: 'other', leaf: $leaf, rows: []);
same(\\Lean${name}\\choose($packet, $other, false), $other);
same(\\Lean${name}\\echo_rows([[$leaf], []]), [[$leaf], []]);
$word = new Word(BigInteger::of('${name === "Willow" ? "4294967295" : "18446744073709551615"}'));
same(\\Lean${name}\\echo_word($word), $word);
same(\\Lean${name}\\echo_empty(new EmptyValue()), new EmptyValue());
same(\\Lean${name}\\array_empty([new EmptyValue(), new EmptyValue()]), [new EmptyValue(), new EmptyValue()]);
same(\\Lean${name}\\answer(), ${name === "Willow" ? 17 : 29});
${callables ? `same(\\Lean${name}\\call_word(BigInteger::of(40), fn($value) => $value->plus(1)), BigInteger::of(42));
$adder = \\Lean${name}\\make_word(BigInteger::of(2));
try { same($adder(BigInteger::of(40)), BigInteger::of(42)); } finally { $adder->close(); }` : ""}
$word = BigInteger::of('4294967295');
same(\\Lean${name}\\matrix([$word]), [[$word], [$word]]);
same(\\Lean${name}\\grow("hello\\0λ"), ["hello\\0λ", "hello\\0λ"]);
same(\\Lean${name}\\replicate(BigInteger::of('4')), [7, 7, 7, 7]);
same((string) \\Lean${name}\\double_nat(BigInteger::of('${(1n << 4096n) + 1n}')), '${(1n << 4097n) + 2n}');
${[0n, 4294967295n, 4294967296n, (1n << 4096n) + 123457n].map(value => `same((string) \\Lean${name}\\nat_low_word(BigInteger::of('${value}')), '${value & 0xffffffffn}');`).join("\n")}
foreach (['0', '1', '4294967295', '18446744073709551615', str_repeat('9', 16384)] as $text) same((string) \\Lean${name}\\echo_nat(BigInteger::of($text)), $text);
foreach (['0', '-1', '9223372036854775807', '-9223372036854775808'] as $text) same((string) \\Lean${name}\\echo_i64(BigInteger::of($text)), $text);
foreach (['f32', 'f64'] as $label) {
    $call = 'Lean${name}\\\\echo_' . $label;
    check(is_nan($call(NAN))); same($call(INF), INF); same($call(-INF), -INF);
    same(pack('d', $call(-0.0)), pack('d', -0.0));
}
same(\\Lean${name}\\echo_f32(1 / 3), unpack('f', pack('f', 1 / 3))[1]);
foreach ([
    ['unit', 0, \\TypeError::class], ['bool', 1, \\TypeError::class],
    ['u8', -1, \\ValueError::class], ['u8', 256, \\ValueError::class],
    ['u16', -1, \\ValueError::class], ['u16', 65536, \\ValueError::class],
    ['u32', 1, \\TypeError::class], ['u32', 2147483648.0, \\TypeError::class],
    ['u32', BigInteger::of('-1'), \\ValueError::class],
    ['u32', BigInteger::of('4294967296'), \\ValueError::class],
    ['u64', BigInteger::of('-1'), \\ValueError::class],
    ['u64', BigInteger::of('18446744073709551616'), \\ValueError::class],
    ['i8', -129, \\ValueError::class], ['i8', 128, \\ValueError::class],
    ['i16', -32769, \\ValueError::class], ['i16', 32768, \\ValueError::class],
    ['i32', 2147483648.0, \\TypeError::class], ['i32', -2147483649.0, \\TypeError::class],
    ['i64', BigInteger::of('-9223372036854775809'), \\ValueError::class],
    ['i64', BigInteger::of('9223372036854775808'), \\ValueError::class],
    ['nat', BigInteger::of('-1'), \\ValueError::class], ['integer', '1', \\TypeError::class],
    ['f32', 1, \\TypeError::class], ['f64', '1.0', \\TypeError::class],
    ['text', "\\xff", \\ValueError::class], ['text', "\\xc0\\x80", \\ValueError::class],
    ['text', "\\xed\\xa0\\x80", \\ValueError::class], ['bytes', 'bytes', \\TypeError::class]
] as [$label, $value, $class]) {
    $call = 'Lean${name}\\\\echo_' . $label; $array = 'Lean${name}\\\\array_' . $label;
    rejects(fn() => $call($value), $class);
    rejects(fn() => $array([$value]), $class);
    rejects(fn() => leafValue($label, $value), $class);
    same(\\Lean${name}\\answer(), ${name === "Willow" ? 17 : 29});
}
rejects(fn() => \\Lean${name}\\echo_nat(BigInteger::of(str_repeat('9', 16385))), \\ValueError::class);
foreach (['01' => '1', '-0' => '0', '+1' => '1', '1e3' => '1000'] as $text => $expected) same((string) \\Lean${name}\\echo_nat(BigInteger::of($text)), $expected);
same((string) \\Lean${name}\\echo_nat(BigInteger::of('4294967295')->plus(1)), '4294967296');
${name === "Aspen" ? "same((string) \\LeanAspen\\echo_nat(\\LeanWillow\\echo_nat(BigInteger::of('18446744073709551616')))->plus(1), '18446744073709551617');" : ""}
rejects(fn() => \\Lean${name}\\echo_u32(1), \\TypeError::class);
rejects(fn() => \\Lean${name}\\echo_u32(BigInteger::of('4294967296')), \\ValueError::class);
rejects(fn() => \\Lean${name}\\echo_i64(BigInteger::of('-9223372036854775809')), \\ValueError::class);
rejects(fn() => \\Lean${name}\\echo_f64(1), \\TypeError::class);
rejects(fn() => \\Lean${name}\\echo_text("\\xff"), \\ValueError::class);
rejects(fn() => \\Lean${name}\\array_u8([1 => 1]), \\TypeError::class);
rejects(fn() => \\Lean${name}\\array_text([str_repeat('x', 16 * 1024 * 1024)]), \\ValueError::class);
rejects(fn() => \\Lean${name}\\grow(str_repeat('x', 9 * 1024 * 1024)));
for ($i = 0; $i < 100; $i++) same(\\Lean${name}\\echo_record($packet), $packet);
same(\\Lean${name}\\answer(), ${name === "Willow" ? 17 : 29});
echo '${name}:ok';
`;
