# Elaborated export metadata

`elaborated-export-metadata.schema.json` is the versioned boundary between the
Lean-side extractor and JavaScript Binding IR projection. It records fully
qualified environment identities and pretty-printed elaborated expressions;
source text is not a substitute for any field in this record.

The extractor sorts modules, imports, declarations, effects, theorem
references, and diagnostics before canonical JSON serialization. Its identity
is SHA-256 over those canonical UTF-8 bytes. Producer identity binds the exact
adapter version, Lean version, selected toolchain, and invocation inputs.

Every selected module binds its source hash and compiled-interface hash.
Mismatch is a `stale-metadata` error, never a warning that projection may
ignore. A declaration either has a supported binding shape or one closed
unsupported reason. Unsupported Lean meaning and extractor failure are
separate diagnostic categories so adapter work cannot be confused with a
broken or incomplete extraction run.

The theorem reference list reports elaborated environment relationships only.
It does not promote an assurance claim to verified; artifact-bound assurance
and human review remain separate release gates.
