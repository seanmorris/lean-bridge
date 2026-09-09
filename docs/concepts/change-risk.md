# Use proofs to check a change

A proof becomes useful during maintenance when the implementation changes but the required behavior does not. Lean checks whether the new code still satisfies the theorem. If the proof no longer works, the strict check fails before that workflow produces a release.

For a product team, this is a concrete review question: which behavior must every future implementation preserve?

## A small example

The author tutorial implements addition and proves that swapping the inputs preserves the result:

```lean
def add (left right : Nat) : Nat := left + right

theorem add_commutative (left right : Nat) :
    add left right = add right left :=
  Nat.add_comm left right
```

The theorem covers all natural-number pairs, not only the pairs in a test suite. A reviewer can read its statement without understanding the proof's tactic details.

## Change the implementation

Suppose a refactor accidentally returns `left` and ignores `right`. The old theorem no longer follows: `add 1 2` becomes 1 while `add 2 1` becomes 2.

The repository's documentation proof check runs that mutation in memory. It expects Lean to reject it, then separately expects rejection when the proof is replaced with `by sorry`. The maintained source is not edited.

From a checkout with the pinned Lean compiler installed:

```sh
npm run test:docs:proof
```

Expected result: the command succeeds because the original theorem checks and both invalid variants fail. Its JSON report names the compiler revision, source hash, theorem, and rejected cases. A failure to reject either variant fails the command.

The [proof-check runner](../../scripts/check-documentation-proofs.mjs) owns this exercise. [Proofs and assurance](../lean/proofs-and-assurance.md) gives the direct strict Lean command for the tutorial file.

## Choose a useful theorem

Commutativity does not fully specify addition. A function that always returns zero is also commutative. If the product needs a particular formula, a bound, or an exact reachability result, state that requirement as another theorem.

The same review applies to an algorithm. A shortest-path result should connect valid edges, reach the requested destination, and have no cheaper alternative. “The output array is nonempty” would not capture that requirement.

## Use tests alongside the proof

Keep tests for the application adapter, error handling, package installation, and UI interactions. Those tests exercise how the application supplies the theorem's inputs and consumes its result. Benchmark the compiled call when changing its implementation.

Next, [audit a named claim](auditable-claims.md), then follow [Dijkstra's actual guarantee](dijkstra.md) to a reusable graph example.
