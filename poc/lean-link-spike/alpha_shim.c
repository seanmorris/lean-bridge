#include <lean/lean.h>
#include <stdint.h>

typedef lean_object *(*lean_link_box_fn)(uint32_t);
typedef uint32_t (*lean_link_read_fn)(lean_object *);

extern lean_object *lean_link_alpha_box(uint32_t value);
extern uint32_t lean_link_alpha_read(lean_object *box);
extern void bridge_register_lean_alpha(
    lean_link_box_fn box,
    lean_link_read_fn read
);

__attribute__((constructor))
static void lean_link_alpha_register(void) {
  bridge_register_lean_alpha(lean_link_alpha_box, lean_link_alpha_read);
}
