# Historical extractor identity after borrowed results

The full core run after `dffda6f` found seven transfer-receipt failures. The C#,
JVM, Perl, native PHP, Python, Ruby and Rust checkers compared their archived
extractor identity directly with the current `NativeExports.lean` file. The C
borrowed-result change added compiler support for parameter anchors, so those
identities correctly differ.

The checkers now use the authenticated source-history transition recorded in
the C borrowed-result receipt. They stop at the extractor digest named by each
old execution. An unrecorded source edit remains visible and fails verification.
The installed receipts and their compiler metadata remain unchanged.

The companion repair receipt records the changed checker files, reversible
source transitions, and unchanged predecessor identities. Tests reconstruct all
seven historical runtime/package contracts, reject altered identities and edit
spans, and check that the support index remains unchanged. This repair
adds no type support and makes no new installed-execution claim.
