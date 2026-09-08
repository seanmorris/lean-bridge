# Proofs and assurance metadata

The [first component](first-component.md) proves that swapping the inputs to `add` preserves its result:

```lean
theorem add_commutative (left right : Nat) :
    add left right = add right left :=
  Nat.add_comm left right
```

Lean unfolds `add` to natural-number addition. `Nat.add_comm` supplies a proof for every pair of natural numbers, including values not exercised by the JavaScript example.

## Check the theorem

From the Lake project, run:

```sh
lean -DwarningAsError=true OnboardingSmall.lean
```

The file includes `#print axioms add_commutative`. Expected output:

```text
'OnboardingSmall.add_commutative' does not depend on any axioms
```

The strict warning option rejects `sorry`. Default Lean compilation reports `sorry` as a warning and can return a successful exit code. Keep the strict check in the author workflow.

## Read the relationship record

The analyzer finds a reference to `add` in the theorem statement. After analysis, select its record:

```sh
node --input-type=module -e '
import fs from "node:fs";
const ir = JSON.parse(fs.readFileSync("build/analysis/binding-ir.json", "utf8"));
const { subject, state, theorems } = ir.assurance.find(item => item.subject === "lean:OnboardingSmall.add");
console.log(JSON.stringify({ subject, state, theorems }, null, 2));
'
```

Expected output:

```json
{
  "subject": "lean:OnboardingSmall.add",
  "state": "unverified",
  "theorems": [
    "OnboardingSmall.add_commutative"
  ]
}
```

The analyzer reads source. It does not execute the Lean checker or assess what a theorem guarantees. The package's `metadata/assurance.json` retains this record unchanged after compilation.

The ordinary component build has no artifact-bound theorem audit that upgrades this relationship to `proved`. The strict command above checks the theorem; the package receipt checks the archive identities. Neither operation changes that metadata state.

## Keep exports separate from proofs

The generated package exports `add` and `isEmpty`. It does not export `add_commutative`, and no theorem is attached to `isEmpty` in this example.

Commutativity also has a specific meaning: both argument orders return the same result. It does not state a limit on the result or prove a JavaScript input validator. To claim a different property, state and check another theorem.

## Test a failing proof

In a disposable copy of the file, replace the implementation of `add` with `left` while keeping the theorem. The strict Lean command fails because returning only the first input is not commutative.

Replacing the proof with `by sorry` also fails the strict command. The [author acceptance runner](../../scripts/check-lean-author-tutorial.mjs) exercises both rejection cases without modifying the committed tutorial source.

Return to [the component build](first-component.md#build-the-component) after restoring the checked file. See [export decisions](export-decisions.md) when changing a function's public shape.
