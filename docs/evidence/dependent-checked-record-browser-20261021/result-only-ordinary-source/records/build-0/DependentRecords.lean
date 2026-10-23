namespace DependentRecords

/-- The second runtime field is bounded by the first runtime field. -/
structure Dependent where
  bound : Nat
  below : Fin bound
  valid : below.val < bound

/-- The only host-input path constructs both proofs from the observed payload. -/
@[noinline] def mkDependent (bound below : Nat) : Option Dependent :=
  if h : below < bound then some ⟨bound, ⟨below, h⟩, h⟩ else none

/-- Consume both retained fields after the checked constructor has run. -/
@[noinline] def dependentTotal (value : Dependent) : Nat :=
  value.bound + value.below.val

/-- Return the exact checked value through its proof-free host mirror. -/
@[noinline] def dependentRoundtrip (value : Dependent) : Dependent := value

/-- Lean produces the dependent proofs for a result-only API. -/
@[noinline] def dependentResult (seed : Nat) : Dependent :=
  ⟨seed + 1, ⟨seed, by omega⟩, by omega⟩

end DependentRecords
