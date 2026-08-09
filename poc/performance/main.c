#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>
#include <stdlib.h>

typedef lean_object *(*performance_make_point_fn)(uint32_t, lean_object *);
typedef uint32_t (*performance_lower_bound_fn)(lean_object *, lean_object *);
typedef lean_object *(*performance_index_build_fn)(uint32_t, lean_object *);
typedef lean_object *(*performance_index_query_fn)(lean_object *, lean_object *);
typedef lean_object *(*performance_index_range_fn)(lean_object *, lean_object *, lean_object *);
typedef lean_object *(*performance_index_insert_fn)(lean_object *, lean_object *);
typedef uint32_t (*performance_index_size_fn)(lean_object *);
typedef lean_object *(*performance_range_checksum_fn)(lean_object *, lean_object *, lean_object *);
typedef lean_object *(*performance_initializer_fn)(uint8_t);

extern lean_object *initialize_Init(uint8_t);
extern void lean_initialize_runtime_module(void);
extern void bridge_lean_runtime_finalize_module(void);

enum performance_status {
  PERFORMANCE_OK = 0,
  PERFORMANCE_RUNTIME = 1,
  PERFORMANCE_COMPONENT = 2,
  PERFORMANCE_ARGUMENT = 3,
  PERFORMANCE_DOMAIN = 4,
  PERFORMANCE_CAPACITY = 5,
  PERFORMANCE_STALE_HANDLE = 6,
};

enum performance_runtime_state {
  PERFORMANCE_RUNTIME_COLD = 0,
  PERFORMANCE_RUNTIME_READY = 1,
  PERFORMANCE_RUNTIME_FAILED = 2,
  PERFORMANCE_RUNTIME_SHUT_DOWN = 3,
};

enum performance_handle_layout {
  PERFORMANCE_SLOT_BITS = 12,
  PERFORMANCE_GENERATION_BITS = 12,
  PERFORMANCE_SLOT_MASK = (1u << PERFORMANCE_SLOT_BITS) - 1u,
  PERFORMANCE_GENERATION_MASK = (1u << PERFORMANCE_GENERATION_BITS) - 1u,
  PERFORMANCE_KIND_SHIFT = 24,
  PERFORMANCE_INDEX_KIND = 3,
  PERFORMANCE_HANDLE_CAPACITY = 1024,
};

typedef struct performance_handle_slot {
  lean_object *object;
  uint16_t generation;
  uint8_t retired;
} performance_handle_slot;

static performance_make_point_fn make_point_fn = 0;
static performance_lower_bound_fn lower_bound_fn = 0;
static performance_index_build_fn index_build_fn = 0;
static performance_index_query_fn index_nearest_fn = 0;
static performance_index_range_fn index_range_fn = 0;
static performance_index_insert_fn index_insert_fn = 0;
static performance_index_size_fn index_size_fn = 0;
static performance_range_checksum_fn range_checksum_fn = 0;
static performance_initializer_fn ordered_initializer = 0;
static performance_initializer_fn index_initializer = 0;
static performance_initializer_fn consumer_initializer = 0;
static uint8_t ordered_initialized = 0;
static uint8_t index_initialized = 0;
static uint8_t consumer_initialized = 0;
static uint32_t runtime_state = PERFORMANCE_RUNTIME_COLD;
static uint32_t runtime_init_runs = 0;
static uint32_t library_init_runs = 0;
static uint32_t live_handles = 0;
static uint32_t rejected_handles = 0;
static performance_handle_slot handle_slots[PERFORMANCE_HANDLE_CAPACITY];

static uint32_t run_initializer(performance_initializer_fn initializer, uint8_t *initialized) {
  lean_object *result;
  if (*initialized) return 1;
  if (!initializer) return 0;
  result = initializer(1);
  library_init_runs += 1;
  if (lean_io_result_is_error(result)) {
    lean_dec(result);
    runtime_state = PERFORMANCE_RUNTIME_FAILED;
    return 0;
  }
  lean_dec(result);
  *initialized = 1;
  return 1;
}

static void initialize_registered_component(
    performance_initializer_fn initializer,
    uint8_t *initialized
) {
  if (runtime_state == PERFORMANCE_RUNTIME_READY) (void)run_initializer(initializer, initialized);
}

EMSCRIPTEN_KEEPALIVE
void bridge_perf_register_ordered_search(
    performance_make_point_fn make_point,
    performance_lower_bound_fn lower_bound,
    performance_initializer_fn initializer
) {
  make_point_fn = make_point;
  lower_bound_fn = lower_bound;
  ordered_initializer = initializer;
  initialize_registered_component(initializer, &ordered_initialized);
}

EMSCRIPTEN_KEEPALIVE
void bridge_perf_register_spatial_index(
    performance_index_build_fn build,
    performance_index_query_fn nearest,
    performance_index_range_fn range,
    performance_index_insert_fn insert,
    performance_index_size_fn size,
    performance_initializer_fn initializer
) {
  index_build_fn = build;
  index_nearest_fn = nearest;
  index_range_fn = range;
  index_insert_fn = insert;
  index_size_fn = size;
  index_initializer = initializer;
  initialize_registered_component(initializer, &index_initialized);
}

EMSCRIPTEN_KEEPALIVE
void bridge_perf_register_spatial_consumer(
    performance_range_checksum_fn checksum,
    performance_initializer_fn initializer
) {
  range_checksum_fn = checksum;
  consumer_initializer = initializer;
  initialize_registered_component(initializer, &consumer_initialized);
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_perf_runtime_init(void) {
  lean_object *result;
  if (runtime_state == PERFORMANCE_RUNTIME_READY) return 1;
  if (runtime_state != PERFORMANCE_RUNTIME_COLD || !ordered_initializer) return 0;
  runtime_init_runs += 1;
  lean_initialize_runtime_module();
  result = initialize_Init(1);
  if (lean_io_result_is_error(result)) {
    lean_dec(result);
    runtime_state = PERFORMANCE_RUNTIME_FAILED;
    return 0;
  }
  lean_dec(result);
  if (!run_initializer(ordered_initializer, &ordered_initialized)) return 0;
  if (index_initializer && !run_initializer(index_initializer, &index_initialized)) return 0;
  if (consumer_initializer && !run_initializer(consumer_initializer, &consumer_initialized)) return 0;
  lean_io_mark_end_initialization();
  runtime_state = PERFORMANCE_RUNTIME_READY;
  return 1;
}

static lean_object *make_i32_array(const int32_t *values, uint32_t length) {
  lean_object *array = lean_mk_empty_array_with_capacity(lean_box(length));
  uint32_t index;
  for (index = 0; index < length; index += 1) {
    array = lean_array_push(array, lean_box_uint32((uint32_t)values[index]));
  }
  return array;
}

static lean_object *make_points(
    const uint32_t *ids,
    const int32_t *coordinates,
    uint32_t count,
    uint32_t dimensions
) {
  lean_object *points = lean_mk_empty_array_with_capacity(lean_box(count));
  uint32_t index;
  for (index = 0; index < count; index += 1) {
    lean_object *point_coordinates = make_i32_array(coordinates + index * dimensions, dimensions);
    lean_object *point = make_point_fn(ids[index], point_coordinates);
    points = lean_array_push(points, point);
  }
  return points;
}

static lean_object *unwrap_except(lean_object *result) {
  lean_object *value;
  if (!result) return 0;
  if (lean_obj_tag(result) == 0) {
    lean_dec(result);
    return 0;
  }
  value = lean_ctor_get(result, 0);
  lean_inc(value);
  lean_dec(result);
  return value;
}

static uint32_t encode_handle(uint32_t slot, uint32_t generation) {
  return
    (PERFORMANCE_INDEX_KIND << PERFORMANCE_KIND_SHIFT) |
    ((generation & PERFORMANCE_GENERATION_MASK) << PERFORMANCE_SLOT_BITS) |
    (slot + 1u);
}

static lean_object *resolve_handle(uint32_t token, performance_handle_slot **resolved_slot) {
  uint32_t encoded_slot = token & PERFORMANCE_SLOT_MASK;
  uint32_t generation = (token >> PERFORMANCE_SLOT_BITS) & PERFORMANCE_GENERATION_MASK;
  uint32_t kind = token >> PERFORMANCE_KIND_SHIFT;
  performance_handle_slot *slot;
  if (
    encoded_slot == 0 || encoded_slot > PERFORMANCE_HANDLE_CAPACITY ||
    generation == 0 || kind != PERFORMANCE_INDEX_KIND
  ) {
    rejected_handles += 1;
    return 0;
  }
  slot = &handle_slots[encoded_slot - 1u];
  if (!slot->object || slot->retired || slot->generation != generation) {
    rejected_handles += 1;
    return 0;
  }
  if (resolved_slot) *resolved_slot = slot;
  return slot->object;
}

static uint32_t retain_index(lean_object *object) {
  uint32_t index;
  for (index = 0; index < PERFORMANCE_HANDLE_CAPACITY; index += 1) {
    performance_handle_slot *slot = &handle_slots[index];
    if (slot->object || slot->retired) continue;
    if (slot->generation == 0) slot->generation = 1;
    slot->object = object;
    live_handles += 1;
    return encode_handle(index, slot->generation);
  }
  lean_dec(object);
  return 0;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_perf_lower_bound(
    const uint32_t *ids,
    const int32_t *coordinates,
    uint32_t count,
    uint32_t dimensions,
    const int32_t *query
) {
  lean_object *points;
  lean_object *query_array;
  if (
    runtime_state != PERFORMANCE_RUNTIME_READY || !make_point_fn || !lower_bound_fn ||
    !ids || !coordinates || !query || dimensions == 0
  ) return UINT32_MAX;
  points = make_points(ids, coordinates, count, dimensions);
  query_array = make_i32_array(query, dimensions);
  return lower_bound_fn(points, query_array);
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_perf_index_build(
    const uint32_t *ids,
    const int32_t *coordinates,
    uint32_t count,
    uint32_t dimensions
) {
  lean_object *result;
  lean_object *index;
  if (
    runtime_state != PERFORMANCE_RUNTIME_READY || !index_build_fn || !make_point_fn ||
    !ids || !coordinates || dimensions == 0
  ) return 0;
  result = index_build_fn(dimensions, make_points(ids, coordinates, count, dimensions));
  index = unwrap_except(result);
  return index ? retain_index(index) : 0;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_perf_index_size(uint32_t token) {
  lean_object *index = resolve_handle(token, 0);
  if (runtime_state != PERFORMANCE_RUNTIME_READY || !index || !index_size_fn) return UINT32_MAX;
  lean_inc(index);
  return index_size_fn(index);
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_perf_index_nearest(
    uint32_t token,
    const int32_t *query,
    uint32_t dimensions,
    uint32_t *point_id,
    int32_t *result_coordinates,
    uint32_t coordinate_capacity,
    uint32_t *distance_low,
    uint32_t *distance_high
) {
  lean_object *index = resolve_handle(token, 0);
  lean_object *result;
  lean_object *nearest;
  lean_object *coordinates;
  uint64_t distance;
  uint32_t position;
  if (
    runtime_state != PERFORMANCE_RUNTIME_READY || !index || !index_nearest_fn ||
    !query || !point_id || !result_coordinates || !distance_low || !distance_high ||
    coordinate_capacity < dimensions
  ) return PERFORMANCE_ARGUMENT;
  lean_inc(index);
  result = index_nearest_fn(index, make_i32_array(query, dimensions));
  nearest = unwrap_except(result);
  if (!nearest) return PERFORMANCE_DOMAIN;
  coordinates = lean_ctor_get(nearest, 0);
  *point_id = lean_ctor_get_uint32(nearest, sizeof(void *) + 8);
  distance = lean_ctor_get_uint64(nearest, sizeof(void *));
  *distance_low = (uint32_t)distance;
  *distance_high = (uint32_t)(distance >> 32);
  for (position = 0; position < dimensions; position += 1) {
    result_coordinates[position] = (int32_t)lean_unbox_uint32(lean_array_uget_borrowed(coordinates, position));
  }
  lean_dec(nearest);
  return PERFORMANCE_OK;
}

static uint32_t copy_id_array(lean_object *array, uint32_t *output, uint32_t capacity) {
  uint32_t length = (uint32_t)lean_array_size(array);
  uint32_t index;
  if (length > capacity) return UINT32_MAX;
  for (index = 0; index < length; index += 1) {
    output[index] = lean_unbox_uint32(lean_array_uget_borrowed(array, index));
  }
  return length;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_perf_index_range(
    uint32_t token,
    const int32_t *minimum,
    const int32_t *maximum,
    uint32_t dimensions,
    uint32_t *point_ids,
    uint32_t capacity
) {
  lean_object *index = resolve_handle(token, 0);
  lean_object *result;
  lean_object *ids;
  uint32_t length;
  if (
    runtime_state != PERFORMANCE_RUNTIME_READY || !index || !index_range_fn ||
    !minimum || !maximum || !point_ids
  ) return UINT32_MAX;
  lean_inc(index);
  result = index_range_fn(index, make_i32_array(minimum, dimensions), make_i32_array(maximum, dimensions));
  ids = unwrap_except(result);
  if (!ids) return UINT32_MAX;
  length = copy_id_array(ids, point_ids, capacity);
  lean_dec(ids);
  return length;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_perf_index_insert(
    uint32_t token,
    uint32_t point_id,
    const int32_t *coordinates,
    uint32_t dimensions
) {
  performance_handle_slot *slot = 0;
  lean_object *index = resolve_handle(token, &slot);
  lean_object *point;
  lean_object *result;
  lean_object *updated;
  if (
    runtime_state != PERFORMANCE_RUNTIME_READY || !index || !index_insert_fn ||
    !make_point_fn || !coordinates
  ) return UINT32_MAX;
  point = make_point_fn(point_id, make_i32_array(coordinates, dimensions));
  lean_inc(index);
  result = index_insert_fn(index, point);
  updated = unwrap_except(result);
  if (!updated) return UINT32_MAX;
  lean_dec(slot->object);
  slot->object = updated;
  lean_inc(updated);
  return index_size_fn(updated);
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_perf_consumer_range_checksum(
    uint32_t token,
    const int32_t *minimum,
    const int32_t *maximum,
    uint32_t dimensions,
    uint32_t *point_ids,
    uint32_t capacity,
    uint32_t *checksum_low,
    uint32_t *checksum_high
) {
  lean_object *index = resolve_handle(token, 0);
  lean_object *result;
  lean_object *checksum;
  lean_object *ids;
  uint64_t value;
  uint32_t length;
  if (
    runtime_state != PERFORMANCE_RUNTIME_READY || !index || !range_checksum_fn ||
    !minimum || !maximum || !point_ids || !checksum_low || !checksum_high
  ) return UINT32_MAX;
  lean_inc(index);
  result = range_checksum_fn(index, make_i32_array(minimum, dimensions), make_i32_array(maximum, dimensions));
  checksum = unwrap_except(result);
  if (!checksum) return UINT32_MAX;
  ids = lean_ctor_get(checksum, 0);
  value = lean_ctor_get_uint64(checksum, sizeof(void *));
  length = copy_id_array(ids, point_ids, capacity);
  *checksum_low = (uint32_t)value;
  *checksum_high = (uint32_t)(value >> 32);
  lean_dec(checksum);
  return length;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_perf_index_release(uint32_t token) {
  performance_handle_slot *slot = 0;
  lean_object *index = resolve_handle(token, &slot);
  if (!index) return UINT32_MAX;
  slot->object = 0;
  lean_dec(index);
  live_handles -= 1;
  if (slot->generation == PERFORMANCE_GENERATION_MASK) slot->retired = 1;
  else slot->generation += 1;
  return live_handles;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_perf_runtime_shutdown(void) {
  if (runtime_state == PERFORMANCE_RUNTIME_SHUT_DOWN) return 1;
  if (runtime_state != PERFORMANCE_RUNTIME_READY || live_handles != 0) return 0;
  bridge_lean_runtime_finalize_module();
  runtime_state = PERFORMANCE_RUNTIME_SHUT_DOWN;
  return 1;
}

EMSCRIPTEN_KEEPALIVE uint32_t bridge_perf_runtime_state(void) { return runtime_state; }
EMSCRIPTEN_KEEPALIVE uint32_t bridge_perf_runtime_init_runs(void) { return runtime_init_runs; }
EMSCRIPTEN_KEEPALIVE uint32_t bridge_perf_library_init_runs(void) { return library_init_runs; }
EMSCRIPTEN_KEEPALIVE uint32_t bridge_perf_live_handles(void) { return live_handles; }
EMSCRIPTEN_KEEPALIVE uint32_t bridge_perf_rejected_handles(void) { return rejected_handles; }
