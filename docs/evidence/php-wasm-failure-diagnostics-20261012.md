# PHP-Wasm failure diagnostics and universal fixture selection

Child-process failures now retain the exit code and termination signal, including
when both output streams are empty. Successful process results keep their existing
shape. A failed generated recursive PHP-Wasm probe retains its original directory,
error, Node executable identity and relevant source hashes. CI uploads that
directory even when the job fails. Successful scratch directories are removed.

No test is retried, skipped or accepted because of these diagnostics.

## Hosted failure and local checks

[PHP-Wasm job 114716526220](https://github.com/seanmorris/lean-bridge/actions/runs/38220864275/job/114716526220)
failed at `d2d819205189ceaaf80d7e2cc80901111c778de2` during strict
recursive callback-reply checks. Both captured streams were empty. The old error
omitted the child's status and signal, and the test deleted its temporary files.
The available log does not establish why the child stopped.

The complete unchanged generated probe passed locally at predecessor
`41ed314cf35d1157daf21a9692a094c62976e22c` on Node 22.23.2. Twenty fresh
weak/strict reply executions against those retained compiled binaries also passed
on the hosted job's exact Node version, 22.23.3. These runs did not reproduce the
hosted failure. Original files remain under
`build/vo1220-php-wasm-generated-repro-r2` and
`build/vo1220-php-wasm-reply-replay-r1`, outside `/tmp`.

The official Node 22.23.3 Linux x64 archive was checked against its published
SHA256 list. Archive digest:
`df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de`.
The selected executable digest is
`fde6a4bf8d0562f7751d1a2d6cb9b417c4cfe107bbcb0aa3e9a24e125e348f48`.
The system Node installation was not replaced.

Two focused baseline controls reproduced the diagnostic defect: a child exiting
with status 7 and a child terminating itself with SIGTERM both lacked the required
structured failure fields. The successful-result control passed. After the fix,
all three controls pass. Retention controls check original-file preservation,
the same error/cause, refusal to overwrite an existing failure record, successful
cleanup and unconditional CI upload.

## Universal fixture repair

The broader regression exposed three independent canonical-build failures.
Internal universal-fixture planning scanned the repository's 116 Binding IR
documents and rejected the ambiguous selection before probing build tools.

Only the internal `projectRoot === engineRoot` branch now selects Alpha's fixed
contract. It verifies the graph entry, raw and semantic hashes, exact relative
path and captured input identity. Ordinary package discovery is unchanged.
Isolated tests reject duplicate entries, another library identity, alternate
paths and raw or semantic drift before any tool runs. The existing missing-tool,
Docker orchestration and private Nix-store tests now pass.

## Validation

All runs used one CPU at low CPU and I/O priority.

- Focused controls: 11 passed, zero failures or skips.
- Thirteen-root regression: 115 passed, zero failures, one explicitly gated
  compiled PHP-Wasm probe skipped.
- Separate enabled generated PHP-Wasm suite on Node 22.23.3: 16 passed, zero
  failures or skips. This executed the compiled probe omitted from the regression.
- Full ESLint, checked JavaScript and all sixteen generated reference pages passed.
- Independent Git audit verified all ten exact source transitions, 111 source-pin
  updates and unchanged support claims: 496 evidence entries and 583 observations.
  Earlier evidence files remain unchanged.

The [source history](php-wasm-failure-diagnostics-source-history-20261012.json)
has SHA256 `201a8b55f82151f030174cc0d34b5824c3ffa4cc0007545f8114d3b96ef4041c`.
It preserves original source identities; it does not promote new support.

Retained local record identities:

| Record | SHA256 |
| --- | --- |
| Original hosted log, `build/vo1220-php-wasm-generated-d2d8192-114716526220.log` | `9d32994d31297556f566bc868c72ebe87893eab190f45910a8bdea8e889ff01b` |
| Failing baseline, `build/vo1220-process-diagnostics-before-r1.tap` | `9c7d04e0d2d07a519faf96d758860cb792b69ea24e04298cb1bbb410946d83f3` |
| Focused suite, `build/vo1220-failure-diagnostics-focused-r5-1.log` | `8999ea3761c613b4bffd076c1b9dc2e367f89d1dcaba38f6238e35ca8953f653` |
| Final regression, `build/vo1220-failure-diagnostics-regression-r3-0.log` | `65cb532229a3291b6fef5ea043e90ae41be1a054b8ed7090a02c2b6bae304ba1` |
| Enabled compiled suite, `build/vo1220-failure-diagnostics-generated-r1-0.log` | `168586b41365de6a024f971c2324cd6c7b1439a2cab1dd1443ad2e5d888b2d75` |

The original hosted failure still requires fresh hosted observation. The separate
JVM container-entry debugger failure remains outside this diagnostic milestone.
Neither #1443 nor #1220 is closed by this change.
