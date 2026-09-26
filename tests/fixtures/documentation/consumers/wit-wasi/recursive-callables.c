#include "structured_wasmtime.h"
#include <stdio.h>

static int report(wasmtime_error_t *error)
{
    if (!error) return 0;
    wasm_name_t message;
    wasmtime_error_message(error, &message);
    fprintf(stderr, "%.*s\n", (int)message.size, message.data);
    wasm_name_delete(&message);
    wasmtime_error_delete(error);
    return 1;
}

static wasmtime_error_t *wrap(void *data,
    const structured_tree_t *value, structured_tree_t *out)
{
    (void)data;
    structured_tree_t branch = {.kind = STRUCTURED_TREE_T_KIND_BRANCH};
    branch.cases.branch.children.data = value;
    branch.cases.branch.children.length = 1;
    return structured_tree_t_wasmtime_copy(&branch, out);
}

int main(void)
{
    structured_wasmtime *session = NULL;
    if (report(structured_wasmtime_open(&session))) return 1;
    structured_wasmtime_function callback = 0, closure = 0;
    structured_tree_t wrapped = {0}, chosen = {0};
    uint32_t forty_two = 42;
    structured_tree_t leaf = {.kind = STRUCTURED_TREE_T_KIND_LEAF};
    leaf.cases.leaf.value.data = &forty_two;
    leaf.cases.leaf.value.length = 1;
    int failed = report(structured_wasmtime_call_recursive_callback1_create(
        session, wrap, NULL, NULL, &callback));
    if (!failed) failed = report(structured_wasmtime_value_call_recursive(
        session, &leaf, callback, &wrapped));
    if (!failed) failed = report(structured_wasmtime_value_make_recursive(
        session, &wrapped, &closure));
    structured_tree_t_clear(&wrapped);
    bool selected = true;
    if (!failed) failed = report(structured_wasmtime_make_recursive_call(
        session, closure, &selected, &leaf, &chosen));
    failed |= report(structured_wasmtime_function_close(session, &closure));
    failed |= report(structured_wasmtime_function_close(session, &callback));
    structured_wasmtime_close(session);

    if (!failed) {
        const structured_tree_t *child = chosen.cases.branch.children.data;
        failed = chosen.kind != STRUCTURED_TREE_T_KIND_BRANCH
            || chosen.cases.branch.children.length != 1 || !child
            || child->kind != STRUCTURED_TREE_T_KIND_LEAF
            || child->cases.leaf.value.length != 1
            || child->cases.leaf.value.data[0] != 42;
        if (!failed) puts("branch(leaf(42))");
    }
    structured_tree_t_clear(&chosen);
    return failed;
}
