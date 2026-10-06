# `Fin n` acceptance for Rust, Ruby, .NET, Java, Kotlin, native PHP and WIT/WASI packages

VO1425 milestone under VO1220, 2026-10-06. It extends the [C and C++ acceptance](native-fin-20261005.md).

## Accepted boundary

Ordinary-source packages for these hosts accept top-level parameters and results whose elaborated Lean type is `Fin n`, or a transparent alias of `Fin n`, when `n` reduces to a closed natural-number literal. The value crosses as `Nat` in each host's existing exact integer type. `Fin` inside containers, records, variants, callbacks and reviewed Binding IR is still rejected.

Each package bundles the same native adapter as the C package. That adapter compares the caller's limbs with the exact bound before any argument is converted or Lean is called, and the compiled Lean adapter checks the bound again before it constructs `Fin`. A value at or above its bound fails the call with the host's usual error for an invalid argument, whose message names the parameter and bound, for example `arg0 is not below its Fin 10 bound`. Parameters are named `arg0`, `arg1` and so on.

| Host | Value type | At or above the bound |
| --- | --- | --- |
| Rust | `BigUint` | `Err(Error::Native { code: 1, .. })` |
| Ruby | `Integer` | `RangeError` |
| .NET | `System.Numerics.BigInteger` | `ArgumentException` |
| Java and Kotlin | `java.math.BigInteger` | `IllegalArgumentException` |
| Native PHP | `Brick\\Math\\BigInteger` | `LeanBridgeError` with code 1 |
| WIT/WASI | `list<u32>` limbs | Wasmtime call error; result slot unchanged |

Generated documentation states each bound from the declaration's checked `lean-lang.org/refinements` metadata, never from the erased `Nat` type.

## Installed evidence

Each test builds the [fixture](../../tests/fixtures/onboarding/native-fin/NativeFin.lean) for the C target and one host from two clean roots, requires byte-identical archives, verifies the package-set receipt, removes the producer, and installs the host package offline without a Lean or C compiler. The consumer checks `Fin 0`, `Fin 1`, `Fin 10`, an alias of `Fin 300` and a 2^70 bound: endpoints, the bound and values beyond it, exact results, a result-only `Fin 7`, a three-argument call that rejects its `Fin` argument and leaves caller data unchanged, and 1,000 rejection and recovery cycles. It runs again after the installation is relocated. The JVM test compiles a Java consumer and a Kotlin consumer separately against the one installed JAR.

Each test also extracts the C archive from the same build and requires the host package's bundled native libraries to be byte-identical to it. The Rust test additionally runs a probe under an `LD_PRELOAD` interposer in the consumer process: valid calls reach the adapter and the Lean source, rejected public calls reach neither, and a raw invalid adapter call reaches only the adapter. The other hosts load their bundled libraries privately, so dispatch is not counted there.

These runs used revision `d6d6eb4` on Debian 12 (glibc 2.36).

### Rust crate

`LEAN_BRIDGE_RUST_FIN_TEST=1 node --test tests/rust-fin.test.mjs` passed 3 of 3 tests; the installed consumer ran 2021 checks. Both builds produced:

```text
b5f0b54cf628a3667e2071f01aed3b6084942a85e7ee47684fa68111011e2976  archives/native-fin-1.0.0-c.tar.gz
f57d39367e1c5872d1d1c51952d6d1a05c1eee195194267d872f705e66f803ff  archives/native-fin-1.0.0.crate
```

### Ruby gem

`LEAN_BRIDGE_RUBY_FIN_TEST=1 node --test tests/ruby-fin.test.mjs` passed 3 of 3 tests; the installed consumer ran 2029 checks. Both builds produced:

```text
b847ad9250e92ef75bc4ecb58aae6985eb5d4485f67c6885b55c0c88e5cdcc8f  archives/native-fin-1.0.0-c.tar.gz
fbb9df51d0622037ef78cd46bb6300b8162baa50100542be6c5360cc46185666  archives/native-fin-1.0.0-x86_64-linux.gem
```

### .NET NuGet package

`LEAN_BRIDGE_DOTNET_FIN_TEST=1 node --test tests/dotnet-fin.test.mjs` passed 3 of 3 tests; the installed consumer ran 2022 checks. Both builds produced:

```text
2811059e8384cce91eff92975cbdb44d095d7637497bbf7f7ad5b7b85e58590f  archives/native-fin-1.0.0-c.tar.gz
3b94d488be015689bb2be70ca5cf5eb7c802e49e7da823a2eae549a0c2beba21  archives/native-fin.1.0.0.nupkg
```

### Java and Kotlin Maven JAR

`LEAN_BRIDGE_JVM_FIN_TEST=1 node --test tests/jvm-fin.test.mjs` passed 3 of 3 tests; the installed Java and Kotlin consumers ran 2023 and 2022 checks. Both builds produced:

```text
36c57cdd178bcb005414b632966430aa9797a42793b2f266ccb9506500f6a485  archives/native-fin-1.0.0-c.tar.gz
aad78d19c04c2e25738096480bf0cd11c79a770c6a7cac6f99575683f0043deb  archives/native-fin-1.0.0.jar
518be6a0ff402b5d23e937bd883909caf02fd09e523deef3df546cc5cdb4265f  archives/native-fin-1.0.0.pom
```

### native PHP Composer archive

`LEAN_BRIDGE_PHP_FIN_TEST=1 node --test tests/php-fin.test.mjs` passed 3 of 3 tests; the installed consumer ran 2028 checks. Both builds produced:

```text
da86179501f71861c4c8786a4a4142d2f13c1aaac21682fa4729d4e7a63e938c  archives/lean-bridge-fixtures-native-fin-1.0.0-linux-x86_64.zip
ff0a3b96b0e3c32852b3fec130bc1ba855118452b7650c9b4605e4f8d95ac058  archives/native-fin-1.0.0-c.tar.gz
```

### WIT/WASI Wasmtime host package

`LEAN_BRIDGE_WIT_FIN_TEST=1 node --test tests/wit-fin.test.mjs` passed 3 of 3 tests; the installed consumer ran 2027 checks. Both builds produced:

```text
0ff1ce3032bb581eedc63a8e348e1657c6410c9d04cc703bfeba8a737e5a0358  archives/nativefin-1.0.0-c.tar.gz
523363a1f299b8ab041235df11a68c3a276ba8d2df59a8682d5c989d36999286  archives/nativefin-1.0.0-wit-wasi.tar.gz
```

## Not covered

- Python wheels and CPAN packages use the same checks and have tests, but their installers require glibc 2.38, which the machine used here lacks. Their installed acceptance is not recorded, and the type-surface inventory does not list them.
- Nested, nominal and callback `Fin`, `Subtype`, reviewed Binding IR and browser profiles are outside this milestone.
