#include <lean/lean.h>
#include <stdint.h>

typedef lean_object *(*lean_link_box_fn)(uint32_t);
typedef uint32_t (*lean_link_read_fn)(lean_object *);
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

extern lean_object *lean_link_alpha_box(uint32_t value);
extern uint32_t lean_link_alpha_read(lean_object *box);
extern lean_object *lean_link_alpha_payload(
    uint8_t enabled,
    uint32_t count,
    lean_object *label,
    lean_object *bytes,
    lean_object *values
);
extern lean_object *lean_link_alpha_round_trip(lean_object *payload);
extern uint8_t lean_link_alpha_payload_enabled(lean_object *payload);
extern uint32_t lean_link_alpha_payload_count(lean_object *payload);
extern lean_object *lean_link_alpha_payload_label(lean_object *payload);
extern lean_object *lean_link_alpha_payload_bytes(lean_object *payload);
extern lean_object *lean_link_alpha_payload_values(lean_object *payload);
extern lean_object *initialize_Alpha(uint8_t builtin);
extern void bridge_register_lean_alpha(
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
);

__attribute__((constructor))
static void lean_link_alpha_register(void) {
  bridge_register_lean_alpha(
    lean_link_alpha_box,
    lean_link_alpha_read,
    lean_link_alpha_payload,
    lean_link_alpha_round_trip,
    lean_link_alpha_payload_enabled,
    lean_link_alpha_payload_count,
    lean_link_alpha_payload_label,
    lean_link_alpha_payload_bytes,
    lean_link_alpha_payload_values,
    initialize_Alpha
  );
}
