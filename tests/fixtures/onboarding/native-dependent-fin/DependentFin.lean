namespace DependentFin

/-- The bound is the live first argument: Fin 0 has no values and Fin 1 only zero. -/
def mirror (bound : Nat) (value : Fin bound) : Nat := bound - 1 - value.val

/-- A dependent site after an unrelated Nat: only the immediately preceding bound applies. -/
def label (start : Nat) (bound : Nat) (value : Fin bound) (name : String) : String :=
  name ++ ":" ++ toString (start + value.val)

end DependentFin
