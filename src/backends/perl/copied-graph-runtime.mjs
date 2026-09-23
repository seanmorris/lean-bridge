/**
 * Scoped Perl/XS storage and scalar helpers for copied graph converters.
 *
 * @file
 */
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";

export const perlGraphRuntime = `
#include "EXTERN.h"
#include "perl.h"
#include "XSUB.h"
#include <stdlib.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <stdio.h>
_Static_assert(sizeof(void *) == 8 && sizeof(IV) == 8 && sizeof(UV) == 8, "Perl graph conversion requires a 64-bit ABI");
#ifndef LB_PERL_GRAPH_MALLOC
#define LB_PERL_GRAPH_MALLOC malloc
#endif
#ifndef LB_PERL_GRAPH_FREE
#define LB_PERL_GRAPH_FREE free
#endif
#ifndef LB_PERL_GRAPH_CHECKPOINT
#define LB_PERL_GRAPH_CHECKPOINT() ((void)0)
#endif
typedef struct lpg_allocation {
  struct lpg_allocation *next;
  max_align_t alignment;
  unsigned char data[];
} lpg_allocation;
typedef struct {
  lpg_allocation *allocations;
  void *output;
  void (*clear)(void *);
  void (*retire)(void);
  size_t native_bytes, storage_bytes, nodes;
  struct { const void *address; size_t type; } path[${componentRecursiveLimits.valueDepth + 1}];
} lpg_scope;
static void lpg_close(lpg_scope *scope) {
  void *output = scope->output; scope->output = NULL;
  if (output && scope->clear) scope->clear(output);
  lpg_allocation *allocation = scope->allocations; scope->allocations = NULL;
  while (allocation) {
    lpg_allocation *next = allocation->next;
    LB_PERL_GRAPH_FREE(allocation); allocation = next;
  }
}
static void lpg_end(pTHX_ void *value) {
  PERL_UNUSED_CONTEXT;
  lpg_scope *scope = value; lpg_close(scope); LB_PERL_GRAPH_FREE(scope);
}
static lpg_scope *lpg_begin(pTHX_ void (*retire)(void)) {
  /* Grow Perl's save stack before acquiring memory needing its destructor. */
  SSGROW(4);
  LB_PERL_GRAPH_CHECKPOINT();
  lpg_scope *scope = LB_PERL_GRAPH_MALLOC(sizeof(*scope));
  if (!scope) croak("Perl graph allocation failed");
  memset(scope, 0, sizeof(*scope));
  SAVEDESTRUCTOR_X(lpg_end, scope);
  scope->retire = retire;
  scope->native_bytes = scope->storage_bytes = 16 * 1024 * 1024;
  scope->nodes = ${componentRecursiveLimits.valueNodes};
  return scope;
}
static void lpg_charge(pTHX_ size_t *remaining, size_t count, size_t width) {
  if (!width || count > *remaining / width) croak("Perl copied graph storage limit exceeded");
  *remaining -= count * width;
}
static void *lpg_allocate(pTHX_ lpg_scope *scope, size_t count, size_t width) {
  if (!count) return NULL;
  lpg_charge(aTHX_ &scope->storage_bytes, count, width);
  lpg_charge(aTHX_ &scope->storage_bytes, 1, sizeof(lpg_allocation));
  LB_PERL_GRAPH_CHECKPOINT();
  lpg_allocation *allocation = LB_PERL_GRAPH_MALLOC(sizeof(*allocation) + count * width);
  if (!allocation) croak("Perl graph allocation failed");
  allocation->next = scope->allocations; scope->allocations = allocation;
  memset(allocation->data, 0, count * width); return allocation->data;
}
static void lpg_invalid(pTHX_ lpg_scope *scope, const char *message) {
  if (scope->retire) scope->retire();
  croak("Invalid native copied graph: %s", message);
}
static void lpg_enter(pTHX_ lpg_scope *scope, const void *value, size_t type, size_t depth, size_t native_storage, int output) {
  if (depth > ${componentRecursiveLimits.valueDepth} || !scope->nodes) croak("Perl copied graph depth or node limit exceeded");
  --scope->nodes;
  lpg_charge(aTHX_ &scope->native_bytes, native_storage, 1);
  for (size_t i = 0; value && i < depth; ++i) if (scope->path[i].address == value && scope->path[i].type == type) {
    if (output) lpg_invalid(aTHX_ scope, "cycle");
    croak("Cyclic Perl copied value");
  }
  scope->path[depth].address = value; scope->path[depth].type = type;
}
static void lpg_pointer(pTHX_ lpg_scope *scope, const void *pointer, size_t count, size_t width, size_t alignment) {
  if (!count) return;
  if (!pointer || (uintptr_t)pointer % alignment || count > (UINTPTR_MAX - (uintptr_t)pointer) / width)
    lpg_invalid(aTHX_ scope, "missing, misaligned or overflowing span");
  /* Authenticated native producers supply readable process memory. */
}
static SV *lpg_pin(pTHX_ SV *value) {
  EXTEND_MORTAL(1); return sv_2mortal(SvREFCNT_inc(value));
}
static SV *lpg_sv(pTHX_ lpg_scope *scope) {
  lpg_charge(aTHX_ &scope->storage_bytes, 1, sizeof(SV) + 64);
  LB_PERL_GRAPH_CHECKPOINT(); EXTEND_MORTAL(1);
  return sv_2mortal(newSV(0));
}
static SV *lpg_text(pTHX_ lpg_scope *scope, const char *text, size_t length, int unicode) {
  lpg_charge(aTHX_ &scope->storage_bytes, length + 1, 1);
  SV *value = lpg_sv(aTHX_ scope);
  LB_PERL_GRAPH_CHECKPOINT(); sv_setpvn(value, length ? text : "", length);
  if (unicode) SvUTF8_on(value);
  return value;
}
static HV *lpg_hash(pTHX_ lpg_scope *scope) {
  lpg_charge(aTHX_ &scope->storage_bytes, 1, sizeof(HV) + 128);
  LB_PERL_GRAPH_CHECKPOINT(); EXTEND_MORTAL(1);
  return (HV *)sv_2mortal((SV *)newHV());
}
static AV *lpg_array(pTHX_ lpg_scope *scope, size_t length) {
  lpg_charge(aTHX_ &scope->storage_bytes, length, sizeof(SV *) + sizeof(SV) + 64);
  lpg_charge(aTHX_ &scope->storage_bytes, 1, sizeof(AV) + 128);
  LB_PERL_GRAPH_CHECKPOINT(); EXTEND_MORTAL(1);
  AV *value = (AV *)sv_2mortal((SV *)newAV());
  if (length) { LB_PERL_GRAPH_CHECKPOINT(); av_extend(value, length - 1); }
  return value;
}
static SV *lpg_reference(pTHX_ lpg_scope *scope, SV *referent, const char *package) {
  SV *value = lpg_sv(aTHX_ scope);
  LB_PERL_GRAPH_CHECKPOINT(); sv_setrv_inc(value, referent);
  if (package) { LB_PERL_GRAPH_CHECKPOINT(); sv_bless(value, gv_stashpv(package, GV_ADD)); }
  return value;
}
static void lpg_store(pTHX_ lpg_scope *scope, HV *hash, const char *field, SV *value) {
  lpg_charge(aTHX_ &scope->storage_bytes, 1, sizeof(SV) + 64 + strlen(field));
  LB_PERL_GRAPH_CHECKPOINT(); SV **slot = hv_fetch(hash, field, strlen(field), 1);
  if (!slot) croak("Perl graph field allocation failed");
  LB_PERL_GRAPH_CHECKPOINT(); sv_setsv(*slot, value);
}
static void lpg_append(pTHX_ AV *array, size_t index, SV *value) {
  LB_PERL_GRAPH_CHECKPOINT(); SV **slot = av_fetch(array, index, 1);
  if (!slot) croak("Perl graph element allocation failed");
  LB_PERL_GRAPH_CHECKPOINT(); sv_setsv(*slot, value);
}
static int lpg_branch(SV *value, const char *package) {
  if (!SvROK(value) || SvTYPE(SvRV(value)) != SVt_PVHV || SvMAGICAL(SvRV(value)) || !SvOBJECT(SvRV(value))) return 0;
  HV *stash = SvSTASH(SvRV(value));
  const char *name = stash ? HvNAME(stash) : NULL;
  return name && strEQ(name, package);
}
static SV **lpg_fields(pTHX_ lpg_scope *scope, SV *value, const char *package, const char *const *fields, size_t count) {
  if (!lpg_branch(value, package)) croak("Expected exact %s with a plain untied hash", package);
  HV *input = (HV *)lpg_pin(aTHX_ SvRV(value));
  if (HvUSEDKEYS(input) != count) croak("Perl graph fields do not match the generated schema");
  SV **slots = lpg_allocate(aTHX_ scope, count, sizeof(SV *));
  /* Pin every slot before a child conversion can invoke Perl. */
  for (size_t i = 0; i < count; ++i) {
    SV **entry = hv_fetch(input, fields[i], strlen(fields[i]), 0);
    if (!entry) croak("Missing Perl graph field %s", fields[i]);
    slots[i] = lpg_pin(aTHX_ *entry);
  }
  return slots;
}
static SV **lpg_sequence(pTHX_ lpg_scope *scope, SV *value, size_t *length) {
  if (!SvROK(value) || SvTYPE(SvRV(value)) != SVt_PVAV || SvOBJECT(SvRV(value)) ||
      (SvMAGICAL(SvRV(value)) && mg_find(SvRV(value), PERL_MAGIC_tied))) croak("Expected a plain untied array reference");
  AV *array = (AV *)lpg_pin(aTHX_ SvRV(value)); *length = av_count(array);
  if (*length > scope->nodes) croak("Perl copied graph node limit exceeded");
  SV **slots = lpg_allocate(aTHX_ scope, *length, sizeof(SV *));
  for (size_t i = 0; i < *length; ++i) {
    SV **entry = av_fetch(array, i, 0);
    if (!entry) croak("Sparse Perl copied arrays are unsupported");
    slots[i] = lpg_pin(aTHX_ *entry);
  }
  return slots;
}
static uint64_t lpg_unsigned(pTHX_ SV *value, uint64_t maximum) {
  if (!SvIOK(value) || (!SvIsUV(value) && SvIV(value) < 0) || SvUV(value) > maximum)
    croak("Unsigned integer is out of range or not an exact integer scalar");
  return (uint64_t)SvUV(value);
}
static int64_t lpg_signed(pTHX_ SV *value, int64_t minimum, int64_t maximum) {
  if (!SvIOK(value) || (SvIsUV(value) && SvUV(value) > (uint64_t)maximum) ||
      (!SvIsUV(value) && (SvIV(value) < minimum || SvIV(value) > maximum)))
    croak("Signed integer is out of range or not an exact integer scalar");
  return (int64_t)SvIV(value);
}
static SV *lpg_bigint_text(pTHX_ lpg_scope *scope, SV *value, int natural) {
  if (!SvROK(value) || !sv_derived_from(value, "Math::BigInt")) croak("Expected Math::BigInt");
  LB_PERL_GRAPH_CHECKPOINT();
  dSP; PUSHMARK(SP); XPUSHs(value); PUTBACK;
  int count = call_method("bstr", G_SCALAR); SPAGAIN;
  if (count != 1) { SP -= count; PUTBACK; croak("Math::BigInt must return one decimal value"); }
  SV *text = POPs; PUTBACK; lpg_pin(aTHX_ text); SvGETMAGIC(text);
  if (SvROK(text) || (!SvPOK(text) && !SvIOK(text) && !SvNOK(text))) croak("Math::BigInt must return a decimal scalar");
  LB_PERL_GRAPH_CHECKPOINT();
  STRLEN length; const char *bytes = SvPV_nomg(text, length);
  lpg_charge(aTHX_ &scope->storage_bytes, length, 1);
  size_t i = 0;
  if (!length) croak("Invalid Math::BigInt");
  if (bytes[0] == '-') { if (natural) croak("Nat cannot be negative"); i = 1; }
  if (i == length) croak("Invalid Math::BigInt");
  for (; i < length; ++i) if (bytes[i] < '0' || bytes[i] > '9') croak("Math::BigInt must be finite and integral");
  return text;
}
static const uint32_t *lpg_limbs(pTHX_ lpg_scope *scope, SV *value, int natural, size_t *count, int *negative) {
  SV *text = lpg_bigint_text(aTHX_ scope, value, natural);
  STRLEN length; const char *bytes = SvPV_nomg(text, length);
  *negative = bytes[0] == '-'; bytes += *negative; length -= *negative;
  while (length && *bytes == '0') { ++bytes; --length; }
  if (!length) { *count = 0; *negative = 0; return NULL; }
  size_t capacity = length / 9 + 1;
  uint32_t *limbs = lpg_allocate(aTHX_ scope, capacity, sizeof(uint32_t));
  size_t used = 0;
  while (length) {
    size_t digits = length % 9; if (!digits) digits = 9;
    uint32_t factor = 1, chunk = 0;
    for (size_t i = 0; i < digits; ++i) { factor *= 10; chunk = chunk * 10 + (bytes[i] - '0'); }
    uint64_t carry = chunk;
    for (size_t i = 0; i < used; ++i) { carry += (uint64_t)limbs[i] * factor; limbs[i] = (uint32_t)carry; carry >>= 32; }
    if (carry) { if (used == capacity) croak("Perl graph limb capacity exceeded"); limbs[used++] = (uint32_t)carry; }
    bytes += digits; length -= digits;
  }
  lpg_charge(aTHX_ &scope->native_bytes, used, sizeof(uint32_t));
  *count = used; return limbs;
}
static SV *lpg_bigint(pTHX_ lpg_scope *scope, const uint32_t *limbs, size_t count, int negative) {
  while (count && !limbs[count - 1]) --count;
  uint32_t *work = lpg_allocate(aTHX_ scope, count, sizeof(uint32_t));
  if (count) memcpy(work, limbs, count * sizeof(uint32_t));
  size_t capacity = count * 2 + 1;
  uint32_t *chunks = lpg_allocate(aTHX_ scope, capacity, sizeof(uint32_t));
  size_t used = 0;
  while (count) {
    uint64_t remainder = 0;
    for (size_t i = count; i > 0; --i) { uint64_t value = (remainder << 32) | work[i - 1]; work[i - 1] = value / 1000000000; remainder = value % 1000000000; }
    chunks[used++] = remainder;
    while (count && !work[count - 1]) --count;
  }
  char *bytes = lpg_allocate(aTHX_ scope, used * 9 + 3, 1), *cursor = bytes;
  if (negative && used) *cursor++ = '-';
  if (!used) *cursor++ = '0';
  else { cursor += sprintf(cursor, "%u", chunks[--used]); while (used) cursor += sprintf(cursor, "%09u", chunks[--used]); }
  SV *text = lpg_text(aTHX_ scope, bytes, cursor - bytes, 0), *klass = lpg_text(aTHX_ scope, "Math::BigInt", 12, 0);
  LB_PERL_GRAPH_CHECKPOINT(); dSP; PUSHMARK(SP); XPUSHs(klass); XPUSHs(text); PUTBACK;
  int returns = call_method("new", G_SCALAR); SPAGAIN;
  if (returns != 1) { SP -= returns; PUTBACK; croak("Math::BigInt construction failed"); }
  SV *result = POPs; PUTBACK; lpg_pin(aTHX_ result);
  if (!SvROK(result) || !sv_derived_from(result, "Math::BigInt")) croak("Math::BigInt constructor returned an invalid value");
  return result;
}
`;
