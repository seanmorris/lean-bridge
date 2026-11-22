# Standalone Perl resource identity and callback lifetimes

[Hosted run 44988736734](https://github.com/seanmorris/lean-bridge/actions/runs/44988736734/job/137104927887)
built two independently reviewed components and an ordinary-source version of the
primary component at `4de6971b3c58f41f8098abaf396b179dee0ce0dd`. All three used
one byte-identical runtime archive. The job installed the original packages on
threaded and unthreaded Perl 5.36.3 and 5.38.2, removed the author trees and
handoff directories, and ran the probes against relocated installations without
a compiler on the consumer path.

Each configuration passed 50 assertions through each source route: 12 for
cross-component identity and stale/wrong-kind rejection, 23 for callbacks and
returned closures, and 15 for scoped borrows, nested calls and promotion to an
independent lease. The eight runs produced **400 passing assertions** in 24 TAP
transcripts. The probes check the original callback exception and that live
identities, wrappers, scopes and callbacks return to baseline.

The [verification receipt](standalone-perl-resources-20261122/verified.json)
identifies the original [GitHub ZIP](standalone-perl-resources-20261122/original.zip),
its three component archives, the runtime and the internal report. The ZIP is
51,784,211 bytes, SHA-256 `e291e8e484988aef7d8a766858b7a3ef2dc18ee170314d5920b0bd3b102bbfed`.
It is stored once. Recheck the receipts, tracked probe sources, archive bytes
and transcripts offline from the repository root:

```sh
node scripts/verify-perl-resource-run.mjs --offline 44988736734 \
  4de6971b3c58f41f8098abaf396b179dee0ce0dd "$PWD/docs/evidence/standalone-perl-resources-20261122"
```

This record concerns synchronous, standalone resources and call-scoped host
callbacks. It does not establish retained host callbacks, host-owned objects,
other language profiles, `IO` effects or async delivery. The earlier run
completed the semantic checks but failed during archive retention; it is not
the source of this evidence.
