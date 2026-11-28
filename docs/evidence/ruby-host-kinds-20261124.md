# When an installed Ruby component retains a host object

A Ruby object passed to a strong-canonical import used to remain alive if a
later argument was invalid, even though Lean never received the call. A
native reproduction counted one leftover registration after that rejection.
The corrected provider makes the registration permanent for the binding
only after all arguments convert. A valid host-member result is admitted
when it crosses back into Lean.

The [installation test](../../tests/helpers/ruby-host-packages.mjs) builds
two independent components with the offline CLI, from ordinary Lean source
and again from reviewed interfaces. Its [Ruby consumer](../../tests/fixtures/ruby-host-meter/nominals.rb)
runs after the projects, handoffs, and archives are removed and the gem
installation is moved. It exercises both binding orders on each route.

- Passing a new strong Token with a wrong-class second argument or an
  out-of-range third argument 32 times each leaves zero registrations.
  Lean never calls the Ruby receiver. A rejected call cannot remove a prior pin.
- A successful argument and a successful member return survive GC and
  compaction. A call that *enters* Lean and then raises a Ruby exception
  also retains its argument and returns the original exception object.
- Equal but distinct objects have separate registrations. One Ruby object
  used as two different declared kinds also gets separate registrations.
- The first unbind leaves shared strong registrations intact. The last
  unbind brings the native count to zero; the Ruby weak reference dies
  after the calling fiber exits. A Lean reference saved before unbinding
  cannot be used in a new binding.

Both installed pairs also passed the existing weak-identity, borrowed
anchor, fault/reentry and 19-primitive checks. All four verified archives
were 50,103,296 bytes on Linux x86-64, MRI 3.3.12, pinned Lean 4.32.2,
with the local glibc floor override 2.36.

| Source | Gem | SHA-256 |
| --- | --- | --- |
| Ordinary | workshop | `029e08ddbfe6a738fc833e12d511fc8306669371538c889c8a635f5e37b254c9` |
| Ordinary | workshop-peer | `06f6584e0b2de6bee99fca52aa32c4813e44c5544c1836903b5b2da484bbbd03` |
| Reviewed | workshop | `1392d9dec9bc33677a45a6dcd17e690a088f63e3c06f98fe4a771573409ebc7a` |
| Reviewed | workshop-peer | `954914119132fd7f2dec26446596ede5862b7af71e2da1f2cfaceb75139767d0` |

Run `npm run test:ruby-host-packages` with the [publisher prerequisites](../publish/rubygems.md#call-ruby-objects-from-lean).
This measures synchronous host calls on the binding fiber, not Ruby calls
from Lean workers.
