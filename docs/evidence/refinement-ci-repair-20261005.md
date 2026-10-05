# Refinement CI evidence repair

The `d6bc8bc` CI run exposed two independent verifier problems after nested
`Fin` support changed the extractor and its import graph. These changes repair
the evidence readers. They do not add a supported type or change generated
production code.

## Historical import closures

The PHP and WIT acceptance readers discovered dependencies from current source
files while checking receipts recorded before the refinement module existed.
They now reconstruct authenticated predecessor source before walking imports.
The original receipt inventories and hashes remain unchanged.

The source-history test also reconstructs the installed WIT reader at its
recorded revision before applying that revision's reversal spans. Unknown
source edits still fail authentication.

## Fresh compiler invocations

The JVM and Perl execution verifiers compared fresh metadata against compiler
invocation hashes from their original acceptance runs. Updating the extractor
changes that identity even when the selected declarations remain identical.

The verifier now validates the observed invocation, authenticates the extractor
through its source history, and rebases only the extractor identity and its
derived invocation hash for comparison with the frozen semantic fixture. It
preserves every declaration, diagnostic, selection, module, and interface.
It does not change the observed report.

Historical reports retain their original compiler-output pins. For a newer
invocation, the verifier independently compiles the known Lean fixture and
generated carriers, checks the compiled interface identity, and compares the
resulting C hash with the report. It removes its private scratch directory on
both success and failure.

## Verification inputs

The current-report checks use the artifacts from
[consumer run 37279921375](https://github.com/seanmorris/lean-bridge/actions/runs/37279921375),
at `d6bc8bcde0592883dda8f26af7d8cb4111648fca`:

- JVM artifact `11338152521`: all six direct-runtime reports, plus mutations of
  carrier C, invocation identity, diagnostics, and extractor identity.
- Perl artifact `11341072351`: six direct-runtime reports and both ordinary
  source and reviewed IR reports for faults, lifetime, mutants, and sanitizers.
  The existing evidence tests include coordinated report mutations.

The regression tests also exercise the original PHP/WIT receipts, the original
JVM/Perl acceptance archives, and exact source-history reconstruction. New
unit tests cover all six invocation shapes, reject mismatched provenance, and
check that normalization leaves the observed input unchanged.

No registry publication or type-surface support promotion belongs to this repair.
