/* One observation slot. Does not know about Perl, classes or identity. */
#include <lean/lean.h>
#include <stdlib.h>
extern void lean_initialize_runtime_module(void);
extern lean_object *initialize_Init(uint8_t);
static lean_object *held;
void witness_start(void) {
  static int initialized;
  if (initialized) return;
  lean_initialize_runtime_module();
  lean_object *r=initialize_Init(1); if (!lean_io_result_is_ok(r)) abort();
  lean_dec(r); lean_io_mark_end_initialization(); initialized=1;
}
void witness_save(lean_object *v) {
  if (v) lean_inc(v);
  if (held) lean_dec(held);
  held=v;
}
lean_object *witness_value(void) { return held; }
