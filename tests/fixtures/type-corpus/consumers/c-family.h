/* Observations of actual public C/C++ values, never expected Lean results. */
#include <assert.h>
#include <inttypes.h>
#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static inline void wire_quote(FILE *stream, const char *text, size_t length) {
  fputc('"', stream);
  for (size_t i = 0; i < length; ++i) {
    unsigned char ch = (unsigned char)text[i];
    if (ch == '"' || ch == '\\') { fputc('\\', stream); fputc(ch, stream); }
    else if (ch < 32) fprintf(stream, "\\u%04x", (unsigned)ch);
    else fputc(ch, stream);
  }
  fputc('"', stream);
}
static inline void wire_big(FILE *stream, const uint32_t *limbs, size_t length, bool negative) {
  assert(length < 1048576);
  size_t capacity = length * 2 + 1, used = 1;
  uint32_t *decimal = (uint32_t *)calloc(capacity, sizeof(uint32_t));
  assert(decimal);
  for (size_t i = length; i > 0; --i) {
    uint64_t carry = limbs[i - 1];
    for (size_t j = 0; j < used; ++j) {
      uint64_t value = ((uint64_t)decimal[j] << 32) + carry;
      decimal[j] = (uint32_t)(value % UINT64_C(1000000000));
      carry = value / UINT64_C(1000000000);
    }
    while (carry) {
      assert(used < capacity);
      decimal[used++] = (uint32_t)(carry % UINT64_C(1000000000));
      carry /= UINT64_C(1000000000);
    }
  }
  fputs("{\"integer\":\"", stream);
  if (negative && (used > 1 || decimal[0])) fputc('-', stream);
  fprintf(stream, "%" PRIu32, decimal[used - 1]);
  while (--used) fprintf(stream, "%09" PRIu32, decimal[used - 1]);
  fputs("\"}", stream);
  free(decimal);
}
static inline float wire_from_f32(uint32_t bits) { float value; memcpy(&value, &bits, sizeof value); return value; }
static inline double wire_from_f64(uint64_t bits) { double value; memcpy(&value, &bits, sizeof value); return value; }
static inline void wire_float32(FILE *stream, float value) {
  uint32_t bits; memcpy(&bits, &value, sizeof bits);
  if (isnan(value)) fputs("{\"float32\":\"nan\"}", stream);
  else fprintf(stream, "{\"float32\":\"%" PRIu32 "\"}", bits);
}
static inline void wire_float64(FILE *stream, double value) {
  uint64_t bits; memcpy(&bits, &value, sizeof bits);
  if (isnan(value)) fputs("{\"float64\":\"nan\"}", stream);
  else fprintf(stream, "{\"float64\":\"%" PRIu64 "\"}", bits);
}

struct wire_release { void *owner; void (*release)(void *); unsigned calls; };
static inline void wire_release_once(void *raw) {
  struct wire_release *watch = (struct wire_release *)raw;
  assert(++watch->calls == 1);
  watch->release(watch->owner);
}
#define WIRE_WATCH(value, watch) \
  struct wire_release watch = {(value).owner, (value).release, 0}; \
  if (watch.owner && watch.release) { (value).owner = &watch; (value).release = wire_release_once; }
#define WIRE_CLEARED(value, watch) \
  assert((watch).calls == (((watch).owner && (watch).release) ? 1u : 0u)); \
  assert((value).data == NULL && (value).length == 0 && (value).owner == NULL && (value).release == NULL)
