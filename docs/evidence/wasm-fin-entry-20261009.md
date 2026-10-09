# Fin entry checks in Node and browsers

The [retained reports](wasm-entry-20261009/receipt.json) measure scalar and
container `Fin` calls from ordinary-source and independently reviewed packages.
All 16 reports passed locally: eight Node reports and eight reports that also
run in Chromium, Firefox and WebKit. Their retained transcripts account for
440 context, engine and lifecycle-phase observations.

## What each mode measures

| Mode | Package | Adapter entry | Lean source entry |
| --- | --- | --- | --- |
| Original | Unmodified generated package | Actual Wasm adapter frames | Not measured |
| Probe | Separately built package with `dbgTrace` markers and an unrefined control export | Actual Wasm adapter frames | Source markers in this instrumented package |

The probe's source counts do not describe execution inside the unmodified
package. Each mode has its own compilation, package identities and expected
transcripts. Public invalid calls stop before adapter entry. Raw calls with
runtime-encodable, out-of-bound values enter the adapter and fail its checks.
In the probe, those calls produce no Lean source marker. Invalid host types
can fail in the runtime's encoder before adapter entry. Valid calls and
recovery calls provide positive controls.

## Coverage

Both modes run each source route with two fixtures:

- Scalar: `Fin 0`, `Fin 1`, `Fin 10`, a bound larger than 64 bits, result-only
  refinement and a refined middle argument.
- Structural: the scalar fixture plus nested arrays, empty `Array (Fin 0)` and
  `List (Option (Prod (Fin 3) (Except (Fin 5) (Fin 2))))`.

The original scalar and structural fixtures make 226 and 520 calls per runtime
observation. Their probes add ten unrefined control calls, for 236 and 530.
The strict TypeScript consumer has a separately accounted prelude.

Each Node report has two observations, JavaScript and strict TypeScript.
Each browser-enabled report has those two plus 51 observations across pages,
React and dedicated workers in the three engines. Browser coverage includes
the harness's required lifecycle, failure-recovery and remount/restart phases.
The [archive validator](../../tests/wasm-entry-evidence.test.mjs) recounts the
transcripts and refuses a missing engine, context, phase, variant or call.
The browser reports retain Chromium's version only. Firefox and WebKit ran,
but their versions are not recorded in these reports.

The producer builds from two author roots and compares package bytes, removes
author/build inputs, installs offline and executes with a compiler-free PATH.
Browser consumers run from bundled deployments after installation removal.

## Evidence identities

The initial ordinary-scalar Node reports ran at
`7c117573c61696dc93f98ba83c18162517b72d37`. All other passing reports ran at
`7eae44484e981a83092bc94fc46585130b3ad733`. The earlier failed
`ba282ec4c561ef52d161a4c94884dcacd1798221` attempt remains in the archive as a
failure; it contributes no passing observation.

The archive retains reports and their transcripts, original queue and terminal
records, TAP, runners, frozen expectations, TypeScript consumers and selected
Git source snapshots. Compressed members authenticate both compressed and
inflated bytes. Package receipt and component identities are recorded in the
reports; the original package archives and receipt bytes are not retained here.

These measurements supplement the existing installed-package evidence. They do
not replace its package archive identities or extend the support matrix to new
types or profiles. The [reconciliation tests](../../tests/wasm-entry-supplement.test.mjs)
preserve all older evidence and change only the three existing npm Fin
observations. No hosted-CI, locked-Nix, nominal-field, callback, `Subtype`, native
or PHP-Wasm acceptance is established by these local reports.
