#include "nominalprimitivesubtypes_wasmtime.h"
#include "wit-values.h"
#include <math.h>
#include <stdio.h>

/* Public nineteen-base caller; NOMINAL_RESULT_ONLY selects the standalone output API. */
static nominalprimitivesubtypes_wasmtime *session;
static unsigned checks, host_rejections, rejections;
#define CHECK(condition) do { if (!(condition)) { fprintf(stderr, "nominal WIT check failed at %d: %s\n", __LINE__, #condition); exit(1); } ++checks; } while (0)

static void show_error(const char *label, wasmtime_error_t *error) {
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%s: %.*s\n", label, (int)message.size, message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error);
}
static value success_many(const char *label, value *inputs, size_t count, value expected) {
  value before[2] = {{0}, {0}}, out = {0};
  if (count > 2) abort();
  for (size_t i = 0; i < count; ++i) before[i] = clone(&inputs[i]);
  wasmtime_error_t *error = nominalprimitivesubtypes_wasmtime_call(session, label, inputs, count, &out);
  if (error) show_error(label, error);
  CHECK(error == NULL);
  if (!same(&out, &expected)) fprintf(stderr, "%s: unexpected result\n", label);
  CHECK(same(&out, &expected));
  for (size_t i = 0; i < count; ++i) {
    if (!same(&inputs[i], &before[i])) fprintf(stderr, "%s: input %zu changed\n", label, i);
    CHECK(same(&inputs[i], &before[i])); clear(&inputs[i]); clear(&before[i]);
  }
  CHECK(same(&out, &expected));
  clear(&expected); return out;
}
static value success(const char *label, value input, value expected) { return success_many(label, &input, 1, expected); }
static void expect(const char *label, value input, value expected) { value out = success(label, input, expected); clear(&out); }
static void refused_many(const char *label, value *inputs, size_t count, const char *cause, bool host) {
  value before[2] = {{0}, {0}}, out = small(777), sentinel = clone(&out);
  if (count > 2) abort();
  for (size_t i = 0; i < count; ++i) before[i] = clone(&inputs[i]);
  wasmtime_error_t *error = nominalprimitivesubtypes_wasmtime_call(session, label, inputs, count, &out);
  CHECK(error != NULL);
  wasm_name_t message; wasmtime_error_message(error, &message);
  bool exact = exact_cause(message.data, message.size, cause);
  if (!exact) fprintf(stderr, "%s: expected '%s', got '%.*s'\n", label, cause, (int)message.size, message.data);
  CHECK(exact); CHECK(same(&out, &sentinel));
  for (size_t i = 0; i < count; ++i) { CHECK(same(&inputs[i], &before[i])); clear(&inputs[i]); clear(&before[i]); }
  if (host) ++host_rejections; else ++rejections;
  wasm_name_delete(&message); wasmtime_error_delete(error);
  clear(&out); clear(&sentinel);
}
static void host_refused(const char *label, value input) {
  refused_many(label, &input, 1, "Unknown export, invalid WIT input or 16 MiB conversion limit", true);
}
/* Result exports take RawPacket; the caller projects the same host fields. */
static value produced_group(const fields *f) { return group(packet(f)); }
static value produced_pair(const fields *f) { return boxes(produced_group(f), produced_group(f)); }
static value produced_choices(const fields *f) {
  value values = list(3); values.of.list.data[0] = none();
  values.of.list.data[1] = some(branch(true, packet(f))); values.of.list.data[2] = some(branch(false, packet(f)));
  return event_choices(values);
}
static value absent_group(void) { value out = list(1); out.of.list.data[0] = none(); return out; }
static value absent_choices(void) { return event_choices(absent_group()); }
static void produce_all(const fields *f) {
  expect("produce", packet(f), some(packet(f)));
  expect("produce-group", packet(f), produced_group(f));
  expect("produce-pair", packet(f), produced_pair(f));
  expect("produce-event", packet(f), event_box(packet(f)));
  expect("produce-choices", packet(f), produced_choices(f));
}
static void produce_none(const fields *f) {
  expect("produce", packet(f), none());
  expect("produce-group", packet(f), absent_group());
  expect("produce-pair", packet(f), boxes(absent_group(), absent_group()));
  expect("produce-event", packet(f), event_empty());
  expect("produce-choices", packet(f), absent_choices());
}
#ifndef NOMINAL_RESULT_ONLY
#include "wit-inputs.h"
#endif
int main(void) {
  (void)huge; (void)pair; (void)s8; (void)s16; (void)s32; (void)u16; (void)u32; (void)normalized_fields; (void)two_to_100_minus_2; (void)two_to_100_plus_2; (void)unicode_text; (void)unicode_normalized; (void)appended_bytes; (void)forty_three; (void)hundred;
  const unsigned snapshots = nominal_snapshot_controls(); CHECK(snapshots == 22);
  wasmtime_error_t *error = nominalprimitivesubtypes_wasmtime_open(&session);
  if (error) { show_error("open", error); return 1; }
  CHECK(session != NULL);
  value bits = {0};
  error = nominalprimitivesubtypes_wasmtime_call(session, "word-bits", NULL, 0, &bits);
  if (error) { show_error("word-bits", error); return 1; }
  CHECK(bits.kind == WASMTIME_COMPONENT_U32 && bits.of.u32 == 64); clear(&bits);
  fields produced = produced_fields(); produce_all(&produced);
  /* Every predicate failure yields the absent result, field by field. */
  fields f;
#define INVALID(change) do { f = base(); change; produce_none(&f); } while (0)
  INVALID(f.bool_value = false);
  INVALID(f.uint8_value = 43); INVALID(f.uint16_value = 43); INVALID(f.uint32_value = 43); INVALID(f.uint64_value = 43);
  INVALID(f.int8_value = -43); INVALID(f.int16_value = -43); INVALID(f.int32_value = -43); INVALID(f.int64_value = -43);
  INVALID(f.nat_limbs = forty_three); INVALID(f.int_limbs = forty_three);
  INVALID(f.float32_value = INFINITY); INVALID(f.float64_value = INFINITY);
  INVALID(f.text_size = 0); INVALID(f.bytes_size = 0);
  INVALID(f.char_value = 0); INVALID(f.usize_value = 43); INVALID(f.isize_value = -43);
  INVALID(f.digit = 3);
#undef INVALID
  /* Wrong shapes have valid backing storage and remain safe to clone/delete. */
  host_refused("produce", u8(1));
  f = base(); value wrong = packet(&f); wrong.of.record.data[0].name.data[0] = 'U'; host_refused("produce", wrong);
  wrong = packet(&f); --wrong.of.record.size; host_refused("produce", wrong);
  wrong = packet(&f); clear(field(&wrong, UINT8_FIELD)); *field(&wrong, UINT8_FIELD) = u16(42); host_refused("produce", wrong);
  const uint32_t noncanonical[] = {42, 0};
  wrong = packet(&f); clear(field(&wrong, NAT_FIELD)); *field(&wrong, NAT_FIELD) = nat(noncanonical, 2); host_refused("produce", wrong);
  wrong = packet(&f); clear(field(&wrong, INT_FIELD)); *field(&wrong, INT_FIELD) = integer(true, small(0)); host_refused("produce", wrong);
  wrong = packet(&f); clear(field(&wrong, INT_FIELD)); *field(&wrong, INT_FIELD) = integer(false, nat(noncanonical, 2)); host_refused("produce", wrong);
  wrong = packet(&f); field(&wrong, CHAR_FIELD)->of.character = 0xd800; host_refused("produce", wrong);
  wrong = packet(&f); field(&wrong, CHAR_FIELD)->of.character = 0x110000; host_refused("produce", wrong);
  wrong = packet(&f); clear(field(&wrong, TEXT_FIELD)); *field(&wrong, TEXT_FIELD) = text("\xff", 1); host_refused("produce", wrong);
  wrong = packet(&f); field(&wrong, UNIT_FIELD)->of.enumeration.data[0] = 'U'; host_refused("produce", wrong);
  const uint8_t two = 2; wrong = packet(&f); memcpy(&field(&wrong, BOOL_FIELD)->of.boolean, &two, 1); host_refused("produce", wrong);
  host_refused("missing-export", packet(&f));
#ifdef NOMINAL_RESULT_ONLY
  host_refused("echo-a", packet(&f));
  for (uint32_t round = 0; round < 256; ++round) {
    const uint32_t limbs[] = {2 * round, 0, 0, 16};
    f = produced_fields(); f.nat_limbs = limbs; f.nat_size = 4; produce_all(&f);
  }
#else
  full_inputs();
#endif
  f = produced_fields(); value kept = success("produce", packet(&f), some(packet(&f)));
  nominalprimitivesubtypes_wasmtime_close(session); session = NULL;
  value expected = some(packet(&f)); CHECK(same(&kept, &expected));
  clear(&kept); clear(&expected);
  printf("{\"checks\":%u,\"rejections\":%u,\"hostRejections\":%u,\"snapshotControls\":%u,\"rounds\":256,\"wordBits\":64}\n", checks, rejections, host_rejections, snapshots);
  return 0;
}
