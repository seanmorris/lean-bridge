/* Independent native field oracle. It does not manufacture Lean record layouts. */
#include <lean/lean.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static size_t checks, live, attempts, fail_at, failures, fault_cases;
#define CHECK(condition) do { ++checks; if (!(condition)) { \
  fprintf(stderr, "value check failed at %s:%d: %s\n", __FILE__, __LINE__, #condition); abort(); \
} } while (0)
static void *allocate(size_t bytes) {
  if (++attempts == fail_at) return NULL;
  void *value = calloc(1, bytes); if (value) ++live; return value;
}
static void release(void *value) { if (value) { CHECK(live > 0); --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE release
#include "owned-values-codec.h"
#include "value-bindings.h"

extern lean_object *COMPONENT_INITIALIZER(uint8_t);
extern lean_object *initialize_Witness(uint8_t);
extern lean_object *owned_test_record_identity(lean_object *);
extern lean_object *owned_test_tree_identity(lean_object *);
static void *initialize_component(uint8_t builtin) {
  lean_object *result = COMPONENT_INITIALIZER(builtin);
  if (lean_io_result_is_error(result)) return result;
  lean_dec(result); return initialize_Witness(builtin);
}
static void clean(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  CHECK(snapshot.live_identities == 0); CHECK(live == 0);
}
static Ticket ticket(lb_owned_context *context, unsigned serial, ov_result_owner *owner) {
  uint32_t limb = serial; Nat number = { &limb, 1 }; Text text = { "ticket\0label", 12 }; Ticket out = {0};
  CHECK(V_newTicket(context, &number, &text, &out, owner) == LB_OWNED_OK);
  CHECK(out.token != 0); return out;
}
static void expect_ticket(lb_owned_context *context, const Ticket *value, unsigned serial) {
  Nat out = {0}; ov_result_owner owner = {0};
  CHECK(V_serial(context, value, &out, &owner) == LB_OWNED_OK);
  CHECK(out.length == 1 && out.data[0] == serial); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
}
static void expect_bundle(lb_owned_context *context, const Bundle *value, Ticket expected) {
  CHECK(value->f0.token == expected.token);
  CHECK(value->f1->tag == 1 && value->f1->f0.token == expected.token);
  CHECK(value->f2->length == 2 && value->f2->data[0].token == expected.token && value->f2->data[1].token == expected.token);
  CHECK(value->f3->length == 1 && value->f3->data[0].token == expected.token);
  CHECK(value->f4->f0.negative == 1 && value->f4->f0.length == 3 && value->f4->f0.data[2] == 7);
  CHECK(value->f4->f1.length == 3 && value->f4->f1.data[0] == 0 && value->f4->f1.data[1] == 255 && value->f4->f1.data[2] == 19);
  expect_ticket(context, &value->f0, 42);
}
static void expect_tree(lb_owned_context *context, const Tree *value, unsigned depth, Ticket expected) {
  for (unsigned i = 0; i < depth; ++i) {
    CHECK(value->tag == 1 && value->cases.c1.f0->length == 1);
    value = &value->cases.c1.f0->data[0];
  }
  CHECK(value->tag == 0 && value->cases.c0.f0.token == expected.token);
  expect_ticket(context, &value->cases.c0.f0, 42);
}

typedef struct {
  uint32_t limbs[3]; uint8_t bytes[3]; Ticket repeated[2];
  Payload payload; Optional spare; Tickets peers; History history; Bundle bundle;
} bundle_input;
static void initialize_bundle(bundle_input *input, Ticket value) {
  *input = (bundle_input){0}; input->limbs[0] = 19; input->limbs[1] = 0; input->limbs[2] = 7;
  input->bytes[0] = 0; input->bytes[1] = 255; input->bytes[2] = 19;
  input->repeated[0] = value; input->repeated[1] = value;
  input->payload = (Payload){ { input->limbs, 3, 1 }, { input->bytes, 3 } };
  input->spare = (Optional){ 1, value }; input->peers = (Tickets){ input->repeated, 2 };
  input->history = (History){ input->repeated, 1 };
  input->bundle = (Bundle){ value, &input->spare, &input->peers, &input->history, &input->payload };
}
static void test_shapes(void) {
  lb_owned_context context = {0}; ov_result_owner ticket_owner = {0}, owner = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  Ticket value = ticket(&context, 42, &ticket_owner), retained = {0};
  CHECK(V_retainTicket(&context, &value, &retained, &owner) == LB_OWNED_OK);
  CHECK(retained.token == value.token); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  Text label = {0}; CHECK(V_label(&context, &value, &label, &owner) == LB_OWNED_OK);
  CHECK(label.length == 12 && !memcmp(label.data, "ticket\0label", 12)); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  bundle_input input; initialize_bundle(&input, value);
  Bundle out = {0};
  CHECK(V_bundle(&context, &value, &input.spare, &input.peers, &input.history, &input.payload, &out, &owner) == LB_OWNED_OK);
  expect_bundle(&context, &out, value); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  CHECK(V_echoRecord(&context, &input.bundle, &out, &owner) == LB_OWNED_OK);
  expect_bundle(&context, &out, value);
  CHECK(out.f4->f1.data != input.bytes && out.f4->f0.data != input.limbs);
  Payload copied = {0}; ov_result_owner copy_owner = {0};
  CHECK(V_payload(&context, &out, &copied, &copy_owner) == LB_OWNED_OK);
  CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  CHECK(copied.f1.data[1] == 255); CHECK(ov_owner_clear(&copy_owner) == LB_OWNED_OK);
  CHECK(V_echoAlias(&context, &input.bundle, &out, &owner) == LB_OWNED_OK);
  expect_bundle(&context, &out, value); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  Tickets array = {0}; CHECK(V_echoArray(&context, &input.peers, &array, &owner) == LB_OWNED_OK);
  CHECK(array.length == 2 && array.data[0].token == value.token && array.data[1].token == value.token);
  CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  History list = {0}; CHECK(V_echoList(&context, &input.history, &list, &owner) == LB_OWNED_OK);
  CHECK(list.length == 1 && list.data[0].token == value.token); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  Optional optional = {0}; CHECK(V_echoOption(&context, &input.spare, &optional, &owner) == LB_OWNED_OK);
  CHECK(optional.tag == 1 && optional.f0.token == value.token); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  Optional none = { 0, {UINT64_MAX} }; CHECK(V_echoOption(&context, &none, &optional, &owner) == LB_OWNED_OK);
  CHECK(optional.tag == 0 && optional.f0.token == 0 && ov_owner_empty(&owner));
  Result result_in = { .tag = 0, .f0 = &input.bundle }, result_out = {0};
  CHECK(V_echoResult(&context, &result_in, &result_out, &owner) == LB_OWNED_OK);
  CHECK(result_out.tag == 0); expect_bundle(&context, result_out.f0, value); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  result_in = (Result){ .tag = 1, .f1 = value };
  CHECK(V_echoResult(&context, &result_in, &result_out, &owner) == LB_OWNED_OK);
  CHECK(result_out.tag == 1 && result_out.f1.token == value.token); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  TupleTail tail = { &input.spare, &input.payload }; Tuple pair = { value, &tail }, pair_out = {0};
  CHECK(V_echoTuple(&context, &pair, &pair_out, &owner) == LB_OWNED_OK);
  CHECK(pair_out.f0.token == value.token && pair_out.f1->f0->f0.token == value.token); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  for (uint32_t branch = 0; branch < 4; ++branch) {
    Choice choice = { .tag = branch }, returned = {0};
    if (branch == 1) choice.cases.c1.f0 = value;
    if (branch == 2) choice.cases.c2.f0 = choice.cases.c2.f1 = value;
    if (branch == 3) choice.cases.c3.f0 = &input.peers;
    CHECK(V_echoVariant(&context, &choice, &returned, &owner) == LB_OWNED_OK);
    CHECK(returned.tag == branch);
    if (branch == 1) CHECK(returned.cases.c1.f0.token == value.token);
    if (branch == 2) CHECK(returned.cases.c2.f0.token == value.token && returned.cases.c2.f1.token == value.token);
    if (branch == 3) CHECK(returned.cases.c3.f0->length == 2);
    CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  }
  Optional options[] = { none, input.spare }; Row row = { options, 2 }, row_out = {0};
  CHECK(V_echoRow(&context, &row, &row_out, &owner) == LB_OWNED_OK);
  CHECK(row_out.length == 2 && row_out.data[0].tag == 0 && row_out.data[1].tag == 1 && row_out.data[1].f0.token == value.token);
  CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  NestedOption nested_option = { 1, &result_in }; NestedList nested_list = { &nested_option, 1 };
  Nested nested = { &nested_list, 1 }, nested_out = {0};
  CHECK(V_echoNested(&context, &nested, &nested_out, &owner) == LB_OWNED_OK);
  CHECK(nested_out.data[0].data[0].f0->tag == 1 && nested_out.data[0].data[0].f0->f1.token == value.token);
  CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  /* Returned child and closure leases must outlive the original aggregate lease. */
  CHECK(V_echoRecord(&context, &input.bundle, &out, &owner) == LB_OWNED_OK);
  Ticket child = {0}; ov_result_owner child_owner = {0}, closure_owner = {0}; RecordClosure closure = {0};
  CHECK(V_primary(&context, &out, &child, &child_owner) == LB_OWNED_OK);
  CHECK(V_makeRecord(&context, &out, &closure, &closure_owner) == LB_OWNED_OK);
  CHECK(ov_owner_clear(&owner) == LB_OWNED_OK); CHECK(ov_owner_clear(&ticket_owner) == LB_OWNED_OK);
  expect_ticket(&context, &child, 42);
  uint8_t use_captured = 1;
  CHECK(RecordClosure_apply(&context, &closure, &use_captured, &input.bundle, &out, &owner) == LB_OWNED_OK);
  CHECK(ov_owner_clear(&child_owner) == LB_OWNED_OK); CHECK(ov_owner_clear(&closure_owner) == LB_OWNED_OK);
  expect_bundle(&context, &out, value);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK);
  CHECK(out.f4->f1.data[1] == 255); /* Native copied fields remain until explicit clear. */
  CHECK(ov_owner_clear(&owner) == LB_OWNED_OK); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK); clean();
}

static void test_trees_and_callbacks(void) {
  lb_owned_context context = {0}; ov_result_owner ticket_owner = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  Ticket value = ticket(&context, 42, &ticket_owner);
  Tree trees[66] = {{0}}; Trees children[65] = {{0}};
  trees[0].tag = 0; trees[0].cases.c0.f0 = value;
  for (size_t i = 1; i < 66; ++i) { children[i - 1] = (Trees){ &trees[i - 1], 1 }; trees[i].tag = 1; trees[i].cases.c1.f0 = &children[i - 1]; }
  for (unsigned depth = 0; depth <= 63; ++depth) {
    Tree result = {0}; ov_result_owner owner = {0}, closure_owner = {0}; TreeClosure closure = {0};
    CHECK(V_echoRecursive(&context, &trees[depth], &result, &owner) == LB_OWNED_OK);
    expect_tree(&context, &result, depth, value); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
    CHECK(V_makeRecursive(&context, &trees[depth], &closure, &closure_owner) == LB_OWNED_OK);
    uint8_t captured = 1;
    CHECK(TreeClosure_apply(&context, &closure, &captured, &trees[0], &result, &owner) == LB_OWNED_OK);
    CHECK(ov_owner_clear(&closure_owner) == LB_OWNED_OK); expect_tree(&context, &result, depth, value);
    CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  }
  Tree result = { .tag = 999 }; ov_result_owner owner = {0};
  CHECK(V_echoRecursive(&context, &trees[64], &result, &owner) == LB_OWNED_LIMIT);
  CHECK(result.tag == 999 && ov_owner_empty(&owner));
  /* Import real Lean closures into private callback handles, not host callbacks. */
  ov_transaction transaction = {0}; ov_result_owner callback_owner = {0}; TreeCallback callback = {0};
  CHECK(ov_begin(&transaction, &context, &callback_owner, COMPONENT_ID) == LB_OWNED_OK);
  CHECK(TreeCallback_out(&callback, owned_test_tree_identity(lean_box(0)), 0, &transaction) == LB_OWNED_OK);
  CHECK(ov_commit(&transaction, &callback_owner) == LB_OWNED_OK);
  CHECK(V_callbackRecursive(&context, &trees[32], &callback, &result, &owner) == LB_OWNED_OK);
  expect_tree(&context, &result, 32, value); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  CHECK(TreeCallback_apply(&context, &callback, &trees[31], &result, &owner) == LB_OWNED_OK);
  expect_tree(&context, &result, 31, value); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  CHECK(ov_owner_clear(&callback_owner) == LB_OWNED_OK);
  RecordCallback record_callback = {0}; Bundle bundle_out = {0}; bundle_input input; initialize_bundle(&input, value);
  CHECK(ov_begin(&transaction, &context, &callback_owner, COMPONENT_ID) == LB_OWNED_OK);
  CHECK(RecordCallback_out(&record_callback, owned_test_record_identity(lean_box(0)), 0, &transaction) == LB_OWNED_OK);
  CHECK(ov_commit(&transaction, &callback_owner) == LB_OWNED_OK);
  CHECK(V_callbackRecord(&context, &input.bundle, &record_callback, &bundle_out, &owner) == LB_OWNED_OK);
  expect_bundle(&context, &bundle_out, value); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  CHECK(RecordCallback_apply(&context, &record_callback, &input.bundle, &bundle_out, &owner) == LB_OWNED_OK);
  expect_bundle(&context, &bundle_out, value); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  CHECK(ov_owner_clear(&callback_owner) == LB_OWNED_OK);
  CHECK(ov_owner_clear(&ticket_owner) == LB_OWNED_OK); CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
}

static void test_failures(void) {
  lb_owned_context context = {0}; ov_result_owner ticket_owner = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  Ticket value = ticket(&context, 42, &ticket_owner); bundle_input input; initialize_bundle(&input, value);
  size_t baseline = live; Bundle out = { .f0 = { UINT64_MAX } }; ov_result_owner owner = {0};
  attempts = 0; CHECK(V_echoRecord(&context, &input.bundle, &out, &owner) == LB_OWNED_OK);
  size_t count = attempts; CHECK(ov_owner_clear(&owner) == LB_OWNED_OK); CHECK(live == baseline);
  ++fault_cases;
  for (size_t failure = 1; failure <= count; ++failure) {
    attempts = 0; fail_at = failure; out = (Bundle){ .f0 = { UINT64_MAX } };
    CHECK(V_echoRecord(&context, &input.bundle, &out, &owner) == LB_OWNED_ALLOC_FAILED);
    CHECK(out.f0.token == UINT64_MAX && ov_owner_empty(&owner) && live == baseline);
    CHECK(context.scopes == 0 && context.live_owners == 1); ++failures; fail_at = 0;
    expect_ticket(&context, &value, 42);
  }
  input.spare.tag = 2;
  CHECK(V_echoRecord(&context, &input.bundle, &out, &owner) == LB_OWNED_INVALID);
  CHECK(out.f0.token == UINT64_MAX && live == baseline && context.scopes == 0); input.spare.tag = 1;
  input.payload.f0.negative = 2;
  CHECK(V_echoRecord(&context, &input.bundle, &out, &owner) == LB_OWNED_INVALID);
  CHECK(live == baseline); input.payload.f0.negative = 1;
  input.payload.f1.length = SIZE_MAX;
  CHECK(V_echoRecord(&context, &input.bundle, &out, &owner) == LB_OWNED_LIMIT); input.payload.f1.length = 3;
  input.peers.data = NULL;
  CHECK(V_echoRecord(&context, &input.bundle, &out, &owner) == LB_OWNED_INVALID); input.peers.data = input.repeated;
  input.peers.length = SIZE_MAX;
  CHECK(V_echoRecord(&context, &input.bundle, &out, &owner) == LB_OWNED_LIMIT); input.peers.length = 2;
  Tree cycle = { .tag = 1 }; Trees children = { &cycle, 1 }; cycle.cases.c1.f0 = &children; Tree tree_out = { .tag = 999 };
  CHECK(V_echoRecursive(&context, &cycle, &tree_out, &owner) == LB_OWNED_INVALID);
  CHECK(tree_out.tag == 999 && live == baseline);
  cycle.tag = UINT32_MAX;
  CHECK(V_echoRecursive(&context, &cycle, &tree_out, &owner) == LB_OWNED_INVALID);
  Ticket invalid = { UINT64_MAX }; Nat serial = {0};
  CHECK(V_serial(&context, &invalid, &serial, &owner) == LB_OWNED_INVALID);
  Text invalid_text = { "\xc0\x80", 2 }; uint32_t limb = 4; Nat number = { &limb, 1 };
  CHECK(V_newTicket(&context, &number, &invalid_text, &invalid, &owner) == LB_OWNED_INVALID);
  CHECK(live == baseline);
  CHECK(V_echoRecord(&context, &input.bundle, &out, &owner) == LB_OWNED_OK);
  ov_result_owner copied = owner;
  CHECK(ov_owner_clear(&copied) == LB_OWNED_INVALID);
  CHECK(V_echoRecord(&context, &input.bundle, &out, &owner) == LB_OWNED_INVALID);
  CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  CHECK(ov_owner_clear(&ticket_owner) == LB_OWNED_OK);
  CHECK(V_serial(&context, &value, &serial, &owner) == LB_OWNED_INVALID);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
}

static void test_recursive_faults(void) {
  lb_owned_context context = {0}; ov_result_owner ticket_owner = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  Ticket value = ticket(&context, 42, &ticket_owner);
  Tree trees[17] = {{0}}; Trees children[16] = {{0}};
  trees[0].tag = 0; trees[0].cases.c0.f0 = value;
  for (size_t i = 1; i < 17; ++i) {
    children[i - 1] = (Trees){ &trees[i - 1], 1 };
    trees[i].tag = 1; trees[i].cases.c1.f0 = &children[i - 1];
  }
  /* Enumerate every allocation in recursive copying, fresh resource creation,
     captured closure acquisition and invocation, including partial output trees. */
  for (unsigned operation = 0; operation < 4; ++operation) {
    ov_result_owner closure_owner = {0}; TreeClosure closure = {0};
    if (operation == 3) CHECK(V_makeRecursive(&context, &trees[16], &closure, &closure_owner) == LB_OWNED_OK);
    size_t baseline = live, owners = context.live_owners, count = 0; ++fault_cases;
    for (size_t failure = 0; failure <= count; ++failure) {
      ov_result_owner owner = {0}; Tree returned = { .tag = 999 };
      TreeClosure captured = { UINT64_MAX }; Ticket created = { UINT64_MAX };
      uint32_t limb = 77; Nat number = { &limb, 1 }; Text label = { "new", 3 }; uint8_t yes = 1;
      attempts = 0; fail_at = failure; int status;
      if (operation == 0) status = V_echoRecursive(&context, &trees[16], &returned, &owner);
      else if (operation == 1) status = V_newTicket(&context, &number, &label, &created, &owner);
      else if (operation == 2) status = V_makeRecursive(&context, &trees[16], &captured, &owner);
      else status = TreeClosure_apply(&context, &closure, &yes, &trees[0], &returned, &owner);
      fail_at = 0;
      if (!failure) {
        count = attempts; CHECK(count > 0); CHECK(status == LB_OWNED_OK);
        if (operation == 0 || operation == 3) expect_tree(&context, &returned, 16, value);
        CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
      } else {
        CHECK(status == LB_OWNED_ALLOC_FAILED); ++failures;
        CHECK(returned.tag == 999 && captured.token == UINT64_MAX && created.token == UINT64_MAX);
        CHECK(ov_owner_empty(&owner));
      }
      CHECK(live == baseline && context.scopes == 0 && context.live_owners == owners);
      expect_ticket(&context, &value, 42);
    }
    CHECK(ov_owner_clear(&closure_owner) == LB_OWNED_OK);
  }
  CHECK(ov_owner_clear(&ticket_owner) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
}

static void test_broker_cleanup_errors(void) {
  for (unsigned during_commit = 0; during_commit < 2; ++during_commit) {
    lb_owned_context context = {0}; ov_result_owner ticket_owner = {0}, owner = {0};
    CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
    Ticket value = ticket(&context, 42, &ticket_owner);
    lb_owned_owner *entry = context.owners; CHECK(entry && entry->token == value.token);
    if (during_commit) {
      ov_transaction transaction = {0}; lean_object *borrowed = NULL; void *raw = NULL;
      CHECK(ov_begin(&transaction, &context, &owner, COMPONENT_ID) == LB_OWNED_OK);
      CHECK(lb_owned_scope_borrow(&transaction.scope, entry->kind, value.token, &borrowed) == LB_OWNED_OK);
      CHECK(ov_allocate(&transaction, 3, 1, &raw) == LB_OWNED_OK);
      CHECK(ov_owner_clear(&ticket_owner) == LB_OWNED_OK);
      /* Inject loss of the broker reference immediately before input cleanup. */
      CHECK(lean_bridge_native_identity_release(entry->token, entry->kind, entry->value) == 1);
      CHECK(ov_commit(&transaction, &owner) == LB_OWNED_RUNTIME);
      CHECK(ov_owner_empty(&owner) && !context.batches && !context.top);
    } else {
      bundle_input input; initialize_bundle(&input, value); Bundle out = {0};
      CHECK(V_echoRecord(&context, &input.bundle, &out, &owner) == LB_OWNED_OK);
      CHECK(ov_owner_clear(&ticket_owner) == LB_OWNED_OK);
      CHECK(lean_bridge_native_identity_release(entry->token, entry->kind, entry->value) == 1);
      CHECK(ov_owner_clear(&owner) == LB_OWNED_RUNTIME);
      CHECK(ov_owner_empty(&owner) && !context.batches);
    }
    CHECK(context.poisoned && live == 0 && context.live_owners == 0);
    CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
    CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
  }
}

static void test_cumulative_limits(void) {
  lb_owned_context context = {0}; ov_result_owner ticket_owner = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  Ticket value = ticket(&context, 42, &ticket_owner); bundle_input input; initialize_bundle(&input, value);
  size_t baseline = live;
  for (unsigned dimension = 0; dimension < 2; ++dimension) {
    size_t needed = 0;
    for (size_t limit = 0; limit <= needed; ++limit) {
      ov_transaction transaction = {0}; ov_result_owner owner = {0}; Bundle returned = {0}; lean_object *carried = NULL;
      CHECK(ov_begin(&transaction, &context, &owner, COMPONENT_ID) == LB_OWNED_OK);
      size_t *budget = dimension ? &transaction.budget.visits : &transaction.budget.bytes;
      size_t before = *budget;
      if (limit) *budget = limit - 1;
      int status = Bundle_in(&input.bundle, 0, 1, &transaction, &carried);
      if (!status) status = Bundle_out(&returned, carried, 0, &transaction);
      if (!limit) {
        CHECK(status == LB_OWNED_OK); needed = before - *budget; CHECK(needed > 10);
        CHECK(ov_commit(&transaction, &owner) == LB_OWNED_OK);
        expect_bundle(&context, &returned, value); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
      } else {
        CHECK(status == LB_OWNED_LIMIT); CHECK(ov_abort(&transaction, status) == LB_OWNED_LIMIT);
        CHECK(ov_owner_empty(&owner));
      }
      CHECK(live == baseline && context.scopes == 0 && context.live_owners == 1);
    }
  }
  Ticket repeated[2049]; for (size_t i = 0; i < 2049; ++i) repeated[i] = value;
  Tickets many = { repeated, 2048 }, returned = {0}; ov_result_owner owner = {0};
  CHECK(V_echoArray(&context, &many, &returned, &owner) == LB_OWNED_OK);
  CHECK(returned.length == 2048); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  many.length = 2049; returned = (Tickets){ .length = SIZE_MAX };
  CHECK(V_echoArray(&context, &many, &returned, &owner) == LB_OWNED_LIMIT);
  CHECK(returned.length == SIZE_MAX && ov_owner_empty(&owner) && live == baseline && !context.scopes);
  CHECK(ov_owner_clear(&ticket_owner) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK); clean();
}

int main(void) {
  CHECK(lean_bridge_native_component_initialize(COMPONENT_ID, initialize_component));
  if (getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) { puts("{\"cold\":true}"); return 0; }
  test_shapes(); test_trees_and_callbacks(); test_failures(); test_recursive_faults();
  test_broker_cleanup_errors(); test_cumulative_limits();
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  printf("{\"checks\":%zu,\"failures\":%zu,\"faultCases\":%zu,\"live\":%zu,\"identities\":%u}\n",
    checks, failures, fault_cases, live, snapshot.live_identities);
  return 0;
}
