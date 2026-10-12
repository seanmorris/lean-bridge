# Required nominal C# package CI

The managed C# job now requires four serial NuGet selections: ordinary/full,
reviewed/full, ordinary/result-only and reviewed/result-only. Each selection
reproduces its package in two author roots and exercises offline installation,
physical relocation and source-free deployment. The shell refuses existing
output directories and preserves the original stdout, stderr and partial
records on failure. A failed producer or checker stops the step.

The job installs .NET SDK 8.0.424 in a separate runner-temporary directory and
passes that host explicitly. Existing compiler setup, acceptance steps and
240-minute job budget are unchanged. The separate SDK avoids selecting a newer
preinstalled .NET 8 feature band. The action documents its installation-directory
setting in [setup-dotnet's environment variables](https://github.com/actions/setup-dotnet/blob/v6/README.md#environment-variables).
The new producer step has a 45-minute timeout and declares glibc 2.38 explicitly.
An ambient floor override is rejected. Each native producer retains the existing
memory, disk and bounded-load checks.

Each CI selection runs `scripts/check-nominal-subtype-dotnet-ci.mjs`. The checker:

- Requires complete, zero-skip TAP for the exact selected route and API.
- Verifies the original package-set receipt and complete nupkg, including every
  managed and native member. NuGet SHA-512 values come from those archive bytes.
- Requires the closed retained-record set and applies the independent package,
  model, constructor, restore, deployment, compiler-probe and result checkers.
- Measures the selected host binary and SDK again. It executes only the original
  compiled caller's `--runtime` branch in a fresh private directory to observe
  the current framework and runtime-file identities. It does not compile the
  caller, rerun the algorithm or reopen recorded historical absolute paths.
- Keeps the complete SDK and shared framework as trusted tools, as the original
  installed acceptance does. It does not claim constructor/source entry counts.

The workflow uploads `build/nominal-subtype-dotnet-ci/` on success or failure,
including original handoffs, complete records, original TAP and verification
results. A report without its original archive is insufficient for this gate.

## Source history

The new source-history ledger records nine exact transitions from archive commit
`51f55c70d0aa7fc08e582e2de9fb51f12e1869f7`. It preserves earlier ledger and archive
bytes. The support inventory changes only 92 current-workflow source pins;
its 496 evidence entries and 583 observations retain their existing claims.
Earlier workflow comparisons reconstruct their exact checkpoint through the
new authenticated transition. Unknown changes remain visible to those checks.

## Validation

All four original handoffs passed the actual CI checker with .NET SDK 8.0.424
and framework 8.0.30. Their original 37,884 checks across twelve executions stay
unchanged. The checker measured the host and runtime again but did not rerun
those algorithm executions or compile a new package.

- New checker and shell tests: five passed without skips, including 148 invalid
  TAP controls, 108 producer/host/framework/record controls, 22 handoff controls,
  nine complete/failing shell scenarios and nine stale-output refusals.
- Workflow, history, inventory and registration regression: 89 passed without
  skips. Log `build/vo1444-nominal-dotnet-ci-workflow-r2-0.log`, SHA-256
  `52ba6ad86524dafb9baec7621d947d33e232e1a0707b39164c86224420e1d397`.
- Registered selection through `tests/component-refinement-mirrors.test.mjs`:
  all nine new CI tests passed without skips. This was a named selection, not a
  complete rerun of that root. Log
  `build/vo1444-nominal-dotnet-ci-registered-r1-0.log`, SHA-256
  `f170bedd810e690582395468b0830ca93b9ecf24160daa8f371419cd1a02958a`.
- Full ESLint, checked JavaScript, shell syntax, all sixteen generated reference
  checks and `git diff --check` passed.
- Independent Git audit `build/vo1444-nominal-dotnet-ci-audit-r1.json` verifies
  all nine exact transitions, the 92 workflow-only source-pin updates and the
  four original archive identities. Earlier evidence remains unchanged.

The first local preflight stopped before running any test because host load
remained at or above six for five minutes. A later source-only preflight fixed
one style diagnostic. The first broader regression caught the Rust promotion
test comparing the live inventory with its older workflow-hash checkpoint; the
corrected test authenticates and compares the complete checkpoint. Its original
failure log remains at `build/vo1444-nominal-dotnet-ci-workflow-r1-0.log`.
No successful compiled producer was restarted. Hosted acceptance of the new
gate is pending.

Ledger SHA-256:
`b6c5804472b01fae56f07f705a1328928f6a620c4934c0d3151e0a3af0ed6e49`.

Support-table and consumer-documentation promotion of the demonstrated C# cells
follows this CI milestone. The remaining #1444, #1443 and #1446 scope stays open.
