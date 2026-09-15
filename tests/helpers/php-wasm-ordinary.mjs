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
	, ["u32", "UInt32", "BigInteger::fromDecimal('4294967295')"]
	, ["u64", "UInt64", "BigInteger::fromDecimal('18446744073709551615')"]
	, ["i8", "Int8", "-128"], ["i16", "Int16", "-32768"]
	, ["i32", "Int32", "-2147483647 - 1"]
	, ["i64", "Int64", "BigInteger::fromDecimal('-9223372036854775808')"]
	, ["nat", "Nat", `BigInteger::fromDecimal('${(1n << 4096n) + 1n}')`]
	, ["integer", "Int", `BigInteger::fromDecimal('-${1n << 4096n}')`]
	, ["f32", "Float32", "-0.0"], ["f64", "Float", "-0.0"]
	, ["text", "String", '"a\\0λ🌿"']
	, ["bytes", "ByteArray", 'Bytes::fromString("\\0\\xff\\x80")']
];
const fields = name => name === "Willow" ? phpWasmOrdinaryScalars : [...phpWasmOrdinaryScalars].reverse();
/**
 * Create a pure Lean API with no hand-written native implementation.
 *
 * @param root - Temporary source root.
 * @param name - Component discriminator and public namespace suffix.
 */
export const createPhpWasmOrdinaryProject = async (root, name) => {
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
theorem echo_rows_spec (value : Array (Array Leaf)) : echo_rows value = value := rfl
end SharedApi
`);
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["SharedApi"], exports: [...phpWasmOrdinaryScalars.flatMap(([label]) => [`SharedApi.echo_${label}`, `SharedApi.array_${label}`]), ...["echo_record", "choose", "echo_rows", "echo_word", "echo_empty", "array_empty", "matrix", "grow", "replicate", "double_nat", "nat_low_word", "answer"].map(label => `SharedApi.${label}`)], targets: { "php-wasm": { npm: { name: `@example/${name.toLowerCase()}-php-wasm`, version: "2.0.0-RC.1" }, composer: { name: `example/${name.toLowerCase()}-php-wasm`, version: "2.0.0-RC.1" } } } }));
};

/**
 * Exercise compiled copied values and strict boundaries from weak-mode PHP.
 *
 * @param name - Component discriminator and public namespace suffix.
 */
export const phpWasmOrdinaryConsumer = name => `<?php
namespace Test${name};
require_once '/${name}/src/Api.php';
use Lean${name}\\{BigInteger, Bytes, Leaf, Packet, Word, EmptyValue};
function check($condition, $message = 'Check failed') { if (!$condition) throw new \\RuntimeException($message); }
function same($a, $b) { check(get_debug_type($a) === get_debug_type($b) && $a == $b, 'Values differ'); }
function rejects($call, $class = \\Throwable::class) {
    try { $call(); } catch (\\Throwable $error) { check($error instanceof $class, get_class($error) . ': ' . $error->getMessage()); return; }
    throw new \\RuntimeException('Expected rejection');
}
check(PHP_INT_SIZE === 4);
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
$word = new Word(BigInteger::fromDecimal('${name === "Willow" ? "4294967295" : "18446744073709551615"}'));
same(\\Lean${name}\\echo_word($word), $word);
same(\\Lean${name}\\echo_empty(new EmptyValue()), new EmptyValue());
same(\\Lean${name}\\array_empty([new EmptyValue(), new EmptyValue()]), [new EmptyValue(), new EmptyValue()]);
same(\\Lean${name}\\answer(), ${name === "Willow" ? 17 : 29});
$word = BigInteger::fromDecimal('4294967295');
same(\\Lean${name}\\matrix([$word]), [[$word], [$word]]);
same(\\Lean${name}\\grow("hello\\0λ"), ["hello\\0λ", "hello\\0λ"]);
same(\\Lean${name}\\replicate(BigInteger::fromDecimal('4')), [7, 7, 7, 7]);
same((string) \\Lean${name}\\double_nat(BigInteger::fromDecimal('${(1n << 4096n) + 1n}')), '${(1n << 4097n) + 2n}');
${[0n, 4294967295n, 4294967296n, (1n << 4096n) + 123457n].map(value => `same((string) \\Lean${name}\\nat_low_word(BigInteger::fromDecimal('${value}')), '${value & 0xffffffffn}');`).join("\n")}
foreach (['0', '1', '4294967295', '18446744073709551615', str_repeat('9', 16384)] as $text) same((string) \\Lean${name}\\echo_nat(BigInteger::fromDecimal($text)), $text);
foreach (['0', '-1', '9223372036854775807', '-9223372036854775808'] as $text) same((string) \\Lean${name}\\echo_i64(BigInteger::fromDecimal($text)), $text);
foreach (['f32', 'f64'] as $label) {
    $call = 'Lean${name}\\\\echo_' . $label;
    check(is_nan($call(NAN))); same($call(INF), INF); same($call(-INF), -INF);
    same(pack('d', $call(-0.0)), pack('d', -0.0));
}
same(\\Lean${name}\\echo_f32(1 / 3), unpack('f', pack('f', 1 / 3))[1]);
rejects(fn() => \\Lean${name}\\echo_u32(1), \\TypeError::class);
rejects(fn() => \\Lean${name}\\echo_u32(BigInteger::fromDecimal('4294967296')), \\ValueError::class);
rejects(fn() => \\Lean${name}\\echo_i64(BigInteger::fromDecimal('-9223372036854775809')), \\ValueError::class);
rejects(fn() => \\Lean${name}\\echo_f64(1), \\TypeError::class);
rejects(fn() => \\Lean${name}\\echo_text("\\xff"), \\ValueError::class);
rejects(fn() => \\Lean${name}\\array_u8([1 => 1]), \\TypeError::class);
rejects(fn() => \\Lean${name}\\array_text([str_repeat('x', 16 * 1024 * 1024)]), \\ValueError::class);
rejects(fn() => \\Lean${name}\\grow(str_repeat('x', 9 * 1024 * 1024)));
for ($i = 0; $i < 100; $i++) same(\\Lean${name}\\echo_record($packet), $packet);
same(\\Lean${name}\\answer(), ${name === "Willow" ? 17 : 29});
echo '${name}:ok';
`;
