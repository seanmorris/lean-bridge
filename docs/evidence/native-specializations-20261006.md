# Finite specialization acceptance for native packages

VO1220 row, 2026-10-06. It extends the [npm](finite-specialization-20261005.md) and [CPAN](native-finite-specialization-20260914.md) specialization evidence to the other native targets.

## Accepted boundary

`lean-bridge.exports.json` names each concrete export, its generic declaration and one to eight closed type arguments. Lean elaborates the application, resolves the instance dictionaries that follow the bound type parameters, and compiles one concrete function per entry. The native model, Binding IR and every generated host API expose only the concrete names; the open declaration is absent from the package.

The [fixture](../../tests/fixtures/onboarding/native-specializations/Specialized.lean) specializes four declarations ten ways:

| Export | Declaration | Type arguments | Resolves |
| --- | --- | --- | --- |
| `echoWord` | `echo {α : Type u}` | `Specialized.Word` (an alias of `UInt32`) | an implicit type argument through a transparent alias |
| `echoText`, `echoNat` | `echo` | `String`; `Nat` | the same declaration at a heap-backed and an unbounded type |
| `echoWords` | `echo` | `Specialized.Words` (an alias of `Array Word`) | a constructed type argument, named by an alias |
| `chooseWord` | `choose {α} [Inhabited α]` | `UInt32` | the fixture's high-priority `Inhabited UInt32` instance, whose default is 37 |
| `chooseText` | `choose` | `String` | the core `Inhabited String` instance |
| `chooseWords` | `choose` | `Specialized.Words` | the core `Inhabited (Array α)` instance at a constructed type, whose default is the empty array |
| `firstTextWord` | `first (α : Type u) (β : Type v)` | `String`, `UInt32` | two explicit type arguments in different universes |
| `doubleWord`, `doubleNat` | `duplicate {α} [Add α]` | `UInt32`; `Nat` | wrapping and unbounded `Add` instances |

A monomorphic `plain` export sits beside them. The fixture also declares a generic structure `Pair (α : Type u) (β : Type v)`; a specialization at `Pair Word String` (through an alias) is rejected before any package is built with the classified diagnostic `unsupported-native-type` naming `Specialized.echoPair` and the instantiated type, and no output directory is created. Generic structure instantiations stay outside the native type surface.

## Installed evidence

Each run builds the fixture from two clean roots for the selected targets, requires byte-identical archives, verifies the package-set receipt, removes the producer, and installs each package offline without a Lean or C compiler. The consumer calls every concrete export, checks that `chooseWord(false, 5)` returns the instance value 37 and `chooseText(false, s)` returns the empty string, checks the empty-array instance value of `chooseWords(false, xs)`, checks the concrete argument validation of a specialized export where the host can express it, confirms the open declarations are absent where the host can reflect on the API, and repeats the instance-selected calls 1,000 times.

These runs used revision `78955d7` on Debian 12 (glibc 2.36).

### C and C++

`LEAN_BRIDGE_SPECIALIZATION_PROFILES=c,cpp node --test tests/native-specializations.test.mjs` passed 2 of 2 tests; the installed C and C++ consumers ran 2016 and 2011 checks. Both builds produced:

```text
be48b49e913579854194c26151282497cce304f4457846f54e519851f0ffb818  archives/specialized-1.0.0-c.tar.gz
0bb3ebcb424d020d450ae685a905fdfbe9b96188ecf9d82cf5354e11171f584a  archives/specialized-1.0.0-cpp.tar.gz
```

### .NET

`LEAN_BRIDGE_SPECIALIZATION_PROFILES=dotnet node --test tests/native-specializations.test.mjs` passed 2 of 2 tests; the installed consumer ran 2030 checks. Both builds produced:

```text
84cb7e78d838d5add2b8ea2a1f0618b00cac5e7c44d653bee308b2d15ed23689  archives/Specialized.Api.1.0.0.nupkg
```

### Java and Kotlin

`LEAN_BRIDGE_SPECIALIZATION_PROFILES=java,kotlin node --test tests/native-specializations.test.mjs` passed 2 of 2 tests; the installed Java and Kotlin consumers ran 2070 and 2036 checks. Both builds produced:

```text
a5bfe43e756a1ffe325e4441752e6197f073717456bad2110891bab9adceaa72  archives/specialized-1.0.0.jar
c2b4b0b373bc733d9bdac5f445110e5aef842cd770fe5be4ef8a514a32db6dec  archives/specialized-1.0.0.pom
```

### native PHP

`LEAN_BRIDGE_SPECIALIZATION_PROFILES=php-native node --test tests/native-specializations.test.mjs` passed 2 of 2 tests; the installed consumer ran 2020 checks. Both builds produced:

```text
9562ce9a7fcf7987132ebd923101ef6b257f29de326665938773af7cb5dbe3c6  archives/example-specialized-1.0.0-linux-x86_64.zip
```

### Ruby

`LEAN_BRIDGE_SPECIALIZATION_PROFILES=ruby node --test tests/native-specializations.test.mjs` passed 2 of 2 tests; the installed consumer ran 2020 checks. Both builds produced:

```text
48a1f9fa445165e544064361e4a91802046e43014957a09ce5cf2994fc9befaf  archives/specialized-1.0.0-x86_64-linux.gem
```

### Rust

`LEAN_BRIDGE_SPECIALIZATION_PROFILES=rust node --test tests/native-specializations.test.mjs` passed 2 of 2 tests; the installed consumer ran 2011 checks. Both builds produced:

```text
358453af7caee916dee7763c9f6a06ee63a0871264b4bd23046173dfd8d851c6  archives/specialized-1.0.0.crate
```

### WIT/WASI

`LEAN_BRIDGE_SPECIALIZATION_PROFILES=wit-wasi node --test tests/native-specializations.test.mjs` passed 2 of 2 tests; the installed consumer ran 2021 checks. Both builds produced:

```text
3a239938c95240d6dc111f4c59f36fc3e696eca4e07dbf3794bb62ad1c6fabd3  archives/specialized-1.0.0-wit-wasi.tar.gz
```

## Not covered

- Python wheels and CPAN packages run the same test with their own consumers, but their installers require glibc 2.38, which the machine used here lacks; their cells wait for CI reports. CPAN keeps its earlier [evidence](native-finite-specialization-20260914.md) for callbacks, resources and compiled-XS installation.
- Generic structures and variants cannot be instantiated for native packages; the rejection above is the specified behaviour. A checked projection for them is a separate row.
- Specialized declarations with callbacks, resources or reviewed Binding IR are outside this row.
