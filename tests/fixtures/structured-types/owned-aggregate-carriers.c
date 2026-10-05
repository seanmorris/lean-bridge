/* Independent typed-value oracle. It never inspects resource record offsets. */
#include "carriers.h"
#include "probe-bindings.h"
#include "lean_bridge_native_runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static unsigned checks;
#define CHECK(condition) do { ++checks; if (!(condition)) { \
  fprintf(stderr, "check failed at %s:%d: %s\n", __FILE__, __LINE__, #condition); abort(); \
} } while (0)

static lean_object *share(lean_object *value) { lean_inc(value); return value; }
static lean_object *carry(lean_object *value) { return lean_array_push(lean_alloc_array(0, 0), value); }
static lean_object *take(lean_object *value) {
  CHECK(lean_is_array(value) && lean_array_size(value) == 1);
  lean_object *result = share(lean_array_get_core(value, 0)); lean_dec(value); return result;
}
static void empty(lean_object *value) {
  CHECK(lean_is_array(value) && lean_array_size(value) == 0); lean_dec(value);
}
static lean_object *ticket(unsigned number) {
  return take(F_newTicket(carry(lean_unsigned_to_nat(number)), carry(lean_mk_string("retained ticket"))));
}
static void expect_ticket(lean_object *value, lean_object *identity, unsigned serial) {
  lean_object *item = take(value); CHECK(item == identity);
  lean_object *number = take(F_serial(carry(item)));
  CHECK(lean_nat_eq(number, lean_unsigned_to_nat(serial))); lean_dec(number);
}
static lean_object *payload(void) {
  lean_object *bytes = lean_alloc_sarray(1, 0, 0);
  bytes = lean_byte_array_push(bytes, 0); bytes = lean_byte_array_push(bytes, 255);
  return PAYLOAD_make(carry(lean_int64_to_int(-19)), carry(bytes));
}
static lean_object *tickets(lean_object *item) {
  return TICKETS_make(lean_array_push(carry(carry(share(item))), carry(share(item))));
}
static lean_object *bundle(lean_object *item) {
  return BUNDLE_make(carry(share(item)), OPTIONAL_make0(carry(share(item))), tickets(item),
    HISTORY_make(carry(carry(share(item)))), payload());
}
static void expect_bundle(lean_object *value, lean_object *item, unsigned serial) {
  expect_ticket(F_primary(share(value)), item, serial);
  expect_ticket(OPTIONAL_field0(BUNDLE_field1(share(value))), item, serial);
  lean_object *peers = TICKETS_items(BUNDLE_field2(share(value)));
  CHECK(lean_array_size(peers) == 2);
  for (size_t i = 0; i < 2; ++i) expect_ticket(share(lean_array_get_core(peers, i)), item, serial);
  lean_dec(peers);
  lean_object *history = HISTORY_items(BUNDLE_field3(share(value)));
  CHECK(lean_array_size(history) == 1);
  expect_ticket(share(lean_array_get_core(history, 0)), item, serial); lean_dec(history);
  lean_object *data = F_payload(value);
  lean_object *count = take(PAYLOAD_field0(share(data))), *bytes = take(PAYLOAD_field1(data));
  CHECK(lean_int_eq(count, lean_int64_to_int(-19))); lean_dec(count);
  CHECK(lean_sarray_size(bytes) == 2 && lean_byte_array_uget(bytes, 0) == 0 && lean_byte_array_uget(bytes, 1) == 255);
  lean_dec(bytes);
}
static lean_object *tree(unsigned depth, lean_object *item) {
  lean_object *value = TREE_make0(carry(share(item)));
  for (unsigned i = 0; i < depth; ++i) value = TREE_make1(TREES_make(carry(value)));
  return value;
}
static void expect_tree(lean_object *value, unsigned depth, lean_object *item, unsigned serial) {
  for (unsigned i = 0; i < depth; ++i) {
    CHECK(TREE_branch(share(value)) == 1);
    lean_object *children = TREES_items(TREE_case1_field0(value));
    CHECK(lean_array_size(children) == 1);
    value = share(lean_array_get_core(children, 0)); lean_dec(children);
  }
  CHECK(TREE_branch(share(value)) == 0);
  expect_ticket(TREE_case0_field0(value), item, serial);
}
extern lean_object *owned_test_record_identity(lean_object *);
extern lean_object *owned_test_tree_identity(lean_object *);
extern lean_object *initialize_Witness(uint8_t);
extern lean_object *COMPONENT_INITIALIZER(uint8_t);
static void *initialize_component(uint8_t builtin) {
  lean_object *result = COMPONENT_INITIALIZER(builtin);
  if (lean_io_result_is_error(result)) return result;
  lean_dec(result); return initialize_Witness(builtin);
}

static void test_carriers(void) {
  lean_object *first = ticket(42), *second = ticket(73);
  expect_ticket(F_retainTicket(carry(share(first))), first, 42);
  lean_object *label = take(F_label(carry(share(first))));
  CHECK(strcmp(lean_string_cstr(label), "retained ticket") == 0); lean_dec(label);
  lean_object *list = TICKETS_items(F_echoArray(tickets(first)));
  CHECK(lean_array_size(list) == 2);
  for (size_t i = 0; i < 2; ++i) expect_ticket(share(lean_array_get_core(list, i)), first, 42);
  lean_dec(list);
  list = HISTORY_items(F_echoList(HISTORY_make(carry(carry(share(first))))));
  expect_ticket(take(list), first, 42);
  expect_ticket(OPTIONAL_field0(F_echoOption(OPTIONAL_make0(carry(share(first))))), first, 42);
  CHECK(OPTIONAL_branch(F_echoOption(OPTIONAL_none(lean_box(0)))) == 0);
  expect_bundle(F_bundle(carry(share(first)), OPTIONAL_make0(carry(share(first))), tickets(first),
    HISTORY_make(carry(carry(share(first)))), payload()), first, 42);
  expect_bundle(F_echoRecord(bundle(first)), first, 42);
  expect_bundle(ALIAS_field0(F_echoAlias(ALIAS_make(bundle(first)))), first, 42);
  expect_bundle(RESULT_field0(F_echoResult(RESULT_make0(bundle(first)))), first, 42);
  expect_ticket(RESULT_field1(F_echoResult(RESULT_make1(carry(share(first))))), first, 42);
  lean_object *pair = F_echoTuple(TUPLE_make(carry(share(first)), TUPLE_TAIL_make(OPTIONAL_none(lean_box(0)), payload())));
  expect_ticket(TUPLE_field0(share(pair)), first, 42);
  CHECK(OPTIONAL_branch(TUPLE_TAIL_field0(TUPLE_field1(pair))) == 0);
  CHECK(CHOICE_branch(F_echoVariant(CHOICE_make0(lean_box(0)))) == 0);
  expect_ticket(CHOICE_case1_field0(F_echoVariant(CHOICE_make1(carry(share(first))))), first, 42);
  pair = F_echoVariant(CHOICE_make2(carry(share(first)), carry(share(second))));
  expect_ticket(CHOICE_case2_field0(share(pair)), first, 42);
  expect_ticket(CHOICE_case2_field1(pair), second, 73);
  list = TICKETS_items(CHOICE_case3_field0(F_echoVariant(CHOICE_make3(tickets(first)))));
  CHECK(lean_array_size(list) == 2); lean_dec(list);
  list = ROW_ITEMS_items(ROW_field0(F_echoRow(ROW_make(ROW_ITEMS_make(
    lean_array_push(carry(OPTIONAL_none(lean_box(0))), OPTIONAL_make0(carry(share(first)))))))));
  CHECK(lean_array_size(list) == 2); CHECK(OPTIONAL_branch(share(lean_array_get_core(list, 0))) == 0);
  expect_ticket(OPTIONAL_field0(share(lean_array_get_core(list, 1))), first, 42); lean_dec(list);
  list = NESTED_items(F_echoNested(NESTED_make(carry(NESTED_LIST_make(carry(NESTED_OPTION_make0(RESULT_make0(bundle(first)))))))));
  list = NESTED_LIST_items(take(list));
  expect_bundle(RESULT_field0(NESTED_OPTION_field0(take(list))), first, 42);
  expect_bundle(F_callbackRecord(bundle(first), owned_test_record_identity(lean_box(0))), first, 42);
  expect_bundle(RECORD_CALLBACK_apply(owned_test_record_identity(lean_box(0)), bundle(first)), first, 42);
  for (unsigned depth = 0; depth <= 128; ++depth) {
    expect_tree(F_echoRecursive(tree(depth, first)), depth, first, 42);
    expect_tree(F_callbackRecursive(tree(depth, first), owned_test_tree_identity(lean_box(0))), depth, first, 42);
    expect_tree(TREE_CALLBACK_apply(owned_test_tree_identity(lean_box(0)), tree(depth, first)), depth, first, 42);
    lean_object *closure = F_makeRecursive(tree(depth, first));
    expect_tree(TREE_CLOSURE_apply(share(closure), carry(lean_box(1)), tree(0, second)), depth, first, 42);
    expect_tree(TREE_CLOSURE_apply(closure, carry(lean_box(0)), tree(depth, second)), depth, second, 73);
  }
  lean_object *closure = F_makeRecord(bundle(first));
  expect_bundle(RECORD_CLOSURE_apply(share(closure), carry(lean_box(1)), bundle(second)), first, 42);
  expect_bundle(RECORD_CLOSURE_apply(closure, carry(lean_box(0)), bundle(second)), second, 73);
  empty(BUNDLE_field0(lean_alloc_array(0, 0)));
  empty(OPTIONAL_field0(OPTIONAL_none(lean_box(0))));
  empty(RESULT_field0(RESULT_make1(carry(share(first)))));
  empty(CHOICE_case1_field0(CHOICE_make0(lean_box(0))));
  CHECK(TREE_branch(lean_alloc_array(0, 0)) == UINT32_MAX);
  empty(F_echoRecord(lean_array_push(carry(take(bundle(first))), take(bundle(first)))));
  empty(TICKETS_make(carry(lean_alloc_array(0, 0))));
  CHECK(lean_is_exclusive(first)); CHECK(lean_is_exclusive(second));
  lean_dec(first); lean_dec(second);
}
