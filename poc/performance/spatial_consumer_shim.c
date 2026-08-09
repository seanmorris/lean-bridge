#include <lean/lean.h>
#include <stdint.h>

typedef lean_object *(*performance_range_checksum_fn)(lean_object *, lean_object *, lean_object *);
typedef lean_object *(*performance_initializer_fn)(uint8_t);

extern lean_object *lean_bridge_performance_range_checksum(lean_object *, lean_object *, lean_object *);
extern lean_object *initialize_SpatialConsumer(uint8_t);

extern void bridge_perf_register_spatial_consumer(
    performance_range_checksum_fn,
    performance_initializer_fn
);

__attribute__((constructor))
static void bridge_perf_spatial_consumer_register(void) {
  bridge_perf_register_spatial_consumer(
    lean_bridge_performance_range_checksum,
    initialize_SpatialConsumer
  );
}
