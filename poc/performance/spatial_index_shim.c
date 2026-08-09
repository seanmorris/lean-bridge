#include <lean/lean.h>
#include <stdint.h>

typedef lean_object *(*performance_index_build_fn)(uint32_t, lean_object *);
typedef lean_object *(*performance_index_query_fn)(lean_object *, lean_object *);
typedef lean_object *(*performance_index_range_fn)(lean_object *, lean_object *, lean_object *);
typedef lean_object *(*performance_index_insert_fn)(lean_object *, lean_object *);
typedef uint32_t (*performance_index_size_fn)(lean_object *);
typedef lean_object *(*performance_initializer_fn)(uint8_t);

extern lean_object *lean_bridge_performance_index_build(uint32_t, lean_object *);
extern lean_object *lean_bridge_performance_index_nearest(lean_object *, lean_object *);
extern lean_object *lean_bridge_performance_index_range(lean_object *, lean_object *, lean_object *);
extern lean_object *lean_bridge_performance_index_insert(lean_object *, lean_object *);
extern uint32_t lean_bridge_performance_index_size(lean_object *);
extern lean_object *initialize_SpatialIndex(uint8_t);

extern void bridge_perf_register_spatial_index(
    performance_index_build_fn,
    performance_index_query_fn,
    performance_index_range_fn,
    performance_index_insert_fn,
    performance_index_size_fn,
    performance_initializer_fn
);

__attribute__((constructor))
static void bridge_perf_spatial_index_register(void) {
  bridge_perf_register_spatial_index(
    lean_bridge_performance_index_build,
    lean_bridge_performance_index_nearest,
    lean_bridge_performance_index_range,
    lean_bridge_performance_index_insert,
    lean_bridge_performance_index_size,
    initialize_SpatialIndex
  );
}
