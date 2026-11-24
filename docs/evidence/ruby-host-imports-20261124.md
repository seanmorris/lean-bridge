# Checking Ruby host imports against Lean source

A Ruby-owned object is different from a Lean-owned resource used by Ruby. In this [fixture](../../tests/fixtures/ruby-host-meter/Workshop.lean), Lean asks a Ruby class to construct a box and calls its methods. The [import contract](../../tests/fixtures/ruby-host-meter/lean-bridge.hosts.json) declares the member names, types, ownership, and effects. This compiler check precedes the Ruby runtime and gem installation checks.

| Lean export | What the compiler established |
| --- | --- |
| `Workshop.make` and `Workshop.identity` | Both return the declared Ruby box type. One reaches the Ruby constructor; the other reaches the identity method. |
| `Workshop.update` | Reaches the Ruby property setter and getter. Its public contract records mutation. The compiled setter calls `lean_bridge_host_ruby_box_set_level`. |
| `Workshop.read` | Records a synchronous `IO` call with distinct Lean IO and Ruby host failure channels. |
| `Workshop.mapped` | The Lean function converts the host call's error to `EIO String`. Its caller sees the declared string error, not a Ruby exception channel. |

The [test](../../tests/helpers/ruby-host-imports.mjs) resolves the fixture with Lake, compiles the generated module and application, then repeats with a reviewed public Binding IR. Both builds produced the same public IR (SHA-256 `57621490d3f2f3f34a84dc519f81555eddc3619f63b0fb506ca138ee11522621`) and generated host-module C (`b38a771e8096be9f1c54b252ff74309a85689f917195ea608e2df46082ed8492`). The Lean interface hashes matched as well. The test rejects a review that substitutes the getter for the read method, a native symbol from the Python provider, a mismatched callback scheduler, and a source package claiming the generated module.

From the repository root, set `LEAN_BRIDGE_LEAN_PREFIX` to the prefix for Lean 4.32.2 and run `npm run test:ruby-host-imports`. No Ruby interpreter is involved at this stage. Calling these imports on an actual Ruby object from an installed gem requires the runtime provider; the public RubyGems builder does not accept `hostImports` yet.

The existing [Python host-package regression](../../tests/helpers/host-object-project.mjs) passed with the same compiler changes: a locally installed CLI built both ordinary and reviewed wheels, pip installed them offline, and a relocated consumer used its own Python class. Both retained CPython 3.11 host contracts from before the module field was introduced also reproduced their original public IR.
