/**
 * Synthetic C providers isolate Zend conversion tests from Lean compilation.
 *
 * @file
 */
import { alpha } from "../../poc/lean-link-spike/descriptors.mjs";
import { createNativeModel } from "../../src/build/native-model.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { nativeMetadataFixture } from "./native-metadata.mjs";

export const zendScalars = [
	["unit", "null"], ["bool", "true"], ["uint8", "255"], ["uint16", "65535"]
	, ["uint32", "BigInteger::fromDecimal('4294967295')"]
	, ["uint64", "BigInteger::fromDecimal('18446744073709551615')"]
	, ["int8", "-128"], ["int16", "-32768"]
	, ["int32", "-2147483647 - 1"]
	, ["int64", "BigInteger::fromDecimal('-9223372036854775808')"]
	, ["nat", `BigInteger::fromDecimal('${(1n << 4096n) + 1n}')`]
	, ["int", `BigInteger::fromDecimal('-${1n << 4096n}')`]
	, ["float32", "-0.0"], ["float64", "-0.0"]
	, ["string", '"a\\0λ🌿"'], ["bytes", 'Bytes::fromString("\\0\\xff\\x80")']
];
const primitive = name => ({ kind: "primitive", name });
const array = type => ({ kind: "apply", constructor: "array", arguments: [type] });

/**
 * The source labels are synthetic; this fixture is not elaboration evidence.
 *
 * @param name - Synthetic component name.
 */
export const copiedZendFixture = (name = "willow") => {
	const ir = structuredClone(createNativeModel({ ...nativeMetadataFixture(), component: { id: `${name}@1.0.0`, name, version: "1.0.0" } }).bindingIr);
	const base = ir.declarations[0], record = structuredClone(alpha.bindingIr.types.find(type => type.kind === "record"));
	const fields = name === "willow" ? zendScalars : [...zendScalars].reverse();
	const leaf = { ...record, id: `${name}:Leaf`, name: "Leaf", fields: fields.map(([label]) => ({ ...record.fields[0], name: `v_${label}`, type: primitive(label) })), assurance: [] };
	const leafRef = { kind: "named", id: leaf.id };
	const empty = { ...record, id: `${name}:EmptyValue`, name: "EmptyValue", fields: [], assurance: [] };
	const packet = { ...record, id: `${name}:Packet`, name: "Packet", fields: [{ ...record.fields[0], name: "leaf", type: leafRef }, { ...record.fields[0], name: "rows", type: array(array(leafRef)) }], assurance: [] };
	ir.types = [leaf, empty, packet];
	const signatures = [...zendScalars.flatMap(([label]) => [[`echo_${label}`, [primitive(label)], primitive(label)], [`array_${label}`, [array(primitive(label))], array(primitive(label))]])
		, ...[leaf, empty, packet].map(type => [`echo_${type.name.toLowerCase()}`, [{ kind: "named", id: type.id }], { kind: "named", id: type.id }])
		, ["answer", [], primitive("uint16")]
		, ["choose", [primitive("string"), primitive("string"), primitive("bool")], primitive("string")]
		, ["live_allocations", [], primitive("uint16")]
		, ["fail_after", [primitive("int32")], primitive("unit")]
		, ["bad_text", [], primitive("string")]
		, ["native_failure", [primitive("string")], primitive("string")]
		, ["native_bailout", [primitive("string")], primitive("string")]
		, ["output_bailout", [primitive("string")], primitive("string")]
		, ["excess_output", [], primitive("string")]
		, ["nat_low_word", [primitive("nat")], primitive("uint32")]
		, ["max_word", [], primitive("uint64")]
		, ["min_signed", [], primitive("int64")]
	];
	ir.declarations = signatures.map(([label, parameters, result]) => ({ ...structuredClone(base), id: `lean:${name}.${label}`, overloadKey: `${name}.${label}`, name: label, source: { ...base.source, declaration: `${name}.${label}` }, parameters: parameters.map((type, i) => ({ ...base.parameters[0], name: `arg${i}`, type })), result: { ...base.result, type: result }, assurance: [] }));
	return ir;
};

/** C malloc counters and deterministic fault injection only enter test binaries. */
export const zendAllocationFixture = String.raw`
#include <stdlib.h>
int fixture_live = 0, fixture_fail = -1, fixture_output_bailout = 0;
void *fixture_allocate(size_t count, size_t size) {
  if (fixture_fail == 0) { fixture_fail = -1; return NULL; }
  if (fixture_fail > 0) fixture_fail--;
  void *p = calloc(count, size); if (p) fixture_live++; return p;
}
void fixture_release(void *p) { if (p) { fixture_live--; free(p); } }
void fixture_before_string(void) {
  if (fixture_output_bailout) { fixture_output_bailout = 0; zend_bailout(); }
}
`;

/** Separate compilation prevents the test provider from specializing the caller. */
export const zendAllocationHeader = String.raw`
#include <stdlib.h>
extern int fixture_live, fixture_fail, fixture_output_bailout;
void *fixture_allocate(size_t count, size_t size);
void fixture_release(void *p);
void fixture_before_string(void);
#define LB_ZEND_CALLOC fixture_allocate
#define LB_ZEND_FREE fixture_release
`;

/**
 * Echo borrowed input through independently owned C buffers, with fault probes.
 *
 * @param ir - Synthetic copied API.
 */
export const zendProviderFixture = ir => {
	const { surface } = compileCopiedPhpModel(ir, { integerBits: 32 });
	const clears = surface.copies.filter(copy => copy.aggregate).map(copy => `void ${copy.name}_clear(${copy.name} *value) {
  ${copy.record ? copy.fields.filter(field => field.type.aggregate).map(field => `${field.type.name}_clear(&value->${field.name});`).join("\n  ") : "if (value->release) value->release(value->owner);"}
  *value = (${copy.name}){0};
}`).join("\n");
	const calls = surface.functions.map(fn => {
		const result = surface.copy(fn.declaration.result.type), unit = fn.resultType === "void";
		const args = fn.declaration.parameters.map((site, i) => { const copy = surface.copy(site.type); return `${copy.ctype}${copy.aggregate ? " const *" : " "}arg${i}`; }).concat(unit ? [] : [`${result.ctype} *out`]).concat(`${surface.prefix}_error *error`);
		let body = unit ? "" : result.aggregate ? "*out = *arg0;" : "*out = arg0;";
		if(fn.field === "answer") body = "*out = 42;";
		else if(fn.field === "live_allocations") body = "*out = (uint16_t)(fixture_live - 1);";
		else if(fn.field === "fail_after") body = "fixture_fail = arg0;";
		else if(fn.field === "bad_text") body = '*out = (' + result.ctype + '){"\\xff", 1, NULL, NULL};';
		else if(fn.field === "excess_output") body = '*out = (' + result.ctype + '){"x", 1, NULL, NULL};';
		else if(fn.field === "nat_low_word") body = "*out = arg0->length ? arg0->data[0] : 0;";
		else if(fn.field === "max_word") body = "*out = UINT64_MAX;";
		else if(fn.field === "min_signed") body = "*out = INT64_MIN;";
		else if(fn.field === "choose") body = "*out = arg2 ? *arg0 : *arg1;";
		if(result.aggregate && !result.record)
		{
			body += `\n  size_t width = sizeof(*out->data); void *copy = fixture_allocate(out->length ? out->length : 1, width);
  if (!copy) { *out = (${result.ctype}){0}; return 1; }
  if (out->length) memcpy(copy, out->data, out->length * width);
  out->data = copy; out->owner = copy; out->release = fixture_release;`;
		}
		if(fn.field === "native_failure") body += '\n  error->message = out->data; error->message_length = out->length; return 7;';
		if(fn.field === "native_bailout") body += '\n  zend_bailout();';
		if(fn.field === "output_bailout") body += '\n  fixture_output_bailout = 1;';
		if(fn.field === "excess_output") body += '\n  out->length = 16 * 1024 * 1024 + 1;';
		return `${surface.prefix}_status ${fn.name}(${args.join(", ")}) { (void)error; ${unit && fn.parameters.length ? "(void)arg0;" : ""}\n  ${body}\n  return 0;\n}`;
	}).join("\n");
	return `${clears}\n${calls}`;
};

/**
 * Exercise public objects and the private wire boundary from a weak-mode caller.
 *
 * @param name - Synthetic component name.
 * @param manifest - Generated Zend source manifest.
 */
export const zendConsumerFixture = (name, manifest) => {
	const ns = manifest.namespace, fieldValues = name === "willow" ? zendScalars : [...zendScalars].reverse();
	return `<?php
namespace Test${name};
require '/${name}/src/Api.php';
use ${ns}\\{BigInteger, Bytes, Leaf, Packet, EmptyValue};
function check($condition, $message = 'Check failed') { if (!$condition) throw new \\RuntimeException($message); }
function same($a, $b) { check(get_debug_type($a) === get_debug_type($b) && $a == $b, 'Values differ'); }
function rejects($call, $class = \\Throwable::class) {
  try { $call(); } catch (\\Throwable $e) { check($e instanceof $class, get_class($e) . ': ' . $e->getMessage()); return; }
  throw new \\RuntimeException('Expected failure');
}
check(PHP_INT_SIZE === 4);
${zendScalars.map(([label, value]) => `$value = ${value}; same(\\${ns}\\echo_${label}($value), $value);
same(\\${ns}\\array_${label}([$value, $value]), [$value, $value]);
same(\\${ns}\\array_${label}([]), []);`).join("\n")}
$leaf = new Leaf(${fieldValues.map(([label, value]) => `v_${label}: ${value}`).join(", ")});
$packet = new Packet($leaf, [[$leaf], []]);
$result = \\${ns}\\echo_packet($packet);
same($result, $packet); check($result !== $packet && $result->leaf !== $leaf && $result->rows[0][0] !== $leaf);
rejects(fn() => $result->rows = []);
same(\\${ns}\\echo_emptyvalue(new EmptyValue()), new EmptyValue());
same(\\${ns}\\answer(), 42);
same(\\${ns}\\choose('left', 'right', false), 'right');
foreach (['0', '1', '4294967295', '18446744073709551615', str_repeat('9', 16384)] as $text) same((string) \\${ns}\\echo_nat(BigInteger::fromDecimal($text)), $text);
foreach (['0', '-1', '9223372036854775807', '-9223372036854775808'] as $text) same((string) \\${ns}\\echo_int64(BigInteger::fromDecimal($text)), $text);
same((string) \\${ns}\\max_word(), '18446744073709551615');
same((string) \\${ns}\\min_signed(), '-9223372036854775808');
${[0n, 4294967295n, 4294967296n, (1n << 4096n) + 123457n].map(value => `same((string) \\${ns}\\nat_low_word(BigInteger::fromDecimal('${value}')), '${value & 0xffffffffn}');`).join("\n")}
foreach (['01', '-0', '+1', '1.0', "1\\n", str_repeat('9', 16385)] as $bad) rejects(fn() => BigInteger::fromDecimal($bad), \\ValueError::class);
foreach (['-1', '4294967296'] as $bad) rejects(fn() => \\${ns}\\echo_uint32(BigInteger::fromDecimal($bad)), \\ValueError::class);
foreach (['9223372036854775808', '-9223372036854775809'] as $bad) rejects(fn() => \\${ns}\\echo_int64(BigInteger::fromDecimal($bad)), \\ValueError::class);
foreach ([1, 1.0, true, '1', null] as $bad) rejects(fn() => \\${ns}\\echo_uint32($bad), \\TypeError::class);
foreach (['float32', 'float64'] as $label) {
  $call = '${ns}\\\\echo_' . $label;
  check(is_nan($call(NAN))); same($call(INF), INF); same($call(-INF), -INF);
  same(pack('d', $call(-0.0)), pack('d', -0.0));
}
same(\\${ns}\\echo_float32(1 / 3), unpack('f', pack('f', 1 / 3))[1]);
rejects(fn() => \\${ns}\\echo_float64(1), \\TypeError::class);
rejects(fn() => \\${ns}\\echo_string("\\xff"), \\ValueError::class);
rejects(fn() => \\${ns}\\array_uint8([1 => 1]), \\TypeError::class);
rejects(fn() => \\${ns}\\array_string([str_repeat('x', 16 * 1024 * 1024)]), \\ValueError::class);
${manifest.exports.filter(fn => fn.function.endsWith("echo_uint32")).map(fn => `foreach (['-1', '4294967296', '01', '-0', '+1', "1\\n"] as $bad) rejects(fn() => \\${fn.transport}($bad), \\ValueError::class);
foreach ([1, 1.0, true, null] as $bad) rejects(fn() => \\${fn.transport}($bad), \\TypeError::class);
rejects(fn() => \\${fn.transport}(), \\ArgumentCountError::class);
rejects(fn() => \\${fn.transport}('1', '2'), \\ArgumentCountError::class);`).join("\n")}
${manifest.exports.filter(fn => fn.function.endsWith("echo_int64")).map(fn => `foreach (['9223372036854775808', '-9223372036854775809'] as $bad) rejects(fn() => \\${fn.transport}($bad), \\ValueError::class);`).join("\n")}
${manifest.exports.filter(fn => fn.function.endsWith("echo_packet")).map(fn => `rejects(fn() => \\${fn.transport}([]), \\ValueError::class);`).join("\n")}
rejects(fn() => \\${ns}\\bad_text(), \\ValueError::class);
rejects(fn() => \\${ns}\\excess_output(), \\ValueError::class);
try { \\${ns}\\native_failure('owned'); throw new \\RuntimeException('Expected failure'); }
catch (\\${ns}\\LeanBridgeError $error) { same($error->getMessage(), 'owned'); same($error->getCode(), 7); }
same(\\${ns}\\live_allocations(), 0);
$failed = 0;
for ($index = 0; $index < 80; $index++) {
  \\${ns}\\fail_after($index);
  try { \\${ns}\\echo_packet($packet); } catch (\\Throwable $e) { $failed++; }
  try { \\${ns}\\fail_after(-1); } catch (\\Throwable $e) { \\${ns}\\fail_after(-1); }
  same(\\${ns}\\live_allocations(), 0);
  same(\\${ns}\\echo_uint8(42), 42);
}
check($failed > 3, 'Fault injection did not exercise the allocation paths');
echo '${name}:ok\\n';
`;
};
