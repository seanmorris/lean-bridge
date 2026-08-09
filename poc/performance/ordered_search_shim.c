#include <lean/lean.h>
#include <stdint.h>

typedef lean_object *(*performance_make_point_fn)(uint32_t, lean_object *);
typedef uint32_t (*performance_lower_bound_fn)(lean_object *, lean_object *);
typedef lean_object *(*performance_initializer_fn)(uint8_t);

extern lean_object *lean_bridge_performance_make_point(uint32_t, lean_object *);
extern uint32_t lean_bridge_performance_point_lower_bound(lean_object *, lean_object *);
extern lean_object *initialize_OrderedSearch(uint8_t);

extern void bridge_perf_register_ordered_search(
    performance_make_point_fn,
    performance_lower_bound_fn,
    performance_initializer_fn
);

__attribute__((constructor))
static void bridge_perf_ordered_search_register(void) {
  bridge_perf_register_ordered_search(
    lean_bridge_performance_make_point,
    lean_bridge_performance_point_lower_bound,
    initialize_OrderedSearch
  );
}
