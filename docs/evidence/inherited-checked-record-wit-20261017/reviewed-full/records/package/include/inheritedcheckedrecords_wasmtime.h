#ifndef INHERITEDCHECKEDRECORDS_WASMTIME_H
#define INHERITEDCHECKEDRECORDS_WASMTIME_H
#include <wasmtime.h>
#include <wasmtime/component.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct inheritedcheckedrecords_wasmtime inheritedcheckedrecords_wasmtime;
/* Open the embedded, compiled component. Output is unchanged on failure. */
wasmtime_error_t *inheritedcheckedrecords_wasmtime_open(inheritedcheckedrecords_wasmtime **out);
/* Add this package's native import to a caller-owned linker. */
wasmtime_error_t *inheritedcheckedrecords_wasmtime_link(wasmtime_component_linker_t *linker);
/* Call a WIT export by name. Arguments borrow valid Wasmtime C values.
 * Result is independently owned; delete it with wasmtime_component_val_delete.
 * Use a fresh result slot. An error leaves it unchanged. */
wasmtime_error_t *inheritedcheckedrecords_wasmtime_call(inheritedcheckedrecords_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out);
/* Dispose the session; caller-owned results remain valid. */
void inheritedcheckedrecords_wasmtime_close(inheritedcheckedrecords_wasmtime *session);
#ifdef __cplusplus
}
#endif
#endif
