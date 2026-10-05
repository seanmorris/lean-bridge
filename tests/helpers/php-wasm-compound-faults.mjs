/**
 * Synthetic providers isolate Zend compound cleanup from Lean execution.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { zendAllocationFixture } from "./php-copied-zend.mjs";

const option = { option: "nat" }, result = { result: ["string", "string"] };
/** Describe the synthetic boundary API without claiming compiled Lean execution. */
export const zendCompoundFaultIr = () => corpusReviewedIr({ id: "compound_probe" }, [
	{ name: "Probe.option", parameters: [option], result: option }
	, { name: "Probe.result", parameters: [result], result }
	, { name: "Probe.pair", parameters: [{ tuple: [option, result] }], result: { tuple: [option, result] } }
	, { name: "Probe.fail_after", parameters: ["int32"], result: "unit" }
	, { name: "Probe.configure", parameters: ["int32"], result: "unit" }
	, { name: "Probe.live_allocations", parameters: [], result: "uint16" }
]);

/**
 * Copy payloads into tracked C owners and introduce controlled malformed outputs.
 *
 * @param ir - Synthetic boundary contract.
 */
export const zendCompoundFaultProvider = ir => {
	const { surface } = compileCopiedPhpModel(ir, { integerBits: 32 });
	const helpers = surface.copies.filter(copy => copy.aggregate).map(copy => {
		let clear, clone;
		if(copy.compound)
		{
			clear = copy.fields.filter(field => field.type.aggregate).map(field => `${field.type.name}_clear(&value->${field.name});`).join(" ");
			if(copy.compound === "option") clone = `out->has_value = input->has_value; return !input->has_value || clone${copy.fields[0].type.index}(&input->value, &out->value);`;
			else if(copy.compound === "result") clone = `out->is_ok = input->is_ok; return input->is_ok ? clone${copy.fields[0].type.index}(&input->ok, &out->ok) : clone${copy.fields[1].type.index}(&input->error, &out->error);`;
			else clone = `return ${copy.fields.map(field => `clone${field.type.index}(&input->${field.name}, &out->${field.name})`).join(" && ")};`;
		}
		else
		{
			clear = "if (value->release) value->release(value->owner);";
			clone = `void *data = fixture_allocate(input->length ? input->length : 1, sizeof(*input->data)); if (!data) return 0;
  if (input->length) memcpy(data, input->data, input->length * sizeof(*input->data));
  out->data = data; out->length = input->length; out->owner = data; out->release = fixture_release; return 1;`;
		}
		return `void ${copy.name}_clear(${copy.ctype} *value) { ${clear} *value = (${copy.ctype}){0}; }
static int clone${copy.index}(const ${copy.ctype} *input, ${copy.ctype} *out) { ${clone} }`;
	}).join("\n");
	const calls = surface.functions.map(fn => {
		const result = surface.copy(fn.declaration.result.type), unit = fn.resultType === "void";
		const args = fn.declaration.parameters.map((site, i) => { const copy = surface.copy(site.type); return `${copy.ctype}${copy.aggregate ? " const *" : " "}arg${i}`; }).concat(unit ? [] : [`${result.ctype} *out`]).concat("compound_probe_error *error");
		let body;
		if(fn.field === "fail_after") body = "fixture_fail = arg0;";
		else if(fn.field === "configure") body = "mode = arg0;";
		else if(fn.field === "live_allocations") body = "*out = (uint16_t)(fixture_live - 1);";
		else
		{
			body = `if (!clone${result.index}(arg0, out)) return 1;`;
			if(fn.field === "option") body += `
  if (mode == 1) out->has_value = 2;
  if (mode == 6 && !out->has_value) { out->value.data = (const uint32_t *)1; out->value.length = SIZE_MAX; }`;
			else if(fn.field === "result") body += `
  if (mode == 2) out->is_ok = 2;
  compound_probe_string *text = out->is_ok ? &out->ok : &out->error;
  if (mode == 3) { text->data = NULL; text->length = 1; }
  if (mode == 4) { text->data = "\\xff"; text->length = 1; }
  if (mode == 5) text->length = 16 * 1024 * 1024 + 1;
  if (mode == 6) { compound_probe_string *inactive = out->is_ok ? &out->error : &out->ok; inactive->data = (const char *)1; inactive->length = SIZE_MAX; }
  if (mode == 7) zend_bailout();
  if (mode == 8) fixture_output_bailout = 1;
  if (mode == 9) { error->message = text->data; error->message_length = text->length; return 7; }`;
			else if(fn.field === "pair") body += "\n  if (mode == 8) fixture_output_bailout = 1;";
		}
		return `compound_probe_status ${fn.name}(${args.join(", ")}) { (void)error; ${body} return 0; }`;
	}).join("\n");
	return `#include <php.h>\n#include "compound_probe.h"\n${zendAllocationFixture}\nstatic int mode;\n${helpers}\n${calls}\n`;
};

/**
 * Exercise both the public value API and the private Zend wire with invalid data.
 *
 * @param manifest - Generated test-only transport names.
 */
export const zendCompoundFaultConsumer = manifest => {
	const call = name => "\\" + manifest.exports.find(fn => fn.function.endsWith("\\" + name)).transport;
	return `<?php
declare(strict_types=0);
use Brick\\Math\\BigInteger;
use LeanCompoundProbe\\{Some, Ok, Err};
require '/probe/src/Api.php';
$checks = 0; $failures = 0;
function check($value) { global $checks; ++$checks; if (!$value) throw new RuntimeException('Zend compound probe ' . $checks); }
function rejects($call, $class = Throwable::class) {
  try { $call(); } catch (Throwable $error) { check($error instanceof $class); return; }
  throw new RuntimeException('Expected rejection');
}
function clean() { check(LeanCompoundProbe\\live_allocations() === 0); }
$value = new Some(BigInteger::of(str_repeat('9', 1234)));
check(LeanCompoundProbe\\option($value) == $value); clean();
check(LeanCompoundProbe\\option(null) === null); clean();
foreach ([new Ok("a\\0λ"), new Err('')] as $branch) { check(LeanCompoundProbe\\result($branch) == $branch); clean(); }
foreach ([fn() => LeanCompoundProbe\\option($value), fn() => LeanCompoundProbe\\result(new Ok('owned')), fn() => LeanCompoundProbe\\pair([$value, new Err('owned')])] as $call) {
  $succeeded = false;
  for ($limit = 0; $limit < 100; ++$limit) {
    LeanCompoundProbe\\fail_after($limit);
    try { $call(); $succeeded = true; } catch (Throwable $error) { ++$failures; }
    try { LeanCompoundProbe\\fail_after(-1); } catch (Throwable $error) { LeanCompoundProbe\\fail_after(-1); }
    clean();
    if ($succeeded) break;
  }
  check($succeeded);
}
foreach ([false, [], [1, 2], [1 => '1'], ['value' => '1']] as $bad) { rejects(fn() => ${call("option")}($bad), TypeError::class); clean(); }
foreach ([null, [], [true], [true, 'x', 'y'], [1, 'x'], ['1', 'x'], [1 => true, 2 => 'x']] as $bad) { rejects(fn() => ${call("result")}($bad), TypeError::class); clean(); }
rejects(fn() => ${call("pair")}([['9999'], [true, false]]), TypeError::class); clean();
rejects(fn() => ${call("pair")}([null]), ValueError::class); clean();
rejects(fn() => ${call("option")}(), ArgumentCountError::class); clean();
rejects(fn() => ${call("option")}(null, null), ArgumentCountError::class); clean();
$tag = true; check(${call("result")}([&$tag, 'reference']) === [true, 'reference']); clean();
LeanCompoundProbe\\configure(1); rejects(fn() => LeanCompoundProbe\\option($value), ValueError::class); clean();
foreach ([2, 3, 4, 5] as $mode) {
  LeanCompoundProbe\\configure($mode);
  foreach ([new Ok('owned'), new Err('owned')] as $branch) { rejects(fn() => LeanCompoundProbe\\result($branch), ValueError::class); clean(); }
}
LeanCompoundProbe\\configure(6);
check(LeanCompoundProbe\\option(null) === null); clean();
foreach ([new Ok('owned'), new Err('owned')] as $branch) { check(LeanCompoundProbe\\result($branch) == $branch); clean(); }
LeanCompoundProbe\\configure(9);
try { LeanCompoundProbe\\result(new Ok('owned error')); throw new RuntimeException('Expected bridge failure'); }
catch (LeanCompoundProbe\\LeanBridgeError $error) { check($error->getMessage() === 'owned error' && $error->getCode() === 7); }
clean(); LeanCompoundProbe\\configure(0);
check(LeanCompoundProbe\\pair([$value, new Ok('recovered')]) == [$value, new Ok('recovered')]); clean();
echo json_encode(['checks' => $checks, 'allocationFailures' => $failures, 'malformedOutputs' => 9, 'inactivePayloads' => 3, 'wordBits' => PHP_INT_SIZE * 8]);
`;
};
