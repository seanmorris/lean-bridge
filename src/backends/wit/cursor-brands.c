/* Wasmtime represents an embedder resource type by a uint32_t. Allocate the
 * high half once per process, not once per generated package: two components
 * linked into the same store must not accept one another's cursor borrows. */
#include <stdint.h>
#include <stdatomic.h>
uint32_t lean_bridge_wit_cursor_brand_v1(void) {
    static _Atomic uint32_t last=UINT32_C(0x7fffffff);
    uint32_t n=atomic_load(&last);
    while (n!=UINT32_MAX && !atomic_compare_exchange_weak(&last,&n,n+1)) {}
    return n==UINT32_MAX?0:n+1;
}
