#include "mutualcheckedrecords-graph-types.h"
#ifdef __cplusplus
extern "C" {
#endif
uint32_t mutualcheckedrecords_echo_graph(const mutualcheckedrecords_envelope_t *a0, mutualcheckedrecords_envelope_t *out);
uint32_t mutualcheckedrecords_echo_groups_graph(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *a0, mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *out);
uint32_t mutualcheckedrecords_first_graph(const mutualcheckedrecords_envelope_t *a0, mutualcheckedrecords_scalar_nat_t *out);
uint32_t mutualcheckedrecords_groups_graph(const mutualcheckedrecords_graph_6586a61fcab9df3e21b7_t *a0, mutualcheckedrecords_scalar_nat_t *out);
uint32_t mutualcheckedrecords_produce_graph(const mutualcheckedrecords_scalar_nat_t *a0, mutualcheckedrecords_envelope_t *out);
uint32_t mutualcheckedrecords_second_graph(const mutualcheckedrecords_envelope_t *a0, mutualcheckedrecords_scalar_nat_t *out);
const char *mutualcheckedrecords_graph_error(void);
#ifdef __cplusplus
}
#endif

#ifdef __cplusplus
extern "C" {
#endif
uint32_t mutualcheckedrecords_graph_initialize(void);
int mutualcheckedrecords_graph_ready(void);
void mutualcheckedrecords_graph_retire(void);
#ifdef __cplusplus
}
#endif
