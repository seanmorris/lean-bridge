# Package a Lean library

Lean Bridge can analyze and package documented public definitions in an ordinary Lake project. The current POC accepts a local checkout as its CLI package. It has no registry release.

## Prerequisites

Install Node 22, Git, and either Nix or Docker. Nix commands require flakes and the `nix-command` feature. The repository pins its Nix input in `flake.lock`, its Docker definition in `containers/builder/manifest.json`, Lean in `lean-toolchain`, and the component graph in `poc/lean-link-spike/graph-lock.json`.

Set two paths and install the CLI from the checkout:

```sh
export LEAN_BRIDGE_CHECKOUT=/path/to/lean-bridge
export LEAN_BRIDGE_WORK=$(mktemp -d)
npm install --global "$LEAN_BRIDGE_CHECKOUT"
lean-bridge --help
```

Prepare one shared runtime. The Nix path is the shorter setup:

```sh
nix --extra-experimental-features 'nix-command flakes' \
  build "$LEAN_BRIDGE_CHECKOUT#universal-core-artifacts" \
  --out-link "$LEAN_BRIDGE_WORK/runtime"
export LEAN_BRIDGE_RUNTIME_ROOT="$LEAN_BRIDGE_WORK/runtime/lazy"
export LEAN_BRIDGE_BUILD_BACKEND=nix
```

The Docker path uses the pinned local toolchains and builder image:

```sh
cd "$LEAN_BRIDGE_CHECKOUT"
npm ci
npm run bootstrap
npm run build:lean-link-spike
npm run build:builder-image
export LEAN_BRIDGE_RUNTIME_ROOT="$LEAN_BRIDGE_CHECKOUT/build/lean-link-spike/lazy"
export LEAN_BRIDGE_BUILD_BACKEND=docker
```

## Create a plain Lake project

Create `lakefile.toml`:

```toml
name = "onboarding-small"
version = "1.0.0"

[[lean_lib]]
name = "OnboardingSmall"
```

Create `lean-toolchain` with the toolchain used by the current fixture:

```text
leanprover/lean4:v4.32.2
```

Create `OnboardingSmall.lean`:

```lean
namespace OnboardingSmall

/-- Add two natural numbers. -/
def add (left right : Nat) : Nat := left + right

/-- Return whether a copied UTF-8 string is empty. -/
def isEmpty (value : String) : Bool := value.isEmpty

end OnboardingSmall
```

Ignore generated output so that later builds do not dirty the source revision:

```gitignore
build/
```

These files contain no Lean Bridge annotation, wrapper, or target-specific source. Commit them before the reproducibility dry run. That command creates two detached clean checkouts of the exact revision.

```sh
git init
git add .gitignore lakefile.toml lean-toolchain OnboardingSmall.lean
git commit -m "Add onboarding component"
```

## Analyze, build, and perform a dry run

Run each command from the Lake project:

```sh
lean-bridge analyze \
  --project . \
  --check \
  --output build/analysis

lean-bridge build \
  --project . \
  --target npm \
  --output build/lean-bridge-release

lean-bridge publish \
  --project . \
  --target npm \
  --dry-run \
  --output build/lean-bridge-dry-run
```

`analyze` reads source and Lake metadata. The explicit output receives `project-analysis.json`, `binding-ir.json`, and `policy-report.json`. It refuses to merge with an existing directory.

`build` compiles one runtime-free component and writes its component-neutral bundle under `build/lean-bridge-release/bundle`. Inspect the component, assurance, runtime requirement, and provenance records:

```sh
find build/lean-bridge-release/bundle -type f -print | sort
```

`publish --dry-run` repeats the build in two clean checkouts, compares every byte and file mode, and writes the authorized local candidate. It reads no registry credential and performs no registry write.

```sh
find build/lean-bridge-dry-run/release/packages/npm -maxdepth 1 -type f -print | sort
sed -n '1,200p' build/lean-bridge-dry-run/evidence/reproducibility.json
sed -n '1,200p' build/lean-bridge-dry-run/publish-manifest.json
```

Verify the copied package receipt and both referenced archives:

```sh
node "$LEAN_BRIDGE_CHECKOUT/scripts/verify-component-package-receipt.mjs" \
  --receipt build/lean-bridge-dry-run/release/packages/npm/component-package-receipt.json
```

The verifier recalculates the receipt identity and archive hashes. A passing dry run is local evidence. It does not publish to npm.

## Current export rules

The source analyzer proposes exports for public `def`, `opaque`, and `abbrev` declarations with explicit supported parameter and result types. It skips `private`, `protected`, `unsafe`, `partial`, and existing `@[extern]` declarations. Theorems remain assurance references and are not host callables. Duplicate unqualified host names require an explicit naming decision.

The statically inferred POC accepts these primitive types:

- `Unit`, `Bool`, `UInt8`, `UInt16`, `UInt32`, and `UInt64`;
- `Int8`, `Int16`, `Int32`, `Int64`, `Nat`, and `Int`;
- `Float32`, `Float`, `String`, and `ByteArray`; and
- nested `Array T`, `Option T`, and `Except E T` when their arguments are supported.

`IO T` and `Task T` use Promise delivery for a supported `T`. `EIO`, function parameters, function results, implicit parameters, instance parameters, unsupported structures, and ambiguous foreign declarations require an adapter decision. Existing reviewed Binding IR can describe richer generated surfaces than the source-only inference path.

## Adapter questions

Analysis remains noninteractive unless you pass `--interactive`. A required question identifies the declaration, reason, and closed choices in human or JSON output. Current questions cover:

- exclusion or a reviewed contract for `@[extern]` declarations;
- exclusion or an adapter for unsupported types, effects, and callable shapes;
- host qualification, renaming, or exclusion for public-name collisions; and
- component selection when a project contains several Binding IR documents.

Resolve required questions before `build`. The CLI does not write a guessed adapter into Lean source.

## Exit codes

| Code | Meaning |
|---:|---|
| 0 | The command succeeded. |
| 1 | The command ran and failed. |
| 2 | A capability or required decision blocked the command. |
| 64 | Syntax or configuration was invalid. |
| 130 | The command was cancelled. |

Use `--json --progress none` for one machine-readable result. A first interrupt returns 130 after cancelling the active process.

## Common failures

| Diagnostic | Cause | Action |
|---|---|---|
| `component-adapter-hints-required` | A declaration has an unsupported or ambiguous boundary. | Run `analyze --json`, then exclude it or supply a reviewed Binding IR adapter. |
| `analysis-output-exists` or `build-output-exists` | The requested output is not empty. | Choose a new output path. Outputs are atomic and never merged. |
| `source-not-git` | The dry-run project is outside Git. | Initialize Git and commit the package inputs. |
| `source-tree-dirty` | A tracked or untracked project input changed after the candidate revision. | Commit the intended input or remove the unrelated file from the project. |
| `docker-unavailable` or `nix-unavailable` | The selected isolated builder is not installed. | Install the selected builder or choose the other pinned path. |
| `shared-runtime-package-unavailable` | The CLI cannot find `main.mjs` and `main.wasm`. | Set `LEAN_BRIDGE_RUNTIME_ROOT` to the prepared lazy runtime directory. |
| `package-ineligible` | The requested projection lacks a required runtime artifact or adapter. | Check the [consumer support contract](consumer-support.v1.json) before selecting another target. |

The executable onboarding fixture lives at `tests/fixtures/onboarding/small`. The [plain project acceptance record](evidence/plain-project-package-acceptance.md) retains its build, install, call, and receipt results.
