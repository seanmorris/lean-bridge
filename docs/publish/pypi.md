# Build and publish Python packages

Build an ordinary Lake project into a prepared Python wheel with `--target pypi`. Consumers install it with pip and call typed Python functions without compiling Lean or configuring native libraries. Ordinary wheels also support synchronous primitive callbacks and returned Lean closures. The separate Alpha projection remains available for its resource fixture.

For ordinary-source builds, declare the library's [description, authors and URLs](../publishing.md#declare-package-metadata) once in `lean-bridge.exports.json`.

Upload the generated platform wheel with Twine, then download and verify that same file before running the Python consumer. Twine uploads existing distribution files without rebuilding them. This guide uses TestPyPI for the operator-authorized registry exercise. [Twine documentation](https://twine.readthedocs.io/en/stable/).

## Build an ordinary Lean project

Prepare the source and select exports using [shared export configuration](../lean/existing-package.md#configure-exports). The ordinary Python path accepts pure functions over nineteen copied primitives, concrete copied aliases, arrays, Lists, acyclic records, tagged variants, `Option`, `Except` and nested binary products, plus synchronous primitive callbacks and returned closures. Set the distribution name and an exact normalized three-part PEP 440 version:

```json
{
  "schemaVersion": 1,
  "modules": ["Iris"],
  "exports": ["Iris.echo_u32", "Iris.echo_nat", "Iris.echo_text", "Iris.array_u32"],
  "targets": {
    "pypi": { "name": "iris-api", "version": "2.0.0rc1" }
  }
}
```

Use a lowercase hyphen-separated distribution name you own. Python imports follow the compiled component name, not the distribution name: component `iris` becomes `lean_iris`. Release versions such as `1.2.3`, `2.0.0rc1` and `1.2.3.post1` are accepted. The development default is `0.0.0+local`; choose a public version before uploading to PyPI.

On Linux x86-64 with the pinned Lean toolchain, native C compiler and Python 3.11 or newer available, run:

```sh
lean-bridge build --project ./iris --target pypi --output ./release-iris
```

Set `LEAN_BRIDGE_PYTHON` to an absolute interpreter path if Python is not available as `python3`. The build checks generated Python syntax without loading ambient Python modules. It creates `release-iris/archives/iris_api-2.0.0rc1-py3-none-manylinux_2_38_x86_64.whl`. The wheel contains generated functions, frozen record classes, stubs, verified native libraries, compiler receipts and license notices. It needs no extension build or setuptools at installation. This path emits a wheel, not an sdist.

Deep type annotations use standard `TypeAliasType` boundaries while keeping
precise list-or-tuple inputs and tuple results. For these packages, wheel metadata
declares `typing_extensions>=4.6,<5` on Python 3.11 only. pip handles that dependency;
Python 3.12 and newer use the standard library. Do not tell consumers to disable
dependency resolution. For disconnected deployments, prepare a wheelhouse using
the [offline installation recipe](../consume/python.md#ordinary-project-packages).
The package-set receipt covers your original wheel, not third-party dependencies.

Repeat `--target` to combine PyPI with npm, CPAN, C, C++, Cargo, NuGet, Maven, RubyGems or WIT/WASI when their type profiles all accept the exports. Lean compiles once per required native/Wasm profile. A failed projection leaves no partial release directory.

Before upload, run `lean-bridge verify --receipt ./release-iris/package-set-receipt.json` and the [installed Python example](../consume/python.md#ordinary-project-packages). Distribute the receipt, its `.json.sha256` sidecar and the original `archives/` paths with the wheel for [Node-only verification](../consume/receive-package.md#verify-a-local-package-set). These unsigned checks detect byte and metadata drift; they do not authenticate the publisher. The [acceptance record](../evidence/native-python-20260915.md) covers relocated builds, offline pip installation, cleanup and shared-runtime composition.

Use the Twine upload and download checks below for an ordinary wheel too. The Alpha-specific source projection and preflight are separate.

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
`targets.pypi` to a distribution name and version you own. Build with
`--target pypi` as above. The generated module is `lean_parcels`, and its
`Parcel` class takes `label` and `counts` fields.

Arrays and acyclic records can nest with the other supported copied types.
Python callers use the generated dataclasses, ordinary integers and lists or
tuples. Returned arrays are independent tuples. Required fields retain their
order and meaning; reserved Python names gain a trailing underscore, with
collisions rejected before packaging. Run the
[consumer example](../consume/python.md#arrays-and-records) against the original
wheel before publishing. The [installed collection record](../evidence/python-collections-20260922.md)
covers both source paths, Python 3.11/3.12, exact typing and conversion-failure cleanup.

## Export options, results and products

Both ordinary-source and reviewed-IR builds compile `Option T`, `Except E T`
and `A × B`. Their contents can use all nineteen primitives, arrays, Lists, acyclic
records and these constructors recursively, within the 32-level type limit.
Python receives generated `Some`, `Ok` and `Err` wrappers and binary tuples.
Unit and nested options retain their presence; success and error retain their
branch when payload types match. `Except` errors remain returned values.

The wheel includes the wrappers, type aliases and stubs. Consumers need no
constructor numbers, serialization layer or manual runtime configuration.
Python conversions and native copies each have a 16 MiB call budget. Resources,
callbacks inside copied values and recursive data types are not admitted.
Compound arguments/results inside callables remain unsupported.

Run the [compound consumer example](../consume/python.md#options-results-and-products)
before publishing. The [acceptance record](../evidence/python-compounds-20260920.md)
covers both source paths, offline installation, nested values and cleanup.
Combined builds require every selected target to support the same API.

## Export copied Lists

Export `List` parameters, results or record fields without a target-specific
annotation. Python accepts exact lists or tuples and returns owned tuples.
Lists can nest with arrays, copied records, options, results and binary products.
Their conversion limits match the other copied containers. List and Array keep
distinct contract types even though both use Python sequences. List callback
payloads remain unsupported. See the [consumer example](../consume/python.md#lists)
and [installed checks on both source paths](../evidence/python-lists-20260920.md).

## Export named copied aliases

Concrete `abbrev` and type-valued `def` aliases retain public names as Python
`TypeAlias` declarations. Both source paths preserve checked alias targets and
chains in the contract. Functions and record fields use the named annotations;
the private adapter keeps the target's storage, validation and cleanup rules.
Aliases can name supported primitives, copied records, arrays, Lists, options,
results and binary products. Names that collide with Python builtins, functions,
records or generated helpers fail before packaging.

An alias of `Unit` emits `TypeAlias = None`, which strict type checkers accept.
An alias of `Nat` still rejects negative values. Python's numeric annotations do
not encode fixed-width ranges, so runtime validation remains necessary.
See the [consumer example](../consume/python.md#named-aliases) and
[installed wheel and stub checks](../evidence/python-aliases-20260921.md).
Generic and recursive aliases, and compound callable payloads
still need adapter support.

## Export tagged variants

Export functions over concrete, non-recursive Lean inductives without a
Python-specific annotation. Both source paths compile typed constructor helpers
and include named frozen dataclasses and union annotations in the wheel.
For a Lean `Signal.data` constructor, the public class is `SignalData`.
Case classes support structural pattern matching; consumers do not pass Lean
constructor numbers or configure the runtime.

Payloads can contain all nineteen primitives and supported copied containers,
records and other variants. The adapter reads only the active case and releases
native output even if Python conversion raises. Generated constructor names and
escaped field names must be unique. Naming collisions fail before compilation.
Recursive, generic, indexed, callable and identity-bearing payloads remain
outside this projection.

Run the [variant consumer example](../consume/python.md#tagged-variants) before
publishing. The [installed acceptance record](../evidence/python-variants-20260921.md)
covers original offline-installed wheels, independent source contracts, strict
type checking and failure cleanup. Combined builds require every selected
target to accept the same signatures.

## Export callbacks and closures

Callback arguments and results can use any of the nineteen primitives. The generated Python API accepts typed callables and returns callable `LeanClosure` objects with `close()` and context-manager support. Consumers do not write native declarations.

For example, add these definitions to your Lean module:

```lean
namespace Callables
def callNat (value : Nat) (callback : Nat → Nat) : Nat := callback value
def makeString (captured : String) : Bool → String → String :=
  fun useCaptured value => if useCaptured then captured else value
end Callables
```

Select both exports and set `"arities": { "Callables.makeString": 1 }` in `lean-bridge.exports.json`. That arity leaves the final two arguments in the returned closure. For a [reviewed contract](../lean/existing-package.md#compile-a-reviewed-contract), the outer signature determines the arity instead; omit configuration `arities`.

Both source paths enforce synchronous value delivery, repeated invocation, same-agent re-entry, deferred self-disposal and the native callback failure policy. Host callbacks are call-scoped borrows; returned closures are explicit leases. Retained host callbacks, callable containers and asynchronous delivery are rejected. All native-runtime targets admit primitive callables. Combined builds still require every selected target to accept the same API and author configuration.

Run the [installed callable example](../consume/python.md#callbacks-and-returned-lean-closures) before publishing. The [acceptance record](../evidence/python-callables-20260918.md) includes exact wheel identities, source-hidden offline installation and lifetime checks.

## Choose the package name and platform

This section describes the Alpha fixture's fixed coordinates.

The universal Alpha fixture produces distribution `lean-bridge-alpha==0.0.0`, imported as `lean_alpha`. Its supported wheel is `lean_bridge_alpha-0.0.0-py3-none-manylinux_2_38_x86_64.whl`: Python 3.11 or newer, Linux x86-64, and glibc 2.38 or newer. Keep that platform tag intact.

TestPyPI has its own accounts and package database. Establish ownership of the project name there and obtain a TestPyPI token through the registry's account controls. Do not use production credentials. The fixture name does not establish ownership; use it only in a registry you control. For a different public name or version, regenerate the canonical package mapping and artifacts through the reviewed build workflow before freezing the release. The builder has no `--name` override. [TestPyPI account and upload guide](https://packaging.python.org/en/latest/guides/using-testpypi/).

## Build and verify the candidate

This section describes the repository's reviewed Alpha bundle, not the ordinary source build above.

From the checkout, prepare the native universal bundle using the [example artifact build instructions](../consume/receive-package.md#build-the-example-artifacts-as-a-maintainer), then project it into a new directory:

```sh
node scripts/build-pypi-package.mjs \
  --bundle build/consumer-universal-bundle --output build/publish-pypi-package
```

The builder emits a wheel, an sdist, a wheel preflight script, and a projection record. It copies the native libraries already recorded in the bundle. The sdist is an additional source distribution; rebuilding it does not reproduce the approved wheel automatically. The supported consumer recipe installs the original platform wheel.

For a reproducible universal candidate, use a clean committed checkout:

```sh
node scripts/lean-bridge.mjs publish --project . --target pypi --dry-run \
  --output build/pypi-release-gate
npm run verify:release-authorization -- \
  --authorization build/pypi-release-gate \
  --candidate build/pypi-release-gate/release
```

The universal `pypi` target records both the wheel and sdist. Review their coordinates, paths, and hashes. A complete transaction for that target would publish both approved files. The wheel-only TestPyPI exercise below produces a separate manual sandbox record.

The stock CLI has no PyPI registry adapter. A successful package build or dry run does not supply one. Twine does not create Lean Bridge's signed publication attestation, transaction record, or completion receipt. Project production releases still require the [shared approvals and reviewed integration](../publishing.md#build-and-approve-the-same-artifacts).

## Check the wheel locally

Use an isolated Python environment on the supported native platform. Install the publisher tool separately from the package being released:

```sh
python3 -m venv .publish-venv
./.publish-venv/bin/python -m pip install twine==7.0.0
export LEAN_BRIDGE_PYPI_WHEEL=/absolute/path/to/approved-platform-wheel.whl
export LEAN_BRIDGE_PYPI_NAME=your-owned-lean-package
export LEAN_BRIDGE_PYPI_VERSION=0.1.0
./.publish-venv/bin/python -m twine check --strict "$LEAN_BRIDGE_PYPI_WHEEL"
sha256sum "$LEAN_BRIDGE_PYPI_WHEEL"
```

Replace the example variables with the reviewed metadata and actual wheel filename. Compare the hash with the candidate record. `twine check` checks distribution metadata and description rendering; the [Python consumer](../consume/python.md) supplies the execution and cleanup checks. Run that consumer against the local wheel before uploading.

Alpha releases also include an optional Node-based wheel diagnostic. Ordinary releases do not need it:

```sh
export LEAN_BRIDGE_PYPI_PREFLIGHT=/absolute/path/to/python-wheel-preflight.mjs
node "$LEAN_BRIDGE_PYPI_PREFLIGHT" --wheel "$LEAN_BRIDGE_PYPI_WHEEL" \
  --python ./.publish-venv/bin/python
```

## Upload to TestPyPI

Have the approved secret provider supply `TWINE_PASSWORD` with the TestPyPI API token for this command. Twine 7 selects token authentication automatically for PyPI and TestPyPI; `TWINE_USERNAME=__token__` is not required by this pinned version. Do not put the token in a shell command, committed `.pypirc`, transcript, or release report. After the operator approves the external write:

```sh
./.publish-venv/bin/python -m twine upload \
  --repository-url https://test.pypi.org/legacy/ --non-interactive \
  "$LEAN_BRIDGE_PYPI_WHEEL"
```

The explicit upload URL keeps the exercise on TestPyPI. Avoid `--skip-existing`: a filename collision needs a byte comparison, not a skipped check. If publishing an approved sdist too, pass its exact filename in addition to the wheel and verify both downloads. Twine's upload and authentication options are documented in its [command reference](https://twine.readthedocs.io/en/stable/#twine-upload).

## Publish to PyPI

Complete [production review](../publishing.md#build-and-approve-the-same-artifacts) for the exact coordinates, files, credentials, and publisher implementation. Establish ownership of the project on PyPI separately from TestPyPI. Have the secret provider replace `TWINE_PASSWORD` with the authorized PyPI token; TestPyPI tokens do not authenticate to PyPI.

The operator-approved upload uses PyPI's production endpoint:

```sh
./.publish-venv/bin/python -m twine upload \
  --repository-url https://upload.pypi.org/legacy/ --non-interactive \
  "$LEAN_BRIDGE_PYPI_WHEEL"
```

Pass the approved sdist filename too if it belongs to this release. Verify production downloads with `--index-url https://pypi.org/simple/` in the next section. The upload still does not create Lean Bridge's signed transaction records, and it must not be used to bypass a project's blocked release approval. [PyPI and TestPyPI repository endpoints](https://packaging.python.org/en/latest/specifications/pypirc/).

## Download, compare, and install

Run these commands on the wheel's supported platform. Use a new download directory and disable the pip cache:

```sh
mkdir -p build
LEAN_BRIDGE_PYPI_CHECK_DIR=$(mktemp -d "$(pwd)/build/pypi-registry-check.XXXXXX")
./.publish-venv/bin/python -m pip download --no-cache-dir --no-deps \
  --only-binary=:all: --index-url https://test.pypi.org/simple/ \
  --dest "$LEAN_BRIDGE_PYPI_CHECK_DIR" \
  "$LEAN_BRIDGE_PYPI_NAME==$LEAN_BRIDGE_PYPI_VERSION"
LEAN_BRIDGE_PYPI_DOWNLOADED="$LEAN_BRIDGE_PYPI_CHECK_DIR/$(basename "$LEAN_BRIDGE_PYPI_WHEEL")"
cmp "$LEAN_BRIDGE_PYPI_WHEEL" "$LEAN_BRIDGE_PYPI_DOWNLOADED"
sha256sum "$LEAN_BRIDGE_PYPI_WHEEL" "$LEAN_BRIDGE_PYPI_DOWNLOADED"
```

The download must have the expected filename and identical bytes. `--only-binary=:all:` prevents an sdist rebuild from silently replacing the reviewed wheel. `--no-deps` prevents this fixture check from fetching unrelated packages. Do not add another package index to compensate for a missing release. [pip download](https://pip.pypa.io/en/stable/cli/pip_download/).

Create a fresh consumer venv, install the downloaded wheel with dependency resolution enabled, and execute the matching [Python example](../consume/python.md). For an offline check, use `--no-index --find-links ./wheelhouse` with the prepared dependency wheels. Alpha consumers can run the optional packaged preflight first. Record the program's visible output and cleanup result. Retain the downloaded hash, filename, version, TestPyPI project URL, and any upload response alongside the approved candidate. PyPI's [release JSON API](https://docs.pypi.org/api/json/#get-a-release) also exposes per-file URLs and SHA-256 digests for comparison.

If a reviewed integration produced a signed Lean Bridge receipt, give consumers that receipt, its verifier, and the independently trusted signer-policy hash. A successful Twine upload alone does not produce those records.

## Recover a failed or partial upload

After a timeout, inspect the exact TestPyPI release and compare its downloadable files before retrying. Retry only missing approved files; stop on a hash mismatch. An accepted filename cannot be reused for replacement bytes, even after deletion. Publish a corrected version through a new review instead. [PyPI filename reuse policy](https://pypi.org/help/#file-name-reuse).

Keep a manual sandbox record distinct from a completed multi-file universal transaction. [Sandbox release](../contributing/sandbox-release.md#rehearse-a-registry-release) and [Publishing](../publishing.md) explain the records required for the shared release flow.

### Publish Python wheels to PyPI

The package-manager recipe above remains available at this address. Return to [target selection](../publishing.md) or [consumer installation](../consume.md).
