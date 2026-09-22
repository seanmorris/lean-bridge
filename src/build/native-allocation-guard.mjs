/**
 * Check compiler-emitted constructor sizes against the linked Lean allocator.
 *
 * @file
 */

// Include Lean before defining the call-site macro. Its own inline functions
// remain unchanged; only freshly compiled module/adapter C receives the check.
// Use the pinned headers' sizes and allocator configuration, not a guessed
// source-level record layout. Closures use lean_alloc_object, not this allocator.
export const nativeAllocationGuardHeader = `#ifndef LEAN_BRIDGE_NATIVE_ALLOCATION_GUARD_H
#define LEAN_BRIDGE_NATIVE_ALLOCATION_GUARD_H
#include <lean/lean.h>

#if defined(LEAN_SMALL_ALLOCATOR)
#define LB_NATIVE_CTOR_LIMIT LEAN_MAX_SMALL_OBJECT_SIZE
#elif defined(LEAN_MIMALLOC)
#define LB_NATIVE_CTOR_LIMIT MI_SMALL_SIZE_MAX
#else
#define LB_NATIVE_CTOR_LIMIT SIZE_MAX
#endif

#define LB_NATIVE_CTOR_BYTES(n, s) \\
  ((sizeof(lean_ctor_object) + (size_t)(n) * sizeof(void *) + (size_t)(s) \\
    + LEAN_OBJECT_SIZE_DELTA - 1) / LEAN_OBJECT_SIZE_DELTA * LEAN_OBJECT_SIZE_DELTA)
#define lean_alloc_ctor(tag, n, s) \\
  ((void)sizeof(struct { \\
    _Static_assert(__builtin_choose_expr(__builtin_constant_p(n) && __builtin_constant_p(s), 1, 0), \\
      "Lean Bridge: native constructor allocation requires compiler-constant field sizes"); \\
    _Static_assert((uintmax_t)(n) < LEAN_MAX_CTOR_FIELDS, \\
      "Lean Bridge: native constructor exceeds Lean's object-field limit"); \\
    _Static_assert((uintmax_t)(s) < LEAN_MAX_CTOR_SCALARS_SIZE, \\
      "Lean Bridge: native constructor exceeds Lean's scalar-byte limit"); \\
    _Static_assert(LB_NATIVE_CTOR_BYTES(n, s) <= LB_NATIVE_CTOR_LIMIT, \\
      "Lean Bridge: native constructor exceeds the pinned runtime allocator limit"); \\
    unsigned char checked; \\
  }), lean_alloc_ctor((tag), (n), (s)))
#endif
`;
