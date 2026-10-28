namespace DependentSignatures

/-- Consume a value whose bound is the earlier runtime argument. -/
@[noinline] def dependent (bound : Nat) (value : Fin bound) : Nat :=
  bound + value.val

end DependentSignatures
