/**
 * Per-declaration native C adapters for the admitted copied value surface.
 *
 * @file
 */
import { generateCopiedNativeCalls } from "./native-copied-values.mjs";
import { compilePrimitiveCSurface } from "./primitive-surface.mjs";
import { generateNativeCallables } from "./native-callables.mjs";


/**
 * Generate a checked native vtable; all calls use Lean-emitted typed symbols.
 *
 * @param model - Reconstructed native compiler model.
 * @param receipt - Verified native component compilation receipt.
 */
export const generateNativePrimitiveC = (model, receipt) => {
	const surface = compilePrimitiveCSurface(model.bindingIr, { wordBits: model.pointerBits, callables: true, compounds: true, lists: true }), p = surface.prefix, macro = p.toUpperCase();
	const callables = generateNativeCallables(model, surface);
	if(!/^initialize_LeanBridgeNative[0-9a-f]{16}$/.test(receipt.initializer)) throw new TypeError("Invalid native initializer identity");
	return `#include "${p}_runtime.h"
#include "component.h"
#include "lean_bridge_native_runtime.h"
#include <stdlib.h>
#include <string.h>
${surface.callbacks.size ? "#include <pthread.h>\n#include <unistd.h>" : ""}

static inline ${p}_status lb_invalid(${p}_error *error, const char *message) {
  if (error) *error = (${p}_error){${macro}_ERROR_INVALID_ARGUMENT, message, strlen(message)};
  return ${macro}_STATUS_INVALID_ARGUMENT;
}
static inline ${p}_status lb_failure(${p}_error *error, const char *message) {
  if (error) *error = (${p}_error){${macro}_ERROR_UNEXPECTED, message, strlen(message)};
  return ${macro}_STATUS_UNEXPECTED_ERROR;
}
static inline int lb_charge(size_t *budget, size_t length, size_t width) {
  if (length > *budget / width) return 0;
  *budget -= length * width; return 1;
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

${generateCopiedNativeCalls(model, surface)}
${callables.source}
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
${callables.vtable}
};
__attribute__((constructor)) static void lb_install(void) {
  (void)${p}_runtime_install_v1(&lb_runtime, NULL);
}
__attribute__((destructor)) static void lb_detach(void) {
  lean_bridge_native_component_detach(${JSON.stringify(model.component.id)});
}
`;
};
