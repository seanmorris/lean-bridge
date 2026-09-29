# Installed Rust input transfers

Task 1219 extends the ownership profile with explicit consuming Rust inputs.
Generated functions take mutable references. Validation and native snapshot
preparation precede consumption; C owner slots identify the exact handoff before
Lean runs. Callback reentry observes moved aliases immediately. Later errors or
panics leave inputs consumed, while independent retains survive.

The enabled `npm run test:owned-rust-transfers` gate checks ordinary configuration
and independently reviewed contracts against compiled Lean. Its independent
consumer exercises resources, containers, aliases, recursive trees, boxed chains,
mixed copied fields, returned closures and callbacks. Allocation faults and panic
injection cover both sides of single- and multiple-input handoffs, with no live
bridge allocation or identity increase.

Installed checks reassemble identical archives, reject forged move contracts,
remove producer inputs, and install offline with an empty Cargo home. A
link-only compiler rejects native source compilation. The shared C++ package
and Rust documentation example execute against the release. The Rust executable
then runs after relocation and deletion of the installed sources and handoff.

The source-bound JSON receipt records those observations and reversible source
changes. Earlier receipts remain unchanged. It makes no support-table promotions.
Remaining consumer transfer bindings, owner-anchored borrowed results, owned
Docker acceptance and final cross-language acceptance remain open.
