# Generated C Backend Evidence

Status: the Alpha Binding IR generates a C11 package that compiles and runs through direct native functions. The runtime adapter used by this test is a native fixture. The real Lean runtime connection remains a later conformance task.

## Generated package

`generateCBindingPackage` validates Binding IR version 3 and emits:

- `include/lean_alpha.h`, the public C11 API;
- `src/lean_alpha.c`, the generated ownership and call wrappers;
- `internal/lean_alpha_runtime.h`, the runtime integration boundary;
- generated package documentation; and
- a manifest tied to the canonical Binding IR SHA-256 hash.

The public header contains no `ccall`, `cwrap`, dispatcher, private bridge symbol, WebAssembly type, numeric runtime handle, or signature token. The internal header declares one typed function pointer for each declaration. It does not expose a generic invoke operation.

## Alpha projection

The same Alpha IR used by the JavaScript generator produces:

```c
typedef struct lean_alpha_payload {
  bool enabled;
  uint32_t count;
  lean_alpha_string label;
  lean_alpha_bytes bytes;
  lean_alpha_array_uint32_span values;
} lean_alpha_payload;

typedef struct lean_alpha_box lean_alpha_box;

lean_alpha_status lean_alpha_box_create(
  uint32_t value,
  lean_alpha_box **out,
  lean_alpha_error *error
);

lean_alpha_status lean_alpha_box_read(
  const lean_alpha_box *self,
  uint32_t *out,
  lean_alpha_error *error
);

void lean_alpha_box_dispose(lean_alpha_box **self);
```

Strings, bytes, and typed spans retain their distinct C types. Each dynamic copied field can carry a release callback when a returned value owns storage. `lean_alpha_payload_clear` releases those fields. Input values can use borrowed storage by leaving the ownership fields empty.

`Box` remains opaque. Its constructor returns an owned pointer. `Box.identity` returns a borrow anchored to the receiver and verifies that the runtime returned the same identity. Disposal consumes the caller's pointer and sets it to null.

`Transform` becomes a typed C callback for host functions. A Lean closure returned by `makeAdder` becomes an opaque owned callable with generated `call` and `dispose` functions. Callback identities and runtime values remain inside the implementation.

Finite generic declarations produce one concrete C function per specialization. The public API carries neither a type token nor an unrestricted generic claim.

## Executed checks

`tests/c-generator.test.mjs` writes the generated package into a fresh directory and compiles it with C11, `-Wall`, `-Wextra`, and `-Werror`. The executable:

- installs one generated runtime table and initializes it once;
- constructs, reads, compares, and disposes an opaque `Box`;
- round-trips a record containing a boolean, unsigned integer, string, bytes, and an array of unsigned integers;
- confirms returned dynamic values use independent storage and release it through generated clear functions;
- passes a normal C callback through a generated function;
- receives an owned callable, invokes it, and disposes it; and
- exercises the generated status and null-argument checks.

The package audit checks the canonical Binding IR hash, required files, public exports, and forbidden public surface. Separate negative fixtures reject Promise delivery and generic declarations without a finite specialization list before files are emitted.

## Current boundary

The test runtime implements the generated internal vtable directly. It proves the host surface, ownership convention, deterministic generation, compile compatibility, and behavior of the generated C layer. It does not prove that the C backend can call the current Lean Wasm private symbols. That connection requires a generated runtime adapter and cross-language conformance vectors against the real Alpha implementation.
