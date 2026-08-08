#include <lean/lean.h>

typedef lean_object *(*lean_link_identity_fn)(lean_object *);
typedef uint32_t (*lean_link_read_fn)(lean_object *);
typedef lean_object *(*lean_link_initializer_fn)(uint8_t);

extern lean_object *lean_link_beta_identity(lean_object *box);
extern uint32_t lean_link_beta_read(lean_object *box);
extern void bridge_register_lean_beta(
    lean_link_identity_fn identity,
    lean_link_read_fn read,
    lean_link_initializer_fn initialize
);

__attribute__((constructor))
static void lean_link_beta_register(void) {
  /* Beta's generated identity/read code has no initialization work. */
  bridge_register_lean_beta(
    lean_link_beta_identity,
    lean_link_beta_read,
    (lean_link_initializer_fn)0
  );
}
