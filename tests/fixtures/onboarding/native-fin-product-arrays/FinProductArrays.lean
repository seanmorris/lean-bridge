namespace FinProductArrays

/-- An array directly over a product: the first component is Fin 4, the second an Except whose
    error branch is Fin 6 and whose ok branch is any Nat. -/
def rows (values : Array (Fin 4 × Except (Fin 6) Nat)) : Nat :=
  values.foldl (fun acc item => match item with
    | (a, .ok n) => acc + a.val + n
    | (a, .error b) => acc + a.val + b.val + 1000) 0

/-- The same array reversed; the returned bounds are produced by Lean. -/
def reversed (values : Array (Fin 4 × Except (Fin 6) Nat)) : Array (Fin 4 × Except (Fin 6) Nat) :=
  values.reverse

end FinProductArrays
