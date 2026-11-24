# Ruby class identity across Lean tasks and cursors

On Linux x86-64 with MRI 3.3.12, the public CLI built three platform gems and
verified each package-set receipt. The ordinary and reviewed builds produced
byte-identical binding IR (SHA-256
`e0484120bb78c8385ac6358f9a6bbe3136e93ed5a1a9789c60325ccce75abe13`).
The reviewed route used that interface without an explicit export list.

| Gem | Bytes | Archive SHA-256 | Package-set receipt SHA-256 |
| --- | ---: | --- | --- |
| Ordinary | 50,115,584 | `32e2964a3770c17b4c9e977775523180c4c2a90ae772b5071223eda79a17c1fb` | `12ad227652701fb2a923fd0897a4a2e8853ba7adfee285313b84ae135791cecc` |
| Reviewed | 50,116,096 | `b23b47e78713c826f5979dd02fc508da257597e139decc01ee7cde0761a75271` | `b7586878a56a0e4ba6f026acfa56d30803133a294b2c50e73ea88e4c6b428498` |
| Separate peer | 50,116,096 | `bf94f588dd51a2815d07b221e393d68e447fa713a5da67037e534cae1b75b131` | `2c5b24b89cfb5f15521f64d49b2f7376991f2f51465f53a13c88119c2decabbc` |

After removing both author trees, the [installation test](../../tests/helpers/ruby-host-workers.mjs)
installed each primary gem offline alongside the peer, moved the installation,
and ran two Ruby programs with no producer tools on their path. Both programs
passed on both primary routes.

- [The application](../../tests/fixtures/ruby-host-workers/consumer.rb) checked the original object's identity through a retained callback, a task result, a cursor item and a typed failure. A callback reentered a peer component and compacted the Ruby heap. A weak import was released after delivery; a strong import was not pinned by a rejected argument. The application distinguished a callback exception that Lean could catch, an invalid callback return, and a fatal exception that retired the peer. It rejected work on the wrong fiber and showed that a closed binding could not resume a stale task. Descriptor counts returned to baseline and live native identities to zero.
- [The private-token test](../../tests/fixtures/ruby-host-workers/private-tokens.rb) kept the peer binding open while the original binding closed and reopened with the same classes. Neither a sibling nor the new binding could resolve or release the old token. The original binding also rejected truncated and wrong-kind tokens. An abandoned token did not survive unbind.
- The producer rejected a reviewed interface that changed leased ownership to copied ownership, and a worker calling a Ruby member through a Lean helper. Neither rejected build produced a package-set receipt. The scalar-only task ran without binding a class.

Run `npm run test:ruby-host-workers` with the pinned Lean toolchain, native
runtime and MRI 3.3 configured for the producer. These are local installed-gem
results, not a hosted CI run or a registry publication.
