#include <stdio.h>
static void lb_probe_end(const char **label) { fprintf(stderr, "LB_SUBTYPE_ENTRY_V1 end public %s\n", *label); }
#include <php.h>
#include <stdbool.h>
#include <limits.h>
#include <Zend/zend_exceptions.h>
#include "owned-values-codec.h"
_Static_assert(sizeof(void *) == 4 && sizeof(zend_long) == 4, "32-bit PHP-Wasm required");


#include <inttypes.h>
#include <stdlib.h>
#include <string.h>

#ifndef LB_ZEND_CALLOC
#define LB_ZEND_CALLOC calloc
#endif
#ifndef LB_ZEND_FREE
#define LB_ZEND_FREE free
#endif

typedef struct lb_block { struct lb_block *next; void *data; } lb_block;
typedef struct {
  size_t remaining;
  lb_block *blocks;
  const char *error;
  int type_error;
  unsigned failure; /* 2: budget, 3: allocation, 4: invalid representation. */
} lb_scope;
static int lb_fail(lb_scope *s, const char *message, int type_error) {
  if (!s->error) { s->error = message; s->type_error = type_error; if (!s->failure) s->failure = 4; }
  return 0;
}
static int lb_charge(lb_scope *s, size_t count, size_t width) {
  if (!width || count > s->remaining / width) {
    if (!s->error) s->failure = 2;
    return lb_fail(s, "16 MiB Zend conversion limit exceeded", 0);
  }
  s->remaining -= count * width; return 1;
}
static int lb_readable(lb_scope *s, const void *data, size_t count, size_t width, size_t alignment) {
  if (!count) return 1;
  if (!data || !width || !alignment || count > SIZE_MAX / width) return lb_fail(s, "Invalid native output buffer", 0);
  if ((uintptr_t)data % alignment) return lb_fail(s, "Misaligned native output buffer", 0);
#ifdef __wasm__
  if ((uint64_t)(uintptr_t)data + (uint64_t)count * width > (uint64_t)__builtin_wasm_memory_size(0) * 65536)
    return lb_fail(s, "Native output buffer exceeds Wasm memory", 0);
#endif
  return 1;
}
static void *lb_allocate(lb_scope *s, size_t count, size_t width) {
  if (!lb_charge(s, count ? count : 1, width) || !lb_charge(s, 1, sizeof(lb_block))) return NULL;
  lb_block *block = LB_ZEND_CALLOC(1, sizeof(*block));
  void *data = block ? LB_ZEND_CALLOC(count ? count : 1, width) : NULL;
  if (!data) {
    LB_ZEND_FREE(block); if (!s->error) s->failure = 3;
    lb_fail(s, "Zend conversion allocation failed", 0); return NULL;
  }
  block->data = data; block->next = s->blocks; s->blocks = block; return data;
}
static void lb_scope_clear(lb_scope *s) {
  while (s->blocks) {
    lb_block *block = s->blocks; s->blocks = block->next;
    LB_ZEND_FREE(block->data); LB_ZEND_FREE(block);
  }
}
static int lb_utf8(const unsigned char *p, size_t n) {
  size_t i = 0;
  while (i < n) {
    unsigned a = p[i++], c = 0, minimum = 0, rest = 0;
    if (a < 128) continue;
    if (a >= 0xc2 && a <= 0xdf) { c = a & 31; minimum = 0x80; rest = 1; }
    else if (a >= 0xe0 && a <= 0xef) { c = a & 15; minimum = 0x800; rest = 2; }
    else if (a >= 0xf0 && a <= 0xf4) { c = a & 7; minimum = 0x10000; rest = 3; }
    else return 0;
    if (rest > n - i) return 0;
    while (rest--) { unsigned b = p[i++]; if ((b & 0xc0) != 0x80) return 0; c = (c << 6) | (b & 63); }
    if (c < minimum || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) return 0;
  }
  return 1;
}
static inline int lb_char_in(const unsigned char *text, size_t length, uint32_t *out) {
  if (!length || length > 4 || !lb_utf8(text, length)) return 0;
  size_t expected = text[0] < 128 ? 1 : text[0] < 0xe0 ? 2 : text[0] < 0xf0 ? 3 : 4;
  if (length != expected) return 0;
  uint32_t point = text[0] & (length == 1 ? 127 : length == 2 ? 31 : length == 3 ? 15 : 7);
  for (size_t i = 1; i < length; i++) point = (point << 6) | (text[i] & 63);
  *out = point; return 1;
}
static inline size_t lb_char_out(uint32_t point, char *text) {
  if (point < 128) { text[0] = (char)point; return 1; }
  size_t length = point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  for (size_t i = length - 1; i > 0; i--) { text[i] = (char)(0x80 | (point & 63)); point >>= 6; }
  text[0] = (char)((length == 2 ? 0xc0 : length == 3 ? 0xe0 : 0xf0) | point); return length;
}
static int lb_decimal(zval *value, lb_scope *s, const char **digits, size_t *length, bool *negative) {
  if (Z_TYPE_P(value) != IS_STRING) return lb_fail(s, "Expected canonical decimal text", 1);
  const char *text = Z_STRVAL_P(value); size_t n = Z_STRLEN_P(value);
  if (!lb_charge(s, n, 1)) return 0;
  bool sign = n && text[0] == '-';
  if (sign) { text++; n--; }
  if (!n || n > 16384 || (text[0] == '0' && (n != 1 || sign)))
    return lb_fail(s, "Expected canonical decimal text of at most 16384 digits", 0);
  for (size_t i = 0; i < n; i++) if (text[i] < '0' || text[i] > '9')
    return lb_fail(s, "Expected canonical decimal text", 0);
  *digits = text; *length = n; *negative = sign; return 1;
}
static int lb_u64_in(zval *value, lb_scope *s, uint64_t *out, bool signed_value, unsigned bits) {
  const char *digits; size_t n; bool negative;
  if (!lb_decimal(value, s, &digits, &n, &negative)) return 0;
  if (negative && !signed_value) return lb_fail(s, "Expected an unsigned integer", 0);
  uint64_t limit = signed_value ? (negative ? UINT64_C(9223372036854775808) : INT64_MAX)
    : bits == 32 ? UINT32_MAX : UINT64_MAX;
  uint64_t magnitude = 0;
  for (size_t i = 0; i < n; i++) {
    unsigned digit = (unsigned)(digits[i] - '0');
    if (magnitude > (limit - digit) / 10) return lb_fail(s, "Integer is outside the declared Lean range", 0);
    magnitude = magnitude * 10 + digit;
  }
  *out = negative ? UINT64_C(0) - magnitude : magnitude; return 1;
}
static int lb_big_in(zval *value, lb_scope *s, uint32_t **out, size_t *length, bool *negative, bool signed_value) {
  const char *digits; size_t n; bool sign;
  if (!lb_decimal(value, s, &digits, &n, &sign)) return 0;
  if (sign && !signed_value) return lb_fail(s, "Expected an unsigned integer", 0);
  size_t capacity = n / 9 + 1, count = 0;
  uint32_t *words = lb_allocate(s, capacity, sizeof(uint32_t));
  if (!words) return 0;
  for (size_t offset = 0; offset < n;) {
    size_t width = (n - offset) % 9; if (!width) width = 9;
    uint64_t carry = 0, base = 1;
    for (size_t i = 0; i < width; i++) { carry = carry * 10 + (unsigned)(digits[offset++] - '0'); base *= 10; }
    for (size_t i = 0; i < count; i++) { uint64_t v = (uint64_t)words[i] * base + carry; words[i] = (uint32_t)v; carry = v >> 32; }
    if (carry) words[count++] = (uint32_t)carry;
  }
  *out = words; *length = count; *negative = sign; return 1;
}
static int lb_big_out(const uint32_t *words, size_t length, bool negative, zval *out, lb_scope *s) {
  if (length > 1701 || (!length && negative))
    return lb_fail(s, "Invalid or excessive big integer output", 0);
  if (!lb_readable(s, words, length, sizeof(*words), _Alignof(uint32_t))) return 0;
  if (length && !words[length - 1]) return lb_fail(s, "Noncanonical big integer output", 0);
  if (!lb_charge(s, length, sizeof(uint32_t))) return 0;
  uint32_t *chunks = lb_allocate(s, length * 2 + 1, sizeof(uint32_t));
  if (!chunks) return 0;
  size_t count = 0;
  for (size_t index = length; index > 0; index--) {
    uint64_t carry = words[index - 1];
    for (size_t i = 0; i < count; i++) {
      uint64_t v = (uint64_t)chunks[i] * UINT64_C(4294967296) + carry;
      chunks[i] = (uint32_t)(v % 1000000000); carry = v / 1000000000;
    }
    while (carry) { chunks[count++] = (uint32_t)(carry % 1000000000); carry /= 1000000000; }
  }
  size_t capacity = count * 9 + 2;
  char *text = lb_allocate(s, capacity, 1); if (!text) return 0;
  size_t used = negative ? 1 : 0; if (negative) text[0] = '-';
  used += (size_t)snprintf(text + used, capacity - used, "%" PRIu32, count ? chunks[--count] : 0);
  while (count) used += (size_t)snprintf(text + used, capacity - used, "%09" PRIu32, chunks[--count]);
  if (used - (negative ? 1 : 0) > 16384) return lb_fail(s, "BigInteger decimal conversion limit exceeded", 0);
  if (!lb_charge(s, used, 1)) return 0;
  ZVAL_STRINGL(out, text, used); return 1;
}


#include <Zend/zend_exceptions.h>
#include <Zend/zend_fibers.h>

typedef struct lgo_state lgo_state;
typedef struct lgo_lease lgo_lease;
typedef struct lgo_borrow lgo_borrow;
typedef struct lgo_input_group lgo_input_group;
struct lgo_state {
  lb_owned_context native;
  lgo_lease *leases;
  size_t references;
  int closing;
};
struct lgo_lease {
  lgo_state *state;
  lgo_lease *next;
  ov_result_owner owner;
  size_t references;
  int pending, clearing;
  lgo_input_group *input_move;
  int published, consumed;
};
struct lgo_borrow {
  lgo_state *state;
  lb_owned_scope *scope;
  size_t references;
  int active;
};
typedef struct {
  lgo_lease *lease;
  lgo_borrow *borrow;
  uint64_t token;
  unsigned type;
} lgo_handle;
static lgo_state *lgo_current;
static int lgo_resource_type;
static int lgo_initialize(void);
static const char *const lgo_kinds[] = {
  NULL,
  NULL,
  NULL,
  "resource:OwnedCheckedRecords.Ticket",
  NULL,
  NULL,
  NULL,
};
static const char *lgo_kind(unsigned type) {
  return type < sizeof(lgo_kinds) / sizeof(lgo_kinds[0]) ? lgo_kinds[type] : NULL;
}
static int lgo_main(void) {
  return EG(current_fiber_context) == EG(main_fiber_context);
}
static int lgo_affinity(lgo_state *state) {
  if (!state || state->native.self != &state->native) return LB_OWNED_INVALID;
  if (state->native.process != getpid()) return LB_OWNED_PROCESS;
  if (!lgo_main() || !pthread_equal(state->native.thread, pthread_self())
      || state->native.thread_serial != lb_owned_thread_serial) return LB_OWNED_THREAD;
  return LB_OWNED_OK;
}
static int lgo_state_retain(lgo_state *state) {
  if (!state || !state->references) return LB_OWNED_INVALID;
  if (state->references == SIZE_MAX) return LB_OWNED_LIMIT;
  ++state->references; return LB_OWNED_OK;
}
static void lgo_state_release(lgo_state *state) {
  if (!state || !state->references || --state->references) return;
  if (!state->closing || state->leases || state->native.top || state->native.initialized) {
    state->references = 1; lean_bridge_native_runtime_retire(); return;
  }
  LB_ZEND_FREE(state);
}
static int lgo_ready(lgo_state *state) {
  int status = lgo_affinity(state);
  if (status) return status;
  return state->closing ? LB_OWNED_CLOSED : lb_owned_ready(&state->native);
}
static void lgo_lease_destroy(lgo_lease *lease) {
  lgo_state *state = lease->state;
  lgo_lease **position = &state->leases;
  while (*position && *position != lease) position = &(*position)->next;
  if (!*position || lease->references || !ov_owner_empty(&lease->owner)) {
    lean_bridge_native_runtime_retire(); return;
  }
  *position = lease->next; LB_ZEND_FREE(lease); lgo_state_release(state);
}
static int lgo_drain(lgo_state *state) {
  int status = lgo_affinity(state);
  if (status) return status;
  status = lgo_state_retain(state); if (status) return status;
  int failure = LB_OWNED_OK;
  for (lgo_lease *lease = state->leases, *next; lease; lease = next) {
    next = lease->next;
    if (!lease->pending || lease->references || lease->clearing) continue;
    lease->clearing = 1;
    int released = ov_owner_clear(&lease->owner); lease->clearing = 0;
    if (!failure) failure = released;
    if (ov_owner_empty(&lease->owner)) lgo_lease_destroy(lease);
  }
  lgo_state_release(state); return failure;
}
static void lgo_lease_release(lgo_lease *lease) {
  if (!lease || !lease->references || --lease->references) return;
  lease->pending = 1;
  // Destruction in a Fiber cannot enter Lean. The next main-context entry
  // drains this registered lease. After shutdown only empty C storage remains.
  if (lease->state->closing && ov_owner_empty(&lease->owner)) lgo_lease_destroy(lease);
  else if (lgo_main()) (void)lgo_drain(lease->state);
}
static int lgo_lease_retain(lgo_lease *lease) {
  if (!lease || !lease->references || lease->pending || lease->clearing) return LB_OWNED_CLOSED;
  if (lease->references == SIZE_MAX) return LB_OWNED_LIMIT;
  ++lease->references; return LB_OWNED_OK;
}
static int lgo_lease_new(lgo_state *state, lgo_lease **out) {
  *out = NULL; int status = lgo_ready(state); if (status) return status;
  status = lgo_drain(state); if (status) return status;
  lgo_lease *lease = LB_ZEND_CALLOC(1, sizeof(*lease));
  if (!lease) return LB_OWNED_ALLOC_FAILED;
  status = lgo_state_retain(state);
  if (status) { LB_ZEND_FREE(lease); return status; }
  lease->state = state; lease->references = 1;
  lease->next = state->leases; state->leases = lease; *out = lease;
  return LB_OWNED_OK;
}
static int lgo_state_current(lgo_state **out) {
  *out = NULL;
  if (!lgo_main()) return LB_OWNED_THREAD;
  if (!lgo_current) {
    int status = lgo_initialize(); if (status) return status;
    lgo_state *state = LB_ZEND_CALLOC(1, sizeof(*state));
    if (!state) return LB_OWNED_ALLOC_FAILED;
    status = lb_owned_context_init(&state->native, "owned-checked-records@1.0.0");
    if (status) { LB_ZEND_FREE(state); return status; }
    state->references = 1; lgo_current = state;
  }
  int status = lgo_ready(lgo_current);
  if (!status) status = lgo_drain(lgo_current);
  if (!status) *out = lgo_current;
  return status;
}
static int lgo_state_close(lgo_state *state) {
  int status = lgo_affinity(state); if (status) return status;
  status = lgo_state_retain(state); if (status) return status;
  if (!state->closing) {
    state->closing = 1; status = lb_owned_context_close(&state->native);
  }
  // Closing invalidates all views. Clear native buffers now, even if PHP still
  // holds wrappers that will be destroyed after extension RSHUTDOWN.
  for (lgo_lease *lease = state->leases, *next; lease; lease = next) {
    next = lease->next;
    int released = ov_owner_clear(&lease->owner);
    if (!status) status = released;
    if (!lease->references && ov_owner_empty(&lease->owner)) lgo_lease_destroy(lease);
  }
  lgo_state_release(state); return status;
}
static int lgo_shutdown(void) {
  lgo_state *state = lgo_current;
  if (!state) return LB_OWNED_OK;
  int status = lgo_state_close(state);
  // Never release a live context after an affinity failure.
  if (!state->closing) return status;
  lgo_current = NULL; lgo_state_release(state); return status;
}
static int lgo_scope_live(lgo_borrow *borrow) {
  if (!borrow || !borrow->active || !borrow->scope || !borrow->references) return LB_OWNED_CLOSED;
  int status = lgo_ready(borrow->state); if (status) return status;
  for (lb_owned_scope *scope = borrow->state->native.top; scope; scope = scope->parent)
    if (scope == borrow->scope) return LB_OWNED_OK;
  return LB_OWNED_CLOSED;
}
static void lgo_borrow_release(lgo_borrow *borrow) {
  if (!borrow || !borrow->references || --borrow->references) return;
  lgo_state *state = borrow->state; LB_ZEND_FREE(borrow); lgo_state_release(state);
}
static int lgo_borrow_new(lgo_state *state, lb_owned_scope *scope, lgo_borrow **out) {
  *out = NULL; int status = lgo_ready(state); if (status) return status;
  int found = 0;
  for (lb_owned_scope *active = state->native.top; active; active = active->parent)
    if (active == scope) { found = 1; break; }
  if (!found) return LB_OWNED_ORDER;
  lgo_borrow *borrow = LB_ZEND_CALLOC(1, sizeof(*borrow));
  if (!borrow) return LB_OWNED_ALLOC_FAILED;
  status = lgo_state_retain(state);
  if (status) { LB_ZEND_FREE(borrow); return status; }
  borrow->state = state; borrow->scope = scope; borrow->active = 1; borrow->references = 1;
  *out = borrow; return LB_OWNED_OK;
}
static void lgo_borrow_expire(lgo_borrow *borrow) {
  if (borrow) { borrow->active = 0; borrow->scope = NULL; }
}
static void lgo_borrow_end(lgo_borrow **slot) {
  lgo_borrow *borrow = *slot; *slot = NULL;
  if (!borrow) return;
  lgo_borrow_expire(borrow); lgo_borrow_release(borrow);
}
static int lgo_entries_contain(lb_owned_entry *entries, unsigned type, uint64_t token) {
  const char *kind = lgo_kind(type); if (!kind || !token) return 0;
  for (lb_owned_entry *entry = entries; entry; entry = entry->next)
    if (entry->owner->token == token && !strcmp(entry->owner->kind, kind)) return 1;
  return 0;
}
static int lgo_handle_check(lgo_handle *handle) {
  if (!handle || !handle->token || (!handle->lease && !handle->borrow)) return LB_OWNED_CLOSED;
  if (!lgo_kind(handle->type) || (handle->lease && handle->borrow)) return LB_OWNED_INVALID;
  if (handle->lease) {
    lgo_lease *lease = handle->lease;
    int status = lgo_ready(lease->state); if (status) return status;
    if (!lease->references || lease->pending || lease->clearing || lease->consumed) return LB_OWNED_CLOSED;
    if (lease->owner.batch.context != &lease->state->native
        || !lgo_entries_contain(lease->owner.batch.entries, handle->type, handle->token)) return LB_OWNED_INVALID;
  } else {
    int status = lgo_scope_live(handle->borrow); if (status) return status;
    lb_owned_scope *scope = handle->borrow->scope;
    if (!lgo_entries_contain(scope->inputs, handle->type, handle->token)
        && !lgo_entries_contain(scope->outputs, handle->type, handle->token)) return LB_OWNED_INVALID;
  }
  return LB_OWNED_OK;
}
static lgo_state *lgo_handle_state(lgo_handle *handle) {
  return handle->lease ? handle->lease->state : handle->borrow ? handle->borrow->state : NULL;
}
static int lgo_handle_fetch(zval *value, unsigned type, lgo_state *state, lgo_handle **out) {
  *out = NULL; ZVAL_DEREF(value);
  if (Z_TYPE_P(value) != IS_RESOURCE || Z_RES_P(value)->type != lgo_resource_type || !Z_RES_P(value)->ptr)
    return LB_OWNED_INVALID;
  lgo_handle *handle = Z_RES_P(value)->ptr;
  int status = lgo_handle_check(handle); if (status) return status;
  if (handle->type != type || (state && lgo_handle_state(handle) != state)) return LB_OWNED_INVALID;
  *out = handle; return LB_OWNED_OK;
}
static void lgo_handle_release(lgo_handle *handle) {
  lgo_lease *lease = handle->lease; lgo_borrow *borrow = handle->borrow;
  handle->lease = NULL; handle->borrow = NULL; handle->token = 0;
  if (lease) lgo_lease_release(lease);
  if (borrow) lgo_borrow_release(borrow);
}
static int lgo_handle_close(lgo_handle *handle) {
  if (!handle || !handle->token) return LB_OWNED_OK;
  int status = lgo_affinity(lgo_handle_state(handle)); if (status) return status;
  lgo_handle_release(handle); return LB_OWNED_OK;
}
static void lgo_resource_destroy(zend_resource *resource) {
  lgo_handle *handle = resource->ptr;
  if (!handle) return;
  resource->ptr = NULL; lgo_handle_release(handle); LB_ZEND_FREE(handle);
}
static int lgo_wrap(unsigned type, uint64_t token, lgo_lease *lease, lgo_borrow *borrow, zval *out) {
  lgo_handle candidate = { .lease = lease, .borrow = borrow, .token = token, .type = type };
  int status = lgo_handle_check(&candidate);
  if (status) return status == LB_OWNED_INVALID || status == LB_OWNED_CLOSED ? OV_RESULT : status;
  lgo_handle *handle = LB_ZEND_CALLOC(1, sizeof(*handle));
  if (!handle) return LB_OWNED_ALLOC_FAILED;
  if (lease) status = lgo_lease_retain(lease);
  else if (borrow->references == SIZE_MAX) status = LB_OWNED_LIMIT;
  else ++borrow->references;
  if (status) { LB_ZEND_FREE(handle); return status; }
  *handle = candidate;
  zend_try { ZVAL_RES(out, zend_register_resource(handle, lgo_resource_type)); }
  zend_catch { lgo_handle_release(handle); LB_ZEND_FREE(handle); zend_bailout(); }
  zend_end_try();
  return LB_OWNED_OK;
}
static int lgo_handle_retain(lgo_handle *handle, zval *out) {
  int status = lgo_handle_check(handle); if (status) return status;
  lgo_state *state = lgo_handle_state(handle); lgo_lease *lease = NULL;
  status = lgo_lease_new(state, &lease); if (status) return status;
  ov_transaction transaction = {0}; uint64_t token = 0; lean_object *value = NULL;
  status = ov_begin(&transaction, &state->native, &lease->owner, "owned-checked-records@1.0.0");
  if (!status) status = lb_owned_scope_borrow(&transaction.scope, lgo_kind(handle->type), handle->token, &value);
  if (!status) status = lb_owned_scope_acquire(&transaction.scope, lgo_kind(handle->type), value, &token);
  if (!status) status = ov_commit(&transaction, &lease->owner);
  else if (transaction.scope.context) status = ov_abort(&transaction, status);
  if (!status) {
    zend_try { status = lgo_wrap(handle->type, token, lease, NULL, out); }
    zend_catch { lgo_lease_release(lease); zend_bailout(); }
    zend_end_try();
  }
  if (!status) lease->published = 1;
  lgo_lease_release(lease); return status;
}
static void lgo_clear_zvals(zval *values, size_t count, int *bailout) {
  zend_object *volatile failure = EG(exception);
  if (failure) { GC_ADDREF(failure); zend_clear_exception(); }
  for (size_t index = 0; index < count; ++index) {
    zend_try { zval_ptr_dtor(values + index); }
    zend_catch { *bailout = 1; } zend_end_try();
    ZVAL_UNDEF(values + index);
    if (EG(exception)) {
      if (!failure) { failure = EG(exception); GC_ADDREF(failure); }
      zend_clear_exception();
    }
  }
  // PHP 8.4 exit uses an internal unwind object, not a userland Throwable.
  if (failure) zend_throw_exception_internal(failure);
}
static int lgo_borrow_finish(lgo_borrow **borrow, ov_transaction *transaction,
    zval *values, size_t count, int status, int *bailout) {
  // Invalidate views before any PHP destructor runs, but keep the frame's state
  // reference until its native scope has unwound. A callback can close every
  // owning wrapper and the current context while that scope is still active.
  lgo_borrow_expire(*borrow);
  lgo_clear_zvals(values, count, bailout);
  if (transaction->scope.context) status = ov_abort(transaction, status);
  lgo_borrow_end(borrow); return status;
}

static int lgo_identity_input(lb_scope *, unsigned, zval *, uint64_t *);
static int lgo_identity_output(lb_scope *, unsigned, uint64_t, zval *);

enum { LG_SCALAR, LG_FIELDS, LG_VARIANT, LG_OPTION, LG_RESULT, LG_SEQUENCE };
typedef struct { unsigned type; size_t offset; bool pointer; } lg_field;
typedef struct { size_t count; const lg_field *fields; } lg_branch;
typedef struct {
  unsigned kind;
  bool inhabited;
  size_t size, alignment;
  unsigned element;
  size_t tag_offset, data_offset, length_offset;
  size_t branch_count;
  const lg_branch *branches;
  int (*input)(zval *, void *, lb_scope *);
  int (*output)(const void *, zval *, lb_scope *);
} lg_node;
typedef struct {
  unsigned type;
  bool entered;
  unsigned char *native;
  zval *wire;
  HashTable *outer, *items;
  zval *children;
  const lg_field *fields;
  unsigned char *data;
  size_t index, count, wire_offset;
} lg_frame;
typedef struct { lb_scope scope; size_t visits; lg_frame frames[129]; } lg_walk;


static int lb_to5(zval *value, lbov_927414336ec9185cc5a2_t167081552b6f9c1d1afd *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  uint32_t *words; bool negative; if (!lb_big_in(value, s, &words, &out->length, &negative, false)) return 0;
  out->data = words;
  return 1;
}
static int lb_from5(const lbov_927414336ec9185cc5a2_t167081552b6f9c1d1afd *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  return lb_big_out(value->data, value->length, false, out, s);
  return 1;
}

static int lb_to6(zval *value, lbov_927414336ec9185cc5a2_tdc0347e1f7f5c4d928f1 *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_STRING) return lb_fail(s, "Expected string bytes", 1);
  if (!lb_charge(s, Z_STRLEN_P(value), 1)) return 0;
  if (!lb_utf8((const unsigned char *)Z_STRVAL_P(value), Z_STRLEN_P(value))) return lb_fail(s, "String requires valid UTF-8", 0);
  out->data = (const char *)Z_STRVAL_P(value); out->length = Z_STRLEN_P(value);
  return 1;
}
static int lb_from6(const lbov_927414336ec9185cc5a2_tdc0347e1f7f5c4d928f1 *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, value->length, 1) || (value->length && !value->data)) return lb_fail(s, "Invalid string buffer", 0);
  if (!lb_readable(s, value->data, value->length, 1, 1)) return 0;
  if (!lb_utf8((const unsigned char *)value->data, value->length)) return lb_fail(s, "Native string is not valid UTF-8", 0);
  ZVAL_STRINGL(out, value->length ? (const char *)value->data : "", value->length);
  return 1;
}


static int lg_to_3(zval *value, void *out, lb_scope *scope) {
  return lgo_identity_input(scope, 3, value, &((lbov_927414336ec9185cc5a2_td79b9bbde250ee1779da *)out)->token);
}
static int lg_from_3(const void *value, zval *out, lb_scope *scope) {
  return lgo_identity_output(scope, 3, ((const lbov_927414336ec9185cc5a2_td79b9bbde250ee1779da *)value)->token, out);
}


static int lg_to_5(zval *value, void *out, lb_scope *scope) {
  return lb_to5(value, (lbov_927414336ec9185cc5a2_t167081552b6f9c1d1afd *)out, scope);
}
static int lg_from_5(const void *value, zval *out, lb_scope *scope) {
  return lb_from5((const lbov_927414336ec9185cc5a2_t167081552b6f9c1d1afd *)value, out, scope);
}


static int lg_to_6(zval *value, void *out, lb_scope *scope) {
  return lb_to6(value, (lbov_927414336ec9185cc5a2_tdc0347e1f7f5c4d928f1 *)out, scope);
}
static int lg_from_6(const void *value, zval *out, lb_scope *scope) {
  return lb_from6((const lbov_927414336ec9185cc5a2_tdc0347e1f7f5c4d928f1 *)value, out, scope);
}

static const lg_field lg_fields_0_0[] = {
  { 3, offsetof(lbov_927414336ec9185cc5a2_t23107461f72b24c37654, f0), false },
  { 4, offsetof(lbov_927414336ec9185cc5a2_t23107461f72b24c37654, f1), true },
};

static const lg_branch lg_branches_0[] = { { 2, lg_fields_0_0 } };

static const lg_field lg_fields_1_0[] = {
  { 3, offsetof(lbov_927414336ec9185cc5a2_tb2825946e038e653bd2b, f0), false },
  { 5, offsetof(lbov_927414336ec9185cc5a2_tb2825946e038e653bd2b, f1), false },
};

static const lg_branch lg_branches_1[] = { { 2, lg_fields_1_0 } };

static const lg_field lg_fields_2_0[] = {
  { 3, offsetof(lbov_927414336ec9185cc5a2_t4ce841c87ea3b1559bfb, f0), false },
  { 5, offsetof(lbov_927414336ec9185cc5a2_t4ce841c87ea3b1559bfb, f1), false },
  { 5, offsetof(lbov_927414336ec9185cc5a2_t4ce841c87ea3b1559bfb, f2), false },
};

static const lg_branch lg_branches_2[] = { { 3, lg_fields_2_0 } };

static const lg_field lg_fields_4_0[] = {
  { 5, offsetof(lbov_927414336ec9185cc5a2_t2a091437b2d587ce3891, f0), false },
  { 5, offsetof(lbov_927414336ec9185cc5a2_t2a091437b2d587ce3891, f1), false },
};

static const lg_branch lg_branches_4[] = { { 2, lg_fields_4_0 } };

static const lg_node lg_nodes[] = {
  { LG_FIELDS, true, sizeof(lbov_927414336ec9185cc5a2_t23107461f72b24c37654), _Alignof(lbov_927414336ec9185cc5a2_t23107461f72b24c37654), 0, 0, 0, 0, 1, lg_branches_0, NULL, NULL },
  { LG_FIELDS, true, sizeof(lbov_927414336ec9185cc5a2_tb2825946e038e653bd2b), _Alignof(lbov_927414336ec9185cc5a2_tb2825946e038e653bd2b), 0, 0, 0, 0, 1, lg_branches_1, NULL, NULL },
  { LG_FIELDS, true, sizeof(lbov_927414336ec9185cc5a2_t4ce841c87ea3b1559bfb), _Alignof(lbov_927414336ec9185cc5a2_t4ce841c87ea3b1559bfb), 0, 0, 0, 0, 1, lg_branches_2, NULL, NULL },
  { LG_SCALAR, true, sizeof(lbov_927414336ec9185cc5a2_td79b9bbde250ee1779da), _Alignof(lbov_927414336ec9185cc5a2_td79b9bbde250ee1779da), 0, 0, 0, 0, 0, NULL, lg_to_3, lg_from_3 },
  { LG_FIELDS, true, sizeof(lbov_927414336ec9185cc5a2_t2a091437b2d587ce3891), _Alignof(lbov_927414336ec9185cc5a2_t2a091437b2d587ce3891), 0, 0, 0, 0, 1, lg_branches_4, NULL, NULL },
  { LG_SCALAR, true, sizeof(lbov_927414336ec9185cc5a2_t167081552b6f9c1d1afd), _Alignof(lbov_927414336ec9185cc5a2_t167081552b6f9c1d1afd), 0, 0, 0, 0, 0, NULL, lg_to_5, lg_from_5 },
  { LG_SCALAR, true, sizeof(lbov_927414336ec9185cc5a2_tdc0347e1f7f5c4d928f1), _Alignof(lbov_927414336ec9185cc5a2_tdc0347e1f7f5c4d928f1), 0, 0, 0, 0, 0, NULL, lg_to_6, lg_from_6 },
};


static int lg_list(zval *value, size_t count, bool exact, lb_scope *s) {
  ZVAL_DEREF(value);
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))
      || (exact && zend_hash_num_elements(Z_ARRVAL_P(value)) != count))
    return lb_fail(s, "Expected consecutive-key wire list with exact arity", 1);
  return 1;
}
static int lg_children(lg_walk *walk, size_t count) {
  if (count > walk->visits) {
    if (!walk->scope.error) walk->scope.failure = 2;
    return lb_fail(&walk->scope, "Copied value exceeds 262144 visits", 0);
  }
  return lb_charge(&walk->scope, count, 32);
}
static int lg_step(lg_walk *walk, size_t depth) {
  if (depth > 128 || !walk->visits) {
    if (!walk->scope.error) walk->scope.failure = 2;
    return lb_fail(&walk->scope, depth > 128 ? "Copied value exceeds 128 levels" : "Copied value exceeds 262144 visits", 0);
  }
  walk->visits--; return 1;
}
static int lg_input_enter(lg_walk *walk, lg_frame *frame, const lg_node *node) {
  lb_scope *s = &walk->scope; zval *value = frame->wire; ZVAL_DEREF(value);
  if (node->kind == LG_OPTION && Z_TYPE_P(value) == IS_NULL) return 1;
  if (!lg_list(value, 0, false, s)) return 0;
  frame->outer = Z_ARRVAL_P(value); frame->items = frame->outer;
  if (node->kind == LG_SEQUENCE) {
    const lg_node *child = &lg_nodes[node->element]; frame->count = zend_hash_num_elements(frame->items);
    if (!lg_children(walk, frame->count)) return 0;
    frame->data = lb_allocate(s, frame->count, child->size); if (!frame->data) return 0;
    memcpy(frame->native + node->data_offset, &frame->data, sizeof(frame->data));
    memcpy(frame->native + node->length_offset, &frame->count, sizeof(frame->count));
    return 1;
  }
  size_t branch = 0;
  if (node->kind == LG_VARIANT || node->kind == LG_RESULT) {
    if (!lg_list(value, 2, true, s)) return 0;
    zval *tag = zend_hash_index_find(frame->outer, 0); ZVAL_DEREF(tag);
    if (node->kind == LG_VARIANT) {
      if (Z_TYPE_P(tag) != IS_LONG || Z_LVAL_P(tag) < 0 || (uint64_t)Z_LVAL_P(tag) >= node->branch_count)
        return lb_fail(s, "Invalid copied variant wire tag", 1);
      branch = (size_t)Z_LVAL_P(tag); uint32_t raw = (uint32_t)branch;
      memcpy(frame->native + node->tag_offset, &raw, sizeof(raw));
      zval *payload = zend_hash_index_find(frame->outer, 1); ZVAL_DEREF(payload);
      if (!lg_list(payload, node->branches[branch].count, true, s)) return 0;
      frame->items = Z_ARRVAL_P(payload);
    } else {
      if (Z_TYPE_P(tag) != IS_TRUE && Z_TYPE_P(tag) != IS_FALSE) return lb_fail(s, "Except wire tag requires bool", 1);
      unsigned char raw = Z_TYPE_P(tag) == IS_TRUE; branch = raw; frame->wire_offset = 1;
      memcpy(frame->native + node->tag_offset, &raw, sizeof(raw));
    }
  } else if (node->kind == LG_OPTION) {
    if (!lg_list(value, 1, true, s)) return 0;
    branch = 1; unsigned char raw = 1; memcpy(frame->native + node->tag_offset, &raw, sizeof(raw));
  } else if (!lg_list(value, node->branches[0].count, true, s)) return 0;
  frame->fields = node->branches[branch].fields; frame->count = node->branches[branch].count;
  return lg_children(walk, frame->count);
}
static int lg_to(lg_walk *walk, unsigned type, zval *value, void *out) {
  size_t depth = 0; walk->frames[0] = (lg_frame){ .type = type, .wire = value, .native = out };
  while (true) {
    lg_frame *frame = &walk->frames[depth]; const lg_node *node = &lg_nodes[frame->type];
    if (!frame->entered) {
      if (!lg_step(walk, depth)) return 0;
      if (!node->inhabited) return lb_fail(&walk->scope, "The declared copied type has no finite value", 0);
      frame->entered = true;
      if (node->kind == LG_SCALAR) { if (!node->input(frame->wire, frame->native, &walk->scope)) return 0; }
      else {
        if (!lb_charge(&walk->scope, 1, 16) || !lg_input_enter(walk, frame, node)) return 0;
        for (size_t index = 0; index < depth; index++) {
          const lg_frame *parent = &walk->frames[index];
          if ((frame->outer && (frame->outer == parent->outer || frame->outer == parent->items))
              || (frame->items && (frame->items == parent->outer || frame->items == parent->items)))
            return lb_fail(&walk->scope, "Cyclic copied wire value", 0);
        }
      }
    }
    if (frame->index == frame->count) { if (!depth) return 1; depth--; continue; }
    if (depth == 128) return lg_step(walk, 129);
    size_t index = frame->index++; const lg_field *field = node->kind == LG_SEQUENCE ? NULL : &frame->fields[index];
    unsigned child_type = field ? field->type : node->element; const lg_node *child = &lg_nodes[child_type];
    unsigned char *at = field ? frame->native + field->offset : frame->data + index * child->size;
    if (field && field->pointer) {
      void *pointer = lb_allocate(&walk->scope, 1, child->size); if (!pointer) return 0;
      memcpy(at, &pointer, sizeof(pointer)); at = pointer;
    }
    zval *input = zend_hash_index_find(frame->items, index + frame->wire_offset);
    if (!input) return lb_fail(&walk->scope, "Missing copied wire field", 1);
    walk->frames[++depth] = (lg_frame){ .type = child_type, .wire = input, .native = at };
  }
}
static zval *lg_slot(zval *owner) {
  zval empty; ZVAL_NULL(&empty);
  // Insert before constructing the child. Any Zend bailout leaves every
  // partially built child reachable from the call context's owned root zval.
  return zend_hash_next_index_insert(Z_ARRVAL_P(owner), &empty);
}
static int lg_output_enter(lg_walk *walk, lg_frame *frame, const lg_node *node) {
  lb_scope *s = &walk->scope; size_t branch = 0;
  if (node->kind == LG_SEQUENCE) {
    const lg_node *child = &lg_nodes[node->element];
    memcpy(&frame->count, frame->native + node->length_offset, sizeof(frame->count));
    memcpy(&frame->data, frame->native + node->data_offset, sizeof(frame->data));
    if (!lb_readable(s, frame->data, frame->count, child->size, child->alignment)
        || !lg_children(walk, frame->count) || !lb_charge(s, frame->count, child->size)) return 0;
  } else {
    if (node->kind == LG_VARIANT) {
      uint32_t raw; memcpy(&raw, frame->native + node->tag_offset, sizeof(raw)); branch = raw;
    } else if (node->kind == LG_OPTION || node->kind == LG_RESULT) {
      unsigned char raw; memcpy(&raw, frame->native + node->tag_offset, sizeof(raw)); branch = raw;
    }
    if (branch >= node->branch_count) return lb_fail(s, "Invalid native copied branch tag", 0);
    frame->fields = node->branches[branch].fields; frame->count = node->branches[branch].count;
    if (!lg_children(walk, frame->count)) return 0;
  }
  if (node->kind == LG_OPTION && !branch) { ZVAL_NULL(frame->wire); return 1; }
  if (node->kind == LG_VARIANT || node->kind == LG_RESULT) {
    array_init_size(frame->wire, 2);
    if (node->kind == LG_VARIANT) {
      add_next_index_long(frame->wire, (zend_long)branch); frame->children = lg_slot(frame->wire);
      array_init_size(frame->children, (uint32_t)frame->count);
    } else {
      add_next_index_bool(frame->wire, branch); frame->children = frame->wire;
    }
  } else { array_init_size(frame->wire, (uint32_t)frame->count); frame->children = frame->wire; }
  return 1;
}
static int lg_from(lg_walk *walk, unsigned type, const void *value, zval *out) {
  size_t depth = 0;
  // The cursor never writes through native, including when it points to a const
  // borrowed span. A shared frame type avoids a second unbounded traversal.
  walk->frames[0] = (lg_frame){ .type = type, .wire = out, .native = (unsigned char *)value };
  while (true) {
    lg_frame *frame = &walk->frames[depth]; const lg_node *node = &lg_nodes[frame->type];
    if (!frame->entered) {
      if (!lg_step(walk, depth) || !lb_readable(&walk->scope, frame->native, 1, node->size, node->alignment)) return 0;
      if (!node->inhabited) return lb_fail(&walk->scope, "Uninhabited native copied value", 0);
      for (size_t index = 0; index < depth; index++) if (walk->frames[index].type == frame->type && walk->frames[index].native == frame->native)
        return lb_fail(&walk->scope, "Cyclic native copied value", 0);
      frame->entered = true;
      if (node->kind == LG_SCALAR) { if (!node->output(frame->native, frame->wire, &walk->scope)) return 0; }
      else if (!lb_charge(&walk->scope, 1, 16) || !lg_output_enter(walk, frame, node)) return 0;
    }
    if (frame->index == frame->count) { if (!depth) return 1; depth--; continue; }
    if (depth == 128) return lg_step(walk, 129);
    size_t index = frame->index++; const lg_field *field = node->kind == LG_SEQUENCE ? NULL : &frame->fields[index];
    unsigned child_type = field ? field->type : node->element; const lg_node *child = &lg_nodes[child_type];
    unsigned char *at = field ? frame->native + field->offset : frame->data + index * child->size;
    if (field && field->pointer) {
      if (!lb_charge(&walk->scope, 1, child->size)) return 0;
      unsigned char *pointer; memcpy(&pointer, at, sizeof(pointer)); at = pointer;
    }
    zval *wire = lg_slot(frame->children);
    walk->frames[++depth] = (lg_frame){ .type = child_type, .wire = wire, .native = at };
  }
}

typedef struct lgo_input_entry {
  struct lgo_input_entry *next;
  lgo_lease *lease;
} lgo_input_entry;
struct lgo_input_group {
  lgo_input_entry *leases;
  ov_result_owner owner;
};

typedef struct {
  lg_walk graph;
  lgo_state *state;
  lgo_lease *lease;
  lgo_borrow *borrow;
  lb_owned_scope *inputs;
  int status;
  lgo_input_group *input_group;
} lgo_walk;
_Static_assert(offsetof(lgo_walk, graph) == 0 && offsetof(lg_walk, scope) == 0,
  "owned Zend identity hooks require the walk's first-field scope");
typedef struct lgo_host lgo_host;
typedef struct {
  lgo_walk walk;
  ov_transaction inputs;
  lgo_host *hosts;
  zval wire;
  int bailout;
  lgo_input_group *moves;
  size_t move_count;
  ov_transaction move_input;
} lgo_call;
struct lgo_host {
  lgo_host *next;
  lgo_call *call;
  uint64_t token;
  ov_result_owner owner;
  zval callback;
};
static unsigned lgo_depth;
static int lgo_walk_fail(lgo_walk *walk, int status, const char *message, int type_error) {
  if (!walk->status) walk->status = status;
  return lb_fail(&walk->graph.scope, message, type_error);
}
static int lgo_walk_failure(lgo_walk *walk, int output) {
  unsigned failure = walk->graph.scope.failure;
  int status = failure == 2 ? LB_OWNED_LIMIT : failure == 3 ? LB_OWNED_ALLOC_FAILED
    : output ? OV_RESULT : LB_OWNED_INVALID;
  if (!walk->status) walk->status = status;
  if (walk->status == OV_RESULT) lean_bridge_native_runtime_retire();
  return 0;
}

static int lgo_input_reserve(lgo_walk *walk, lgo_handle *handle, lean_object *value) {
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter transfer.reserve\n", stderr);

  lgo_input_group *group = walk->input_group;
  lgo_lease *lease = handle->lease;
  if (!group || !lease || handle->borrow || !lease->published || lease->consumed)
    return LB_OWNED_INVALID;
  if (lease->input_move && lease->input_move != group) return LB_OWNED_INVALID;
  if (!lease->input_move) {
    lgo_input_entry *entry = lb_allocate(&walk->graph.scope, 1, sizeof(*entry));
    if (!entry) { lgo_walk_failure(walk, 0); return walk->status; }
    int status = lgo_lease_retain(lease); if (status) return status;
    entry->lease = lease; entry->next = group->leases; group->leases = entry;
    lease->input_move = group;
  }
  uint64_t token = 0;
  int status = lb_owned_scope_acquire(walk->inputs, lgo_kind(handle->type), value, &token);
  return status ? status : token == handle->token ? LB_OWNED_OK : LB_OWNED_INVALID;
}
static int lgo_input_begin(lgo_call *call, size_t index) {
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter transfer.begin\n", stderr);

  if (index >= call->move_count || call->walk.input_group || call->move_input.scope.context)
    return call->walk.status = LB_OWNED_ORDER;
  lgo_input_group *group = &call->moves[index];
  int status = ov_begin(&call->move_input, &call->walk.state->native, &group->owner,
    "owned-checked-records@1.0.0");
  if (!status) { call->walk.input_group = group; call->walk.inputs = &call->move_input.scope; }
  call->walk.status = status; return status;
}
static int lgo_input_commit(lgo_call *call) {
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter transfer.commit\n", stderr);

  lgo_input_group *group = call->walk.input_group;
  if (!group) return call->walk.status = LB_OWNED_ORDER;
  int status = ov_commit(&call->move_input, &group->owner);
  call->walk.input_group = NULL; call->walk.inputs = &call->inputs.scope;
  call->walk.status = status; return status;
}
/* The native walker has validated every argument and moved every snapshot.
   This hook does not allocate, release storage, call PHP, or fail. */
static void lgo_input_consume(void *context) {
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter owner.consume\n", stderr);

  lgo_call *call = context;
  for (size_t index = 0; index < call->move_count; ++index)
    for (lgo_input_entry *entry = call->moves[index].leases; entry; entry = entry->next)
      entry->lease->consumed = 1;
}
static void lgo_inputs_finish(lgo_call *call) {
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter transfer.finish\n", stderr);

  if (call->move_input.scope.context)
    call->walk.status = ov_abort(&call->move_input, call->walk.status);
  call->walk.input_group = NULL; call->walk.inputs = &call->inputs.scope;
  for (size_t index = 0; index < call->move_count; ++index) {
    lgo_input_group *group = &call->moves[index];
    int status = ov_owner_clear(&group->owner);
    if (!call->walk.status) call->walk.status = status;
    for (lgo_input_entry *entry = group->leases; entry; entry = entry->next) {
      lgo_lease *lease = entry->lease;
      if (lease->input_move != group) {
        lean_bridge_native_runtime_retire();
        if (!call->walk.status) call->walk.status = OV_RESULT;
      }
      lease->input_move = NULL;
      if (lease->consumed) {
        status = ov_owner_clear(&lease->owner);
        if (!call->walk.status) call->walk.status = status;
      }
      lgo_lease_release(lease); entry->lease = NULL;
    }
    group->leases = NULL;
  }
  call->move_count = 0; call->moves = NULL;
}
static int lgo_identity_input(lb_scope *scope, unsigned type, zval *value, uint64_t *token) {
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter identity.borrow\n", stderr);

  lgo_walk *walk = (lgo_walk *)scope; lgo_handle *handle = NULL;
  int status = lgo_handle_fetch(value, type, walk->state, &handle);
  lean_object *pinned = NULL;
  if (!status) status = lb_owned_scope_borrow(walk->inputs, lgo_kind(type), handle->token, &pinned);
  if (!status && walk->input_group) status = lgo_input_reserve(walk, handle, pinned);
  if (status) return lgo_walk_fail(walk, status, "Invalid, foreign or expired Lean identity", status == LB_OWNED_INVALID);
  *token = handle->token; return 1;
}
static int lgo_identity_output(lb_scope *scope, unsigned type, uint64_t token, zval *value) {
  lgo_walk *walk = (lgo_walk *)scope;
  int status = lgo_wrap(type, token, walk->borrow ? NULL : walk->lease, walk->borrow, value);
  if (status) return lgo_walk_fail(walk, status, "Malformed or unavailable native Lean identity", 0);
  return 1;
}
static int lgo_to(lgo_walk *walk, unsigned type, zval *value, void *out) {
  if (walk->status || walk->graph.scope.error) return 0;
  return lg_to(&walk->graph, type, value, out) ? 1 : lgo_walk_failure(walk, 0);
}
static int lgo_from(lgo_walk *walk, unsigned type, const void *value, zval *out) {
  if (walk->status || walk->graph.scope.error) return 0;
  return lg_from(&walk->graph, type, value, out) ? 1 : lgo_walk_failure(walk, 1);
}
static int lgo_call_open(lgo_call *call, size_t bytes) {
  call->walk.graph.scope.remaining = 16 * 1024 * 1024 - bytes;
  call->walk.graph.visits = 262144; ZVAL_UNDEF(&call->wire);
  int status = lgo_state_current(&call->walk.state);
  if (!status) status = lgo_lease_new(call->walk.state, &call->walk.lease);
  ov_result_owner empty = {0};
  if (!status) status = ov_begin(&call->inputs, &call->walk.state->native, &empty, "owned-checked-records@1.0.0");
  call->walk.inputs = &call->inputs.scope;
  return call->walk.status = status;
}
static void lgo_hosts_end(lgo_call *call) {
  // Revoke all broker tokens before dropping any PHP callback reference.
  for (lgo_host *host = call->hosts; host; host = host->next) {
    if (host->token) {
      if (lb_native_callback_wrong_thread(host->token) && !call->walk.status) call->walk.status = LB_OWNED_THREAD;
      lb_native_callback_release(host->token); host->token = 0;
    }
    int status = ov_owner_clear(&host->owner);
    if (!call->walk.status) call->walk.status = status;
  }
  for (lgo_host *host = call->hosts; host; host = host->next)
    lgo_clear_zvals(&host->callback, 1, &call->bailout);
  call->hosts = NULL;
}
static void lgo_call_finish(lgo_call *call, zval *out) {
  lgo_inputs_finish(call);
  lgo_hosts_end(call);
  if (call->inputs.scope.context) call->walk.status = ov_abort(&call->inputs, call->walk.status);
  if (!call->walk.status && !call->walk.graph.scope.error && !call->bailout && !EG(exception)) {
    call->walk.lease->published = 1;
    ZVAL_COPY_VALUE(out, &call->wire); ZVAL_UNDEF(&call->wire);
  }
  lgo_clear_zvals(&call->wire, 1, &call->bailout);
  if (call->walk.lease) { lgo_lease_release(call->walk.lease); call->walk.lease = NULL; }
  lb_scope_clear(&call->walk.graph.scope);
}
static void lgo_error(int status, const char *message, int type_error) {
  if (EG(exception) || (!status && !message)) return;
  if (status == OV_RESULT) lean_bridge_native_runtime_retire();
  if (type_error && status == LB_OWNED_INVALID) zend_type_error("%s", message);
  else zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean ownership call failed", status);
}

extern lean_object *initialize_LeanBridgeOwnedb0f19854153c0b48(uint8_t);
static void *lgo_component_initialize(uint8_t builtin) { return initialize_LeanBridgeOwnedb0f19854153c0b48(builtin); }
static int lgo_initialize(void) {
  return lean_bridge_native_component_initialize("owned-checked-records@1.0.0", lgo_component_initialize)
    ? LB_OWNED_OK : LB_OWNED_RUNTIME;
}


typedef struct {
  lgo_call call;
  lbov_927414336ec9185cc5a2_t23107461f72b24c37654 a0;
  lbov_927414336ec9185cc5a2_t23107461f72b24c37654 output;
} lgo_call0_frame;
static void lgo_call0_execute(lgo_call0_frame *frame, zval *arguments) {
  (void)arguments;
  lgo_call *call = &frame->call;
  if (lgo_call_open(call, sizeof(*frame))) return;
  if (!lgo_to(&call->walk, 0, &arguments[0], &frame->a0)) return;
  call->walk.status = lbov_927414336ec9185cc5a2_f0711e856cfa97d876c9a(&call->walk.state->native, &frame->a0, &frame->output, &call->walk.lease->owner);
  if (!call->walk.status && !call->bailout && !EG(exception))
    (void)lgo_from(&call->walk, 0, &frame->output, &call->wire);
}
ZEND_BEGIN_ARG_INFO_EX(lgo_call0_args, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgo_call0) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "echoBooking";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public echoBooking\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  if (!lgo_main()) { lgo_error(LB_OWNED_THREAD, NULL, 0); RETURN_THROWS(); }
  if (lgo_depth >= 64 || sizeof(lgo_call0_frame) > 16 * 1024 * 1024) {
    lgo_error(LB_OWNED_LIMIT, "Lean call exceeds the reentry or allocation limit", 0); RETURN_THROWS();
  }
  zval arguments[1];
  if (zend_get_parameters_array_ex(1, arguments) != SUCCESS) RETURN_THROWS();
  lgo_call0_frame *frame = LB_ZEND_CALLOC(1, sizeof(*frame));
  if (!frame) { lgo_error(LB_OWNED_ALLOC_FAILED, NULL, 0); RETURN_THROWS(); }
  ++lgo_depth;
  zend_try { lgo_call0_execute(frame, arguments); }
  zend_catch { frame->call.bailout = 1; } zend_end_try();
  lgo_call_finish(&frame->call, return_value);
  int status = frame->call.walk.status, bailout = frame->call.bailout;
  int type_error = frame->call.walk.graph.scope.type_error;
  const char *message = frame->call.walk.graph.scope.error;
  LB_ZEND_FREE(frame); --lgo_depth;
  if (bailout) zend_bailout();
  lgo_error(status, message, type_error);
  if (EG(exception)) RETURN_THROWS();
}


typedef struct {
  lgo_call call;
  lbov_927414336ec9185cc5a2_tb2825946e038e653bd2b a0;
  lbov_927414336ec9185cc5a2_tb2825946e038e653bd2b output;
} lgo_call1_frame;
static void lgo_call1_execute(lgo_call1_frame *frame, zval *arguments) {
  (void)arguments;
  lgo_call *call = &frame->call;
  if (lgo_call_open(call, sizeof(*frame))) return;
  if (!lgo_to(&call->walk, 1, &arguments[0], &frame->a0)) return;
  call->walk.status = lbov_927414336ec9185cc5a2_f535babcfd8d0f67ea0e6(&call->walk.state->native, &frame->a0, &frame->output, &call->walk.lease->owner);
  if (!call->walk.status && !call->bailout && !EG(exception))
    (void)lgo_from(&call->walk, 1, &frame->output, &call->wire);
}
ZEND_BEGIN_ARG_INFO_EX(lgo_call1_args, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgo_call1) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "echoClaim";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public echoClaim\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  if (!lgo_main()) { lgo_error(LB_OWNED_THREAD, NULL, 0); RETURN_THROWS(); }
  if (lgo_depth >= 64 || sizeof(lgo_call1_frame) > 16 * 1024 * 1024) {
    lgo_error(LB_OWNED_LIMIT, "Lean call exceeds the reentry or allocation limit", 0); RETURN_THROWS();
  }
  zval arguments[1];
  if (zend_get_parameters_array_ex(1, arguments) != SUCCESS) RETURN_THROWS();
  lgo_call1_frame *frame = LB_ZEND_CALLOC(1, sizeof(*frame));
  if (!frame) { lgo_error(LB_OWNED_ALLOC_FAILED, NULL, 0); RETURN_THROWS(); }
  ++lgo_depth;
  zend_try { lgo_call1_execute(frame, arguments); }
  zend_catch { frame->call.bailout = 1; } zend_end_try();
  lgo_call_finish(&frame->call, return_value);
  int status = frame->call.walk.status, bailout = frame->call.bailout;
  int type_error = frame->call.walk.graph.scope.type_error;
  const char *message = frame->call.walk.graph.scope.error;
  LB_ZEND_FREE(frame); --lgo_depth;
  if (bailout) zend_bailout();
  lgo_error(status, message, type_error);
  if (EG(exception)) RETURN_THROWS();
}


typedef struct {
  lgo_call call;
  lbov_927414336ec9185cc5a2_t4ce841c87ea3b1559bfb a0;
  lbov_927414336ec9185cc5a2_t4ce841c87ea3b1559bfb output;
} lgo_call2_frame;
static void lgo_call2_execute(lgo_call2_frame *frame, zval *arguments) {
  (void)arguments;
  lgo_call *call = &frame->call;
  if (lgo_call_open(call, sizeof(*frame))) return;
  if (!lgo_to(&call->walk, 2, &arguments[0], &frame->a0)) return;
  call->walk.status = lbov_927414336ec9185cc5a2_feb082cf837ef02082ea8(&call->walk.state->native, &frame->a0, &frame->output, &call->walk.lease->owner);
  if (!call->walk.status && !call->bailout && !EG(exception))
    (void)lgo_from(&call->walk, 2, &frame->output, &call->wire);
}
ZEND_BEGIN_ARG_INFO_EX(lgo_call2_args, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgo_call2) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "echoGrant";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public echoGrant\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  if (!lgo_main()) { lgo_error(LB_OWNED_THREAD, NULL, 0); RETURN_THROWS(); }
  if (lgo_depth >= 64 || sizeof(lgo_call2_frame) > 16 * 1024 * 1024) {
    lgo_error(LB_OWNED_LIMIT, "Lean call exceeds the reentry or allocation limit", 0); RETURN_THROWS();
  }
  zval arguments[1];
  if (zend_get_parameters_array_ex(1, arguments) != SUCCESS) RETURN_THROWS();
  lgo_call2_frame *frame = LB_ZEND_CALLOC(1, sizeof(*frame));
  if (!frame) { lgo_error(LB_OWNED_ALLOC_FAILED, NULL, 0); RETURN_THROWS(); }
  ++lgo_depth;
  zend_try { lgo_call2_execute(frame, arguments); }
  zend_catch { frame->call.bailout = 1; } zend_end_try();
  lgo_call_finish(&frame->call, return_value);
  int status = frame->call.walk.status, bailout = frame->call.bailout;
  int type_error = frame->call.walk.graph.scope.type_error;
  const char *message = frame->call.walk.graph.scope.error;
  LB_ZEND_FREE(frame); --lgo_depth;
  if (bailout) zend_bailout();
  lgo_error(status, message, type_error);
  if (EG(exception)) RETURN_THROWS();
}


typedef struct {
  lgo_call call;
  lbov_927414336ec9185cc5a2_t167081552b6f9c1d1afd a0;
  lbov_927414336ec9185cc5a2_tdc0347e1f7f5c4d928f1 a1;
  lbov_927414336ec9185cc5a2_td79b9bbde250ee1779da output;
} lgo_call3_frame;
static void lgo_call3_execute(lgo_call3_frame *frame, zval *arguments) {
  (void)arguments;
  lgo_call *call = &frame->call;
  if (lgo_call_open(call, sizeof(*frame))) return;
  if (!lgo_to(&call->walk, 5, &arguments[0], &frame->a0)) return;
  if (!lgo_to(&call->walk, 6, &arguments[1], &frame->a1)) return;
  call->walk.status = lbov_927414336ec9185cc5a2_fa1e5189bd92568e4b939(&call->walk.state->native, &frame->a0, &frame->a1, &frame->output, &call->walk.lease->owner);
  if (!call->walk.status && !call->bailout && !EG(exception))
    (void)lgo_from(&call->walk, 3, &frame->output, &call->wire);
}
ZEND_BEGIN_ARG_INFO_EX(lgo_call3_args, 0, 0, 2)
  ZEND_ARG_INFO(0, arg0)
  ZEND_ARG_INFO(0, arg1)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgo_call3) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "newTicket";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public newTicket\n", stderr);

  if (ZEND_NUM_ARGS() != 2) { zend_argument_count_error("Expected exactly 2 arguments"); RETURN_THROWS(); }
  if (!lgo_main()) { lgo_error(LB_OWNED_THREAD, NULL, 0); RETURN_THROWS(); }
  if (lgo_depth >= 64 || sizeof(lgo_call3_frame) > 16 * 1024 * 1024) {
    lgo_error(LB_OWNED_LIMIT, "Lean call exceeds the reentry or allocation limit", 0); RETURN_THROWS();
  }
  zval arguments[2];
  if (zend_get_parameters_array_ex(2, arguments) != SUCCESS) RETURN_THROWS();
  lgo_call3_frame *frame = LB_ZEND_CALLOC(1, sizeof(*frame));
  if (!frame) { lgo_error(LB_OWNED_ALLOC_FAILED, NULL, 0); RETURN_THROWS(); }
  ++lgo_depth;
  zend_try { lgo_call3_execute(frame, arguments); }
  zend_catch { frame->call.bailout = 1; } zend_end_try();
  lgo_call_finish(&frame->call, return_value);
  int status = frame->call.walk.status, bailout = frame->call.bailout;
  int type_error = frame->call.walk.graph.scope.type_error;
  const char *message = frame->call.walk.graph.scope.error;
  LB_ZEND_FREE(frame); --lgo_depth;
  if (bailout) zend_bailout();
  lgo_error(status, message, type_error);
  if (EG(exception)) RETURN_THROWS();
}


typedef struct {
  lgo_call call;
  lbov_927414336ec9185cc5a2_t23107461f72b24c37654 a0;
  lbov_927414336ec9185cc5a2_tb2825946e038e653bd2b a1;
  lbov_927414336ec9185cc5a2_tb2825946e038e653bd2b output;
} lgo_call4_frame;
static void lgo_call4_execute(lgo_call4_frame *frame, zval *arguments) {
  (void)arguments;
  lgo_call *call = &frame->call;
  if (lgo_call_open(call, sizeof(*frame))) return;
  if (!lgo_to(&call->walk, 0, &arguments[0], &frame->a0)) return;
  if (!lgo_to(&call->walk, 1, &arguments[1], &frame->a1)) return;
  call->walk.status = lbov_927414336ec9185cc5a2_feaac3cc8d9197bd7bbca(&call->walk.state->native, &frame->a0, &frame->a1, &frame->output, &call->walk.lease->owner);
  if (!call->walk.status && !call->bailout && !EG(exception))
    (void)lgo_from(&call->walk, 1, &frame->output, &call->wire);
}
ZEND_BEGIN_ARG_INFO_EX(lgo_call4_args, 0, 0, 2)
  ZEND_ARG_INFO(0, arg0)
  ZEND_ARG_INFO(0, arg1)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgo_call4) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "pairClaim";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public pairClaim\n", stderr);

  if (ZEND_NUM_ARGS() != 2) { zend_argument_count_error("Expected exactly 2 arguments"); RETURN_THROWS(); }
  if (!lgo_main()) { lgo_error(LB_OWNED_THREAD, NULL, 0); RETURN_THROWS(); }
  if (lgo_depth >= 64 || sizeof(lgo_call4_frame) > 16 * 1024 * 1024) {
    lgo_error(LB_OWNED_LIMIT, "Lean call exceeds the reentry or allocation limit", 0); RETURN_THROWS();
  }
  zval arguments[2];
  if (zend_get_parameters_array_ex(2, arguments) != SUCCESS) RETURN_THROWS();
  lgo_call4_frame *frame = LB_ZEND_CALLOC(1, sizeof(*frame));
  if (!frame) { lgo_error(LB_OWNED_ALLOC_FAILED, NULL, 0); RETURN_THROWS(); }
  ++lgo_depth;
  zend_try { lgo_call4_execute(frame, arguments); }
  zend_catch { frame->call.bailout = 1; } zend_end_try();
  lgo_call_finish(&frame->call, return_value);
  int status = frame->call.walk.status, bailout = frame->call.bailout;
  int type_error = frame->call.walk.graph.scope.type_error;
  const char *message = frame->call.walk.graph.scope.error;
  LB_ZEND_FREE(frame); --lgo_depth;
  if (bailout) zend_bailout();
  lgo_error(status, message, type_error);
  if (EG(exception)) RETURN_THROWS();
}


typedef struct {
  lgo_call call;
  lbov_927414336ec9185cc5a2_td79b9bbde250ee1779da a0;
  lbov_927414336ec9185cc5a2_t167081552b6f9c1d1afd output;
} lgo_call5_frame;
static void lgo_call5_execute(lgo_call5_frame *frame, zval *arguments) {
  (void)arguments;
  lgo_call *call = &frame->call;
  if (lgo_call_open(call, sizeof(*frame))) return;
  if (!lgo_to(&call->walk, 3, &arguments[0], &frame->a0)) return;
  call->walk.status = lbov_927414336ec9185cc5a2_fec926afda994fba3abe2(&call->walk.state->native, &frame->a0, &frame->output, &call->walk.lease->owner);
  if (!call->walk.status && !call->bailout && !EG(exception))
    (void)lgo_from(&call->walk, 5, &frame->output, &call->wire);
}
ZEND_BEGIN_ARG_INFO_EX(lgo_call5_args, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgo_call5) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "serial";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public serial\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  if (!lgo_main()) { lgo_error(LB_OWNED_THREAD, NULL, 0); RETURN_THROWS(); }
  if (lgo_depth >= 64 || sizeof(lgo_call5_frame) > 16 * 1024 * 1024) {
    lgo_error(LB_OWNED_LIMIT, "Lean call exceeds the reentry or allocation limit", 0); RETURN_THROWS();
  }
  zval arguments[1];
  if (zend_get_parameters_array_ex(1, arguments) != SUCCESS) RETURN_THROWS();
  lgo_call5_frame *frame = LB_ZEND_CALLOC(1, sizeof(*frame));
  if (!frame) { lgo_error(LB_OWNED_ALLOC_FAILED, NULL, 0); RETURN_THROWS(); }
  ++lgo_depth;
  zend_try { lgo_call5_execute(frame, arguments); }
  zend_catch { frame->call.bailout = 1; } zend_end_try();
  lgo_call_finish(&frame->call, return_value);
  int status = frame->call.walk.status, bailout = frame->call.bailout;
  int type_error = frame->call.walk.graph.scope.type_error;
  const char *message = frame->call.walk.graph.scope.error;
  LB_ZEND_FREE(frame); --lgo_depth;
  if (bailout) zend_bailout();
  lgo_error(status, message, type_error);
  if (EG(exception)) RETURN_THROWS();
}


typedef struct {
  lgo_call call;
  lbov_927414336ec9185cc5a2_tb2825946e038e653bd2b a0;
  lbov_927414336ec9185cc5a2_tb2825946e038e653bd2b output;
  lgo_input_group moves[1];
  ov_result_owner *input_owners[1];
  ov_input_transfers transfer;
} lgo_call6_frame;
static void lgo_call6_execute(lgo_call6_frame *frame, zval *arguments) {
  (void)arguments;
  lgo_call *call = &frame->call;
  if (lgo_call_open(call, sizeof(*frame))) return;
  call->moves = frame->moves; call->move_count = 1;
  for (size_t index = 0; index < 1; ++index) frame->input_owners[index] = &frame->moves[index].owner;
  frame->transfer = (ov_input_transfers){ .owners = frame->input_owners, .count = 1,
    .consume = lgo_input_consume, .context = call };
  if (lgo_input_begin(call, 0)) return;
  if (!lgo_to(&call->walk, 1, &arguments[0], &frame->a0)) return;
  if (lgo_input_commit(call)) return;
  call->walk.status = lbov_927414336ec9185cc5a2_f040aca3025d850fc12cc(&call->walk.state->native, &frame->a0, &frame->transfer, &frame->output, &call->walk.lease->owner);
  if (!call->walk.status && !call->bailout && !EG(exception))
    (void)lgo_from(&call->walk, 1, &frame->output, &call->wire);
}
ZEND_BEGIN_ARG_INFO_EX(lgo_call6_args, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lgo_call6) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "transferClaim";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public transferClaim\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  if (!lgo_main()) { lgo_error(LB_OWNED_THREAD, NULL, 0); RETURN_THROWS(); }
  if (lgo_depth >= 64 || sizeof(lgo_call6_frame) > 16 * 1024 * 1024) {
    lgo_error(LB_OWNED_LIMIT, "Lean call exceeds the reentry or allocation limit", 0); RETURN_THROWS();
  }
  zval arguments[1];
  if (zend_get_parameters_array_ex(1, arguments) != SUCCESS) RETURN_THROWS();
  lgo_call6_frame *frame = LB_ZEND_CALLOC(1, sizeof(*frame));
  if (!frame) { lgo_error(LB_OWNED_ALLOC_FAILED, NULL, 0); RETURN_THROWS(); }
  ++lgo_depth;
  zend_try { lgo_call6_execute(frame, arguments); }
  zend_catch { frame->call.bailout = 1; } zend_end_try();
  lgo_call_finish(&frame->call, return_value);
  int status = frame->call.walk.status, bailout = frame->call.bailout;
  int type_error = frame->call.walk.graph.scope.type_error;
  const char *message = frame->call.walk.graph.scope.error;
  LB_ZEND_FREE(frame); --lgo_depth;
  if (bailout) zend_bailout();
  lgo_error(status, message, type_error);
  if (EG(exception)) RETURN_THROWS();
}


ZEND_BEGIN_ARG_INFO_EX(lgo_handle_args, 0, 0, 2)
  ZEND_ARG_INFO(0, type)
  ZEND_ARG_INFO(0, value)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_INFO_EX(lgo_no_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static int lgo_typed_handle(zend_long type, zval *value, int closing, lgo_handle **out) {
  *out = NULL;
  if (type < 0 || (uint64_t)type > UINT_MAX || !lgo_kind((unsigned)type)) return LB_OWNED_INVALID;
  if (!closing) return lgo_handle_fetch(value, (unsigned)type, NULL, out);
  ZVAL_DEREF(value);
  if (Z_TYPE_P(value) != IS_RESOURCE || Z_RES_P(value)->type != lgo_resource_type || !Z_RES_P(value)->ptr)
    return LB_OWNED_INVALID;
  lgo_handle *handle = Z_RES_P(value)->ptr;
  if (handle->type != (unsigned)type) return LB_OWNED_INVALID;
  *out = handle; return LB_OWNED_OK;
}
static ZEND_FUNCTION(lgo_check) {
  zend_long type; zval *value;
  ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_LONG(type) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  lgo_handle *handle = NULL; int status = lgo_typed_handle(type, value, 0, &handle);
  if (!status) status = lgo_drain(lgo_handle_state(handle));
  lgo_error(status, NULL, 0); if (EG(exception)) RETURN_THROWS(); RETURN_NULL();
}
static ZEND_FUNCTION(lgo_retain) {
  zend_long type; zval *value;
  ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_LONG(type) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  lgo_handle *handle = NULL; int status = lgo_typed_handle(type, value, 0, &handle);
  if (!status) status = lgo_handle_retain(handle, return_value);
  lgo_error(status, NULL, 0); if (EG(exception)) RETURN_THROWS();
}
static ZEND_FUNCTION(lgo_close) {
  zend_long type; zval *value;
  ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_LONG(type) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  lgo_handle *handle = NULL; int status = lgo_typed_handle(type, value, 1, &handle);
  if (!status) status = lgo_handle_close(handle);
  lgo_error(status, NULL, 0); if (EG(exception)) RETURN_THROWS(); RETURN_NULL();
}
static ZEND_FUNCTION(lgo_shutdown_entry) {
  ZEND_PARSE_PARAMETERS_NONE();
  int status = lgo_shutdown(); lgo_error(status, NULL, 0); if (EG(exception)) RETURN_THROWS(); RETURN_NULL();
}
static ZEND_FUNCTION(lgo_retire) {
  ZEND_PARSE_PARAMETERS_NONE();
  if (!lgo_main()) { lgo_error(LB_OWNED_THREAD, NULL, 0); RETURN_THROWS(); }
  lean_bridge_native_runtime_retire(); RETURN_NULL();
}

static PHP_MINIT_FUNCTION(lb_owned_927414336ec9185cc5a2) {
  lgo_resource_type = zend_register_list_destructors_ex(lgo_resource_destroy, NULL, "LeanOwnedCheckedRecords owned value", module_number);
  return SUCCESS;
}
static PHP_RSHUTDOWN_FUNCTION(lb_owned_927414336ec9185cc5a2) { (void)lgo_shutdown(); return SUCCESS; }
static const zend_function_entry lgo_functions[] = {
  ZEND_NS_NAMED_FE("LeanOwnedCheckedRecords\\Internal\\OwnedZend927414336ec9185cc5a2", call0, ZEND_FN(lgo_call0), lgo_call0_args)
  ZEND_NS_NAMED_FE("LeanOwnedCheckedRecords\\Internal\\OwnedZend927414336ec9185cc5a2", call1, ZEND_FN(lgo_call1), lgo_call1_args)
  ZEND_NS_NAMED_FE("LeanOwnedCheckedRecords\\Internal\\OwnedZend927414336ec9185cc5a2", call2, ZEND_FN(lgo_call2), lgo_call2_args)
  ZEND_NS_NAMED_FE("LeanOwnedCheckedRecords\\Internal\\OwnedZend927414336ec9185cc5a2", call3, ZEND_FN(lgo_call3), lgo_call3_args)
  ZEND_NS_NAMED_FE("LeanOwnedCheckedRecords\\Internal\\OwnedZend927414336ec9185cc5a2", call4, ZEND_FN(lgo_call4), lgo_call4_args)
  ZEND_NS_NAMED_FE("LeanOwnedCheckedRecords\\Internal\\OwnedZend927414336ec9185cc5a2", call5, ZEND_FN(lgo_call5), lgo_call5_args)
  ZEND_NS_NAMED_FE("LeanOwnedCheckedRecords\\Internal\\OwnedZend927414336ec9185cc5a2", call6, ZEND_FN(lgo_call6), lgo_call6_args)
  ZEND_NS_NAMED_FE("LeanOwnedCheckedRecords\\Internal\\OwnedZend927414336ec9185cc5a2", check, ZEND_FN(lgo_check), lgo_handle_args)
  ZEND_NS_NAMED_FE("LeanOwnedCheckedRecords\\Internal\\OwnedZend927414336ec9185cc5a2", retain, ZEND_FN(lgo_retain), lgo_handle_args)
  ZEND_NS_NAMED_FE("LeanOwnedCheckedRecords\\Internal\\OwnedZend927414336ec9185cc5a2", close, ZEND_FN(lgo_close), lgo_handle_args)
  ZEND_NS_NAMED_FE("LeanOwnedCheckedRecords\\Internal\\OwnedZend927414336ec9185cc5a2", shutdown, ZEND_FN(lgo_shutdown_entry), lgo_no_args)
  ZEND_NS_NAMED_FE("LeanOwnedCheckedRecords\\Internal\\OwnedZend927414336ec9185cc5a2", retire, ZEND_FN(lgo_retire), lgo_no_args)
  PHP_FE_END
};
zend_module_entry lb_owned_927414336ec9185cc5a2_module_entry = {
  STANDARD_MODULE_HEADER, "lb_owned_927414336ec9185cc5a2", lgo_functions,
  PHP_MINIT(lb_owned_927414336ec9185cc5a2), NULL, NULL, PHP_RSHUTDOWN(lb_owned_927414336ec9185cc5a2), NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(lb_owned_927414336ec9185cc5a2)
