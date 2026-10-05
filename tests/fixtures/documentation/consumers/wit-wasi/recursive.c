#include "recursive_wasmtime.h"
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

int main(void)
{
    recursive_wasmtime *session = NULL;
    if (report(recursive_wasmtime_open(&session))) return 1;
    recursive_spine_t leaf = {
        .kind = RECURSIVE_SPINE_T_KIND_LEAF, .cases.leaf.value = 71
    };
    recursive_spine_t grown;
    recursive_spine_t_init(&grown);
    int failed = report(recursive_wasmtime_value_grow(session, &leaf, &grown));
    recursive_wasmtime_close(session);
    if (!failed) {
        /* The result owns its storage even after the session closes. */
        failed = grown.kind != RECURSIVE_SPINE_T_KIND_NEXT
            || !grown.cases.next.value
            || grown.cases.next.value->kind != RECURSIVE_SPINE_T_KIND_LEAF
            || grown.cases.next.value->cases.leaf.value != 71;
        if (!failed) puts("next(leaf(71))");
    }
    recursive_spine_t_clear(&grown);
    return failed;
}
