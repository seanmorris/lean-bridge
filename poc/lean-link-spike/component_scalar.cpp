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
static_assert(sizeof(size_t) == 4, "scalar-frame-v2 requires wasm32 Lean");
static constexpr uint32_t copy_limit = 16 * 1024 * 1024;
extern "C" uint32_t bridge_lean_runtime_status(void);

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_scalar_word_bits(void) {
  return sizeof(size_t) * 8;
}

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
  if (slot->kind != kind || kind > 18 || (slot->flags & ~1u)) return 3;
  if (kind != 11 && slot->flags) return 3;
  if (kind == 0 && slot->bits) return 3;
  if (kind == 1 && slot->bits > 1) return 3;
  if (kind == 16 && (slot->bits > 0x10ffff || (slot->bits >= 0xd800 && slot->bits <= 0xdfff))) return 3;
  if (kind == 17 && slot->bits > UINT32_MAX) return 3;
  if (kind == 18 && ((int64_t)slot->bits < INT32_MIN || (int64_t)slot->bits > INT32_MAX)) return 3;
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

static uint32_t copy_result(bridge_scalar_slot *slot, void const *data, size_t bytes, uint32_t length, uint32_t *budget) {
  if (bytes > *budget) return 4;
  *budget -= bytes;
  void *pointer = malloc(bytes ? bytes : 1);
  if (!pointer) return 5;
  if (bytes) memcpy(pointer, data, bytes);
  slot->bits = ((uint64_t)length << 32) | (uint32_t)(uintptr_t)pointer;
  slot->flags |= 2;
  return 0;
}

static uint32_t encode_object_bounded(bridge_scalar_slot *slot, uint32_t kind, lean_object *value, uint32_t *budget) {
  slot->kind = kind;
  slot->flags = 0;
  slot->bits = 0;
  uint32_t status = 0;
  try {
    if (kind == 14) {
      if (!lean_is_string(value)) status = 6;
      else status = copy_result(slot, lean_string_cstr(value), lean_string_size(value) - 1, lean_string_size(value) - 1, budget);
    } else if (kind == 15) {
      if (!lean_is_sarray(value)) status = 6;
      else status = copy_result(slot, lean_sarray_cptr(value), lean_sarray_size(value), lean_sarray_size(value), budget);
    } else if (kind == 10 || kind == 11) {
      lean::mpz magnitude = lean_is_scalar(value)
        ? (kind == 10 ? lean::mpz((unsigned)lean_unbox(value)) : lean::mpz(lean_scalar_to_int(value)))
        : lean::mpz_value(value);
      if (magnitude.is_neg()) { slot->flags = 1; magnitude.neg(); }
      if (kind == 10 && slot->flags) status = 6;
      else {
        std::vector<uint32_t> limbs;
        lean::mpz base((lean::uint64)1 << 32);
        while (!magnitude.is_zero() && limbs.size() < *budget / 4) {
          limbs.push_back((magnitude % base).get_unsigned_int());
          div2k(magnitude, magnitude, 32);
        }
        status = magnitude.is_zero() ? copy_result(slot, limbs.data(), limbs.size() * 4, limbs.size(), budget) : 4;
      }
    } else if (kind != 0) status = 6;
  } catch (...) { status = 5; }
  lean_dec(value);
  return status;
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_scalar_encode_object(bridge_scalar_slot *slot, uint32_t kind, lean_object *value) {
  uint32_t budget = copy_limit;
  return encode_object_bounded(slot, kind, value, &budget);
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_copied_abi(void) { return 1; }

static uint32_t copied_frame_validate(bridge_scalar_frame *frame, uint32_t argc, uint32_t version) {
  if (!frame || (uintptr_t)frame % 8 || !in_heap((uintptr_t)frame, 32) || argc > 32) return 1;
  uint32_t bytes = 32 + 16 * argc;
  if (frame->version != version || frame->bytes != bytes || frame->argc != argc || frame->status ||
      frame->result.kind || frame->result.flags || frame->result.bits || !in_heap((uintptr_t)frame, bytes)) return 1;
  return bridge_lean_runtime_status() == 2 ? 0 : 2;
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_copied_frame_validate(bridge_scalar_frame *frame, uint32_t argc) {
  return copied_frame_validate(frame, argc, 4);
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_record_abi(void) { return 1; }
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_compound_abi(void) { return 1; }

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_compound_frame_validate(bridge_scalar_frame *frame, uint32_t argc) {
  return copied_frame_validate(frame, argc, 6);
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_record_frame_validate(bridge_scalar_frame *frame, uint32_t argc) {
  return copied_frame_validate(frame, argc, 5);
}

static bool copied_charge(uint32_t *budget, uint64_t bytes) {
  if (bytes > *budget) return false;
  *budget -= (uint32_t)bytes;
  return true;
}

static bool copied_utf8(uint8_t const *data, uint32_t length) {
  for (uint32_t i = 0; i < length;) {
    uint32_t point = data[i++], count = 0, minimum = 0;
    if (point < 0x80) continue;
    if (point >= 0xc2 && point <= 0xdf) { point &= 0x1f; count = 1; minimum = 0x80; }
    else if (point >= 0xe0 && point <= 0xef) { point &= 0x0f; count = 2; minimum = 0x800; }
    else if (point >= 0xf0 && point <= 0xf4) { point &= 7; count = 3; minimum = 0x10000; }
    else return false;
    if (count > length - i) return false;
    while (count--) {
      uint32_t next = data[i++];
      if ((next & 0xc0) != 0x80) return false;
      point = (point << 6) | (next & 0x3f);
    }
    if (point < minimum || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return false;
  }
  return true;
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_copied_validate(bridge_scalar_slot const *slot, uint32_t kind, uint32_t depth, uint32_t *budget) {
  if (kind > 18 || depth > 32 || !slot || (uintptr_t)slot % 8 || !in_heap((uintptr_t)slot, 16)) return 3;
  if (!copied_charge(budget, 16)) return 4;
  uint32_t pointer = (uint32_t)slot->bits, count = slot->bits >> 32;
  if (depth) {
    if (slot->kind != 32 || slot->flags || (!count && pointer)) return 3;
    uint64_t bytes = 16ull * count;
    if ((count && !pointer) || pointer % 8 || !in_heap(pointer, bytes) || bytes > *budget) return 4;
    auto children = (bridge_scalar_slot const *)(uintptr_t)pointer;
    for (uint32_t i = 0; i < count; ++i) {
      uint32_t status = bridge_copied_validate(children + i, kind, depth - 1, budget);
      if (status) return status;
    }
    return 0;
  }
  uint32_t status = bridge_scalar_slot_validate(slot, kind);
  if (status) return status;
  if (kind == 12 && (slot->bits >> 32)) return 3;
  if (kind == 10 || kind == 11 || kind == 14 || kind == 15) {
    uint64_t bytes = (uint64_t)count * (kind < 12 ? 4 : 1);
    if ((count && !pointer) || !copied_charge(budget, bytes)) return 4;
    if (kind == 14 && !copied_utf8((uint8_t const *)(uintptr_t)pointer, count)) return 3;
  }
  return 0;
}

extern "C" EMSCRIPTEN_KEEPALIVE lean_object *bridge_copied_decode(bridge_scalar_slot const *slot, uint32_t kind, uint32_t depth) {
  if (depth) {
    uint32_t count = slot->bits >> 32;
    auto children = (bridge_scalar_slot const *)(uintptr_t)(uint32_t)slot->bits;
    lean_object *value = lean_alloc_array(count, count);
    for (uint32_t i = 0; i < count; ++i) lean_array_set_core(value, i, bridge_copied_decode(children + i, kind, depth - 1));
    return value;
  }
  if (kind == 0 || kind == 10 || kind == 11 || kind == 14 || kind == 15) return bridge_scalar_decode_object(slot);
  if (kind == 4 || kind == 8 || kind == 16) return lean_box_uint32((uint32_t)slot->bits);
  if (kind == 5 || kind == 9) return lean_box_uint64(slot->bits);
  if (kind == 17 || kind == 18) return lean_box_usize((size_t)slot->bits);
  if (kind == 12) { float value; memcpy(&value, &slot->bits, 4); return lean_box_float32(value); }
  if (kind == 13) { double value; memcpy(&value, &slot->bits, 8); return lean_box_float(value); }
  return lean_box(kind == 6 ? (uint8_t)slot->bits : kind == 7 ? (uint16_t)slot->bits : (size_t)slot->bits);
}

/* Only encoder-owned results enter this walk. Partially filled child tables are
   zeroed before publication. Untrusted inputs never acquire the owned flag. */
static void copied_clear(bridge_scalar_slot *slot) {
  if (slot->flags & 2) {
    void *pointer = (void *)(uintptr_t)(uint32_t)slot->bits;
    if (slot->kind >= 32 && slot->kind <= 36) {
      auto children = (bridge_scalar_slot *)pointer;
      uint32_t count = slot->bits >> 32;
      for (uint32_t i = 0; i < count; ++i) copied_clear(children + i);
    }
    free(pointer);
  }
  *slot = {};
}

static uint32_t copied_encode_node(bridge_scalar_slot *slot, uint32_t kind, uint32_t depth, lean_object *value, uint32_t *budget) {
  *slot = {};
  uint32_t status = 0;
  if (depth) {
    if (!lean_is_array(value)) { lean_dec(value); return 6; }
    uint32_t count = lean_array_size(value);
    if (!copied_charge(budget, 16ull * count)) { lean_dec(value); return 4; }
    auto children = count ? (bridge_scalar_slot *)calloc(count, 16) : nullptr;
    if (count && !children) { lean_dec(value); return 5; }
    slot->kind = 32;
    slot->flags = count ? 2 : 0;
    slot->bits = ((uint64_t)count << 32) | (uint32_t)(uintptr_t)children;
    for (uint32_t i = 0; i < count; ++i) {
      lean_object *child = lean_array_get_core(value, i); lean_inc(child);
      status = copied_encode_node(children + i, kind, depth - 1, child, budget);
      if (status) break;
    }
  } else if (kind == 0 || kind == 10 || kind == 11 || kind == 14 || kind == 15) {
    status = encode_object_bounded(slot, kind, value, budget);
    if (status) copied_clear(slot);
    return status;
  } else {
    slot->kind = kind;
    if (kind == 12) { float number = lean_unbox_float32(value); memcpy(&slot->bits, &number, 4); }
    else if (kind == 13) { double number = lean_unbox_float(value); memcpy(&slot->bits, &number, 8); }
    else if (kind == 4 || kind == 8 || kind == 16) slot->bits = lean_unbox_uint32(value);
    else if (kind == 5 || kind == 9) slot->bits = lean_unbox_uint64(value);
    else if (kind == 17 || kind == 18) slot->bits = lean_unbox_usize(value);
    else slot->bits = lean_unbox(value);
    if (kind == 6) slot->bits = (uint64_t)(int64_t)(int8_t)slot->bits;
    if (kind == 7) slot->bits = (uint64_t)(int64_t)(int16_t)slot->bits;
    if (kind == 8 || kind == 18) slot->bits = (uint64_t)(int64_t)(int32_t)slot->bits;
    status = bridge_scalar_slot_validate(slot, kind);
    if (status) status = 6;
  }
  lean_dec(value);
  if (status) copied_clear(slot);
  return status;
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_copied_encode(bridge_scalar_slot *slot, uint32_t kind, uint32_t depth, lean_object *value, uint32_t *budget) {
  *slot = {};
  if (kind > 18 || depth > 32) { lean_dec(value); return 6; }
  if (!copied_charge(budget, 16)) { lean_dec(value); return 4; }
  return copied_encode_node(slot, kind, depth, value, budget);
}

extern "C" EMSCRIPTEN_KEEPALIVE void bridge_copied_frame_clear(bridge_scalar_frame *frame) {
  copied_clear(&frame->result);
}

/* Generated typed walkers validate every node before allocating Lean objects.
   A container charges its own slot here; each child validator charges its slot. */
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_record_children_validate(bridge_scalar_slot const *slot, uint32_t kind, uint32_t expected, uint32_t *budget) {
  if (kind != 32 && kind != 36) return 3;
  return bridge_compound_children_validate(slot, kind, expected, budget);
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_compound_children_validate(bridge_scalar_slot const *slot, uint32_t kind, uint32_t expected, uint32_t *budget) {
  if (kind < 32 || kind > 36 || !slot || (uintptr_t)slot % 8 || !in_heap((uintptr_t)slot, 16)) return 3;
  bool sum = kind == 34 || kind == 35;
  if (slot->kind != kind || (sum ? slot->flags > 1 : slot->flags != 0)) return 3;
  uint32_t pointer = (uint32_t)slot->bits, count = slot->bits >> 32;
  if ((kind == 34 && count != slot->flags) || (kind == 35 && count != 1) || (kind == 33 && count != 2)) return 3;
  if ((expected != UINT32_MAX && count != expected) || (!count && pointer) || (count && !pointer) || pointer % 8) return 3;
  uint64_t bytes = 16ull * count;
  if (!in_heap(pointer, bytes)) return 3;
  if (!copied_charge(budget, 16) || bytes > *budget) return 4;
  return 0;
}

/* The result root is prepaid by the adapter. Each parent prepays all child
   slots before allocating their zeroed table; leaf encoders charge payloads. */
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_record_children_allocate(bridge_scalar_slot *slot, uint32_t kind, uint32_t count, uint32_t *budget) {
  *slot = {};
  if (kind != 32 && kind != 36) return 6;
  return bridge_compound_children_allocate(slot, kind, count, 0, budget);
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_compound_children_allocate(bridge_scalar_slot *slot, uint32_t kind, uint32_t count, uint32_t branch, uint32_t *budget) {
  *slot = {};
  if (kind < 32 || kind > 36 || branch > 1 || ((kind != 34 && kind != 35) && branch)
      || (kind == 34 && count != branch) || (kind == 35 && count != 1) || (kind == 33 && count != 2)) return 6;
  if (!copied_charge(budget, 16ull * count)) return 4;
  void *children = count ? calloc(count, 16) : nullptr;
  if (count && !children) return 5;
  slot->kind = kind;
  slot->flags = (count ? 2 : 0) | branch;
  slot->bits = ((uint64_t)count << 32) | (uint32_t)(uintptr_t)children;
  return 0;
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_record_encode_leaf(bridge_scalar_slot *slot, uint32_t kind, lean_object *value, uint32_t *budget) {
  *slot = {};
  if (kind > 18) { lean_dec(value); return 6; }
  return copied_encode_node(slot, kind, 0, value, budget);
}

extern "C" EMSCRIPTEN_KEEPALIVE void bridge_record_slot_clear(bridge_scalar_slot *slot) {
  copied_clear(slot);
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

/* A lease owns a reference, never a pointer visible to JavaScript. Tokens are
   monotonic and retire before wasm32 wraparound. All use is on this JS agent. */
struct callable_lease {
  uint32_t token;
  char key[41];
  lean_object *value;
  bridge_callable_apply apply;
};
static callable_lease callable_leases[1024] = {};
static uint32_t callable_next_token = 0;

static bool callable_key_valid(char const *key) {
  if (!in_heap((uintptr_t)key, 41)) return false;
  for (unsigned i = 0; i < 40; ++i)
    if (!((key[i] >= '0' && key[i] <= '9') || (key[i] >= 'a' && key[i] <= 'f'))) return false;
  return key[40] == 0;
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_callable_abi(void) { return 1; }

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_callable_store(lean_object *value, char const *key, bridge_callable_apply apply) {
  if (bridge_lean_runtime_status() == 2 && callable_key_valid(key) && apply && callable_next_token != UINT32_MAX) {
    for (auto &lease : callable_leases) if (!lease.token) {
      lease.token = ++callable_next_token;
      memcpy(lease.key, key, 41);
      lease.value = value;
      lease.apply = apply;
      return lease.token;
    }
  }
  lean_dec(value);
  return 0;
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_callable_invoke(uint32_t token, char const *key, bridge_scalar_frame *frame) {
  if (!token || !callable_key_valid(key) || bridge_lean_runtime_status() != 2) return 9;
  for (auto const &lease : callable_leases) if (lease.token == token && !memcmp(lease.key, key, 41)) {
    auto apply = lease.apply;
    lean_object *value = lease.value;
    lean_inc(value); // The trampoline consumes this pin even when validation fails.
    return apply(value, frame);
  }
  return 9;
}

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_callable_release(uint32_t token, char const *key) {
  if (!token || !callable_key_valid(key) || bridge_lean_runtime_status() != 2) return 0;
  for (auto &lease : callable_leases) if (lease.token == token && !memcmp(lease.key, key, 41)) {
    lean_object *value = lease.value;
    lease = {}; // Reentrant disposal cannot find the lease again.
    lean_dec(value);
    return 1;
  }
  return 0;
}

EM_JS(uint32_t, callable_dispatch_js, (uint32_t token, char const *key, bridge_scalar_frame *frame), {
  return Module.bridgeCallableDispatch ? Module.bridgeCallableDispatch(token >>> 0, UTF8ToString(key), frame >>> 0) : 8;
});

extern "C" EMSCRIPTEN_KEEPALIVE uint32_t bridge_callable_dispatch(uint32_t token, char const *key, bridge_scalar_frame *frame) {
  if (!callable_key_valid(key)) return 9;
  return callable_dispatch_js(token, key, frame);
}

extern "C" EMSCRIPTEN_KEEPALIVE void bridge_callable_frame_clear(bridge_scalar_frame *frame) {
  bridge_scalar_frame_clear(frame);
  for (uint32_t i = 0; i < frame->argc; ++i) {
    if (frame->args[i].flags & 2) free((void *)(uintptr_t)(uint32_t)frame->args[i].bits);
    frame->args[i].flags = 0;
    frame->args[i].bits = 0;
  }
}
