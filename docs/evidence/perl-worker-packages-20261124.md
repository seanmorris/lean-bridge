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

Run `npm run test:perl-worker-packages` with the interpreter and dependency
settings in the [transport check](perl-worker-transport-20261124.md).
Set `LEAN_BRIDGE_PERL_WORKER_HANDOFFS` to an existing private directory
to retain all three receipts and their named archives. To run downstream
checks on those exact archives without rebuilding Lean, set
`LEAN_BRIDGE_PERL_WORKER_REPLAY` to the resulting handoff root and run
`npm run test:perl-worker-replay`. Nothing in this test uploads to CPAN.
