# Checked Subtype composition in npm packages

VO1220 milestone, 2026-10-05.

Top-level checked `Subtype` parameters and results now compose with copied arrays, records, options, aliases, recursive values, primitive callbacks, structured callbacks, and returned closures in ordinary-source npm packages. The predicate and constructor checks are unchanged from the [primitive refinement acceptance](npm-subtype-refinements-20261005.md).

The adapters validate refined inputs before calling the source export. Object inputs retain a separate reference while the Lean constructor runs. Rejection releases every decoded argument, including copied trees and callback carriers. Copied transports report an ordinary call failure so the shared runtime remains usable. This also fixes the existing record adapter, whose rejection status previously retired the runtime. Recursive output encoders continue to treat a malformed result carrier as an error.

## Installed checks

Each of the eight component profiles builds from two relocated source roots, reproduces its npm archives, verifies both package receipts, moves the author sources before installation, and installs only the completed archives offline. Node executes the compiled Lean implementation; TypeScript checks the installed declarations with `strict` enabled and `skipLibCheck` disabled. Closure fixtures include `ESNext.Disposable` in their TypeScript libraries.

The installed consumers exercise a checked nonempty Unicode string and a checked `UInt32` below ten. They reject invalid values in both the first and second refined arguments, verify that rejection does not invoke a supplied host callback, and repeat rejection followed by successful calls 64 times. They also round-trip recursive trees and invoke and dispose returned closures where those operations belong to the profile.

| Component profile | Private ABI | Reproduced component archive SHA-256 |
| --- | --- | --- |
| Scalars | 2 | `4385d43cfd8b8e7d1983694c939dc0a39442406726735e3233a254976eb73ad3` |
| Primitive callbacks and returned closures | 3 | `5dc14d5773188b4f0e6b8479f675fb5953f043963c88bdcb8c8eaa4184f0dc04` |
| Copied arrays | 4 | `b096991a28d121402bb71e9b3f9f76e508f0478323287f4a4cfcf1fa66dd6b3f` |
| Copied records | 5 | `a5bd768d43bb71db2c1c36854585e9d4106db4f48273b8ebe2e43aa1c19178e2` |
| Copied options | 6 | `d3b03da980a4ec66097068538bd02107903df45624d1910f34dd980d32499bfd` |
| Named aliases | 7 | `5eaed7a677a0eff421d920877cb4f96744022476fa605f0a1fef19678ee5929a` |
| Recursive copied values | 8 | `83d2ee688bdf8daa8e734151ba687f8a5480ab9c1360cdcd27a9e975bd7b3cbe` |
| Structured callbacks and returned closures | 9 | `e77fcab0f29df95de7f0c7f88f7ae8b6a04b8c84f5000f9d97b401a533ecac1e` |

```sh
source scripts/env.sh
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test \
  --test-name-pattern='checked Subtype inputs compose' \
  tests/unlocked-component.test.mjs
node --test tests/component-array-contract.test.mjs \
  tests/component-record-contract.test.mjs \
  tests/component-callable-contract.test.mjs \
  tests/component-structured-callable-contract.test.mjs
```

The type inventory retains the same four accepted cells: ordinary-source Node JavaScript and TypeScript parameters and results. Refinements inside copied fields, containers, and callback signatures still reject. This milestone adds composition coverage, not new consumer profiles or value positions.
