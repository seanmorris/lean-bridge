#include "structured.h"
#include <stdio.h>

static structured_status increment(void *context, const structured_tree_t *value,
    structured_tree_t *out, structured_error *error) {
    (void)context;
    structured_status status = structured_tree_t_copy(value, out, error);
    if (status == STRUCTURED_STATUS_OK && out->kind == STRUCTURED_TREE_T_KIND_LEAF)
        mpz_add_ui(out->cases.leaf.value, out->cases.leaf.value, 1);
    return status;
}

int main(void) {
    structured_tree_t input, output;
    structured_tree_t_init(&input);
    structured_tree_t_init(&output);
    if (structured_tree_t_select(&input, STRUCTURED_TREE_T_KIND_LEAF)
        != STRUCTURED_STATUS_OK) return 1;
    mpz_set_ui(input.cases.leaf.value, 42);

    /* This signature-specific name comes from structured.h. */
    structured_callbackf4488fe53adb351ea5ca callback = {increment, NULL};
    structured_error error = {0};
    structured_status status = structured_call_recursive(&input, &callback, &output, &error);
    int failed = status != STRUCTURED_STATUS_OK
        || output.kind != STRUCTURED_TREE_T_KIND_LEAF
        || mpz_cmp_ui(output.cases.leaf.value, 43)
        || mpz_cmp_ui(input.cases.leaf.value, 42);
    if (!failed) puts("43");
    structured_tree_t_clear(&output);
    structured_tree_t_clear(&input);
    return failed;
}
