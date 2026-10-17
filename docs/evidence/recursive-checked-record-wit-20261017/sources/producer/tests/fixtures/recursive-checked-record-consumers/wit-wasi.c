/* Independent recursive and mutual checked-record caller through installed WIT graph helpers.
 * Compile once per module: -DRECURSIVE_CHECKED_RECORD_MUTUAL selects MutualCheckedRecords. */
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef RECURSIVE_CHECKED_RECORD_MUTUAL
#include "mutualcheckedrecords_wasmtime.h"
#define P(name) mutualcheckedrecords_##name
#define MODULE "mutual"
#define LEAN "MutualCheckedRecords"
#define MAKE "mkEnvelope"
#define LINK ".next?.more.packet"
#define BOUND ".mode is not below its Fin 3 bound"
#define MUTUAL 1
typedef mutualcheckedrecords_envelope_t record;
typedef mutualcheckedrecords_envelope_next_t link_t;
typedef mutualcheckedrecords_step_t step_t;
#define DIGIT mode
#define TAIL next
#define RECORD_CLEAR mutualcheckedrecords_envelope_t_clear
#else
#include "recursivecheckedrecords_wasmtime.h"
#define P(name) recursivecheckedrecords_##name
#define MODULE "recursive"
#define LEAN "RecursiveCheckedRecords"
#define MAKE "mkPacket"
#define LINK ".tail?"
#define BOUND ".digit is not below its Fin 3 bound"
#define MUTUAL 0
typedef recursivecheckedrecords_packet_t record;
typedef recursivecheckedrecords_packet_tail_t link_t;
#define DIGIT digit
#define TAIL tail
#define RECORD_CLEAR recursivecheckedrecords_packet_t_clear
#endif
typedef P(scalar_nat_t) nat;
typedef P(groups_argument0_t) groups;
typedef P(groups_argument0_element_t) element;

#define REJECTED " was rejected by " LEAN "."
#define HOST "Invalid native graph input, allocation failure or conversion limit"
#define ROUNDS 64

static unsigned long checks, rejections, host_rejections, recoveries, snapshots, snapshot_controls;
static P(wasmtime) *session;

static void check(bool condition, const char *label) {
  if (!condition) { fprintf(stderr, "failed: %s\n", label); exit(1); }
  ++checks;
}

/* Inputs live in a bump arena that each step resets; results own separate storage. */
static unsigned char arena[16u << 20];
static size_t used;
static void *grab(size_t size) {
  size_t start = (used + 15u) & ~(size_t)15u;
  if (size > sizeof(arena) - start) { fprintf(stderr, "failed: caller arena exhausted\n"); exit(1); }
  used = start + size; memset(arena + start, 0, size); return arena + start;
}

/* Nat limbs are least significant first and canonical: zero has no limbs. */
static nat number(uint64_t value, bool huge) {
  uint32_t *limbs = grab(4 * sizeof(uint32_t)); size_t length = 0;
  if (huge) { limbs[0] = (uint32_t)value; limbs[1] = 0; limbs[2] = 0; limbs[3] = 16; length = 4; }
  else { limbs[0] = (uint32_t)value; limbs[1] = (uint32_t)(value >> 32); length = limbs[1] ? 2 : limbs[0] ? 1 : 0; }
  return (nat){.data = limbs, .length = length};
}
static nat small(uint64_t value) { return number(value, false); }
static bool nat_equal(const nat *left, const nat *right) {
  return left->length == right->length && (!left->length || memcmp(left->data, right->data, left->length * sizeof(uint32_t)) == 0);
}

static const record *child(const record *value) {
  const link_t *link = value->TAIL;
  if (!link || !link->has_value) return NULL;
#if MUTUAL
  return link->value && link->value->kind == MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE ? link->value->cases.more.packet : NULL;
#else
  return link->value;
#endif
}
/* Every record points at its option; an absent child is an option without a value. */
static record *node_nat(nat value, nat digit, const record *tail) {
  record *out = grab(sizeof(*out)); out->value = value; out->DIGIT = digit;
  out->TAIL = grab(sizeof(link_t));
  if (tail) {
    link_t *link = grab(sizeof(*link)); link->has_value = 1;
#if MUTUAL
    step_t *step = grab(sizeof(*step)); step->kind = MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE; step->cases.more.packet = tail; link->value = step;
#else
    link->value = tail;
#endif
    out->TAIL = link;
  }
  return out;
}
static record *node(uint64_t value, uint64_t digit, const record *tail) { return node_nat(small(value), small(digit), tail); }
/* A mutual Stop is an explicit present Step; the recursive module has no Stop. */
static record *stop(uint64_t value, uint64_t digit) {
#if MUTUAL
  record *out = node(value, digit, NULL);
  link_t *link = grab(sizeof(*link)); step_t *step = grab(sizeof(*step));
  step->kind = MUTUALCHECKEDRECORDS_STEP_T_KIND_STOP; link->has_value = 1; link->value = step; out->TAIL = link;
  return out;
#else
  return node(value, digit, NULL);
#endif
}
static record *chain(const uint64_t (*pairs)[2], size_t count) {
  const record *tail = NULL;
  for (size_t i = count; i-- > 0;) tail = node(pairs[i][0], pairs[i][1], tail);
  return (record *)tail;
}
static bool stopped(const record *value) {
#if MUTUAL
  return value->TAIL && value->TAIL->has_value && value->TAIL->value && value->TAIL->value->kind == MUTUALCHECKEDRECORDS_STEP_T_KIND_STOP;
#else
  (void)value; return false;
#endif
}

/* Bounded structural equality; also serves as the before/after input snapshot. */
static bool record_equal(const record *left, const record *right, unsigned depth) {
  if (depth > 256) return false;
  if (!left || !right) return left == right;
  if (!nat_equal(&left->value, &right->value) || !nat_equal(&left->DIGIT, &right->DIGIT)) return false;
  bool left_present = left->TAIL && left->TAIL->has_value, right_present = right->TAIL && right->TAIL->has_value;
  if (left_present != right_present || stopped(left) != stopped(right)) return false;
  return record_equal(child(left), child(right), depth + 1);
}
static const record *element_value(const element *item) {
#if MUTUAL
  return item->has_value ? &item->value : NULL;
#else
  return item->has_value ? item->value : NULL;
#endif
}
static bool groups_equal(const groups *left, const groups *right) {
  if (left->length != right->length) return false;
  for (size_t i = 0; i < left->length; ++i) {
    if (left->data[i].has_value != right->data[i].has_value) return false;
    if (!record_equal(element_value(&left->data[i]), element_value(&right->data[i]), 0)) return false;
  }
  return true;
}
/* Snapshots copy limbs too, so a callee writing through a borrowed pointer is observed. */
static nat nat_copy(const nat *value) {
  uint32_t *limbs = grab((value->length ? value->length : 1) * sizeof(uint32_t));
  if (value->length) memcpy(limbs, value->data, value->length * sizeof(uint32_t));
  return (nat){.data = limbs, .length = value->length};
}
static record *record_copy(const record *value) {
  if (!value) return NULL;
  record *out = stopped(value) ? stop(0, 0) : node(0, 0, record_copy(child(value)));
  out->value = nat_copy(&value->value); out->DIGIT = nat_copy(&value->DIGIT);
  return out;
}
static groups group_list(const record *const *items, size_t count) {
  element *data = grab((count ? count : 1) * sizeof(*data));
  for (size_t i = 0; i < count; ++i) if (items[i]) {
    data[i].has_value = 1;
#if MUTUAL
    data[i].value = *items[i];
#else
    data[i].value = items[i];
#endif
  }
  return (groups){.data = data, .length = count};
}
static groups groups_copy(const groups *value) {
  const record **items = grab((value->length ? value->length : 1) * sizeof(*items));
  for (size_t i = 0; i < value->length; ++i) items[i] = record_copy(element_value(&value->data[i]));
  return group_list(items, value->length);
}

/* first/echo/groups select plus-one checks; second/echo_groups plus-two. */
static uint64_t low(const nat *value) { return value->length ? value->data[0] : 0; }
static record *normalized(const record *value, unsigned plus) {
  if (!value) return NULL;
  record *tail = normalized(child(value), plus);
  uint64_t head = low(&value->value), digit = low(&value->DIGIT);
  uint64_t next = plus == 2 && !MUTUAL ? digit + 1 : head + plus;
  if (stopped(value)) return stop(next, digit);
  return node(next, digit, tail);
}

static bool exact_cause(const char *text, size_t size, const char *expected) {
  if (memchr(text, '\0', size)) return false;
  size_t length = strlen(expected);
  if (size == length && memcmp(text, expected, length) == 0) return true;
  static const char start[] = "error while executing at wasm backtrace:\n";
  static const char marker[] = "\n\nCaused by:\n    ";
  if (size && text[size - 1] == '\n') --size;
  if (size < sizeof(start) - 1 + sizeof(marker) - 1 + length || memcmp(text, start, sizeof(start) - 1)) return false;
  const char *tail = text + size - length - (sizeof(marker) - 1);
  return memcmp(tail, marker, sizeof(marker) - 1) == 0 && memcmp(tail + sizeof(marker) - 1, expected, length) == 0;
}
static void expect_error(wasmtime_error_t *error, const char *expected, const char *label) {
  if (!error) { fprintf(stderr, "failed: accepted %s\n", label); exit(1); }
  wasm_name_t message; wasmtime_error_message(error, &message);
  bool exact = exact_cause(message.data, message.size, expected);
  if (!exact) fprintf(stderr, "%s: expected '%s', got '%.*s'\n", label, expected, (int)message.size, message.data);
  check(exact, label);
  wasm_name_delete(&message); wasmtime_error_delete(error);
}
static void expect_ok(wasmtime_error_t *error, const char *label) {
  if (!error) return;
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "failed: %s unexpectedly failed: %.*s\n", label, (int)message.size, message.data);
  exit(1);
}

/* Each call checks the exact result or refusal, then that the borrowed input is unchanged. */
#define FRESH(type, name) type name; memset(&name, 0, sizeof(name))
static void call_number(const char *name, const record *input, uint64_t expected, bool huge) {
  const record *before = record_copy(input);
  FRESH(nat, out);
  wasmtime_error_t *error = strcmp(name, "first") == 0 ? P(wasmtime_value_first)(session, input, &out) : P(wasmtime_value_second)(session, input, &out);
  expect_ok(error, name);
  nat want = number(expected, huge); check(nat_equal(&out, &want), name);
  P(scalar_nat_t_clear)(&out);
  ++snapshots; check(record_equal(input, before, 0), "inputs unchanged");
}
static void call_echo(const record *input, const record *expected) {
  const record *before = record_copy(input);
  FRESH(record, out);
  expect_ok(P(wasmtime_value_echo)(session, input, &out), "echo");
  check(record_equal(&out, expected, 0), "echo exact result");
  RECORD_CLEAR(&out);
  ++snapshots; check(record_equal(input, before, 0), "echo inputs unchanged");
}
static void call_groups(const groups *input, uint64_t expected) {
  groups before = groups_copy(input);
  FRESH(nat, out);
  expect_ok(P(wasmtime_value_groups)(session, input, &out), "groups");
  nat want = small(expected); check(nat_equal(&out, &want), "groups exact result");
  P(scalar_nat_t_clear)(&out);
  ++snapshots; check(groups_equal(input, &before), "groups inputs unchanged");
}
static void call_echo_groups(const groups *input, const groups *expected) {
  groups before = groups_copy(input);
  FRESH(groups, out);
  expect_ok(P(wasmtime_value_echo_groups)(session, input, &out), "echo_groups");
  check(groups_equal(&out, expected), "echo_groups exact result");
  P(groups_argument0_t_clear)(&out);
  ++snapshots; check(groups_equal(input, &before), "echo_groups inputs unchanged");
}
static void call_produce(const nat *input, const record *expected) {
  FRESH(record, out);
  expect_ok(P(wasmtime_value_produce)(session, input, &out), "produce");
  check(record_equal(&out, expected, 0), "produce exact result");
  RECORD_CLEAR(&out);
}

/* Lean rejections and host refusals both leave the fresh output slot untouched.
 * Host refusals use malformed or cyclic graphs, which are never snapshotted. */
enum site { FIRST, SECOND, ECHO };
static void refuse(enum site site, const record *input, const char *expected, bool host) {
  const record *before = host ? NULL : record_copy(input);
  wasmtime_error_t *error;
  if (site == ECHO) {
    FRESH(record, out); error = P(wasmtime_value_echo)(session, input, &out);
    check(!out._bridge_owner && !out.TAIL && !out.value.length, "refused echo output unchanged");
  } else {
    FRESH(nat, out);
    error = site == FIRST ? P(wasmtime_value_first)(session, input, &out) : P(wasmtime_value_second)(session, input, &out);
    check(!out._bridge_owner && !out.length, "refused output unchanged");
  }
  expect_error(error, expected, expected);
  if (host) { ++host_rejections; return; }
  ++rejections; ++snapshots; check(record_equal(input, before, 0), "refused inputs unchanged");
}
static void refuse_groups(bool echo, const groups *input, const char *expected, bool host) {
  groups before = {0};
  if (!host) before = groups_copy(input);
  wasmtime_error_t *error;
  if (echo) { FRESH(groups, out); error = P(wasmtime_value_echo_groups)(session, input, &out); check(!out.length && !out._bridge_owner, "refused groups output unchanged"); }
  else { FRESH(nat, out); error = P(wasmtime_value_groups)(session, input, &out); check(!out.length && !out._bridge_owner, "refused groups output unchanged"); }
  expect_error(error, expected, expected);
  if (host) { ++host_rejections; return; }
  ++rejections; ++snapshots; check(groups_equal(input, &before), "refused group inputs unchanged");
}

#define PAIRS(...) ((const uint64_t (*)[2])(const uint64_t[][2]){__VA_ARGS__}), (sizeof((const uint64_t[][2]){__VA_ARGS__}) / sizeof(uint64_t[2]))
#define ONE(...) (const record *const[]){__VA_ARGS__}, (sizeof((const record *const[]){__VA_ARGS__}) / sizeof(const record *))

int main(int argc, char **argv) {
  (void)argv;
  if (argc != 1) { fprintf(stderr, "The installed package selects the module\n"); return 2; }
  expect_ok(P(wasmtime_open)(&session), "open");

  /* Independent snapshot controls must observe every changed field and link. */
  {
    used = 0;
    const record *pairs[][2] = {
      {node(1, 0, NULL), node(1, 1, NULL)}, {node(1, 0, NULL), node(2, 0, NULL)},
      {node(1, 0, node(1, 0, NULL)), node(1, 0, NULL)},
      {chain(PAIRS({1, 0}, {1, 0})), chain(PAIRS({1, 0}, {2, 0}))},
#if MUTUAL
      {stop(1, 0), node(1, 0, NULL)},
#endif
    };
    for (size_t i = 0; i < sizeof(pairs) / sizeof(pairs[0]); ++i) { check(!record_equal(pairs[i][0], pairs[i][1], 0), "independent snapshot mutation"); ++snapshot_controls; }
    groups a = group_list(ONE(node(1, 0, NULL), NULL)), b = group_list(ONE(NULL, node(1, 0, NULL)));
    check(!groups_equal(&a, &b), "independent group snapshot mutation"); ++snapshot_controls;
  }

  /* Constructor-free results: two linked records, words one and two above the input. */
  for (int round = -2; round < ROUNDS; ++round) {
    used = 0;
    bool huge = round >= 0; uint64_t base = round == -2 ? 0 : round == -1 ? 5 : (uint64_t)round;
    nat input = number(base, huge);
    record *tail = node_nat(number(base + 2, huge), small(2), NULL);
    call_produce(&input, node_nat(number(base + 1, huge), small(1), tail));
  }

  /* Every linked record passes its selected constructors before the outer one. */
  used = 0;
  const record *root = chain(PAIRS({40, 2}, {80, 1}));
  call_number("first", root, 41, false);
  call_number("first", node(0, 1, NULL), 1, false);
  call_number("first", chain(PAIRS({99, 2}, {0, 0}, {7, 1})), 100, false);
  call_number("second", root, MUTUAL ? 42 : 3, false);
  call_number("second", chain(PAIRS({89, 2}, {0, 1})), MUTUAL ? 91 : 3, false);
  call_echo(root, normalized(root, 1));
  const record *longer = chain(PAIRS({1, 0}, {2, 1}, {3, 2}, {4, 0}));
  call_echo(longer, normalized(longer, 1));
  uint64_t deep_pairs[40][2];
  for (unsigned n = 0; n < 40; ++n) { deep_pairs[n][0] = n % 90; deep_pairs[n][1] = n % 3; }
  const record *deep = chain((const uint64_t (*)[2])deep_pairs, 40);
  call_number("first", deep, 1, false);
  call_echo(deep, normalized(deep, 1));
  call_number("second", deep, MUTUAL ? 2 : 1, false);
  const record *shared = node(5, 1, NULL);
  groups g = group_list(ONE(shared, NULL, shared)); call_groups(&g, 3);
  groups empty = group_list(NULL, 0); call_groups(&empty, 0);
  g = group_list(ONE(NULL, root)); call_groups(&g, 2);
  /* Shared acyclic children are valid in both layouts, including below inline elements. */
  const record *shared_tail = node(5, 1, NULL);
  g = group_list(ONE(node(2, 0, shared_tail), node(3, 1, shared_tail))); call_groups(&g, 2);
  g = group_list(ONE(root, NULL, shared));
  groups normal = group_list(ONE(normalized(root, 2), NULL, normalized(shared, 2)));
  call_echo_groups(&g, &normal);
  call_echo_groups(&empty, &empty);
#if MUTUAL
  call_number("first", stop(40, 2), 41, false);
  call_echo(stop(40, 2), stop(41, 2));
  call_echo(node(1, 0, stop(2, 1)), node(2, 0, stop(3, 1)));
  call_number("second", node(1, 0, stop(2, 1)), 3, false);
#endif

  /* Exact late-field and constructor paths through the recursive carrier. */
  used = 0;
  refuse(FIRST, node(100, 0, NULL), "arg0.value" REJECTED "plusOne", false);
  refuse(FIRST, node_nat(number(0, true), small(0), NULL), "arg0.value" REJECTED "plusOne", false);
  refuse(FIRST, chain(PAIRS({40, 2}, {100, 1})), "arg0" LINK ".value" REJECTED "plusOne", false);
  refuse(FIRST, chain(PAIRS({40, 2}, {40, 2}, {100, 1})), "arg0" LINK LINK ".value" REJECTED "plusOne", false);
  refuse(FIRST, node(40, 3, NULL), "arg0" BOUND, false);
  refuse(FIRST, chain(PAIRS({40, 2}, {80, 3})), "arg0" LINK BOUND, false);
  refuse(FIRST, node(0, 2, NULL), "arg0" REJECTED MAKE, false);
  refuse(FIRST, chain(PAIRS({40, 2}, {0, 2})), "arg0" LINK REJECTED MAKE, false);
  refuse(ECHO, chain(PAIRS({40, 2}, {0, 2})), "arg0" LINK REJECTED MAKE, false);
  refuse(SECOND, node(90, 0, NULL), "arg0.value" REJECTED "plusTwo", false);
  refuse(SECOND, chain(PAIRS({1, 0}, {90, 0})), "arg0" LINK ".value" REJECTED "plusTwo", false);
  root = chain(PAIRS({40, 2}, {80, 1}));
  g = group_list(ONE(NULL, node(100, 0, NULL))); refuse_groups(false, &g, "arg0[1]?.value" REJECTED "plusOne", false);
  g = group_list(ONE(root, node(0, 2, NULL))); refuse_groups(false, &g, "arg0[1]?" REJECTED MAKE, false);
  g = group_list(ONE(node(1, 3, NULL))); refuse_groups(false, &g, "arg0[0]?" BOUND, false);
  g = group_list(ONE(node(90, 0, NULL))); refuse_groups(true, &g, "arg0[0]?.value" REJECTED "plusTwo", false);
  g = group_list(ONE(NULL, chain(PAIRS({1, 0}, {95, 1})))); refuse_groups(true, &g, "arg0[1]?" LINK ".value" REJECTED "plusTwo", false);

  /* Malformed native graphs are host refusals, distinct from Lean diagnostics. */
  {
    record *noncanonical = node(1, 0, NULL); uint32_t *limbs = grab(2 * sizeof(uint32_t)); limbs[0] = 1;
    noncanonical->value = (nat){.data = limbs, .length = 2};
    refuse(FIRST, noncanonical, HOST, true);
    record *missing = node(1, 0, NULL); missing->value = (nat){.data = NULL, .length = 1};
    refuse(FIRST, missing, HOST, true);
    record *flag = node(1, 0, node(1, 0, NULL)); ((link_t *)flag->TAIL)->has_value = 2;
    refuse(FIRST, flag, HOST, true);
    record *absent = node(1, 0, NULL); link_t *hole = grab(sizeof(*hole)); hole->has_value = 1; absent->TAIL = hole;
    refuse(FIRST, absent, HOST, true);
    record *bare = node(1, 0, NULL); bare->TAIL = NULL;
    refuse(FIRST, bare, HOST, true);
#if MUTUAL
    record *unknown = stop(1, 0); ((step_t *)unknown->TAIL->value)->kind = 7;
    refuse(FIRST, unknown, HOST, true);
#endif
    record *cyclic = node(1, 0, NULL); link_t *loop = grab(sizeof(*loop)); loop->has_value = 1;
#if MUTUAL
    step_t *more = grab(sizeof(*more)); more->kind = MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE; more->cases.more.packet = cyclic; loop->value = more;
#else
    loop->value = cyclic;
#endif
    cyclic->TAIL = loop;
    refuse(FIRST, cyclic, HOST, true);
    g = group_list(ONE(cyclic)); refuse_groups(false, &g, HOST, true);
    uint64_t long_pairs[100][2] = {{0}};
    for (unsigned n = 0; n < 100; ++n) long_pairs[n][0] = 1;
    refuse(FIRST, chain((const uint64_t (*)[2])long_pairs, 100), HOST, true);
    element *bad = grab(sizeof(*bad)); bad->has_value = 3; groups malformed = {.data = bad, .length = 1};
    refuse_groups(false, &malformed, HOST, true);
    groups dangling = {.data = NULL, .length = 1}; refuse_groups(true, &dangling, HOST, true);
    /* A result slot must be fresh: a non-empty output is refused before any call. */
    record *input = node(1, 0, NULL); FRESH(record, used_slot); used_slot._bridge_owner = input;
    expect_error(P(wasmtime_value_echo)(session, input, &used_slot), "Graph output requires a fresh initialized slot", "fresh output slot");
    ++host_rejections;
  }

  /* Rejection never poisons later calls: each refusal is followed by a success. */
  for (unsigned round = 0; round < ROUNDS; ++round) {
    used = 0;
    uint64_t value = round % 90;
    call_number("first", chain(PAIRS({value, value % 3}, {99 - value, 0})), value + 1, false);
    refuse(FIRST, chain(PAIRS({value, value % 3}, {100 + round, 0})), "arg0" LINK ".value" REJECTED "plusOne", false);
    call_number("second", node(value, round % 3, NULL), MUTUAL ? value + 2 : round % 3 + 1, false);
    g = group_list(ONE(node(value, 0, NULL), node(0, 2, NULL))); refuse_groups(false, &g, "arg0[1]?" REJECTED MAKE, false);
    record *cyclic = node(1, 0, NULL); link_t *loop = grab(sizeof(*loop)); loop->has_value = 1;
#if MUTUAL
    step_t *more = grab(sizeof(*more)); more->kind = MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE; more->cases.more.packet = cyclic; loop->value = more;
#else
    loop->value = cyclic;
#endif
    cyclic->TAIL = loop;
    refuse(FIRST, cyclic, HOST, true);
    const record *items[3] = {0};
    for (unsigned i = 0; i < round % 4 && i < 3; ++i) items[i] = node(value, 0, NULL);
    g = group_list(items, round % 4 < 3 ? round % 4 : 3); call_groups(&g, round % 4 < 3 ? round % 4 : 3);
    ++recoveries;
  }
  P(wasmtime_close)(session);
  printf("{\"checks\":%lu,\"hostRejections\":%lu,\"module\":\"%s\",\"recoveries\":%lu,\"rejections\":%lu,\"rounds\":%d,\"snapshotControls\":%lu,\"snapshots\":%lu}\n",
    checks, host_rejections, MODULE, recoveries, rejections, ROUNDS, snapshot_controls, snapshots);
  return 0;
}
