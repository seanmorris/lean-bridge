# Build your first component

Create a Lake project that exports addition and a string predicate. Check its commutativity theorem, build local npm archives, and call both functions from a separate JavaScript project.

Complete [author setup](setup.md) first. The commands below use its `LEAN_BRIDGE_WORK`, `LEAN_BRIDGE_RUNTIME_ROOT`, and `LEAN_BRIDGE_BUILD_BACKEND` variables.

## Create the project files

```sh
mkdir "$LEAN_BRIDGE_WORK/onboarding-small"
cd "$LEAN_BRIDGE_WORK/onboarding-small"
```

Create `lakefile.toml`:

```toml
name = "onboarding-small"
version = "1.0.0"

[[lean_lib]]
name = "OnboardingSmall"
```

Create `lean-toolchain`:

```text
leanprover/lean4:v4.32.2
```

Create `.gitignore`:

```gitignore
build/
.lake/
```

Create `OnboardingSmall.lean`:

```lean
namespace OnboardingSmall

/-- Add two natural numbers. -/
def add (left right : Nat) : Nat := left + right

/-- Return whether a copied UTF-8 string is empty. -/
def isEmpty (value : String) : Bool := value.isEmpty

/-- Swapping the inputs preserves the sum. -/
theorem add_commutative (left right : Nat) :
    add left right = add right left :=
  Nat.add_comm left right

#print axioms add_commutative

end OnboardingSmall
```

The two `def` declarations become host functions. The theorem remains Lean evidence and does not become a JavaScript export.

Declare the package license in `package.json`:

```json
{ "license": "MIT" }
```

Add a `LICENSE` file containing your license text and copyright notice. The tutorial uses the [MIT license](../../LICENSE). Choose the license that applies to your own code. Publication requires an explicit license and its text; neither is inferred from a repository URL.

## Check and commit the source

```sh
lean -DwarningAsError=true OnboardingSmall.lean
```

Expected output:

```text
'OnboardingSmall.add_commutative' does not depend on any axioms
```

The [proof lesson](proofs-and-assurance.md) explains this result and the separate assurance record. Commit the source and license before asking the reproducibility gate to clone them:

```sh
git init
git add .gitignore lakefile.toml lean-toolchain OnboardingSmall.lean package.json LICENSE
git commit -m "Add documented Lean component"
```

## Analyze the public functions

```sh
lean-bridge analyze \
  --project . \
  --check \
  --output build/analysis
```

The command creates `project-analysis.json`, `binding-ir.json`, and `policy-report.json` inside `build/analysis`. It proposes `OnboardingSmall.add` and `OnboardingSmall.isEmpty` with no required adapter decisions.

Inspect the public names and theorem relationships:

```sh
node --input-type=module -e '
import fs from "node:fs";
const ir = JSON.parse(fs.readFileSync("build/analysis/binding-ir.json", "utf8"));
console.log(ir.declarations.map(item => item.name));
console.log(ir.assurance.map(({ subject, state, theorems }) => ({ subject, state, theorems })));
'
```

Both relationship states are `unverified`. The `add` record names `OnboardingSmall.add_commutative`; the `isEmpty` record has no theorem. Source analysis records references without checking their proofs.

## Build the component

```sh
lean-bridge build \
  --project . \
  --target npm \
  --output build/lean-bridge-release
```

The isolated builder compiles the source and generated adapter, then audits the resulting component. Its component-neutral bundle lives in `build/lean-bridge-release/bundle`.

| Bundle path | Contents |
| --- | --- |
| `artifacts/` | The compiled component without an embedded runtime binary. |
| `binding/binding-ir.json` | Public declarations, value types, documentation, and assurance references. |
| `metadata/assurance.json` | The analyzer's relationship records, still `unverified`. |
| `metadata/runtime-requirement.json` | The shared runtime identity required by this component. |
| `metadata/provenance.json` | Source, build-plan, compiler, and linker identities. |
| `source/` | The source inputs used for this build. |

Each output directory must be absent before the command starts. Choose a new path for another build; commands do not merge outputs.

## Create and verify local archives

```sh
lean-bridge publish \
  --project . \
  --target npm \
  --dry-run \
  --output build/lean-bridge-dry-run
```

The dry run clones the committed project twice, builds both copies, and compares their output bytes and file modes. It writes a local candidate and makes no registry write.

```sh
node build/lean-bridge-dry-run/release/packages/npm/verify-component-package-receipt.mjs \
  --receipt build/lean-bridge-dry-run/release/packages/npm/component-package-receipt.json
```

The standalone verifier checks the receipt identity and both archive hashes. Keep the receipt, verifier, component archive, and runtime archive together. The [publishing pipeline](../../src/release/README.md#publication-and-receipts) describes the separate release authorization flow.

## Call the installed package

Create a consumer outside the source project and install the archive names recorded by the receipt:

```sh
export LEAN_BRIDGE_PACKAGE_DIR="$LEAN_BRIDGE_WORK/onboarding-small/build/lean-bridge-dry-run/release/packages/npm"
mkdir "$LEAN_BRIDGE_WORK/consumer"
cd "$LEAN_BRIDGE_WORK/consumer"
npm init -y
node --input-type=module -e '
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const root = process.env.LEAN_BRIDGE_PACKAGE_DIR;
const receipt = JSON.parse(fs.readFileSync(path.join(root, "component-package-receipt.json"), "utf8"));
execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund",
  path.join(root, receipt.runtime.archive), path.join(root, receipt.package.archive)], { stdio: "inherit" });
'
node --input-type=module -e '
import { add, isEmpty } from "onboarding-small";
console.log(add(100n, 23n));
console.log(isEmpty(""));
console.log(isEmpty("browser"));
'
```

Expected output from the final command:

```text
123n
true
false
```

The generated package exposes `Nat` as nonnegative `bigint` and preserves arbitrary precision. The installed-package checks cover values beyond `2^64`, including 4,096-bit integers.

Continue with [JavaScript and TypeScript](../javascript-typescript.md), or inspect [export decisions](export-decisions.md) before adding another public function.

The executable source is [the author fixture](../../tests/fixtures/documentation/lean-author/OnboardingSmall.lean). The [tutorial acceptance runner](../../scripts/check-lean-author-tutorial.mjs) checks this source, its theorem metadata, the local dry run, and the installed package.
