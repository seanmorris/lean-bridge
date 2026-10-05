/**
 * Synthetic providers test List-specific Zend cleanup independently of Lean.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { listPacket } from "./list-fixture.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { zendAllocationFixture } from "./php-copied-zend.mjs";

/** Describe a test-only boundary, not compiler or installed Lean evidence. */
export const zendListFaultIr = () => corpusReviewedIr({ id: "list_probe" }, [
	...[["numbers", { list: "uint32" }], ["nested", { list: { list: "uint32" } }], ["strings", { list: "string" }], ["echo_packet", listPacket]]
		.map(([name, type]) => ({ name: `Probe.${name}`, parameters: [type], result: type }))
	, { name: "Probe.fail_after", parameters: ["int32"], result: "unit" }
	, { name: "Probe.configure", parameters: ["int32"], result: "unit" }
	, { name: "Probe.live_allocations", parameters: [], result: "uint16" }
]);

/**
 * Generate owned nested copies whose real owners survive forged output headers.
 *
 * @param ir - Synthetic List boundary contract.
 */
export const zendListFaultProvider = ir => {
	const { surface } = compileCopiedPhpModel(ir, { integerBits: 32, lists: true });
	const helpers = surface.copies.map(copy => {
		let clear = "", clone, owner = "";
		if(!copy.aggregate) clone = "*out = *input; return 1;";
		else if(copy.record || copy.compound)
		{
			clear = copy.fields.filter(field => field.type.aggregate).map(field => `${field.type.name}_clear(&value->${field.name});`).join(" ");
			const field = copy.fields[0];
			if(copy.compound === "option") clone = `out->has_value = input->has_value; return !input->has_value || clone${field.type.index}(&input->value, &out->value);`;
			else if(copy.compound === "result") clone = `out->is_ok = input->is_ok; return input->is_ok ? clone${field.type.index}(&input->ok, &out->ok) : clone${copy.fields[1].type.index}(&input->error, &out->error);`;
			else clone = `return ${copy.fields.map(field => `clone${field.type.index}(&input->${field.name}, &out->${field.name})`).join(" && ")};`;
		}
		else if(copy.element)
		{
			const element = copy.element;
			owner = `typedef struct { size_t count; ${element.ctype} data[]; } owner${copy.index};
static void release${copy.index}(void *opaque) {
  owner${copy.index} *owner = opaque;
  ${element.aggregate ? `for (size_t i = 0; i < owner->count; ++i) ${element.name}_clear(&owner->data[i]);` : ""}
  fixture_release(owner);
}`;
			clear = "if (value->release) value->release(value->owner);";
			clone = `owner${copy.index} *owner = fixture_allocate(1, sizeof(*owner) + input->length * sizeof(*input->data));
  if (!owner) return 0; owner->count = input->length;
  out->data = owner->data; out->length = input->length; out->owner = owner; out->release = release${copy.index};
  for (size_t i = 0; i < input->length; ++i) if (!clone${element.index}(&input->data[i], &owner->data[i])) return 0;
  return 1;`;
		}
		else
		{
			clear = "if (value->release) value->release(value->owner);";
			clone = `void *data = fixture_allocate(input->length ? input->length : 1, sizeof(*input->data)); if (!data) return 0;
  if (input->length) memcpy(data, input->data, input->length * sizeof(*input->data));
  out->data = data; out->length = input->length; out->owner = data; out->release = fixture_release;
  ${copy.scalarName === "int" ? "out->negative = input->negative;" : ""} return 1;`;
		}
		return `${owner}
${copy.aggregate ? `void ${copy.name}_clear(${copy.ctype} *value) { ${clear} *value = (${copy.ctype}){0}; }` : ""}
static int clone${copy.index}(const ${copy.ctype} *input, ${copy.ctype} *out) { ${clone} }`;
	}).join("\n");
	const calls = surface.functions.map(fn => {
		const result = surface.copy(fn.declaration.result.type), unit = fn.resultType === "void";
		const args = fn.declaration.parameters.map((site, i) => { const copy = surface.copy(site.type); return `${copy.ctype}${copy.aggregate ? " const *" : " "}arg${i}`; }).concat(unit ? [] : [`${result.ctype} *out`]).concat("list_probe_error *error");
		let body;
		if(fn.field === "fail_after") body = "fixture_fail = arg0;";
		else if(fn.field === "configure") body = "mode = arg0;";
		else if(fn.field === "live_allocations") body = "*out = (uint16_t)(fixture_live - 1);";
		else
		{
			body = `if (!clone${result.index}(arg0, out)) return 1;`;
			if(fn.field === "numbers") body += `
  if (mode == 1) { out->data = NULL; out->length = 1; }
  if (mode == 2) { out->data = (const uint32_t *)1; out->length = 1; }
  if (mode == 3) out->length = SIZE_MAX;
  if (mode == 4) out->length = 524289;
  if (mode == 5) { out->data = (const uint32_t *)(__builtin_wasm_memory_size(0) * 65536 - 4); out->length = 2; }
  if (mode == 6) { out->data = (const uint32_t *)(UINTPTR_MAX - 3); out->length = 1; }
  if (mode == 10) { out->data = (const uint32_t *)1; out->length = 0; }`;
			if(fn.field === "nested") body += `
  if (mode == 11 || mode == 12) {
    list_probe_list_uint32_span *row = (list_probe_list_uint32_span *)out->data;
    row[0].data = mode == 11 ? NULL : (const uint32_t *)1; row[0].length = 1;
  }`;
			if(fn.field === "strings") body += `
  if (mode == 8) fixture_output_bailout = 2;
  if (mode == 9) { error->message = out->data[0].data; error->message_length = out->data[0].length; return 7; }
  if (mode == 13) { list_probe_string *text = (list_probe_string *)out->data; text[1].data = "\\xff"; text[1].length = 1; }
  if (mode == 14) { list_probe_string *text = (list_probe_string *)out->data; text[1].data = NULL; text[1].length = 1; }`;
			body += "\n  if (mode == 7) zend_bailout();";
		}
		return `list_probe_status ${fn.name}(${args.join(", ")}) { (void)error; ${body} return 0; }`;
	}).join("\n");
	const allocations = zendAllocationFixture.replace("if (fixture_output_bailout)", "if (fixture_output_bailout && --fixture_output_bailout == 0)");
	return `#include <php.h>\n#include "list_probe.h"\n${allocations}\nstatic int mode;\n${helpers}\n${calls}\n`;
};

/**
 * Test input rejection, independent owners and recovery through a synthetic API.
 *
 * @param manifest - Names of the test-only Zend wire entries.
 */
export const zendListFaultConsumer = manifest => {
	const call = name => "\\" + manifest.exports.find(fn => fn.function.endsWith("\\" + name)).transport;
	return `<?php
declare(strict_types=0);
use Brick\\Math\\BigInteger;
use LeanListProbe\\{Some, Ok, Err, Bytes, Packet};
require '/probe/src/Api.php';
$checks = 0; $failures = 0; $malformed = 0;
function check(bool $value): void { global $checks; ++$checks; if (!$value) throw new RuntimeException('Zend List probe ' . $checks); }
function rejects(callable $call, string $class = Throwable::class): void {
  try { $call(); } catch (Throwable $error) { check($error instanceof $class); return; }
  throw new RuntimeException('Expected rejection');
}
function clean(): void { check(LeanListProbe\\live_allocations() === 0); }
$one = BigInteger::of(1); $huge = BigInteger::of(2)->power(5120)->plus(17);
$packet = new Packet([[$one], [], [$one, $one]], [null, new Some(new Ok([$huge, null])), new Some(new Err('owned'))],
    [Bytes::fromString("\\0\\xff"), Bytes::fromString('')], [[[true, '🌿'], [false, "\\0"]], []]);
check(LeanListProbe\\numbers([]) === []); clean();
check(LeanListProbe\\numbers([$one, $one]) == [$one, $one]); clean();
$copy = LeanListProbe\\echo_packet($packet); check($copy == $packet && $copy !== $packet && $copy->buffers[0] !== $packet->buffers[0]); clean();
foreach ([fn() => LeanListProbe\\numbers([$one, $one]), fn() => LeanListProbe\\nested([[$one], [], [$one, $one]]),
    fn() => LeanListProbe\\strings(['first', 'second']), fn() => LeanListProbe\\echo_packet($packet)] as $call) {
  $succeeded = false;
  for ($limit = 0; $limit < 1000; ++$limit) {
    LeanListProbe\\fail_after($limit);
    try { $call(); $succeeded = true; } catch (Throwable $error) { ++$failures; }
    try { LeanListProbe\\fail_after(-1); } catch (Throwable $error) { LeanListProbe\\fail_after(-1); }
    clean(); if ($succeeded) break;
  }
  check($succeeded);
}
foreach ([null, false, new ArrayObject(['1']), [1 => '1'], ['key' => '1'], [0 => '1', 2 => '2']] as $bad) {
  rejects(fn() => ${call("numbers")}($bad), TypeError::class); clean();
}
for ($i = 0; $i < 16; ++$i) { rejects(fn() => ${call("nested")}([['1'], ['2', false]]), TypeError::class); clean(); }
rejects(fn() => ${call("numbers")}(), ArgumentCountError::class); clean();
foreach ([1, 2, 3, 4, 5, 6] as $mode) {
  LeanListProbe\\configure($mode); rejects(fn() => LeanListProbe\\numbers([$one, $one]), ValueError::class); clean(); ++$malformed;
}
foreach ([11, 12] as $mode) {
  LeanListProbe\\configure($mode); rejects(fn() => LeanListProbe\\nested([[$one]]), ValueError::class); clean(); ++$malformed;
}
foreach ([13, 14] as $mode) {
  LeanListProbe\\configure($mode); rejects(fn() => LeanListProbe\\strings(['good', 'bad']), ValueError::class); clean(); ++$malformed;
}
LeanListProbe\\configure(10); check(LeanListProbe\\numbers([$one]) === []); clean();
LeanListProbe\\configure(9);
try { LeanListProbe\\strings(['owned error', 'second']); throw new RuntimeException('Missing native failure'); }
catch (LeanListProbe\\LeanBridgeError $error) { check($error->getMessage() === 'owned error' && $error->getCode() === 7); }
clean(); LeanListProbe\\configure(0);
check(LeanListProbe\\echo_packet($packet) == $packet); clean();
echo json_encode(['checks' => $checks, 'allocationFailures' => $failures, 'malformedOutputs' => $malformed,
    'partialInputs' => 16, 'emptyPoisonPointer' => 1, 'wordBits' => PHP_INT_SIZE * 8]);
`;
};
