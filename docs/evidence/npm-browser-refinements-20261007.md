# Installed `Fin` and `Subtype` refinements in browser pages, React effects and workers

VO1429 under VO1220, 2026-10-07. It extends the [npm Fin acceptance](npm-fin-refinements-20261005.md) and the [npm Subtype acceptance](npm-subtype-refinements-20261005.md) from Node to the three browser profiles.

## Accepted boundary

The browser profiles consume the same installed npm archive as Node. The generated JavaScript validates every `Fin` leaf against its exact bound before Wasm dispatch and after return, and the compiled Lean adapter checks each bound and runs each contract-named `Subtype` constructor independently before the source call. A page, a React effect and a dedicated worker therefore reject the same inputs as Node, with the same recovery.

The fixture exports `mirror : Digit → Digit` over `abbrev Digit := Fin 10`, `rows : Array (Array Digit) → Array (Array Digit)`, `empty : Array (Fin 0) → Array (Fin 0)`, `huge` over `Fin 184467440737095516170`, `nested : List (Option (Fin 3 × Except (Fin 2) (Fin 5))) → …`, `echo : Text → Text` over a nonempty `String` subtype with the checked constructor `checkedText`, and `use : Text → Small → String → String` with `Small` a `UInt32` below 10 checked by `checkedSmall`.

## Installed evidence

`LEAN_BRIDGE_LAKE_WASM_TEST=1 LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit node --test tests/browser-refinements.test.mjs` builds the fixture from two clean roots, requires byte-identical archives, verifies the component-package receipt, removes both source roots, installs the archives offline into a plain, a React and a worker consumer, bundles each with Vite (8.2.1) under the nested base path, and serves the bundles from the repository site server with every foreign origin blocked. Each engine loads each bundle, waits for the result, reruns it from the page, and the React page is unmounted and remounted twice in strict and production modes.

Every context passes 128 checks and 129 package rejections: `mirror` at 0, 3 and 9 and rejected at 10, 11, -1, the Number 3, the string "3" and 2^70; `rows`, `empty`, `huge` and `nested` with their valid values and with invalid first, middle and last elements, a negative, a Number and an out-of-range nested leaf, each rejected and recovered over eight rounds; the caller arrays unchanged afterwards; `echo` with Unicode, a non-BMP character and an embedded NUL, rejected for the empty string; `use` at 9 and rejected for empty text, 10 and -1; and 32 further rejection and recovery rounds. The same contexts then call the package-internal runtime directly, which skips the generated JavaScript validation: valid scalar, container and checked-string values still return, and compiled Lean fails the call for an out-of-range nested element, an element in an empty `Fin 0` array, a value at the bound above 64 bits, an out-of-range nested `Except` leaf, empty text and an out-of-range `Small`, with the public API usable after each. A harness check with an API, or a runtime path, that accepts everything fails on the first rejection, so no context can pass by skipping the package.

The run used revision `b5a4d9f` on Debian 12 with Playwright engines Chromium 151.0.7922.34, Firefox 153.0 and WebKit 26.5. Both builds produced:

```text
53ae663f0a62c6e2a096e1477ebc0378875e861ada44ac801957da85264c2d79  lean-bridge-runtime-0.0.0-abi2.8bd55a3bd4eecde57020fd0b4fd641a1fd165d6371dc75d5d886d9e3a16e43ce.tgz
5fa7a7304f45bd1805e94a48425c461a35d826c5a40dbee99e68204c5489147b  onboarding-small-1.0.0.tgz
```

React effect lifecycle across the initial mount and two remounts was `{"cleanups":5,"commits":3,"effects":6,"ignored":3}` in strict mode and `{"cleanups":2,"commits":3,"effects":3,"ignored":0}` in production, in every engine. Each context loaded the Wasm asset from the served bundle and requested no foreign origin. Bundle digests:

```text
57ba2ceb30398b3d9a5d1ef50e57d93014b09757aed39f59949fdd15d11182c0  browser-javascript production
9d64fd3f94c57e10cb8435bd8e270b206460ed257ab04c8690e39fc68c6139bd  browser-react production
579a695c3a1db78841fd5d6b699a20673cc56ced02ee6f6c378a756d06830e12  browser-react strict
55b497dadfaee3f7af9cb6a02f5c77075e72a86a5e6b4c93b08c64109b0f3378  browser-worker production
```

## Repaired run

The [scalar Fin rejection repair](npm-scalar-fin-rejection-20261007.md) (VO1430) made the compiled adapter entry fail a direct call with an out-of-bound top-level scalar `Fin`. The run above, on revision `b5a4d9f`, had excluded the scalar direct calls from its shared check script because that revision returned the default value for them; it stays here as the pre-repair record. The harness was rerun on the repaired revision `9743855` with the scalar direct calls restored and the permissive-runtime control extended to them, in the same twelve contexts: Chromium 151.0.7922.34, Firefox 153.0 and WebKit 26.5 pages, React strict and production, and dedicated workers each pass 130 checks and 131 package rejections, with the same React lifecycle counts, no foreign requests and the Wasm asset served from the bundle. Both builds produced:

```text
53ae663f0a62c6e2a096e1477ebc0378875e861ada44ac801957da85264c2d79  lean-bridge-runtime-0.0.0-abi2.8bd55a3bd4eecde57020fd0b4fd641a1fd165d6371dc75d5d886d9e3a16e43ce.tgz
a9595e15f2fed3dac890574ed16ef202066db11bf43b361ed8882cfb86a3d6fd  onboarding-small-1.0.0.tgz
```

Bundle digests of the repaired run:

```text
d6d0a1ce6a6284c534933940b7221e7be5b68b9bb0a4539b78f83adb4bbea66c  browser-javascript production
bb1650b6a8984b216884a3fe0e0297bfe5bc9bbaa122435a1cdbc05e8d8c4920  browser-react production
ee10a177e0cb619826e491da683a64418affbd785c977164669274908a6fd6d8  browser-react strict
7e52d506b6cd1dfaf9ab47632799dfb85ae04e029fd185e078818f89cf61ccbb  browser-worker production
```

The receipt `npm-browser-refinements-installed` and the browser cells now cite the repaired revision and these archives.

## Not promoted

Nominal record and variant fields, callback positions and reviewed Binding IR are not browser-audited by this run; the Node cells record them separately. Only Chromium, Firefox and WebKit through Playwright are claimed. The report is `build/browser-refinements/report.json`, uploaded by the npm consumer job as part of `type-corpus-npm-<sha>`.
