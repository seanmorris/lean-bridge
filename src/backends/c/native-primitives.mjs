/**
 * Per-declaration native C adapters for the admitted copied primitive surface.
 *
 * @file
 */
import { nativeCopyLimit, nativeCType, nativeObjectType } from "../../build/native-model.mjs";
import { compilePrimitiveCSurface } from "./primitive-surface.mjs";

const dynamic = type => ["nat", "int", "string", "bytes"].includes(type.name);
const input = (type, name) => {
	if(type.name === "unit") return "lean_box(0)";
	if(type.name === "string") return `lean_mk_string_from_bytes(${name}->length ? ${name}->data : "", ${name}->length)`;
	if(type.name === "bytes") return `lb_bytes_in(${name}->data, ${name}->length)`;
	if(type.name === "nat") return `lb_nat_in(${name}->data, ${name}->length)`;
	if(type.name === "int") return `lb_int_in(${name}->data, ${name}->length, ${name}->negative)`;
	return `(${nativeCType(type)})${name}`;
};

const emitFunction = (p, fn, native) => {
	const macro = p.toUpperCase();
	const lines = [`static ${p}_status lb_call_${fn.field}(${fn.signature}) {`
		, "  (void)context;", `  size_t budget = ${nativeCopyLimit}u;`
		, "  (void)budget;" ];
	for(const [i, { name }] of fn.parameters.entries())
	{
		const type = native.parameters[i].type;
		if(type.name === "unit") lines.push(`  if (${name} != 0) return lb_invalid(error, "Unit requires zero");`);
		if(!dynamic(type)) continue;
		const size = ["nat", "int"].includes(type.name) ? "sizeof(uint32_t)" : "1";
		lines.push(`  if (${name} == NULL || (${name}->length && ${name}->data == NULL) || ${name}->length > budget / ${size}) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");`
			, `  budget -= ${name}->length * ${size};`);
		if(type.name === "string") lines.push(`  if (!lb_utf8((const uint8_t *)${name}->data, ${name}->length)) return lb_invalid(error, "String requires valid UTF-8");`);
	}
	const args = fn.parameters.map(({ name }, i) => input(native.parameters[i].type, name));
	if(!args.length) args.push("lean_box(0)");
	lines.push(`  ${nativeCType(native.result)} value = ${native.symbol}(${args.join(", ")});`);
	const result = native.result.name;
	if(result === "string" || result === "bytes")
	{
		const length = result === "string" ? "lean_string_size(value) - 1" : "lean_sarray_size(value)";
		const data = result === "string" ? "lean_string_cstr(value)" : "lean_sarray_cptr(value)";
		lines.push(`  size_t length = ${length};`, "  if (length > budget) { lean_dec(value); return lb_invalid(error, \"16 MiB call limit exceeded\"); }"
			, "  void *copy = length ? malloc(length) : NULL;"
			, "  if (length && copy == NULL) { lean_dec(value); return lb_failure(error, \"Cannot allocate copied result\"); }"
			, `  if (length) memcpy(copy, ${data}, length);`, "  lean_dec(value);"
			, `  *out = (${p}_${result}){copy, length, copy, free};`);
	}
	else if(result === "nat" || result === "int")
	{
		if(result === "int") lines.push("  bool negative = lean_int_lt(value, lean_box(0));", "  lean_object *magnitude = lean_nat_abs(value);", "  lean_dec(value);", "  value = magnitude;");
		lines.push("  uint32_t *limbs = NULL; size_t length = 0;"
			, "  int copied = lb_nat_out(value, &limbs, &length, budget);", "  lean_dec(value);"
			, '  if (copied == 0) return lb_invalid(error, "16 MiB call limit exceeded");'
			, '  if (copied < 0) return lb_failure(error, "Cannot allocate copied result");'
			, `  *out = (${p}_${result}){limbs, length, limbs, free${result === "int" ? ", negative" : ""}};`);
	}
	else if(nativeObjectType(native.result)) lines.push("  lean_dec(value);");
	else if(/^int\d/.test(result)) lines.push("  memcpy(out, &value, sizeof(value));");
	else lines.push(`  *out = (${fn.resultType})value;`);
	lines.push(`  if (error != NULL) *error = (${p}_error){0};`, `  return ${macro}_STATUS_OK;`, "}", "");
	return lines.join("\n");
};

/**
 * Generate a checked native vtable; all calls use Lean-emitted typed symbols.
 *
 * @param model - Reconstructed native compiler model.
 * @param receipt - Verified native component compilation receipt.
 */
export const generateNativePrimitiveC = (model, receipt) => {
	const surface = compilePrimitiveCSurface(model.bindingIr), p = surface.prefix, macro = p.toUpperCase();
	if(!/^initialize_LeanBridgeNative[0-9a-f]{16}$/.test(receipt.initializer)) throw new TypeError("Invalid native initializer identity");
	const exports = new Map(model.exports.map(item => [`lean:${item.name}`, item]));
	const functions = surface.functions.map(fn => {
		const native = exports.get(fn.declaration.id);
		if(!native) throw new TypeError(`C declaration has no compiled native symbol: ${fn.declaration.id}`);
		return emitFunction(p, fn, native);
	});
	return `#include "${p}_runtime.h"
#include "component.h"
#include "lean_bridge_native_runtime.h"
#include <stdlib.h>
#include <string.h>

static inline ${p}_status lb_invalid(${p}_error *error, const char *message) {
  if (error) *error = (${p}_error){${macro}_ERROR_INVALID_ARGUMENT, message, strlen(message)};
  return ${macro}_STATUS_INVALID_ARGUMENT;
}
static inline ${p}_status lb_failure(${p}_error *error, const char *message) {
  if (error) *error = (${p}_error){${macro}_ERROR_UNEXPECTED, message, strlen(message)};
  return ${macro}_STATUS_UNEXPECTED_ERROR;
}
static inline int lb_utf8(const uint8_t *bytes, size_t length) {
  size_t i = 0;
  while (i < length) {
    uint32_t point = bytes[i++]; size_t extra; uint32_t minimum;
    if (point < 0x80) continue;
    if (point >= 0xc2 && point <= 0xdf) { point &= 0x1f; extra = 1; minimum = 0x80; }
    else if (point >= 0xe0 && point <= 0xef) { point &= 0x0f; extra = 2; minimum = 0x800; }
    else if (point >= 0xf0 && point <= 0xf4) { point &= 7; extra = 3; minimum = 0x10000; }
    else return 0;
    if (extra > length - i) return 0;
    while (extra--) { uint8_t next = bytes[i++]; if ((next & 0xc0) != 0x80) return 0; point = (point << 6) | (next & 0x3f); }
    if (point < minimum || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return 0;
  }
  return 1;
}
static inline lean_object *lb_bytes_in(const uint8_t *data, size_t length) {
  lean_object *value = lean_alloc_sarray(1, length, length);
  if (length) memcpy(lean_sarray_cptr(value), data, length);
  return value;
}
static inline lean_object *lb_nat_in(const uint32_t *data, size_t length) {
  lean_object *value = lean_box(0);
  while (length) {
    lean_object *shifted = lean_nat_shiftl(value, lean_box(32)); lean_dec(value);
    lean_object *limb = lean_uint32_to_nat(data[--length]);
    value = lean_nat_add(shifted, limb); lean_dec(shifted); lean_dec(limb);
  }
  return value;
}
static inline lean_object *lb_int_in(const uint32_t *data, size_t length, bool negative) {
  lean_object *value = lean_nat_to_int(lb_nat_in(data, length));
  if (negative) { lean_object *negated = lean_int_neg(value); lean_dec(value); value = negated; }
  return value;
}
/* Borrow value; release every temporary on success, budget failure, and OOM. */
static inline int lb_nat_out(lean_object *value, uint32_t **out, size_t *length, size_t budget) {
  uint32_t *data = NULL; size_t used = 0, capacity = 0, limit = budget / sizeof(uint32_t);
  lean_inc(value);
  while (!lean_nat_eq(value, lean_box(0))) {
    if (used == limit) { free(data); lean_dec(value); return 0; }
    if (used == capacity) {
      capacity = capacity ? capacity * 2 : 4;
      if (capacity > limit) capacity = limit;
      uint32_t *grown = realloc(data, capacity * sizeof(uint32_t));
      if (!grown) { free(data); lean_dec(value); return -1; }
      data = grown;
    }
    data[used++] = lean_uint32_of_nat(value);
    lean_object *next = lean_nat_shiftr(value, lean_box(32)); lean_dec(value); value = next;
  }
  lean_dec(value); *out = data; *length = used; return 1;
}

${functions.join("\n")}
extern lean_object *${receipt.initializer}(uint8_t builtin);
static void *lb_initialize(uint8_t builtin) { return ${receipt.initializer}(builtin); }
static ${p}_status lb_runtime_initialize(void *context, ${p}_error *error) {
  (void)context;
  return lean_bridge_native_component_initialize(${JSON.stringify(model.component.id)}, lb_initialize)
    ? ${macro}_STATUS_OK : lb_failure(error, "Lean runtime initialization failed");
}
static const ${p}_runtime_v1 lb_runtime = {
  .abi_version = ${macro}_BINDING_ABI_VERSION, .context = NULL,
  .initialize = lb_runtime_initialize,
${surface.functions.map(fn => `  .${fn.field} = lb_call_${fn.field},`).join("\n")}
};
__attribute__((constructor)) static void lb_install(void) {
  (void)${p}_runtime_install_v1(&lb_runtime, NULL);
}
__attribute__((destructor)) static void lb_detach(void) {
  lean_bridge_native_component_detach(${JSON.stringify(model.component.id)});
}
`;
};
