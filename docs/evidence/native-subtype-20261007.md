# Author-checked `Subtype` values at native package boundaries

VO1428 under VO1220, 2026-10-07. It extends the [npm Subtype acceptance](npm-subtype-20261005.md) to the native targets that share the C-family adapter.

## Accepted boundary

Ordinary-source native packages accept top-level parameters and results whose type is `Subtype p` over a primitive base, including heap-backed `Nat`, `Int`, `String` and `ByteArray`, when the export contract names a checked constructor (`"refinement": { "constructor": "Library.checkedWord" }`). The extractor verifies the constructor as it does for npm: it belongs to a selected module, takes one explicit value of the exact base, returns `Option` of the exact subtype, and its selected-module dependencies are not unsafe, partial, foreign or replaced with `implemented_by` code.

The host passes the base value. The bundled C adapter validates every argument's structure and every `Fin` bound first, then runs one exported Lean validator per checked parameter, in parameter order, on a fresh conversion that the validator owns; a value the constructor rejects fails the call with the invalid-argument status and the message `argN was rejected by Library.checkedWord`, before the user export runs and with inputs and outputs unchanged. The call adapter then converts again and constructs each subtype through the constructor inside a decidable branch, calls the export once with the constructed values, and projects a subtype result through `.val`. A valid call therefore runs each constructor twice and the export once; a normalizing constructor changes what the export sees.

`Subtype` inside arrays, lists, options, record and variant fields, callbacks, products and `Except`, nominal carriers and reviewed Binding IR stays rejected at the Lean source, as do a missing or wrong-base constructor; a build that selects `cpan` for an export with a checked `Subtype`, or CPAN packaging of such verified staging, fails with `native-refinements-unsupported`.

The [fixture](../../tests/fixtures/onboarding/native-subtype/Subtypes.lean) exports `shout : Word → Word` (nonempty `String`), `half : Even → Nat`, `scale : Int → Small → Int` (a checked argument after an unchecked one), `head : Payload → UInt8` (nonempty `ByteArray`), `pad : Nat → Even` (result only), `join : Word → Word → Word`, `clamp : Bounded → Nat` (a normalizing constructor returning `min value 100`) and `mix : Even → Fin 10 → Nat`.

## Installed evidence

Each run builds the fixture from two clean roots for the selected targets, requires byte-identical archives, verifies the package-set receipt, removes the producer, and installs each package offline without a Lean or C compiler. The consumer checks accepted values (Unicode, embedded NUL, 2^100, both ends of the Int range), each rejection message, the empty string, odd and negative numbers, empty bytes, the second of two checked arguments rejected after the first passed, caller data and outputs left unchanged, `clamp(250)` returning 100, the `Fin` bound rejected before the constructor runs, and 1,000 rejection and recovery cycles.

The C run also compiles an `LD_PRELOAD` interposer and a probe. It counts the Lean source, the exported adapter and the exported validator separately: a valid public call reaches validator, adapter and source once; a rejected public value reaches only its validator; a raw invalid adapter call reaches only the adapter and returns `none`; a raw valid call reaches adapter and source. The probe then runs three batches of 20,000 accepted, rejected and late-rejected heap-backed calls and reads the process's resident size after each (flat within 1 MiB after the first batch), and finally leaks 200,000 adapter results on purpose as the positive control (the resident size grows by more than 4 MiB).

These runs used revision `8ff62bf` on Debian 12 (glibc 2.36).

### C and C++

`LEAN_BRIDGE_SUBTYPE_PROFILES=c,cpp node --test tests/native-subtype.test.mjs` passed; the installed C and C++ consumers ran 2026 and 2019 checks. Both builds produced:

```text
feda0166f593ea0fde5b179e0a6a8f81db7d6ccc3025081d3783e93c8c814deb  archives/subtypes-1.0.0-c.tar.gz
1cad26e91efe78fc9258fe169375329309906c79641b9e30aec781b1a95dcbc9  archives/subtypes-1.0.0-cpp.tar.gz
```

### .NET

`LEAN_BRIDGE_SUBTYPE_PROFILES=dotnet node --test tests/native-subtype.test.mjs` passed; the installed consumer ran 2016 checks. Both builds produced:

```text
c67fb3153e382e65c0ef0e862450ca40de79fec71cd572e067301fc10691a732  archives/Subtypes.Api.1.0.0.nupkg
```

### Java and Kotlin

`LEAN_BRIDGE_SUBTYPE_PROFILES=java,kotlin node --test tests/native-subtype.test.mjs` passed; the installed Java and Kotlin consumers ran 2016 and 2015 checks. Both builds produced:

```text
0d1b716795ff3bc5faf71221aa93fa35915249a0bc57b290b2d7b333b3d4556b  archives/subtypes-1.0.0.jar
d0e18b228669bcf5a74e2dde908ba52abbc46dccf3aad33fdbc550bab73f34c8  archives/subtypes-1.0.0.pom
```

### native PHP

`LEAN_BRIDGE_SUBTYPE_PROFILES=php-native node --test tests/native-subtype.test.mjs` passed; the installed consumer ran 2016 checks. Both builds produced:

```text
2afca267e341057ee93fd8b58cec34265212b93877d9b64f82cf2a12fecacdc4  archives/example-subtypes-1.0.0-linux-x86_64.zip
```

### Ruby

`LEAN_BRIDGE_SUBTYPE_PROFILES=ruby node --test tests/native-subtype.test.mjs` passed; the installed consumer ran 2016 checks. Both builds produced:

```text
2fe685e653d7136a06a9a23f2bdb1d5476bde2d4850c66fb5d98d0c9911348cc  archives/subtypes-1.0.0-x86_64-linux.gem
```

### Rust

`LEAN_BRIDGE_SUBTYPE_PROFILES=rust node --test tests/native-subtype.test.mjs` passed; the installed consumer ran 2018 checks. Both builds produced:

```text
c5bb7c534cb79af44e4eeaea675c63d66be786c01300eb37e27e21f2e83144b5  archives/subtypes-1.0.0.crate
```

### WIT/WASI

`LEAN_BRIDGE_SUBTYPE_PROFILES=wit-wasi node --test tests/native-subtype.test.mjs` passed; the installed consumer ran 2023 checks. Both builds produced:

```text
963aaa38831692c5d180f2d12f69a895e68e7721fc13dc4ad8447131f995af26  archives/subtypes-1.0.0-wit-wasi.tar.gz
```

## Not covered

- Python wheels run the same test, but the wheel installer requires glibc 2.38, which the machine used here lacks; their cells wait for a CI report.
- CPAN packages reject checked `Subtype` in this slice; positive Perl support is a separate row.
- `Subtype` inside containers, fields, callbacks, products and `Except`, nominal carriers, reviewed Binding IR and browser profiles are outside this milestone.
