#include <lean/lean.h>
#include <stdint.h>

typedef lean_object *(*lean_link_box_fn)(uint32_t);
typedef uint32_t (*lean_link_read_fn)(lean_object *);
typedef lean_object *(*lean_link_initializer_fn)(uint8_t);

extern lean_object *lean_link_alpha_box(uint32_t value);
extern uint32_t lean_link_alpha_read(lean_object *box);
extern lean_object *initialize_Alpha(uint8_t builtin);
extern void bridge_register_lean_alpha(
    lean_link_box_fn box,
    lean_link_read_fn read,
    lean_link_initializer_fn initialize
);

__attribute__((constructor))
static void lean_link_alpha_register(void) {
  bridge_register_lean_alpha(
    lean_link_alpha_box,
    lean_link_alpha_read,
    initialize_Alpha
  );
}
