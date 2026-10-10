namespace FinProducts

/-- Transparent aliases keep their exact bounds inside products. -/
abbrev Digit := Fin 10
abbrev DigitPair := Digit × Digit

/-- 10 * 2^64 + 10: wider than any machine word. -/
abbrev Wide := Fin 184467440737095516170

/-- The first component is checked; the second is an ordinary Nat. -/
def first (value : Fin 10 × Nat) : Fin 10 × Nat := (⟨9 - value.1.val, by omega⟩, value.2 + 1)

/-- The second component is checked; Fin 1 admits only zero. -/
def second (value : Nat × Fin 1) : Nat := value.1 + value.2.val

/-- Both components carry a bound, one wider than 64 bits. -/
def wide (value : Wide × Fin 10) : Nat := value.1.val + value.2.val

/-- Fin 0 has no values, so only an absent product is accepted. -/
def absentOnly (value : Option (Fin 0 × Nat)) : Nat := match value with | none => 7 | some (f, _) => f.elim0

/-- Only the ok branch is bounded; any error text is valid. -/
def okOnly (value : Except String (Fin 10)) : Nat := match value with | .ok d => d.val | .error e => e.length + 100

/-- Only the error branch is bounded; any ok Nat is valid. -/
def errorOnly (value : Except (Fin 5) Nat) : Nat := match value with | .ok n => n | .error d => d.val + 100

/-- Both branches are bounded; only the active one is checked. -/
def both (value : Except (Fin 3) (Fin 7)) : Nat := match value with | .ok d => d.val | .error d => d.val + 100

/-- Nesting with the earlier structural containers. -/
def nested (values : List (Option (Fin 3 × Except (Fin 2) Nat))) : Nat :=
  values.foldl (fun acc item => match item with
    | none => acc
    | some (a, .ok n) => acc + a.val + n
    | some (a, .error b) => acc + a.val + b.val) 0

/-- A product of aliases; the result keeps the bound. -/
def aliased (value : DigitPair) : DigitPair := (value.2, value.1)

/-- Result-only products and branches are documented, never checked. -/
def produce (n : Nat) : Except (Fin 10) String :=
  if h : n < 10 then .error ⟨n, h⟩ else .ok (toString n)

def pairUp (n : Nat) : Fin 10 × Nat := (⟨n % 10, Nat.mod_lt _ (by decide)⟩, n)

end FinProducts
