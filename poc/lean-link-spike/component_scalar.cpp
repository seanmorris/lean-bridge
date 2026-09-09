#include "component_scalar.h"
#include "runtime/object.h"
#include <emscripten/emscripten.h>
#include <emscripten/heap.h>
#include <dlfcn.h>
#include <cstdlib>
#include <cstring>
#include <vector>

static_assert(sizeof(bridge_scalar_slot) == 16, "scalar slot layout drift");
static_assert(sizeof(bridge_scalar_frame) == 32, "scalar frame layout drift");
static constexpr uint32_t copy_limit = 16 * 1024 * 1024;
extern "C" uint32_t bridge_lean_runtime_status(void);

static bool in_heap(uintptr_t pointer, uint64_t bytes) {
  return pointer <= emscripten_get_heap_size() && bytes <= emscripten_get_heap_size() - pointer;
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_scalar_frame_validate(bridge_scalar_frame *frame, uint32_t argc) {
  if (!in_heap((uintptr_t)frame, 32) || (uintptr_t)frame % 8) return 1;
  uint64_t bytes = 32ull + 16ull * argc;
  if (frame->version != 2 || frame->argc != argc || frame->bytes != bytes || bytes > copy_limit || !in_heap((uintptr_t)frame, bytes)) return 1;
  if (bridge_lean_runtime_status() != 2) return 2;
  if (frame->result.flags || frame->result.bits) return 1;
  return 0;
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_scalar_slot_validate(bridge_scalar_slot const *slot, uint32_t kind) {
  if (slot->kind != kind || kind > 15 || (slot->flags & ~1u)) return 3;
  if (kind != 11 && slot->flags) return 3;
  if (kind == 0 && slot->bits) return 3;
  if (kind == 1 && slot->bits > 1) return 3;
  if (kind >= 2 && kind <= 4 && slot->bits >= (1ull << (8u << (kind - 2)))) return 3;
  if (kind >= 6 && kind <= 8) {
    int64_t value = (int64_t)slot->bits;
    uint32_t width = 8u << (kind - 6);
    if (value < -(1ll << (width - 1)) || value >= (1ll << (width - 1))) return 3;
  }
  if (kind == 10 || kind == 11 || kind == 14 || kind == 15) {
    uint32_t pointer = (uint32_t)slot->bits;
    uint32_t length = slot->bits >> 32;
    uint64_t bytes = (uint64_t)length * (kind < 12 ? 4 : 1);
    if (bytes > copy_limit || !in_heap(pointer, bytes) || (kind < 12 && pointer % 4)) return 4;
    if (kind < 12 && ((length && ((uint32_t const *)(uintptr_t)pointer)[length - 1] == 0) || (!length && slot->flags))) return 3;
  }
  return 0;
}

extern "C" EMSCRIPTEN_KEEPALIVE lean_object *bridge_scalar_decode_object(bridge_scalar_slot const *slot) {
  uint32_t pointer = (uint32_t)slot->bits;
  uint32_t length = slot->bits >> 32;
  if (slot->kind == 0) return lean_box(0);
  if (slot->kind == 14) return lean_mk_string_from_bytes((char const *)(uintptr_t)pointer, length);
  if (slot->kind == 15) {
    lean_object *value = lean_alloc_sarray(1, length, length);
    if (length) memcpy(lean_sarray_cptr(value), (void const *)(uintptr_t)pointer, length);
    return value;
  }
  lean::mpz magnitude(0u);
  uint32_t const *limbs = (uint32_t const *)(uintptr_t)pointer;
  for (uint32_t index = length; index > 0; --index) {
    mul2k(magnitude, magnitude, 32);
    magnitude += lean::mpz(limbs[index - 1]);
  }
  if (slot->flags & 1) magnitude.neg();
  if (slot->kind == 10) return lean::mk_nat_obj(magnitude);
  if (magnitude < LEAN_MIN_SMALL_INT || magnitude > LEAN_MAX_SMALL_INT) return lean::alloc_mpz(magnitude);
  return lean_box((unsigned)magnitude.get_int());
}

static uint32_t copy_result(bridge_scalar_slot *slot, void const *data, size_t bytes, uint32_t length) {
  if (bytes > copy_limit) return 4;
  void *pointer = malloc(bytes ? bytes : 1);
  if (!pointer) return 5;
  if (bytes) memcpy(pointer, data, bytes);
  slot->bits = ((uint64_t)length << 32) | (uint32_t)(uintptr_t)pointer;
  slot->flags |= 2;
  return 0;
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_scalar_encode_object(bridge_scalar_slot *slot, uint32_t kind, lean_object *value) {
  slot->kind = kind;
  slot->flags = 0;
  slot->bits = 0;
  uint32_t status = 0;
  try {
    if (kind == 14) {
      if (!lean_is_string(value)) status = 6;
      else status = copy_result(slot, lean_string_cstr(value), lean_string_size(value) - 1, lean_string_size(value) - 1);
    } else if (kind == 15) {
      if (!lean_is_sarray(value)) status = 6;
      else status = copy_result(slot, lean_sarray_cptr(value), lean_sarray_size(value), lean_sarray_size(value));
    } else if (kind == 10 || kind == 11) {
      lean::mpz magnitude = lean_is_scalar(value)
        ? (kind == 10 ? lean::mpz((unsigned)lean_unbox(value)) : lean::mpz(lean_scalar_to_int(value)))
        : lean::mpz_value(value);
      if (magnitude.is_neg()) { slot->flags = 1; magnitude.neg(); }
      if (kind == 10 && slot->flags) status = 6;
      else {
        std::vector<uint32_t> limbs;
        lean::mpz base((lean::uint64)1 << 32);
        while (!magnitude.is_zero() && limbs.size() < copy_limit / 4) {
          limbs.push_back((magnitude % base).get_unsigned_int());
          div2k(magnitude, magnitude, 32);
        }
        status = magnitude.is_zero() ? copy_result(slot, limbs.data(), limbs.size() * 4, limbs.size()) : 4;
      }
    } else if (kind != 0) status = 6;
  } catch (...) { status = 5; }
  lean_dec(value);
  return status;
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_scalar_call(char const *symbol, bridge_scalar_frame *frame) {
  if (!in_heap((uintptr_t)frame, 32)) return 1;
  auto operation = (uint32_t (*)(bridge_scalar_frame *))dlsym(RTLD_DEFAULT, symbol);
  if (!operation) return 7;
  uint32_t status = operation(frame);
  frame->status = status;
  return status;
}

extern "C" EMSCRIPTEN_KEEPALIVE void bridge_scalar_frame_clear(bridge_scalar_frame *frame) {
  if (!in_heap((uintptr_t)frame, 32)) return;
  if (frame->result.flags & 2) free((void *)(uintptr_t)(uint32_t)frame->result.bits);
  frame->result.flags = 0;
  frame->result.bits = 0;
}
