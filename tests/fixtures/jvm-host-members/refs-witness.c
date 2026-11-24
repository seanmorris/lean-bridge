/* A single observation slot for two separately linked test components. It
   retains exactly the Lean value supplied by the first component; it never
   wraps Java objects, decides identity, or looks up anything by object. */
#include <lean/lean.h>
static lean_object *saved;
void witness_save(lean_object *v) {
    if (v) lean_inc(v);
    if (saved) lean_dec(saved);
    saved = v;
}
lean_object *witness_value(void) { return saved; }
