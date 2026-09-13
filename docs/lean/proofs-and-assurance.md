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

The compiler-backed analyzer finds a direct reference to `add` in the elaborated theorem statement. After analysis, create `build/inspect-proof.mjs`:

```js
import fs from "node:fs";
const report = JSON.parse(fs.readFileSync("build/analysis/project-analysis.json", "utf8"));
const { declaration, theoremCandidates } = report.exportCandidates.find(item => item.declaration === "OnboardingSmall.add");
console.log(JSON.stringify({ declaration, theoremCandidates }, null, 2));
```

Run `node build/inspect-proof.mjs`. Expected output:

```json
{
  "declaration": "OnboardingSmall.add",
  "theoremCandidates": [
    "OnboardingSmall.add_commutative"
  ]
}
```

Analysis compiles fresh interfaces and asks Lean for theorem references. Similar names, comments, and cached `.ilean` files cannot supply those relationships. Binding IR also preserves them in each declaration's `source.extensions["lean-lang.org/theorem-references"]`; its assurance arrays stay empty.

The strict command above checks the theorem and rejects admitted proofs. A package receipt checks archive identities. Artifact-bound assurance claims require a separate theorem audit. The existing unlocked build path retains its older `unverified` relationship records in `metadata/assurance.json`; analysis does not upgrade those records.

## Keep exports separate from proofs

The generated package exports `add` and `isEmpty`. It does not export `add_commutative`, and no theorem is attached to `isEmpty` in this example.

Commutativity also has a specific meaning: both argument orders return the same result. It does not state a limit on the result or prove a JavaScript input validator. To claim a different property, state and check another theorem.

## Test a failing proof

In a disposable copy of the file, replace the implementation of `add` with `left` while keeping the theorem. The strict Lean command fails because returning only the first input is not commutative.

Replacing the proof with `by sorry` also fails the strict command. The [author acceptance runner](../../scripts/check-lean-author-tutorial.mjs) exercises both rejection cases without modifying the committed tutorial source.

Return to [the component build](first-component.md#build-the-component) after restoring the checked file. See [export decisions](export-decisions.md) when changing a function's public shape.
