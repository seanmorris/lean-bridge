#include <lean_alpha.h>
#include <stdio.h>
#include <string.h>

#define CALL(expression) do { \
    if ((expression) != LEAN_ALPHA_STATUS_OK) { \
        fprintf(stderr, "Lean error %d: ", (int)error.code); \
        if (error.message) fwrite(error.message, 1, error.message_length, stderr); \
        fputc('\n', stderr); \
        goto cleanup; \
    } \
} while (0)
#define REQUIRE(condition) do { \
    if (!(condition)) { fputs("Unexpected Alpha result\n", stderr); goto cleanup; } \
} while (0)

static lean_alpha_status add_two(void *context, uint32_t value,
                                uint32_t *out, lean_alpha_error *error) {
    (void)context;
    (void)error;
    *out = value + 2;
    return LEAN_ALPHA_STATUS_OK;
}

int main(void) {
    int exit_code = 1;
    lean_alpha_error error = {0};
    lean_alpha_box *box = NULL;
    const lean_alpha_box *same = NULL;
    lean_alpha_owned_transform *adder = NULL;
    lean_alpha_payload output = {0};
    uint32_t result = 0;
    const uint8_t bytes[] = {0, 255};
    const uint32_t values[] = {0, UINT32_MAX};
    const char label[] = "Lean λ";
    const lean_alpha_payload input = {
        true, 41,
        {label, sizeof(label) - 1, NULL, NULL},
        {bytes, 2, NULL, NULL},
        {values, 2, NULL, NULL},
    };
    const lean_alpha_transform callback = {add_two, NULL};

    CALL(lean_alpha_box_create(42, &box, &error));
    CALL(lean_alpha_box_read(box, &result, &error));
    REQUIRE(result == 42);
    CALL(lean_alpha_box_identity(box, &same, &error));
    REQUIRE(same == box);
    CALL(lean_alpha_round_trip(&input, &output, &error));
    REQUIRE(!output.enabled && output.count == 42);
    REQUIRE(output.label.length == sizeof(label) - 1);
    REQUIRE(memcmp(output.label.data, label, sizeof(label) - 1) == 0);
    REQUIRE(output.bytes.length == 2 && memcmp(output.bytes.data, bytes, sizeof(bytes)) == 0);
    REQUIRE(output.values.length == 2 && memcmp(output.values.data, values, sizeof(values)) == 0);
    CALL(lean_alpha_with_callback(40, &callback, &result, &error));
    REQUIRE(result == 44);
    CALL(lean_alpha_make_adder(2, &adder, &error));
    CALL(lean_alpha_owned_transform_call(adder, 40, &result, &error));
    REQUIRE(result == 42);
    puts("Box: 42; payload: 42; callback: 44; closure: 42");
    exit_code = 0;

cleanup:
    lean_alpha_payload_clear(&output);
    lean_alpha_owned_transform_dispose(&adder);
    lean_alpha_box_dispose(&box);
    return exit_code;
}
