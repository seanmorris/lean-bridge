#ifndef MUTUALCHECKEDRECORDS_WASMTIME_GRAPH_PACKAGE_H
#define MUTUALCHECKEDRECORDS_WASMTIME_GRAPH_PACKAGE_H
#ifndef MUTUALCHECKEDRECORDS_WASMTIME_H
#define MUTUALCHECKEDRECORDS_WASMTIME_H
#include <wasmtime.h>
#include <wasmtime/component.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct mutualcheckedrecords_wasmtime mutualcheckedrecords_wasmtime;
/* Open the embedded, compiled component. Output is unchanged on failure. */
wasmtime_error_t *mutualcheckedrecords_wasmtime_open(mutualcheckedrecords_wasmtime **out);
/* Add this package's native import to a caller-owned linker. */
wasmtime_error_t *mutualcheckedrecords_wasmtime_link(wasmtime_component_linker_t *linker);
/* Call a WIT export by name. Arguments borrow valid Wasmtime C values.
 * Result is independently owned; delete it with wasmtime_component_val_delete.
 * Use a fresh result slot. An error leaves it unchanged. */
wasmtime_error_t *mutualcheckedrecords_wasmtime_call(mutualcheckedrecords_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out);
/* Dispose the session; caller-owned results remain valid. */
void mutualcheckedrecords_wasmtime_close(mutualcheckedrecords_wasmtime *session);
#ifdef __cplusplus
}
#endif
#endif

#include "mutualcheckedrecords-graph.h"
#ifdef __cplusplus
extern "C" {
#endif
/* Arguments borrow valid native graphs. Results require a fresh initialized
 * slot and own independent storage. Use the result type's _clear function.
 * These helpers cross the compiled component; they never call Lean directly. */
wasmtime_error_t *mutualcheckedrecords_wasmtime_value_echo(mutualcheckedrecords_wasmtime *session, const mutualcheckedrecords_envelope_t *arg0, mutualcheckedrecords_envelope_t *out);
wasmtime_error_t *mutualcheckedrecords_wasmtime_value_echo_groups(mutualcheckedrecords_wasmtime *session, const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *arg0, mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *out);
wasmtime_error_t *mutualcheckedrecords_wasmtime_value_first(mutualcheckedrecords_wasmtime *session, const mutualcheckedrecords_envelope_t *arg0, mutualcheckedrecords_scalar_nat_t *out);
wasmtime_error_t *mutualcheckedrecords_wasmtime_value_groups(mutualcheckedrecords_wasmtime *session, const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *arg0, mutualcheckedrecords_scalar_nat_t *out);
wasmtime_error_t *mutualcheckedrecords_wasmtime_value_produce(mutualcheckedrecords_wasmtime *session, const mutualcheckedrecords_scalar_nat_t *arg0, mutualcheckedrecords_envelope_t *out);
wasmtime_error_t *mutualcheckedrecords_wasmtime_value_second(mutualcheckedrecords_wasmtime *session, const mutualcheckedrecords_envelope_t *arg0, mutualcheckedrecords_scalar_nat_t *out);
#ifdef __cplusplus
}
#endif

/* Stable names for containers in public arguments, results and fields. */
typedef mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t mutualcheckedrecords_envelope_next_t;
static inline void mutualcheckedrecords_envelope_next_t_init(mutualcheckedrecords_envelope_next_t *value) { mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t_init(value); }
static inline void mutualcheckedrecords_envelope_next_t_clear(mutualcheckedrecords_envelope_next_t *value) { mutualcheckedrecords_graph_d2fe45ba488df4ece96d_t_clear(value); }
typedef mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t mutualcheckedrecords_echo_groups_argument0_t;
static inline void mutualcheckedrecords_echo_groups_argument0_t_init(mutualcheckedrecords_echo_groups_argument0_t *value) { mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t_init(value); }
static inline void mutualcheckedrecords_echo_groups_argument0_t_clear(mutualcheckedrecords_echo_groups_argument0_t *value) { mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t_clear(value); }
typedef mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t mutualcheckedrecords_echo_groups_argument0_element_t;
static inline void mutualcheckedrecords_echo_groups_argument0_element_t_init(mutualcheckedrecords_echo_groups_argument0_element_t *value) { mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t_init(value); }
static inline void mutualcheckedrecords_echo_groups_argument0_element_t_clear(mutualcheckedrecords_echo_groups_argument0_element_t *value) { mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t_clear(value); }
typedef mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t mutualcheckedrecords_echo_groups_result_t;
static inline void mutualcheckedrecords_echo_groups_result_t_init(mutualcheckedrecords_echo_groups_result_t *value) { mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t_init(value); }
static inline void mutualcheckedrecords_echo_groups_result_t_clear(mutualcheckedrecords_echo_groups_result_t *value) { mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t_clear(value); }
typedef mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t mutualcheckedrecords_echo_groups_result_element_t;
static inline void mutualcheckedrecords_echo_groups_result_element_t_init(mutualcheckedrecords_echo_groups_result_element_t *value) { mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t_init(value); }
static inline void mutualcheckedrecords_echo_groups_result_element_t_clear(mutualcheckedrecords_echo_groups_result_element_t *value) { mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t_clear(value); }
typedef mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t mutualcheckedrecords_groups_argument0_t;
static inline void mutualcheckedrecords_groups_argument0_t_init(mutualcheckedrecords_groups_argument0_t *value) { mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t_init(value); }
static inline void mutualcheckedrecords_groups_argument0_t_clear(mutualcheckedrecords_groups_argument0_t *value) { mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t_clear(value); }
typedef mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t mutualcheckedrecords_groups_argument0_element_t;
static inline void mutualcheckedrecords_groups_argument0_element_t_init(mutualcheckedrecords_groups_argument0_element_t *value) { mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t_init(value); }
static inline void mutualcheckedrecords_groups_argument0_element_t_clear(mutualcheckedrecords_groups_argument0_element_t *value) { mutualcheckedrecords_graph_c8c78faf2eecb4e21389_t_clear(value); }
#endif /* MUTUALCHECKEDRECORDS_WASMTIME_GRAPH_PACKAGE_H */
