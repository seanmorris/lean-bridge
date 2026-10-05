# Captured Lean text generators, 12 September 2026

This local VO1239 milestone follows `245fccc`. It adds an internal generator runner and closed recipe and receipt contracts. Normal CLI builds do not yet select or execute generators.

## Runner contract

The `lean-text-v1` profile calls a public Lean definition with this signature:

```lean
Array (String × String) → Array String → Except String (Array (String × String))
```

The first argument contains logical input names and captured UTF-8 contents. The second contains literal text arguments. The result pairs logical output names with text. The recipe maps those names to exact snapshot-relative `.lean`, `.c`, or `.h` paths. It supplies captured tool modules in compilation order. Unknown fields, shell commands, environment overrides, missing inputs, output collisions, and escaping paths fail validation.

The [definition schema](../../schema/lake-generator-definition.schema.json) describes this internal contract. It is not author-facing configuration. The future Lake selector must resolve prerequisite ownership and tool dependency order before invoking the runner.

The runner writes the authenticated version-2 capture into a new private directory, stages only declared tool modules on its source search path, and compiles fresh interfaces with the selected Lean executable. Compiler-library module shadowing and symlinked compiler files or library directories fail. The fresh implementation checker rejects unsafe, partial, foreign, `implemented_by`, and `sorry` dependencies in the selected modules. It also rejects unowned, nonpublic, generic, and non-executable selections. The generated driver checks the function's pure type before calling it.

Only the compiler paths and fixed UTF-8 locale settings enter the subprocess environment. The runner does not invoke Elan, Lake update, shell generators, or network-fetch commands. Lean compilation, macros, and import initializers retain normal trusted-Lean behavior. Private staging does not provide an operating-system sandbox for hostile Lean code. Host system libraries outside the selected compiler prefix remain part of the trusted build environment.

## Output and receipt checks

The function must return each declared name exactly once. Output text must contain valid Unicode and fit within 8 MiB per file and 16 MiB total. The runner writes outputs outside the captured source tree. It never relabels generated files as captured author inputs.

The [receipt schema](../../schema/lake-generator-receipt.schema.json) binds the complete source snapshot, recipe, compiler executable and version, complete `lib/lean` inventory, body checker, generated driver, actual input request, fresh compiler artifacts, and output contents. Paths inside inventories are logical paths. Receipts do not contain original checkout or temporary staging prefixes.

Before returning output, the runner rechecks the capture, tool sources, compiler artifacts, checker request, input request, driver, output inventory, and compiler-prefix contents. Its `verify` method repeats those checks before a caller consumes the result. Its `dispose` method removes owned staging. Failed execution and cancellation also remove staging. Receipt validation checks structure and expected source/recipe identities; publishing still requires the separate release authentication flow.

## Verification

All 16 compiled generator checks pass as root and as the unprivileged `nobody` user. Three Node-only contract tests cover closed definitions, exact result names, Unicode and size limits, and invalid captured text before any compiler invocation.

The fixture uses a pure two-module tool to convert a captured value into `Generated.lean` and `generated.h`. Shop supplies `17`; Telemetry supplies `29`. The tests capture each source tree twice, make both original paths unavailable, compare receipts and output bytes, and compile separate Lean and C consumers against the returned files. These test the standalone runner, not installed package generation.

Both consumers return the expected value. Original and relocated source inventories retain their bytes, modes, timestamps, and Git metadata. The tests reject changed tool sources, interfaces, requests, drivers, output contents, extra files, and output symlinks. A separate case changes an interface after execution and confirms that the runner removes staging without releasing output. Cancellation before the first subprocess also removes staging.

Negative declaration cases cover unsafe code, direct and transitive foreign calls, `sorry`, an IO result, recursive partial definitions, `implemented_by`, axioms, protected definitions, and compiler-owned selections. Lean treats a nonrecursive `partial def` as an ordinary kernel-checked definition, so the partial case uses recursion and checks the elaborated implementation.

Recorded identities match across relocated roots and both users:

```text
Shop
  snapshot: d4c4eba5eea8817f41e17f30e20bf87548413c2dc56093a0ce72d37cd236dc36
  receipt:  272ec21bc862456de9c6ec1eac2cafd7653d770a39c141f9dfea5fa74881dc68
  Lean:     35cfe9e26a7cf7c78d7ba524032cf639a7ea5517404069fbf28da94b1a9cc6f4
  header:   d9997c6126f68958c95a1d69ca3aaa1be77ba05ca0d7e5f34959f0053b469805
Telemetry
  snapshot: b8154f98684aef32d7ff429db20f2d04db03134f45db76d119db31b60e3b8547
  receipt:  5cac5e1386f33c0c12c4a1ba0559a97d2aa15a071de6a1eb55c7e47ba6f457df
  Lean:     73c597d5aa2faaa810fc2d1d045a282ae56eb418346c5df91112877680689e98
  header:   290e5b1a41cd3de5c3cedeba0a70a2ec45ee85bbe3db9ed89da913989a70f2be
```

The existing three native Perl groups pass on Perl 5.38.2-threaded, including 183 installed API checks. The two relocated C-input npm cases and the WASM foreign-implementation rejection case also pass after the body-checker change. Their npm archive identities remain unchanged. The checker source hash in the type inventory is refreshed after these runs; no type/profile support changes.

Another 28 engine-inventory, Perl-contract, compiler-adapter, Lean-compiler, linker, and native-input checks pass. `npm run check:core` passes lint, checked JavaScript, and 509 contracts. Site tests pass 101 checks; site typechecking and all 16 generated reference pages pass. The inventory remains at 6,562 cells, 2,193 observed cells, 116 installed-tested cells, and 32,230 required stage gaps. All generator-owned temporary staging is removed after acceptance.

After `source scripts/env.sh`, the relevant commands are:

```sh
node --test tests/lake-generator-contract.test.mjs tests/test-profiles.test.mjs
LEAN_BRIDGE_LAKE_GENERATOR_TEST=1 node --test tests/lake-generators.test.mjs
LEAN_BRIDGE_PERL_NATIVE_TEST=1 \
  LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl \
  LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test tests/perl-native.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test \
  --test-name-pattern='native-input|foreign-implementation' tests/lake-wasm.test.mjs
```

The glibc override matches the local host. The production floor remains 2.38. The native consumer workflow runs the generator suite with the pinned Lean compiler. Nix execution is unavailable locally and is not claimed.

## Next integration milestone

1. Resolve selected Lake prerequisites into authenticated generator definitions without running arbitrary target bodies. Reject undeclared tools, dependency cycles, and generation cycles.
2. Add verified generated-output overlays to private workspace resolution. Keep original capture identity and generated origin distinct.
3. Compile generated Lean and native inputs in both profiles. Bind generator receipts and output identities into build, link, bundle, and release records.
4. Add relocated offline npm and CPAN installation cases whose public APIs depend on generated values. Reject changed recipes, tools, requests, interfaces, and outputs before releasing packages.

Custom Lake targets, `needs`, `extraDepTargets`, `extern_lib`, prebuilt libraries, and additional compiler/linker options remain rejected. Reviewed foreign-call contracts stay under VO1238. The shared authoritative export extractor and stale-interface cutover stay under VO1107/1108. VO1239 remains open. Nothing is pushed or published.
