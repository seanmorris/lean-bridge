# Calling Ruby-owned objects from two installed Lean components

A Ruby application supplies an ordinary class to `bind_hosts`. Lean calls its
constructor, methods and properties. The consumer never sees the native handle,
loads a compiler, or implements dispatch. See the [publisher example](../publish/rubygems.md#call-ruby-objects-from-lean)
and the [consumer example](../consume/ruby.md#supply-a-ruby-object-to-lean).

The [installation test](../../tests/helpers/ruby-host-packages.mjs) packs the
CLI, installs it offline, and builds two independent projects. It repeats the
build with each project's reviewed public Binding IR, checking the review hash
against the freshly compiled interface. It verifies the package-set receipts,
removes the Lean projects and release directories, installs the gems locally,
removes the archives, and moves the gem installation. The final Ruby process
gets a PATH with no build tools.

| Scenario | What the Ruby consumer checks |
| --- | --- |
| A shared object | One gem constructs an actual Ruby object. The other sees the same object by `equal?`, reads its state, and mutates it through a property. Separate Lean references share one native registration. |
| Borrow and transfer | Both receiver-anchored and parameter-anchored results keep the parent alive across `GC.compact`. Releasing the child clears the registration. A transferred receiver leaves no registration on success or when its Ruby method raises. |
| Scope and execution context | The last binding invalidates old Lean references, not the Ruby object. An incompatible class, a call on another fiber or thread, and a child process using an inherited binding are refused. |
| Errors | A Ruby exception survives nested reentry with its identity intact. Lean can inspect its message (including a NUL), replace it with a different IO error, or translate it into a declared EIO payload. A nonlocal Ruby throw cannot unwind a Lean frame. |
| Values | All 19 primitive types pass from Ruby through Lean into a Ruby method and back. The checks cover wide integers, signed boundaries, float rounding, invalid encodings, binary strings and the shared `UNIT` sentinel. A pure returned `Except` and a nested result inside EIO are Ruby `Ok`/`Err` values, not raised exceptions. |

Run `npm run test:ruby-host-packages` with Lean 4.32.2 and MRI Ruby 3.3 with
development headers. Set `LEAN_BRIDGE_LEAN_PREFIX` to the Lean installation
and `LEAN_BRIDGE_RUBY` to the Ruby executable. This local run used MRI 3.3.12
on Linux x86-64 with `LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36`; the release
default remains glibc 2.38. No registry or hosted CI is required.

Both relocated installs finished with zero live native registrations. The four
verified gem archives from this run were:

| Author route | Gem | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| ordinary | `workshop` | 50,099,200 | `7fbb4ac59dd181069ba587176f1ea06a0809d62ad839bebee21fd5375cef4a4d` |
| ordinary | `workshop-peer` | 50,099,200 | `bda39f426d4043c52a9761d978c80ddec0135addd34a9dcc6ae4796a36bce146` |
| reviewed | `workshop` | 50,098,688 | `ff25e6fcdda8604c236b7fcacd0ddd0278490d16ebcf4e51a11e7b49d9e8dd0d` |
| reviewed | `workshop-peer` | 50,098,688 | `2ff522d2975adc06ca8c5860249afc27f96f8cd5c1a288a09cba4a87aa0c1ab7` |

This is the synchronous, statically declared Ruby host-object profile. It does
not establish that a Lean worker may call arbitrary Ruby methods. The archive
set above uses a weak-canonical import. The [mixed-kind follow-up](ruby-host-kinds-20261124.md)
checks strong-canonical retention as well.

## Keep Ruby objects in returned values and declared errors

The [installed consumer](../../tests/fixtures/ruby-host-meter/nominals.rb) used
two different host classes in the same declaration. A returned `Ok` held the
original box; a returned `Err` held the original token. A declared error could
hold the box directly, or hold either object in a nested result. The consumer
closed both bindings, forced GC and compaction, and read each active arm.
It compared objects with `equal?`, including value-equal but distinct tokens.

A fresh binding refused to convert a stale Lean reference into an exception
payload. After clearing it, the same component delivered a declared string
error normally. Both binding orders ended with zero native registrations.
The publisher also rejected a reviewed contract missing the nested error's
lease before it wrote a receipt.

| Source | Gem | Bytes | Gem SHA-256 | Receipt SHA-256 |
| --- | --- | ---: | --- | --- |
| ordinary | workshop | 50,106,880 | `3973d96d1dd0c415567ccbb2eeb93a55345cb6d4fc6eae7486aa1761d7cb860f` | `05398edbb75583f2835b0cea73e4970055beed74da74a48903dbc836fb22c425` |
| ordinary | workshop-peer | 50,106,880 | `b7019ffc1a0b156edaa6091de80cf1b62f086849c92bbbee3f1e9f191cffc833` | `12b8e5bd7155820d643ab4502d3edf20c3c02370904ef821af2bdde0eb4841a0` |
| reviewed | workshop | 50,106,880 | `249b206dad9ab02de6f084d401bd9355fea7519b055c1d7ca67b030182aaec59` | `902cdb3b30ed82b73bd39bd5c011d1f60ae5fbad10e4985ec2c6f531799c89a9` |
| reviewed | workshop-peer | 50,106,880 | `85fba6afcfdcbf8cd9681239b38b2c25f53b5e88649b0de0f8b5f418d2903ebb` | `6de57e8c3a468eb81994a9932b53c644024f372f51703ad740489a46b634366c` |
