#include <emscripten/emscripten.h>
#include <emscripten/heap.h>
#include <lean/lean.h>
#include <stdint.h>
#include <string.h>

typedef lean_object *(*lean_link_box_fn)(uint32_t);
typedef uint32_t (*lean_link_read_fn)(lean_object *);
typedef lean_object *(*lean_link_identity_fn)(lean_object *);
typedef lean_object *(*lean_link_payload_fn)(
    uint8_t,
    uint32_t,
    lean_object *,
    lean_object *,
    lean_object *
);
typedef lean_object *(*lean_link_round_trip_fn)(lean_object *);
typedef uint8_t (*lean_link_payload_enabled_fn)(lean_object *);
typedef uint32_t (*lean_link_payload_count_fn)(lean_object *);
typedef lean_object *(*lean_link_payload_object_fn)(lean_object *);
typedef lean_object *(*lean_link_initializer_fn)(uint8_t);

extern lean_object *initialize_Init(uint8_t builtin);
extern void lean_initialize_runtime_module(void);
extern void bridge_lean_runtime_finalize_module(void);

enum bridge_lean_runtime_state {
  BRIDGE_LEAN_RUNTIME_COLD = 0,
  BRIDGE_LEAN_RUNTIME_INITIALIZING = 1,
  BRIDGE_LEAN_RUNTIME_READY = 2,
  BRIDGE_LEAN_RUNTIME_FAILED = 3,
  BRIDGE_LEAN_RUNTIME_SHUT_DOWN = 4,
};

static lean_link_box_fn alpha_box = 0;
static lean_link_read_fn alpha_read = 0;
static lean_link_payload_fn alpha_payload = 0;
static lean_link_round_trip_fn alpha_round_trip = 0;
static lean_link_payload_enabled_fn alpha_payload_enabled = 0;
static lean_link_payload_count_fn alpha_payload_count = 0;
static lean_link_payload_object_fn alpha_payload_label = 0;
static lean_link_payload_object_fn alpha_payload_bytes = 0;
static lean_link_payload_object_fn alpha_payload_values = 0;
static lean_link_identity_fn beta_identity = 0;
static lean_link_identity_fn gamma_identity = 0;
static lean_link_read_fn beta_read = 0;
static lean_link_read_fn gamma_read = 0;
static lean_link_initializer_fn alpha_initializer = 0;
static lean_link_initializer_fn beta_initializer = 0;
static lean_link_initializer_fn gamma_initializer = 0;
static uint32_t runtime_state = BRIDGE_LEAN_RUNTIME_COLD;
static uint32_t runtime_init_runs = 0;
static uint32_t library_init_runs = 0;
static uint32_t active_frames = 0;

enum bridge_lean_handle_layout {
  BRIDGE_LEAN_HANDLE_SLOT_BITS = 12,
  BRIDGE_LEAN_HANDLE_GENERATION_BITS = 12,
  BRIDGE_LEAN_HANDLE_SLOT_MASK = (1u << BRIDGE_LEAN_HANDLE_SLOT_BITS) - 1u,
  BRIDGE_LEAN_HANDLE_GENERATION_MASK =
    (1u << BRIDGE_LEAN_HANDLE_GENERATION_BITS) - 1u,
  BRIDGE_LEAN_HANDLE_KIND_SHIFT = 24,
  BRIDGE_LEAN_HANDLE_SIDE_SHIFT = 31,
  BRIDGE_LEAN_HANDLE_KIND_MASK = 0x7fu,
  BRIDGE_LEAN_HANDLE_CAPACITY = 1024,
  BRIDGE_LEAN_HANDLE_SIDE_LEAN = 0,
  BRIDGE_LEAN_HANDLE_KIND_ALPHA_BOX = 1,
};

typedef struct bridge_lean_handle_slot {
  lean_object *object;
  uint16_t generation;
  uint8_t kind;
  uint8_t retired;
} bridge_lean_handle_slot;

static bridge_lean_handle_slot handle_slots[BRIDGE_LEAN_HANDLE_CAPACITY];
static uint32_t live_handles = 0;
static uint32_t rejected_handles = 0;
static uint32_t retired_handle_slots = 0;

static uint32_t bridge_lean_handle_encode(
    uint32_t slot,
    uint32_t generation,
    uint32_t kind
) {
  return
    (BRIDGE_LEAN_HANDLE_SIDE_LEAN << BRIDGE_LEAN_HANDLE_SIDE_SHIFT) |
    ((kind & BRIDGE_LEAN_HANDLE_KIND_MASK) << BRIDGE_LEAN_HANDLE_KIND_SHIFT) |
    ((generation & BRIDGE_LEAN_HANDLE_GENERATION_MASK)
      << BRIDGE_LEAN_HANDLE_SLOT_BITS) |
    (slot + 1u);
}

static lean_object *bridge_lean_handle_resolve(
    uint32_t token,
    uint32_t expected_kind
) {
  uint32_t encoded_slot = token & BRIDGE_LEAN_HANDLE_SLOT_MASK;
  uint32_t generation =
    (token >> BRIDGE_LEAN_HANDLE_SLOT_BITS) &
    BRIDGE_LEAN_HANDLE_GENERATION_MASK;
  uint32_t kind =
    (token >> BRIDGE_LEAN_HANDLE_KIND_SHIFT) & BRIDGE_LEAN_HANDLE_KIND_MASK;
  uint32_t side = token >> BRIDGE_LEAN_HANDLE_SIDE_SHIFT;
  bridge_lean_handle_slot *slot;

  if (
    side != BRIDGE_LEAN_HANDLE_SIDE_LEAN ||
    kind != expected_kind ||
    encoded_slot == 0 ||
    encoded_slot > BRIDGE_LEAN_HANDLE_CAPACITY ||
    generation == 0
  ) {
    rejected_handles += 1;
    return 0;
  }
  slot = &handle_slots[encoded_slot - 1u];
  if (
    !slot->object ||
    slot->retired ||
    slot->kind != kind ||
    slot->generation != generation
  ) {
    rejected_handles += 1;
    return 0;
  }
  return slot->object;
}

static uint32_t bridge_lean_handle_retain(
    lean_object *object,
    uint32_t kind
) {
  uint32_t index;

  if (!object) return 0;
  for (index = 0; index < BRIDGE_LEAN_HANDLE_CAPACITY; index += 1) {
    bridge_lean_handle_slot *slot = &handle_slots[index];
    if (slot->object || slot->retired) continue;
    if (slot->generation == 0) slot->generation = 1;
    slot->object = object;
    slot->kind = (uint8_t)kind;
    live_handles += 1;
    return bridge_lean_handle_encode(index, slot->generation, kind);
  }
  lean_dec(object);
  return 0;
}

static uint32_t bridge_lean_handle_release(
    uint32_t token,
    uint32_t expected_kind
) {
  uint32_t encoded_slot = token & BRIDGE_LEAN_HANDLE_SLOT_MASK;
  lean_object *object = bridge_lean_handle_resolve(token, expected_kind);
  bridge_lean_handle_slot *slot;

  if (!object) return UINT32_MAX;
  slot = &handle_slots[encoded_slot - 1u];
  slot->object = 0;
  slot->kind = 0;
  lean_dec(object);
  live_handles -= 1;
  if (slot->generation == BRIDGE_LEAN_HANDLE_GENERATION_MASK) {
    slot->retired = 1;
    retired_handle_slots += 1;
  } else {
    slot->generation += 1;
  }
  return live_handles;
}
#if defined(BRIDGE_LEAN_RUNTIME_TEST_HOOKS)
static uint32_t force_init_error = 0;

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_test_lean_runtime_force_init_error(void) {
  if (runtime_state != BRIDGE_LEAN_RUNTIME_COLD) return 0;
  force_init_error = 1;
  return 1;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_test_lean_heap_size(void) {
  return (uint32_t)emscripten_get_heap_size();
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_test_lean_grow_heap(void) {
  size_t before = emscripten_get_heap_size();
  size_t requested = before + (64u * 1024u);
  if (!emscripten_resize_heap(requested)) return 0;
  return (uint32_t)emscripten_get_heap_size();
}
#endif

static uint32_t bridge_run_library_initializer(
    lean_link_initializer_fn initialize
) {
  lean_object *result;

  if (!initialize) return 1;
  result = initialize(1);
  library_init_runs += 1;
  if (lean_io_result_is_error(result)) {
    lean_dec(result);
    return 0;
  }
  lean_dec(result);
  return 1;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_runtime_init(void) {
  lean_object *result;

  if (runtime_state == BRIDGE_LEAN_RUNTIME_READY) return 1;
  if (runtime_state != BRIDGE_LEAN_RUNTIME_COLD) return 0;

  runtime_state = BRIDGE_LEAN_RUNTIME_INITIALIZING;
  runtime_init_runs += 1;
  lean_initialize_runtime_module();
#if defined(BRIDGE_LEAN_RUNTIME_TEST_HOOKS)
  if (force_init_error) {
    result = lean_io_result_mk_error(
      lean_mk_io_user_error(lean_mk_string("forced Init failure probe"))
    );
  } else {
    result = initialize_Init(1);
  }
#else
  result = initialize_Init(1);
#endif
  if (lean_io_result_is_error(result)) {
    lean_dec(result);
    runtime_state = BRIDGE_LEAN_RUNTIME_FAILED;
    return 0;
  }
  lean_dec(result);
  if (
    !bridge_run_library_initializer(alpha_initializer) ||
    !bridge_run_library_initializer(beta_initializer) ||
    !bridge_run_library_initializer(gamma_initializer)
  ) {
    runtime_state = BRIDGE_LEAN_RUNTIME_FAILED;
    return 0;
  }
  lean_io_mark_end_initialization();
  runtime_state = BRIDGE_LEAN_RUNTIME_READY;
  return 1;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_runtime_status(void) {
  return runtime_state;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_runtime_init_runs(void) {
  return runtime_init_runs;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_library_init_runs(void) {
  return library_init_runs;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_runtime_shutdown(void) {
  if (runtime_state == BRIDGE_LEAN_RUNTIME_SHUT_DOWN) return 1;
  if (runtime_state == BRIDGE_LEAN_RUNTIME_COLD) {
    runtime_state = BRIDGE_LEAN_RUNTIME_SHUT_DOWN;
    return 1;
  }
  if (runtime_state != BRIDGE_LEAN_RUNTIME_READY || live_handles != 0) return 0;

  runtime_state = BRIDGE_LEAN_RUNTIME_SHUT_DOWN;
  bridge_lean_runtime_finalize_module();
  return 1;
}

EMSCRIPTEN_KEEPALIVE
void bridge_register_lean_alpha(
    lean_link_box_fn box,
    lean_link_read_fn read,
    lean_link_payload_fn payload,
    lean_link_round_trip_fn round_trip,
    lean_link_payload_enabled_fn payload_enabled,
    lean_link_payload_count_fn payload_count,
    lean_link_payload_object_fn payload_label,
    lean_link_payload_object_fn payload_bytes,
    lean_link_payload_object_fn payload_values,
    lean_link_initializer_fn initialize
) {
  alpha_box = box;
  alpha_read = read;
  alpha_payload = payload;
  alpha_round_trip = round_trip;
  alpha_payload_enabled = payload_enabled;
  alpha_payload_count = payload_count;
  alpha_payload_label = payload_label;
  alpha_payload_bytes = payload_bytes;
  alpha_payload_values = payload_values;
  alpha_initializer = initialize;
}

EMSCRIPTEN_KEEPALIVE
void bridge_register_lean_beta(
    lean_link_identity_fn identity,
    lean_link_read_fn read,
    lean_link_initializer_fn initialize
) {
  beta_identity = identity;
  beta_read = read;
  beta_initializer = initialize;
}

EMSCRIPTEN_KEEPALIVE
void bridge_register_lean_gamma(
    lean_link_identity_fn identity,
    lean_link_read_fn read,
    lean_link_initializer_fn initialize
) {
  gamma_identity = identity;
  gamma_read = read;
  gamma_initializer = initialize;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_has_lean_alpha(void) {
  return
    alpha_box != 0 &&
    alpha_read != 0 &&
    alpha_payload != 0 &&
    alpha_round_trip != 0 &&
    alpha_payload_enabled != 0 &&
    alpha_payload_count != 0 &&
    alpha_payload_label != 0 &&
    alpha_payload_bytes != 0 &&
    alpha_payload_values != 0;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_has_lean_beta(void) {
  return beta_identity != 0 && beta_read != 0;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_has_lean_gamma(void) {
  return gamma_identity != 0 && gamma_read != 0;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_alpha_make(uint32_t value) {
  if (runtime_state != BRIDGE_LEAN_RUNTIME_READY || !alpha_box) return 0;
  return bridge_lean_handle_retain(
    alpha_box(value),
    BRIDGE_LEAN_HANDLE_KIND_ALPHA_BOX
  );
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_alpha_read(uint32_t handle) {
  lean_object *box;

  if (runtime_state != BRIDGE_LEAN_RUNTIME_READY || !alpha_read || handle == 0) {
    return UINT32_MAX;
  }
  box = bridge_lean_handle_resolve(
    handle,
    BRIDGE_LEAN_HANDLE_KIND_ALPHA_BOX
  );
  if (!box) return UINT32_MAX;
  /* The generated export consumes its argument; retain around a borrowed read. */
  lean_inc(box);
  return alpha_read(box);
}

enum bridge_lean_frame_status {
  BRIDGE_LEAN_FRAME_OK = 0,
  BRIDGE_LEAN_FRAME_ABI_VERSION = 1,
  BRIDGE_LEAN_FRAME_BYTE_SIZE = 2,
  BRIDGE_LEAN_FRAME_RUNTIME = 3,
  BRIDGE_LEAN_FRAME_BOOL = 4,
  BRIDGE_LEAN_FRAME_LIMIT = 5,
  BRIDGE_LEAN_FRAME_POINTER_RANGE = 6,
  BRIDGE_LEAN_FRAME_OUTPUT_CAPACITY = 7,
  BRIDGE_LEAN_FRAME_INTERNAL = 8,
};

enum bridge_lean_frame_limits {
  BRIDGE_LEAN_FRAME_ABI_V1 = 1,
  BRIDGE_LEAN_FRAME_MAX_COPY_BYTES = 1024 * 1024,
  BRIDGE_LEAN_FRAME_MAX_ARRAY_LENGTH = 64 * 1024,
};

typedef struct bridge_lean_value_frame_v1 {
  uint32_t abi_version;
  uint32_t byte_size;
  uint32_t status;
  uint32_t detail;
  uint32_t enabled;
  uint32_t count;
  uint32_t label_ptr;
  uint32_t label_length;
  uint32_t label_capacity;
  uint32_t bytes_ptr;
  uint32_t bytes_length;
  uint32_t bytes_capacity;
  uint32_t values_ptr;
  uint32_t values_length;
  uint32_t values_capacity;
} bridge_lean_value_frame_v1;

static uint32_t bridge_lean_frame_fail(
    bridge_lean_value_frame_v1 *frame,
    uint32_t status,
    uint32_t detail
) {
  frame->status = status;
  frame->detail = detail;
  return status;
}

static uint8_t bridge_lean_range_is_valid(uint32_t ptr, uint32_t length) {
  size_t heap_size = emscripten_get_heap_size();
  size_t start = (size_t)ptr;
  size_t size = (size_t)length;
  return start <= heap_size && size <= heap_size - start;
}

static uint32_t bridge_lean_alpha_round_trip_value(uint32_t frame_address) {
  bridge_lean_value_frame_v1 *frame;
  lean_object *label;
  lean_object *bytes;
  lean_object *values;
  lean_object *payload;
  lean_object *result;
  lean_object *result_label;
  lean_object *result_bytes;
  lean_object *result_values;
  size_t label_length;
  size_t bytes_length;
  size_t values_length;
  uint8_t enabled;
  uint32_t count;
  uint32_t index;

  if (!bridge_lean_range_is_valid(
      frame_address,
      (uint32_t)sizeof(bridge_lean_value_frame_v1)
  )) {
    return BRIDGE_LEAN_FRAME_POINTER_RANGE;
  }
  frame = (bridge_lean_value_frame_v1 *)(uintptr_t)frame_address;
  frame->status = BRIDGE_LEAN_FRAME_OK;
  frame->detail = 0;

  if (frame->abi_version != BRIDGE_LEAN_FRAME_ABI_V1) {
    return bridge_lean_frame_fail(
      frame,
      BRIDGE_LEAN_FRAME_ABI_VERSION,
      frame->abi_version
    );
  }
  if (frame->byte_size != sizeof(bridge_lean_value_frame_v1)) {
    return bridge_lean_frame_fail(
      frame,
      BRIDGE_LEAN_FRAME_BYTE_SIZE,
      frame->byte_size
    );
  }
  if (frame->enabled > 1) {
    return bridge_lean_frame_fail(
      frame,
      BRIDGE_LEAN_FRAME_BOOL,
      frame->enabled
    );
  }
  if (
    frame->label_length > BRIDGE_LEAN_FRAME_MAX_COPY_BYTES ||
    frame->bytes_length > BRIDGE_LEAN_FRAME_MAX_COPY_BYTES ||
    frame->values_length > BRIDGE_LEAN_FRAME_MAX_ARRAY_LENGTH
  ) {
    return bridge_lean_frame_fail(frame, BRIDGE_LEAN_FRAME_LIMIT, 0);
  }
  if (
    frame->label_length > frame->label_capacity ||
    frame->bytes_length > frame->bytes_capacity ||
    frame->values_length > frame->values_capacity
  ) {
    return bridge_lean_frame_fail(
      frame,
      BRIDGE_LEAN_FRAME_OUTPUT_CAPACITY,
      0
    );
  }
  if (
    !bridge_lean_range_is_valid(frame->label_ptr, frame->label_capacity) ||
    !bridge_lean_range_is_valid(frame->bytes_ptr, frame->bytes_capacity) ||
    frame->values_capacity > UINT32_MAX / sizeof(uint32_t) ||
    !bridge_lean_range_is_valid(
      frame->values_ptr,
      frame->values_capacity * (uint32_t)sizeof(uint32_t)
    )
  ) {
    return bridge_lean_frame_fail(
      frame,
      BRIDGE_LEAN_FRAME_POINTER_RANGE,
      0
    );
  }

  label = lean_mk_string_from_bytes(
    (const char *)(uintptr_t)frame->label_ptr,
    frame->label_length
  );
  bytes = lean_alloc_sarray(1, frame->bytes_length, frame->bytes_length);
  if (frame->bytes_length != 0) {
    memcpy(
      lean_sarray_cptr(bytes),
      (const void *)(uintptr_t)frame->bytes_ptr,
      frame->bytes_length
    );
  }
  values = lean_alloc_array(frame->values_length, frame->values_length);
  for (index = 0; index < frame->values_length; index += 1) {
    const uint32_t *input = (const uint32_t *)(uintptr_t)frame->values_ptr;
    lean_array_set_core(values, index, lean_box_uint32(input[index]));
  }

  payload = alpha_payload(
    (uint8_t)frame->enabled,
    frame->count,
    label,
    bytes,
    values
  );
  result = alpha_round_trip(payload);
  if (!result || lean_is_scalar(result)) {
    if (result) lean_dec(result);
    return bridge_lean_frame_fail(frame, BRIDGE_LEAN_FRAME_INTERNAL, 0);
  }

  lean_inc(result);
  enabled = alpha_payload_enabled(result);
  lean_inc(result);
  count = alpha_payload_count(result);
  lean_inc(result);
  result_label = alpha_payload_label(result);
  lean_inc(result);
  result_bytes = alpha_payload_bytes(result);
  lean_inc(result);
  result_values = alpha_payload_values(result);
  lean_dec(result);

  label_length = lean_string_size(result_label) - 1;
  bytes_length = lean_sarray_size(result_bytes);
  values_length = lean_array_size(result_values);
  if (
    label_length > frame->label_capacity ||
    bytes_length > frame->bytes_capacity ||
    values_length > frame->values_capacity
  ) {
    lean_dec(result_label);
    lean_dec(result_bytes);
    lean_dec(result_values);
    return bridge_lean_frame_fail(
      frame,
      BRIDGE_LEAN_FRAME_OUTPUT_CAPACITY,
      0
    );
  }

  if (label_length != 0) {
    memcpy(
      (void *)(uintptr_t)frame->label_ptr,
      lean_string_cstr(result_label),
      label_length
    );
  }
  if (bytes_length != 0) {
    memcpy(
      (void *)(uintptr_t)frame->bytes_ptr,
      lean_sarray_cptr(result_bytes),
      bytes_length
    );
  }
  for (index = 0; index < values_length; index += 1) {
    uint32_t *output = (uint32_t *)(uintptr_t)frame->values_ptr;
    output[index] = lean_unbox_uint32(
      lean_array_get_core(result_values, index)
    );
  }

  frame->enabled = enabled;
  frame->count = count;
  frame->label_length = (uint32_t)label_length;
  frame->bytes_length = (uint32_t)bytes_length;
  frame->values_length = (uint32_t)values_length;
  lean_dec(result_label);
  lean_dec(result_bytes);
  lean_dec(result_values);
  return BRIDGE_LEAN_FRAME_OK;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_alpha_round_trip(uint32_t frame_address) {
  uint32_t status;

  if (
    runtime_state != BRIDGE_LEAN_RUNTIME_READY ||
    !alpha_payload ||
    !alpha_round_trip
  ) {
    return BRIDGE_LEAN_FRAME_RUNTIME;
  }
  active_frames += 1;
  status = bridge_lean_alpha_round_trip_value(frame_address);
  active_frames -= 1;
  return status;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_active_frames(void) {
  return active_frames;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_handle_identity(uint32_t handle) {
  return bridge_lean_handle_resolve(
    handle,
    BRIDGE_LEAN_HANDLE_KIND_ALPHA_BOX
  ) ? handle : 0;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_cross_library_identity(uint32_t handle) {
  lean_object *original;
  lean_object *after_beta;
  lean_object *after_gamma;
  uint32_t alpha_value;
  uint32_t beta_value;
  uint32_t gamma_value;
  uint32_t result;

  if (
    runtime_state != BRIDGE_LEAN_RUNTIME_READY ||
    handle == 0 ||
    !alpha_read ||
    !beta_identity ||
    !beta_read ||
    !gamma_identity ||
    !gamma_read
  ) {
    return 0;
  }

  original = bridge_lean_handle_resolve(
    handle,
    BRIDGE_LEAN_HANDLE_KIND_ALPHA_BOX
  );
  if (!original) return 0;
  lean_inc(original);
  alpha_value = alpha_read(original);
  lean_inc(original);
  beta_value = beta_read(original);
  lean_inc(original);
  gamma_value = gamma_read(original);
  lean_inc(original);
  after_beta = beta_identity(original);
  after_gamma = gamma_identity(after_beta);
  result = (
    after_gamma == original &&
    alpha_value == beta_value &&
    beta_value == gamma_value
  ) ? handle : 0;
  lean_dec(after_gamma);
  return result;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_release(uint32_t handle) {
  return bridge_lean_handle_release(
    handle,
    BRIDGE_LEAN_HANDLE_KIND_ALPHA_BOX
  );
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_live_handles(void) {
  return live_handles;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_rejected_handles(void) {
  return rejected_handles;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_retired_handle_slots(void) {
  return retired_handle_slots;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_handle_capacity(void) {
  return BRIDGE_LEAN_HANDLE_CAPACITY;
}
