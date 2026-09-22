# Build and publish Ruby packages

Build an ordinary Lean project with `--target rubygems` to produce an installable gem. Generated Ruby APIs support all nineteen primitives, nested arrays and Lists, acyclic copied records, tagged variants, options, results, nested binary products, named copied aliases, synchronous primitive callbacks and returned Lean closures. Consumers install the package without compiling Lean or writing native conversions.

For ordinary-source builds, declare the library's [description, authors and URLs](../publishing.md#declare-package-metadata) once in `lean-bridge.exports.json`.

Build and validate the generated gem, then upload its exact bytes to a gem server controlled by your organization. Rehearse against a sandbox with credentials that cannot publish to production.

## Build an ordinary Lean project

Use the [author toolchain](../contributing/author-toolchain.md), a native C compiler and MRI Ruby 3.3 with RubyGems. Set `LEAN_BRIDGE_RUBY` to the Ruby executable if it is not on PATH. The current native profile is Linux x86-64 with glibc 2.38 or newer.

Select modules and functions in `lean-bridge.exports.json`:

```json
{
  "schemaVersion": 1,
  "modules": ["Willow"],
  "exports": ["Willow.echo_nat", "Willow.echo_text", "Willow.matrix"],
  "targets": {
    "rubygems": { "name": "willow-api", "version": "2.0.0.rc.1" }
  }
}
```

Use a gem name your organization owns, then build into a new directory:

```sh
lean-bridge build --project /absolute/path/to/willow --target rubygems \
  --output /absolute/path/to/willow-release
```

The release contains `archives/willow-api-2.0.0.rc.1-x86_64-linux.gem` and `native-release.json` with its hash. The gem includes Ruby sources, compiled native libraries, compiler evidence and dependency license notices. Its README lists the Lean-derived module and function names. Changing the gem coordinate does not rename that module.

Copied types can nest up to 32 levels, and native input/output conversion shares a 16 MiB budget. Ruby conversion scratch has a separate 16 MiB budget. Recursive values, resources, compound callbacks and asynchronous effects remain outside this ordinary profile. Repeat `--target` to share one native compilation with other native targets when all accept the exports. Add npm when the API fits its [supported shapes](../lean/export-decisions.md#start-with-the-runnable-npm-shapes); that adds one Wasm compilation. A failed target leaves no partial release.

Archive assembly uses RubyGems without invoking a compiler. Test the original gem with the [ordinary Ruby consumer](../consume/ruby.md#call-an-ordinary-lean-package). Verify the release with `lean-bridge verify --receipt /absolute/path/to/willow-release/package-set-receipt.json`. Distribute this receipt, its `.json.sha256` sidecar and the named archives together. The receipt checks local file consistency; it is unsigned.

## Export arrays and records

Add these definitions to `Parcels.lean`:

```lean
namespace Parcels

structure Parcel where
  label : String
  counts : Array Nat

def reverse (value : Parcel) : Parcel :=
  { value with counts := value.counts.reverse }

end Parcels
```

Select `Parcels` in `modules` and `Parcels.reverse` in `exports`, then set
`targets.rubygems` to a gem name and version your organization owns. Build with
`--target rubygems` as above. The generated module is `LeanBridge::Parcels`;
its `Parcel` class takes the required keywords `label:` and `counts:`.

Arrays and acyclic copied records can nest with supported copied types.
Ruby callers use `Array`, exact integers and named record classes. Generated
records and variant constructors provide value equality, hashing and key
pattern matching. Frozen records can contain mutable arrays and strings;
conversions copy those payloads. See the [consumer example](../consume/ruby.md#arrays-and-records).

The [installed collection record](../evidence/ruby-collections-20260922.md)
includes this Lean example and its Ruby caller, original archive identities
and both compiler-checked source paths.

## Export named copied aliases

Declare concrete aliases in Lean and select the functions that use them. No
alias-specific configuration is needed:

```lean
namespace Aliases

abbrev Count := UInt32
abbrev Rows := Array (List Count)

def increment (value : Count) : Count := value + 1
def reverse_rows (value : Rows) : Rows := value.map List.reverse

end Aliases
```

Ruby calls use target values such as `Integer` and nested `Array`. The generated
gem records alias names, unflattened targets and chains in its binding manifest,
README and public API comments, including parameter, result and record-field
types. It does not create alias constants or wrapper classes. Target validation
and copied ownership still apply.

Ordinary-source and reviewed-IR builds share this behavior. A reviewed contract
must retain named alias references and their definitions; replacing them with
flattened primitive or container types fails compiler reconciliation. See the
[consumer example](../consume/ruby.md#named-copied-aliases) and
[installed evidence](../evidence/ruby-aliases-20260921.md). Bounded recursion,
compound callable payloads and identity-bearing alias targets
remain separate work.

## Export copied tagged variants

Select concrete, non-recursive Lean inductives through the normal export
configuration or a reviewed contract. Lean checks each source constructor and
payload before generation. No Ruby-specific variant configuration is required.

Each family becomes a Ruby class with nested constructor classes, such as
`Signal::Data`. Constructors take required keyword arguments and expose
read-only accessors and `deconstruct_keys` for pattern matching. Objects are
frozen, while contained arrays and strings remain mutable copied values. Calls
reject unknown subclasses, invalid fields and null cases. The private Fiddle
adapter checks aligned C union layouts and converts only the active payload.
Generated Lean helpers keep runtime tags and object offsets private.

Payloads can contain all nineteen primitives and supported copied containers,
records and other admitted variants. Generic, indexed, recursive, proof-bearing,
callable and identity-bearing payloads remain outside this copied profile.
Combined native variant builds admit C, C++, Python, Rust, .NET, JVM, Ruby and Perl
when every selected target accepts the complete API.

Use the [consumer example](../consume/ruby.md#tagged-variants) and inspect the
[installed acceptance record](../evidence/ruby-variants-20260921.md) before
publishing the original gem.

## Export Lists

Ordinary-source and reviewed-IR builds support `List T` in inputs, results and copied record fields. Elements can use all nineteen primitives, nested Lists and arrays, records, `Option`, `Except` and binary products. Select concrete exports as usual; no List-specific configuration is required.

Ruby callers use exact `Array` instances. Conversions preserve empty Lists, order, duplicates, nesting and independent result storage. The existing 16 MiB accounting budgets and 32-level type limit apply. List callback payloads remain unsupported. See the [consumer example](../consume/ruby.md#lists) and [installed gem evidence](../evidence/ruby-lists-20260921.md).

## Export options, results and products

Add these definitions to `Compounds.lean`:

```lean
namespace Compounds
def classify (value : Option (Option Unit)) : UInt32 :=
  match value with
  | none => 0
  | some none => 1
  | some (some ()) => 2
def result_nat (value : Except Nat Nat) : Except Nat Nat :=
  match value with
  | .ok value => .error value
  | .error error => .ok error
def tuple_nat (value : Nat × Nat) : Nat × Nat :=
  (value.2, value.1)
end Compounds
```

Select `Compounds` in `modules` and its three functions in `exports`. Set the RubyGems name and version, then use the ordinary build command above. The [consumer example](../consume/ruby.md#options-results-and-products) calls this API without native glue.

Ruby maps `Option` to `nil` or `Some`, `Except` to `Ok` or `Err`, and each `Prod` to an exactly two-element array. Constructors are generated inside the package's public module only when needed. Each call checks the concrete payload types and preserves nested options and products. Mutable payloads are copied. Both ordinary source and [reviewed contracts](../lean/existing-package.md#compile-a-reviewed-contract) have [installed package evidence](../evidence/ruby-compounds-20260920.md); compiler validation still checks reviewed contracts against the Lean definitions.

## Export callbacks and closures

Callback arguments and results can use any of the nineteen primitives. Add these definitions to a Lean module:

```lean
namespace Callables
def callNat (value : Nat) (callback : Nat → Nat) : Nat := callback value
def makeString (captured : String) : Bool → String → String :=
  fun useCaptured value => if useCaptured then captured else value
end Callables
```

Select both exports and set `"arities": { "Callables.makeString": 1 }` in `lean-bridge.exports.json`. That arity leaves the final two arguments in the returned closure. Set `targets.rubygems.name` and `version`, then use the build command above.

For a [reviewed contract](../lean/existing-package.md#compile-a-reviewed-contract), the outer signature determines the arity instead; omit configuration `arities`. The callback contract requires repeated invocation, same-agent re-entry, deferred self-disposal, synchronous value delivery and the native callback failure policy. Arguments borrow the call; returned closures have explicit leases. Both source paths receive fresh Lean compiler checks before linking.

Generated Ruby functions accept callable objects or a final block. Returned `LeanClosure` objects have `call`, `close`, `closed?` and `with` for scoped cleanup. Exceptions return to Ruby after native cleanup. Non-local block exits are rejected. Calls use MRI's default 1:1 threading, and closure invocation stays on its creating thread. See the [consumer example](../consume/ruby.md#callbacks-and-returned-lean-closures) and [installed evidence](../evidence/ruby-callables-20260919.md).

## Build the gem

The separate Alpha fixture retains its resource and callback examples.

From the Lean Bridge checkout with its pinned Nix environment:

```sh
nix --extra-experimental-features 'nix-command flakes' build \
  .#rubygems-package --out-link build/publish-rubygems
```

The fixture writes `build/publish-rubygems/lean_bridge_alpha-0.0.0.gem` and `rubygems-projection.json`. It bundles the Ruby API and native Lean libraries. Consumers use MRI Ruby 3.3 on x86-64 Linux with glibc 2.38 or newer; installation runs no native extension build.

For an existing verified universal bundle, use Ruby 3.3's `gem` command and a new output directory:

```sh
node scripts/build-rubygems-package.mjs \
  --bundle build/consumer-universal-bundle --output build/rubygems-package \
  --gem /absolute/path/to/ruby-3.3/bin/gem
```

Run the [Ruby consumer example](../consume/ruby.md) against the package before publication review. Contributors can also run the [managed acceptance checks](../contributing/testing.md#consumer-acceptance).

## Establish ownership and version

The example gem is `lean_bridge_alpha` version `0.0.0`. Do not upload that fixture to RubyGems.org.

For ordinary projects, set `targets.rubygems.name` and `targets.rubygems.version` before building. Names use lowercase letters, digits, underscores and hyphens. Versions use three numeric parts and an optional dot-separated prerelease, such as `2.0.0.rc.1`. Hyphenated prereleases are rejected to prevent RubyGems from silently changing the version. Review source licenses and author metadata before publication; the generated gem marks the package license as `Nonstandard`.

For the separate Alpha fixture, update the reviewed [universal package mapping](../../src/release/universal-release-bundle.mjs), [Ruby generator](../../src/backends/ruby/generate.mjs), and [Alpha identity/version input](../../poc/lean-link-spike/bindings/alpha.binding-ir.json), then regenerate and test the bundle and gem.

Do not rename the archive or edit its gemspec after candidate approval. For a private package, review generating `allowed_push_host` metadata to restrict the destination; the current generated gemspec does not set it. [RubyGems publishing and private hosts](https://guides.rubygems.org/publishing/)

## Freeze and verify the candidate

For an ordinary release, reproduce the build from another source location, compare its archive hash, and execute a fresh installed consumer. Preserve the original gem and `native-release.json` for review.

The signed-candidate workflow below applies to the universal Alpha bundle, not ordinary gems. Use a clean committed checkout. The publication ecosystem is `rubygems`; its binding target is `ruby`.

```sh
node scripts/lean-bridge.mjs publish --project . --target rubygems --dry-run \
  --output build/rubygems-candidate
```

Recheck the manifest and candidate bytes:

```sh
node --input-type=module -e '
import { verifyPublishManifest } from "./src/release/publish-manifest.mjs";
const result = await verifyPublishManifest({
  manifestPath: process.argv[1], requestedTargets: ["rubygems"]
});
console.log(JSON.stringify(result.manifest.targets, null, 2));
' build/rubygems-candidate/publish-manifest.json
```

Use the reviewed archive path, name, version, and hash. Retain the [sandbox record](../contributing/sandbox-release.md#rehearse-a-registry-release) and complete the [production approvals](../publishing.md#build-and-approve-the-same-artifacts) for the chosen host.

The installed CLI has only the npm transaction adapter. `gem push` does not create a Lean Bridge signed completion receipt. A reviewed integration must bind the actual host and authority; a universal manifest naming RubyGems.org does not authorize a different private host.

## Authenticate and push

Set the non-secret archive path and controlled endpoint:

```sh
export LEAN_BRIDGE_GEM_ARCHIVE=/absolute/path/to/the-reviewed-package.gem
export LEAN_BRIDGE_GEM_HOST=https://gems.example.invalid
```

Replace the placeholders with approved values. Your credential provider injects `GEM_HOST_API_KEY`; give it push access to the owned gem, not owner-management or yank permissions unless that job requires them. Keep the token out of source files, shell history, and logs. [RubyGems API-key scopes and environment authentication](https://guides.rubygems.org/api-key-scopes/)

An authorized operator runs:

```sh
set +x
: "${GEM_HOST_API_KEY:?Supply the approved gem-host credential}"
gem push "$LEAN_BRIDGE_GEM_ARCHIVE" --host "$LEAN_BRIDGE_GEM_HOST"
```

The explicit `--host` selects the intended gem server. If that server requires MFA or another authentication flow, use its approved interactive or CI credential workflow rather than weakening account protection. [RubyGems push command](https://guides.rubygems.org/command-reference/#gem-push)

### Publish to RubyGems.org

After the owned name, regenerated package, sandbox record, and production approvals are ready, select RubyGems.org and run the same push command:

```sh
export LEAN_BRIDGE_GEM_HOST=https://rubygems.org
```

The account represented by `GEM_HOST_API_KEY` must own the gem or have permission to create its unused name. If the generated gem has `allowed_push_host`, it must agree with this reviewed public destination. [RubyGems.org publication and ownership](https://guides.rubygems.org/publishing/)

## Download, compare, and install

Set the name and version from the reviewed candidate. Use a new download directory and clear default gem sources for this fetch:

```sh
export LEAN_BRIDGE_GEM_NAME=your_owned_gem
export LEAN_BRIDGE_GEM_VERSION=1.0.0
mkdir build/rubygems-published-download
cd build/rubygems-published-download
gem fetch "$LEAN_BRIDGE_GEM_NAME" --version "$LEAN_BRIDGE_GEM_VERSION" \
  --platform x86_64-linux --clear-sources --source "$LEAN_BRIDGE_GEM_HOST"
export LEAN_BRIDGE_GEM_FILE="$LEAN_BRIDGE_GEM_NAME-$LEAN_BRIDGE_GEM_VERSION-x86_64-linux.gem"
cmp "$LEAN_BRIDGE_GEM_ARCHIVE" "$LEAN_BRIDGE_GEM_FILE"
sha256sum "$LEAN_BRIDGE_GEM_FILE"
```

Ordinary gems use the `x86_64-linux` platform suffix. The Alpha fixture uses the generic `ruby` platform and has no filename suffix; select that platform and filename when downloading the fixture. If the private host requires download authentication, configure its approved read credential separately. `GEM_HOST_API_KEY` authenticates publication; do not assume it configures every private download client. [RubyGems fetch command](https://guides.rubygems.org/command-reference/#gem-fetch)

The downloaded digest must match the reviewed manifest. Install only after comparison:

```sh
export GEM_HOME="$PWD/.gems"
export GEM_PATH="$GEM_HOME"
gem install "$LEAN_BRIDGE_GEM_FILE" --local --install-dir "$GEM_HOME" --no-document
```

Run the [Ruby program](../consume/ruby.md#write-the-application) against that installation. Save its output, the host, coordinate, upload result, and downloaded hash with the candidate.

Where an integrated publisher supplies a signed receipt, also run [recipient archive verification](../consume/receive-package.md#authenticate-a-signed-archive) with the separately trusted signer-policy identity.

## Recover a failed or incorrect release

After an interrupted upload, fetch the existing version and compare it before retrying. Matching bytes establish that the archive arrived; mismatched bytes require investigation and a new reviewed version.

If the release owner authorizes removal, `gem yank` removes the selected version from the host's index. RubyGems.org also removes the gem file, but mirrors may already have copied it. Rotate any exposed secrets even after a yank. [RubyGems removal policy](https://guides.rubygems.org/removing-a-published-gem/)

Use a new reviewed version for corrected content; do not use yanking to replace the archive under an existing release identity.

Keep the failed upload records, original archive, and recovery decision. Do not grant a publishing token yank rights merely to make retries easier.

### Publish a RubyGem

The package-manager recipe above remains available at this address. Return to [target selection](../publishing.md) or [consumer installation](../consume.md).
