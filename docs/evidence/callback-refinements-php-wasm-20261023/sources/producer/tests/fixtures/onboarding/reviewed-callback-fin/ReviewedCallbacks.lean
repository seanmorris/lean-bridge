namespace ReviewedCallbacks

/-- A record with a checked field, reached through callbacks in both directions. -/
structure Tile where
  digit : Fin 5
  count : Nat

/-- A leased closure: each argument is checked before it runs. -/
def scaler (factor : Nat) : Fin 10 → Nat := fun digit => digit.val * factor

/-- A leased closure whose result Lean produces. -/
def counter (start : Nat) : Nat → Fin 10 := fun step => ⟨(start + step) % 10, Nat.mod_lt _ (by decide)⟩

/-- Lean passes bounded arguments to the host's callback. -/
def visit (host : Fin 5 → Nat) : Nat := (List.range 5).foldl (fun acc n => acc + host ⟨n % 5, Nat.mod_lt _ (by decide)⟩) 0

/-- A container of bounded values in a leased closure's argument. -/
def digits (_ : Unit) : Array (Fin 3) → Nat := fun values => values.foldl (fun acc d => acc * 3 + d.val) 0

/-- Nominal bounds in a leased closure's argument... -/
def tiles (_ : Unit) : List Tile → Nat := fun values => values.foldl (fun acc tile => acc + tile.digit.val * 100 + tile.count) 0

/-- ...and in a leased closure's result, which Lean produces. -/
def tileMaker (start : Nat) : Nat → Tile := fun n => ⟨⟨(start + n) % 5, Nat.mod_lt _ (by decide)⟩, n⟩

/-- An unrefined callback keeps its original identity. -/
def apply (f : Nat → Nat) (value : Nat) : Nat := f value

/-- A host-produced bounded reply: admitted by npm, refused by native packages. -/
def three (f : Fin 3 → Fin 3) (value : Fin 3) : Fin 3 := f value

end ReviewedCallbacks
