# Locked-engine `Fin` rejection diagnostics

VO1419 under VO1220, 2026-10-06.

## Failure

[Consumer run 37342104353](https://github.com/seanmorris/lean-bridge/actions/runs/37342104353), at `4affa1bcf6727a550db59ab845394f425cc26882`, failed the installed npm callback `Fin` check. Its negative case, `def impossible (_f : Nat → Fin 0) : Nat := 0`, expected the uninhabited callback-result rejection. Through the locked component engine it received only `CanonicalBuildError: …/lean-bridge-component-engine exited with status 1`.

## Reproduction

`build/vo1419/repro.mjs` runs that fixture through `buildCanonicalProject` with the same injected transport as `tests/unlocked-component.test.mjs`:

- **In process:** the build throws `TypeError: Callback result has no finite recovery value` from the structured-callable recovery planner.
- **As a subprocess:** a wrapper runs `node scripts/run-component-engine.mjs`, the same entry script the Nix `component-build-engine` wrapper runs. The parent received only the generic exit-status error. The rejection survived only as an uncaught-exception stack trace in the retained stderr, with no code, engine paths and source snippets.

The rejection itself was the expected one; its diagnostic was lost at the process boundary. This reproduces the JavaScript boundary. It is not an execution of the real Nix locked engine, which still needs CI to confirm it.

## Repair

- **A stable code.** The recovery planner keeps its message and now sets `code: "uninhabited-callback-result"`.
- **One final diagnostic line.** On failure, `scripts/run-component-engine.mjs` writes a bounded human-readable line, then a final line, `lean-bridge-engine-error <JSON>`, and exits with status 1.
  - The JSON has exactly four fields: `name`, `code`, `message` and `details`.
  - `details` keeps only an allowlisted `declaration` and `source` position. The environment, stacks, causes, raw output and request data are never included.
  - The whole line is at most 6000 UTF-8 bytes, inside the 8000-byte stderr tail the process runner keeps. Long messages are cut at code-point boundaries in a fixed order.
  - Serialization never throws. Hostile or unknown thrown values fall back to a fixed line.
- **Strict decoding.** Both component engine runners decode a `build-command-failed` error only when that final line is valid. They then re-raise the engine's code and message, with the engine and process context in `details`. Every other failure is returned unchanged, including timeouts, cancellation, output limits, missing or malformed lines, and lines followed by other output. The line is a format for the parent; it does not authenticate the child's other output.
- **A precise test predicate.** The installed test now requires both the code and the exact message. An arbitrary exit status 1, or stderr that merely contains the phrase, no longer satisfies it.
- **Distribution boundaries.** The new module is listed in the Nix component-engine source boundary, the CLI package inventory, the development package files and the checked-JavaScript classification.

## Verification

- `node --test tests/component-engine-failure.test.mjs` covers:
  - decoding, and the allowlist;
  - the predicate rejecting every unrelated failure;
  - bounds with escaped and multibyte text;
  - cyclic and hostile values;
  - a real subprocess writing more than 8000 bytes of stderr before the line;
  - the real engine entry point.
- `build/vo1419/repro-after-*.log`: both paths now report `uninhabited-callback-result` with the original message, and the project inputs are unchanged.
- `LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test --test-name-pattern="checked Fin callbacks|nominal Fin fields" tests/unlocked-component.test.mjs` passes in process, and with `LEAN_BRIDGE_LAKE_ENGINE` set to the subprocess wrapper.

No supported-type claim, receipt or archive changes. Running the real locked engine in CI is still pending.
