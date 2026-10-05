#include "cobalt_wasmtime.h"
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
    cobalt_wasmtime *session = NULL;
    if (report(cobalt_wasmtime_open(&session))) return 1;
    wasmtime_component_val_t input = {
        .kind = WASMTIME_COMPONENT_U32, .of.u32 = 42
    };
    wasmtime_component_val_t output = {0};
    int failed = report(cobalt_wasmtime_call(
        session, "echo-u32", &input, 1, &output));
    if (!failed) {
        printf("%u\n", output.of.u32);
        wasmtime_component_val_delete(&output);
    }
    cobalt_wasmtime_close(session);
    return failed;
}
