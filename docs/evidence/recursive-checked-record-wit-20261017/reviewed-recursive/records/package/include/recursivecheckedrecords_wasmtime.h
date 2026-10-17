#ifndef RECURSIVECHECKEDRECORDS_WASMTIME_GRAPH_PACKAGE_H
#define RECURSIVECHECKEDRECORDS_WASMTIME_GRAPH_PACKAGE_H
#ifndef RECURSIVECHECKEDRECORDS_WASMTIME_H
#define RECURSIVECHECKEDRECORDS_WASMTIME_H
#include <wasmtime.h>
#include <wasmtime/component.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct recursivecheckedrecords_wasmtime recursivecheckedrecords_wasmtime;
/* Open the embedded, compiled component. Output is unchanged on failure. */
wasmtime_error_t *recursivecheckedrecords_wasmtime_open(recursivecheckedrecords_wasmtime **out);
/* Add this package's native import to a caller-owned linker. */
wasmtime_error_t *recursivecheckedrecords_wasmtime_link(wasmtime_component_linker_t *linker);
/* Call a WIT export by name. Arguments borrow valid Wasmtime C values.
 * Result is independently owned; delete it with wasmtime_component_val_delete.
 * Use a fresh result slot. An error leaves it unchanged. */
wasmtime_error_t *recursivecheckedrecords_wasmtime_call(recursivecheckedrecords_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out);
/* Dispose the session; caller-owned results remain valid. */
void recursivecheckedrecords_wasmtime_close(recursivecheckedrecords_wasmtime *session);
#ifdef __cplusplus
}
#endif
#endif

#include "recursivecheckedrecords-graph.h"
#ifdef __cplusplus
extern "C" {
#endif
/* Arguments borrow valid native graphs. Results require a fresh initialized
 * slot and own independent storage. Use the result type's _clear function.
 * These helpers cross the compiled component; they never call Lean directly. */
wasmtime_error_t *recursivecheckedrecords_wasmtime_value_echo(recursivecheckedrecords_wasmtime *session, const recursivecheckedrecords_packet_t *arg0, recursivecheckedrecords_packet_t *out);
wasmtime_error_t *recursivecheckedrecords_wasmtime_value_echo_groups(recursivecheckedrecords_wasmtime *session, const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *arg0, recursivecheckedrecords_graph_bf065e9a21862d87767f_t *out);
wasmtime_error_t *recursivecheckedrecords_wasmtime_value_first(recursivecheckedrecords_wasmtime *session, const recursivecheckedrecords_packet_t *arg0, recursivecheckedrecords_scalar_nat_t *out);
wasmtime_error_t *recursivecheckedrecords_wasmtime_value_groups(recursivecheckedrecords_wasmtime *session, const recursivecheckedrecords_graph_bf065e9a21862d87767f_t *arg0, recursivecheckedrecords_scalar_nat_t *out);
wasmtime_error_t *recursivecheckedrecords_wasmtime_value_produce(recursivecheckedrecords_wasmtime *session, const recursivecheckedrecords_scalar_nat_t *arg0, recursivecheckedrecords_packet_t *out);
wasmtime_error_t *recursivecheckedrecords_wasmtime_value_second(recursivecheckedrecords_wasmtime *session, const recursivecheckedrecords_packet_t *arg0, recursivecheckedrecords_scalar_nat_t *out);
#ifdef __cplusplus
}
#endif

/* Stable names for containers in public arguments, results and fields. */
typedef recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t recursivecheckedrecords_packet_tail_t;
static inline void recursivecheckedrecords_packet_tail_t_init(recursivecheckedrecords_packet_tail_t *value) { recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t_init(value); }
static inline void recursivecheckedrecords_packet_tail_t_clear(recursivecheckedrecords_packet_tail_t *value) { recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t_clear(value); }
typedef recursivecheckedrecords_graph_bf065e9a21862d87767f_t recursivecheckedrecords_echo_groups_argument0_t;
static inline void recursivecheckedrecords_echo_groups_argument0_t_init(recursivecheckedrecords_echo_groups_argument0_t *value) { recursivecheckedrecords_graph_bf065e9a21862d87767f_t_init(value); }
static inline void recursivecheckedrecords_echo_groups_argument0_t_clear(recursivecheckedrecords_echo_groups_argument0_t *value) { recursivecheckedrecords_graph_bf065e9a21862d87767f_t_clear(value); }
typedef recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t recursivecheckedrecords_echo_groups_argument0_element_t;
static inline void recursivecheckedrecords_echo_groups_argument0_element_t_init(recursivecheckedrecords_echo_groups_argument0_element_t *value) { recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t_init(value); }
static inline void recursivecheckedrecords_echo_groups_argument0_element_t_clear(recursivecheckedrecords_echo_groups_argument0_element_t *value) { recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t_clear(value); }
typedef recursivecheckedrecords_graph_bf065e9a21862d87767f_t recursivecheckedrecords_echo_groups_result_t;
static inline void recursivecheckedrecords_echo_groups_result_t_init(recursivecheckedrecords_echo_groups_result_t *value) { recursivecheckedrecords_graph_bf065e9a21862d87767f_t_init(value); }
static inline void recursivecheckedrecords_echo_groups_result_t_clear(recursivecheckedrecords_echo_groups_result_t *value) { recursivecheckedrecords_graph_bf065e9a21862d87767f_t_clear(value); }
typedef recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t recursivecheckedrecords_echo_groups_result_element_t;
static inline void recursivecheckedrecords_echo_groups_result_element_t_init(recursivecheckedrecords_echo_groups_result_element_t *value) { recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t_init(value); }
static inline void recursivecheckedrecords_echo_groups_result_element_t_clear(recursivecheckedrecords_echo_groups_result_element_t *value) { recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t_clear(value); }
typedef recursivecheckedrecords_graph_bf065e9a21862d87767f_t recursivecheckedrecords_groups_argument0_t;
static inline void recursivecheckedrecords_groups_argument0_t_init(recursivecheckedrecords_groups_argument0_t *value) { recursivecheckedrecords_graph_bf065e9a21862d87767f_t_init(value); }
static inline void recursivecheckedrecords_groups_argument0_t_clear(recursivecheckedrecords_groups_argument0_t *value) { recursivecheckedrecords_graph_bf065e9a21862d87767f_t_clear(value); }
typedef recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t recursivecheckedrecords_groups_argument0_element_t;
static inline void recursivecheckedrecords_groups_argument0_element_t_init(recursivecheckedrecords_groups_argument0_element_t *value) { recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t_init(value); }
static inline void recursivecheckedrecords_groups_argument0_element_t_clear(recursivecheckedrecords_groups_argument0_element_t *value) { recursivecheckedrecords_graph_2c3080f9e24fa7c11cff_t_clear(value); }
#endif /* RECURSIVECHECKEDRECORDS_WASMTIME_GRAPH_PACKAGE_H */
