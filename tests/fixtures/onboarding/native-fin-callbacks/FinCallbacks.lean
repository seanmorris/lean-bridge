namespace FinCallbacks

/-- The source body every leased closure reaches; kept as its own symbol for dispatch counts. -/
@[noinline] def scaled (factor : Nat) (digit : Fin 10) : Nat := digit.val * factor

/-- A Lean closure leased to the host: each argument is checked before it runs. -/
def scaler (factor : Nat) : Fin 10 → Nat := fun digit => scaled factor digit

/-- Fin 0 has no values: every call is refused, and the closure stays disposable. -/
def impossible (_ : Unit) : Fin 0 → Nat := fun value => value.elim0

/-- A bound wider than 64 bits. -/
def wide (_ : Unit) : Fin 184467440737095516170 → Nat := fun value => value.val + 1

/-- Containers in a closure's argument: every element, a present option and the active branch. -/
def digits (_ : Unit) : Array (Fin 3) → Nat := fun values => values.foldl (fun acc d => acc * 3 + d.val) 0
def pick (_ : Unit) : Option (Fin 5 × Nat) → Nat := fun value => match value with | none => 100 | some (d, n) => d.val + n
def branch (_ : Unit) : Except String (Fin 7) → Nat := fun value => match value with | .ok d => d.val | .error e => e.length + 50

/-- Lean produces these values, so the host only receives them: a bounded closure result... -/
def counter (start : Nat) : Nat → Fin 10 := fun step => ⟨(start + step) % 10, Nat.mod_lt _ (by decide)⟩

/-- ...and bounded arguments Lean passes to the host's callback. -/
def visit (host : Fin 5 → Nat) : Nat := (List.range 5).foldl (fun acc n => acc + host ⟨n % 5, Nat.mod_lt _ (by decide)⟩) 0

end FinCallbacks
