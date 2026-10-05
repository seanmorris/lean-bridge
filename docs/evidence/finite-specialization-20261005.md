# Finite specialization type-surface acceptance

VO1220 milestone, 2026-10-05.

## Accepted boundary

Compiler-backed ordinary-source builds expose configured finite specializations as concrete host functions. Lean resolves each configured leading type, implicit type argument, universe, and immediately following instance dictionary. The generated host API contains no public type parameter or typeclass dictionary.

The npm fixture builds the same Lean project from two relocated roots, reproduces its archives, verifies the component-package receipt, installs the archives offline, and executes the resulting WebAssembly from Node. A strict TypeScript consumer then compiles against the installed declaration file with `skipLibCheck` disabled. Its concrete exports cover an alias, `String`, arbitrary-precision `Nat`, two leading type parameters, and a package-defined `Inhabited UInt32` instance. Invalid host values reject, and the unspecialized generic declaration is absent. The same run now also exercises `Fin 5`; that separately scoped claim is recorded in [npm `Fin n` refinement acceptance](npm-fin-refinements-20261005.md).

The native fixture performs the corresponding acceptance through installed CPAN archives. It exercises both prebuilt and locally compiled XS installation, twelve specializations, aliases, two type parameters, package-defined instances, copied values, resources, callbacks, and closures. The original Lean sources are unavailable during installed execution, and the unspecialized generic declaration is absent.

This evidence promotes only the `generic`, `implicit`, and `instance` signature cells for ordinary-source Node JavaScript, strict Node TypeScript, and Perl. It does not claim reviewed-IR specialization, open generic host dispatch, dependent parameters, default arguments, general proof erasure, or `Subtype` support. The accompanying `Fin` export is governed by its separate refinement record.

## Commands

```sh
source scripts/env.sh
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test --test-name-pattern='finite specializations compile' tests/unlocked-component.test.mjs

export LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl
export LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36
LEAN_BRIDGE_PERL_NATIVE_TEST=1 node --test --test-name-pattern='native finite specializations reproduce' tests/perl-native.test.mjs
```

The npm acceptance produced the component archive SHA-256:

```text
749d6b0a1d96feee043e4997298c49ed8c2269757fd40cb1b786673543843140
```

The retained native CPAN acceptance produced the component archive SHA-256:

```text
d40090b351d5b6084db43f36dae4888132c031b0f379c7ddc1175a92d2cb5181
```
