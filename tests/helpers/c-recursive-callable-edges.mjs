/**
 * Public C recursive-value limits, rejected ownership misuse and closure scope.
 * Only the allocation audit uses a hook in freshly compiled bridge sources.
 *
 * @file
 */

/**
 * Return declarations and a callable edge audit for the installed C consumer.
 *
 * @param model - Public C-family naming model for the independent fixture.
 * @param options - Select instrumented allocation-lifetime checks.
 * @param options.faults - Enable the allocation hook available in the fault probe.
 */
export const recursiveCallableCEdges = (model, { faults }) => {
	const call = model.functions.find(fn => fn.declaration.name === "callRecursive");
	const make = model.functions.find(fn => fn.declaration.name === "makeRecursive");
	const record = model.functions.find(fn => fn.declaration.name === "callRecord");
	const tree = call.parameters[0].name, callback = call.parameters[1].publicName;
	const owned = make.result.publicOwnedName, recordCallback = record.parameters[1].publicName;
	return String.raw`
#include <pthread.h>
#include <sys/wait.h>
#include <unistd.h>
static unsigned edge_rejections, edge_depths, edge_threads, edge_processes, edge_active_disposals;
static unsigned edge_callback_calls;
static void edge_leaf(${tree} *value, unsigned number) {
  ${tree}_init(value); CHECK(${tree}_select(value, STRUCTURED_TREE_T_KIND_LEAF) == STRUCTURED_STATUS_OK);
  mpz_set_ui(value->cases.leaf.value, number);
}
static void edge_leaf_is(const ${tree} *value, unsigned number) {
  CHECK(value->kind == STRUCTURED_TREE_T_KIND_LEAF && mpz_cmp_ui(value->cases.leaf.value, number) == 0);
}
static structured_status edge_echo(void *context, const ${tree} *value, ${tree} *out, structured_error *error) {
  (void)context; ++edge_callback_calls; return ${tree}_copy(value, out, error);
}
static void edge_bad(${tree} *value, unsigned kind) {
  if (!kind) return; /* An initialized, unselected variant has no constructor. */
  CHECK(${tree}_select(value, kind == 6 ? STRUCTURED_TREE_T_KIND_LEAF : STRUCTURED_TREE_T_KIND_BRANCH) == STRUCTURED_STATUS_OK);
  if (kind == 6) { mpz_set_si(value->cases.leaf.value, -1); return; }
  value->cases.branch.children.length = kind == 2 ? SIZE_MAX : 1;
  value->cases.branch.children.data = kind == 3 ? value : kind == 4 ? (const ${tree} *)((const char *)value + 1) : NULL;
  if (kind == 5) value->cases.branch.children.length = 262145;
}
static structured_status edge_invalid_reply(void *context, const ${tree} *value, ${tree} *out, structured_error *error) {
  (void)value; (void)error; ++edge_callback_calls; edge_bad(out, *(const unsigned *)context); return STRUCTURED_STATUS_OK;
}
static structured_status edge_record_echo(void *context, const structured_payload_t *value, structured_payload_t *out, structured_error *error) {
  (void)context; ++edge_callback_calls; return structured_payload_t_copy(value, out, error);
}
static ${owned} *edge_foreign;
static void *edge_thread_create(void *unused) {
  (void)unused; ${tree} input; edge_leaf(&input, 17);
  CHECK(${make.name}(&input, &edge_foreign, NULL) == STRUCTURED_STATUS_OK);
  ${tree}_clear(&input); return NULL;
}
static void *edge_thread_reject(void *unused) {
  (void)unused; ${tree} input, output; edge_leaf(&input, 17); edge_leaf(&output, 41);
  ${owned} *local = NULL;
  CHECK(${make.name}(&input, &local, NULL) == STRUCTURED_STATUS_OK);
  CHECK(${owned}_call(local, true, &input, &output, NULL) == STRUCTURED_STATUS_OK); edge_leaf_is(&output, 17);
  unsigned char unchanged[sizeof(output)]; memcpy(unchanged, &output, sizeof(output));
  CHECK(${owned}_call(edge_foreign, true, &input, &output, NULL) == STRUCTURED_STATUS_INVALID_ARGUMENT);
  CHECK(!memcmp(unchanged, &output, sizeof(output))); ++edge_threads;
  ${owned}_dispose(&local); ${tree}_clear(&input); ${tree}_clear(&output); return NULL;
}
${faults ? `static ${owned} *edge_active;
static unsigned edge_dispose_layer;
static void edge_dispose_on_allocation(unsigned layer) {
  if (layer != edge_dispose_layer) return;
  edge_allocation_hook = NULL; ${owned}_dispose(&edge_active); ++edge_active_disposals;
}` : ""}
static void recursive_edges(void) {
  const unsigned baseline = identities();
  ${tree} input, output; edge_leaf(&input, 17); edge_leaf(&output, 41);
  ${callback} echo = {edge_echo, NULL}; structured_error error = {0};
  unsigned char unchanged[sizeof(output)]; memcpy(unchanged, &output, sizeof(output));
  const unsigned before_calls = edge_callback_calls;
  CHECK(${call.name}(NULL, &echo, &output, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
  CHECK(${call.name}(&input, NULL, &output, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
  CHECK(${call.name}(&input, &echo, NULL, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
  ${callback} missing = {0};
  CHECK(${call.name}(&input, &missing, &output, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
  CHECK(edge_callback_calls == before_calls && !memcmp(unchanged, &output, sizeof(output))); edge_rejections += 4;
  ${owned} *closure = NULL; CHECK(${make.name}(&input, &closure, &error) == STRUCTURED_STATUS_OK);
  for (unsigned kind = 0; kind < 7; ++kind) {
    ${tree} invalid; ${tree}_init(&invalid); edge_bad(&invalid, kind);
    ${owned} *rejected = NULL; const unsigned calls = edge_callback_calls;
    CHECK(${call.name}(&invalid, &echo, &output, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    CHECK(${make.name}(&invalid, &rejected, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT && !rejected);
    CHECK(${tree}_copy(&invalid, &output, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    CHECK(${owned}_call(closure, false, &invalid, &output, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    CHECK(edge_callback_calls == calls && !memcmp(unchanged, &output, sizeof(output)));
    ${callback} bad_reply = {edge_invalid_reply, &kind};
    CHECK(${call.name}(&input, &bad_reply, &output, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    CHECK(edge_callback_calls == calls + 1 && !memcmp(unchanged, &output, sizeof(output)));
    ${tree}_clear(&invalid); CHECK(identities() == baseline + 1); edge_rejections += 5;
  }
  ${owned}_dispose(&closure);
  ${tree} spine[65];
  for (unsigned depth = 0; depth <= 64; ++depth) {
    if (!depth) edge_leaf(&spine[depth], 17);
    else {
      ${tree}_init(&spine[depth]); CHECK(${tree}_select(&spine[depth], STRUCTURED_TREE_T_KIND_BRANCH) == STRUCTURED_STATUS_OK);
      spine[depth].cases.branch.children.data = &spine[depth - 1]; spine[depth].cases.branch.children.length = 1;
    }
    memcpy(unchanged, &output, sizeof(output));
    CHECK(${call.name}(&spine[depth], &echo, &output, &error) == (depth < 64 ? STRUCTURED_STATUS_OK : STRUCTURED_STATUS_INVALID_ARGUMENT));
    if (depth < 64) {
      const ${tree} *leaf = &output;
      for (unsigned i = 0; i < depth; ++i) {
        CHECK(leaf->kind == STRUCTURED_TREE_T_KIND_BRANCH && leaf->cases.branch.children.length == 1);
        leaf = leaf->cases.branch.children.data;
      }
      edge_leaf_is(leaf, 17); ++edge_depths;
    } else { CHECK(!memcmp(unchanged, &output, sizeof(output))); ++edge_rejections; }
    CHECK(identities() == baseline);
  }
  structured_payload_t record, record_out; structured_payload_t_init(&record); structured_payload_t_init(&record_out);
  mpz_set_ui(record_out.count, 91); unsigned char record_before[sizeof(record_out)]; memcpy(record_before, &record_out, sizeof(record_out));
  ${recordCallback} record_echo = {edge_record_echo, NULL};
  for (unsigned kind = 0; kind < 6; ++kind) {
    record.text.data = kind == 0 ? "\xff" : ""; record.text.length = kind == 0 ? 1 : kind == 1 ? SIZE_MAX : 0;
    record.rows.length = kind == 2 ? 1 : 0; record.rows.data = NULL;
    mpz_set_si(record.count, kind == 3 ? -1 : 0);
    record.nested.has_value = kind == 4 ? 2 : kind == 5 ? 1 : 0; record.nested.value.is_ok = kind == 5 ? 2 : 0;
    const unsigned calls = edge_callback_calls;
    CHECK(${record.name}(&record, &record_echo, &record_out, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    CHECK(structured_payload_t_copy(&record, &record_out, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    CHECK(edge_callback_calls == calls && !memcmp(record_before, &record_out, sizeof(record_out))); edge_rejections += 2;
  }
  record.text.length = 0; record.rows.length = 0; mpz_set_ui(record.count, 17); record.nested.has_value = 0;
  record.nested.value.error.data = (const char *)(uintptr_t)1; record.nested.value.error.length = SIZE_MAX;
  CHECK(${record.name}(&record, &record_echo, &record_out, &error) == STRUCTURED_STATUS_OK);
  CHECK(!record_out.nested.has_value && mpz_cmp_ui(record_out.count, 17) == 0);
  structured_payload_t_clear(&record); structured_payload_t_clear(&record_out);
  CHECK(${make.name}(&input, &edge_foreign, &error) == STRUCTURED_STATUS_OK);
  pthread_t thread; CHECK(!pthread_create(&thread, NULL, edge_thread_reject, NULL)); CHECK(!pthread_join(thread, NULL));
  CHECK(${owned}_call(edge_foreign, true, &input, &output, &error) == STRUCTURED_STATUS_OK); edge_leaf_is(&output, 17);
  pid_t child = fork(); CHECK(child >= 0);
  if (!child) {
    CHECK(${owned}_call(edge_foreign, true, &input, &output, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    ${owned}_dispose(&edge_foreign); CHECK(!edge_foreign); _exit(0);
  }
  int status = 0; CHECK(waitpid(child, &status, 0) == child && WIFEXITED(status) && !WEXITSTATUS(status)); ++edge_processes;
  CHECK(${owned}_call(edge_foreign, true, &input, &output, &error) == STRUCTURED_STATUS_OK); edge_leaf_is(&output, 17);
  ${owned}_dispose(&edge_foreign);
  CHECK(!pthread_create(&thread, NULL, edge_thread_create, NULL)); CHECK(!pthread_join(thread, NULL));
  for (unsigned i = 0; i < 16; ++i) {
    CHECK(!pthread_create(&thread, NULL, edge_thread_reject, NULL)); CHECK(!pthread_join(thread, NULL));
  }
  ${owned}_dispose(&edge_foreign); CHECK(!edge_foreign);
${faults ? `  for (unsigned layer = 0; layer < 2; ++layer) {
    CHECK(${make.name}(&spine[1], &edge_active, &error) == STRUCTURED_STATUS_OK);
    memcpy(unchanged, &output, sizeof(output)); edge_dispose_layer = layer; edge_allocation_hook = edge_dispose_on_allocation;
    CHECK(${owned}_call(edge_active, true, &spine[1], &output, &error) == (layer ? STRUCTURED_STATUS_INVALID_ARGUMENT : STRUCTURED_STATUS_OK));
    CHECK(!edge_active && !edge_allocation_hook);
    if (layer) CHECK(!memcmp(unchanged, &output, sizeof(output)));
    else { CHECK(output.kind == STRUCTURED_TREE_T_KIND_BRANCH && output.cases.branch.children.length == 1); edge_leaf_is(output.cases.branch.children.data, 17); }
    CHECK(identities() == baseline);
  }` : ""}
  for (unsigned depth = 0; depth <= 64; ++depth) ${tree}_clear(&spine[depth]);
  ${tree}_clear(&input); ${tree}_clear(&output); CHECK(identities() == baseline);
  CHECK(edge_rejections == 52 && edge_depths == 64 && edge_threads == 17 && edge_processes == 1);
}
`;
};
