# Installed WIT cursor failures

The same compiled Lean pull produced `.ok 73` and `.error "boom"` as
ordinary items. On the next demand it either ended or threw
`IO.userError "boom"`. A second cursor delivered the same items and then
failed with the *declared* string `"boom"`. The tests inspect the tags,
not just the text.

An offline-installed CLI built both package profiles from ordinary and
reviewed source. Each check verified the package-set receipt, removed the
author source and relocated the installed archive before starting its client.
For each profile, removing the IO-failure marker from a reviewed declaration
made the publisher reject it before writing a package-set receipt.

| Profile / author route | Archive bytes | Archive SHA-256 | Receipt SHA-256 |
| --- | ---: | --- | --- |
| Pollable / ordinary | 59,197,568 | `d46226071b7db443284eb0c7382df829cc100a54aad9c8f935afd8b79cbebb0e` | `3bbaa5e5409704387051bf24ffbc5766045e2c77de8d52b41127df5b61aa2098` |
| Pollable / reviewed | 59,198,579 | `73666bf43fceebcaea1abea279c7f83314adaf292e91e9823c1d4102e29b2c7a` | `4d209e81e83264ab812ecf167696b75f82a7f35b739f17d30e4d3680b9ba025e` |
| Canonical / ordinary | 60,916,748 | `1acffd7ce6c7e3b5143c7fe839c9ff26f81c34363719ad62ef499e0cf7b21351` | `9abf183682d0c94234d385922010eb6160a5f41d73a610e9ca0da52b12f568ee` |
| Canonical / reviewed | 60,917,742 | `d7a0dc1cb74faaf71538bc4605cbb3aacb7b15366a219007516607e12d025119` | `6543175a0266e2e6cb44f9a241d70f947d8c31f8d4067756c68ca759c0c4b577` |

The [C client](../../tests/fixtures/wit-cursor-io/consumer.c) linked
through the installed pkg-config file. It observed `ITEM`, `END`,
`STEP_IO_FAILED` and `FAILED`, refused to overwrite an owned result, and
could still read the copied error after closing the session. The
[WebAssembly guest](../../tests/fixtures/wit-cursor-io/application.wat)
matched the installed WIT world and ran under the packaged launcher. It
read the nested result tags separately, then observed end-of-stream.
Both clients counted exactly four Lean close calls: one per exhausted,
IO-failed, domain-failed and early-dropped cursor.
The two reviewed receipts in the table were replayed independently after
the publishing runs; both installed clients passed again without compiling
Lean or creating replacement archives.

Run `npm run test:wit-cursor-io` with the pinned Lean toolchain, wasm-tools,
Wasmtime 42 C SDK (`LEAN_BRIDGE_WASMTIME_C_API`) and complete Wasmtime 51
C SDK (`LEAN_BRIDGE_ASYNC_WASMTIME_C_API`, including its LICENSE).
Set `LEAN_BRIDGE_WIT_CURSOR_HANDOFFS` to an existing directory to keep
verified archives. To replay just the installed client without rebuilding
Lean, set `LEAN_BRIDGE_WIT_CURSOR_REPLAY` to the directory containing one
original package-set receipt and run the same command. No registry or hosted CI
participated in these checks.
