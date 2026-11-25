# CPAN worker package handoffs

An offline-installed publishing CLI built these local Linux x86-64 CPAN
distributions. Each component includes generated XS for threaded and
unthreaded Perl 5.36.3 and 5.38.2. All three pin the **same** 51,422,277-byte
`LeanBridge-Runtime` archive (SHA-256
`44164075aa223e5d7126803c501f53e9c0154028ee606998d70b3657de44b4a9`).

| Source / component | Component archive bytes | Component SHA-256 | Package-set receipt SHA-256 |
| --- | ---: | --- | --- |
| Ordinary Workshop | 231,971 | `628b3f40ee3ae545aa733728dd349c88497ee098ea4f53e1312fb0d383233443` | `e447e94298925667f2c66b8b804b2dbd90a48a60c8d1c38dcc556799d56397f1` |
| Independent Peer | 231,941 | `a9c53e313a0e6b083e4f1071e0373334a8c8c43497bd139170d90e279518a071` | `e0594ade6c5127b0ef609a756ed3940cc9a8a49d984f3a7680a6955a0184f023` |
| Reviewed Workshop | 234,790 | `9c9820944776a96aa229027b3eb431308c87d5c1fbe565ffb4c58b5952d0adb9` | `4746e5c4fa2712fe472620750b44d1d449ab7ba9b800d826d02cb56895375181` |

Ordinary and reviewed Workshop have the same semantic Binding IR digest:
`8d5bbe440ab017aac7e538da643d198edfbe2a841926ca0d0d913fb083f358fb`.
Removing the error-payload site from the review of `Jobs.refuse` stopped
the build before it wrote a receipt. The package verifier rejected modified
XS, worker headers, ledger bytes, an absent compiler selection, and a
provider copied from another handoff. The peer's scalar worker adds 37;
Workshop's adds one, so a swapped implementation is visible to callers.

The installed-consumer run passed all **16 fresh, relocated installations**:
ordinary and reviewed Workshop × Perl 5.36.3 and 5.38.2 (threaded and
unthreaded) × prebuilt-only and locally compiled generated XS. Each prefix
contained Workshop, Peer and the common prebuilt runtime. All three installed
XS files matched the digest in their individual install receipts. Building XS
required a C compiler but not Lean; the prebuilt-only installs required neither.

Each prefix ran three independent Perl applications with no tools on their
execution path: Workshop then Peer, Peer then Workshop, and the public
Future/cursor consumer. All **48 application runs** passed. The two components
observed the same mutable Perl object; closing one component's scope did not
cancel its sibling's outstanding task. The public consumer exercised returned
versus raised failures, callback re-entry, pull demand and cancellation.
The full publishing-and-install test took 27 minutes 2 seconds at a local
limit of 25% of one logical CPU. No registry or hosted CI run was involved.

Run `npm run test:perl-worker-packages` with the interpreter and dependency
settings in the [transport check](perl-worker-transport-20261124.md).
Set `LEAN_BRIDGE_PERL_WORKER_HANDOFFS` to an existing private directory
to retain all three receipts and their named archives. To run downstream
checks on those exact archives without rebuilding Lean, set
`LEAN_BRIDGE_PERL_WORKER_REPLAY` to the resulting handoff root and run
`npm run test:perl-worker-replay`. Nothing in this test uploads to CPAN.

## Filtered publisher source

The Nix Perl engine reads only files in [its source filter](../../nix/perl-engine-source-boundary.json). The uncorrected filter omitted transitive imports and Perl worker templates and still named a deleted C frame source. Unlike an unfiltered checkout, the filtered tree could not load the publisher.

The [filtered-engine checks](../../tests/perl-contract.test.mjs) passed after restoring the required files. They copy just the filter's contents to a temporary directory, import the native publisher there with no tools on its search path, load the Perl scheduler and build the mixed-worker XS headers. Removing a required module fails the import; putting it back restores it. This checks the source filter locally, not a complete Nix derivation or a new CPAN installation.

The [full-build comparison](../../tests/helpers/perl-filtered-worker-package.mjs) goes one step further. Run `npm run test:perl-worker-filtered-engine` with the same four Perl interpreters. It builds the worker from the filtered tree, builds it again from a separate project using the full checkout CLI, verifies both receipts and compares every archive digest.

On November 25 both publishers produced component `a9a5a6a822a0643c2c87693759386c6517fecaa6c6e060db08f0ed8ef7842c0b`, runtime `44164075aa223e5d7126803c501f53e9c0154028ee606998d70b3657de44b4a9`, and package-set receipt `526dc07e9b371e4d0b88188b43b5cf575fa8d20f695f7375c101d64289c8e25b`. The test verified all four selected Perl ABIs and compared the entire receipt. Elapsed: 7 minutes 57 seconds at the local CPU limit. This is a filtered-source build, not an evaluation of a Nix derivation.

Use the **same publisher revision** when supplying a saved reference through `LEAN_BRIDGE_PERL_FILTERED_REFERENCE`. The filtered build reproduced the runtime from the November 24 receipt exactly (`44164075…`), but two later filtered runs produced component `a9a5a6a8…` instead of the earlier `628b3f40…`. The source-project and binding IR digests match. The older component records the November 24 `HostExports.lean` and `ResolveLakeWorkspace.lean` digests; the newer one records the changed sources' digests. The verifier must not ignore that difference.
