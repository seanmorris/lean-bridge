#include "structured_wasmtime.h"
#include <stdio.h>
#include <string.h>

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

static wasmtime_error_t *echo_payload(void *data,
    const wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *out)
{
    (void)data;
    if (count != 1 || args[0].kind != WASMTIME_COMPONENT_RECORD)
        return wasmtime_error_new("Expected one Payload record");
    wasmtime_component_val_clone(&args[0], out);
    return NULL;
}

int main(void)
{
    structured_wasmtime *session = NULL;
    if (report(structured_wasmtime_open(&session))) return 1;
    structured_wasmtime_function callback = 0;
    int failed = report(structured_wasmtime_callback_create(session,
        "function-payload-to-payload", echo_payload, NULL, NULL, &callback));
    if (failed) { structured_wasmtime_close(session); return 1; }

    wasmtime_component_val_t input = {.kind = WASMTIME_COMPONENT_RECORD};
    wasmtime_component_valrecord_new_uninit(&input.of.record, 4);
    const char *names[] = {"text", "rows", "count", "nested"};
    for (size_t i = 0; i < 4; ++i) {
        wasm_name_new(&input.of.record.data[i].name, strlen(names[i]), names[i]);
        input.of.record.data[i].val = (wasmtime_component_val_t){0};
    }
    wasmtime_component_val_t *text = &input.of.record.data[0].val;
    text->kind = WASMTIME_COMPONENT_STRING;
    wasm_byte_vec_new(&text->of.string, 4, "echo");
    input.of.record.data[1].val.kind = WASMTIME_COMPONENT_LIST;
    input.of.record.data[2].val.kind = WASMTIME_COMPONENT_LIST;
    input.of.record.data[3].val.kind = WASMTIME_COMPONENT_OPTION;

    structured_wasmtime_value args[] = {{.value = input}, {.function = callback}};
    structured_wasmtime_value output = {0};
    failed = report(structured_wasmtime_invoke(session, "call-record", args, 2, &output));
    wasmtime_component_val_delete(&input);
    failed |= report(structured_wasmtime_function_close(session, &callback));
    structured_wasmtime_close(session);

    if (!failed) {
        const wasm_byte_vec_t *result = &output.value.of.record.data[0].val.of.string;
        printf("%.*s\n", (int)result->size, result->data);
    }
    wasmtime_component_val_delete(&output.value);
    return failed;
}
