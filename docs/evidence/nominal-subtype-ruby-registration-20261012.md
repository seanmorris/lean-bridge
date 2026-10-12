# Nominal Ruby Subtype harness registration

This milestone adds the independent Ruby caller, package inspector and four
ordinary/reviewed full/result-only installed test selections. No compiled Ruby
selection has run yet. The support inventory remains at 488 evidence entries
and 579 observations.

The caller checks exact copied values without generated equality or serialization,
per-use constructors, nested records and active variants, aliases, 100-bit values,
mixed Fin ordering, rejection paths and unchanged inputs. Full selections include
1,000 rejection/recovery rounds. Separate result-only selections expose no checked
input exports. Synthetic controls reject 46 deliberately incorrect implementations
across the four selections; they do not establish installed package support.

The producer requires an explicit MRI Ruby 3.3 command and native glibc floor.
Each selection builds the same gem in two author roots, removes author sources,
installs offline, checks archive-derived installation identities, physically moves
the consumer and replays the unchanged caller. It retains original gem handoffs
outside temporary author directories. The package inspector reconstructs Ruby
sources from compiler and native identities. No constructor/source entry counts
or memory measurements are claimed.

## Validation

- Registered regression: 130 passed, zero failed, 21 explicit compiler/installed
  skips. `build/vo1444-nominal-ruby-registered-r1.tap`, SHA-256
  `4ed3fe93efcbfc974df6fc16a518653fcca64447d55fddc2e041fcae16152246`.
- Final source/history checks: nine passed, zero failed or skipped, with explicit
  local Ruby 3.3.12. `build/vo1444-nominal-ruby-source-r4.tap`, SHA-256
  `5ff26e354ae338127fdd92822aac1822ee25d8661f01cd5555427064c8ba5d79`.
- Frozen generator reconstruction covers all 19 transitive modules. Focused ESLint
  and repository typecheck pass.
- Contract-only checkouts without Ruby explicitly skip the executable synthetic
  caller controls. An explicitly selected missing interpreter fails. Compiled
  acceptance still requires its explicit installed-test gate and interpreter.

The registration ledger records three exact transitions from
`ae1f52cd0d9f7b1e17de552baa1ad6652f1da80f`; it changes no support claim or prior
evidence bytes. Ledger SHA-256:
`550d8c72539632c837efa1f8ef47fd0b0b7f50ee698b88436a989cc681d0f95b`.
Independent audit `build/vo1444-nominal-ruby-registration-audit-r1.json`, SHA-256
`8b3029d95cd52edc6dfeb5d6347bfc7ec88f69988648109996e0d307759530da`.

Four real compiled selections, archived originals with independent corruption
controls, documentation and required recurring CI remain for Ruby acceptance.
The broader requirements of #1444 and #1220 remain open.
