namespace FinReplies

/-! Host callbacks whose replies carry Fin bounds (VO #1453). Each reply indexes a fixed-size
vector through its Fin, an unchecked read in compiled code, so an invalid Fin reaching Lean
would read outside the vector. Only shapes with a Fin-free failure value are exported. -/

def table3 : Vector Nat 3 := #v[1, 2, 3]
def table5 : Vector Nat 5 := #v[10, 20, 30, 40, 50]
def table7 : Vector Nat 7 := #v[100, 200, 300, 400, 500, 600, 700]
def table10 : Vector Nat 10 := #v[0, 1, 4, 9, 16, 25, 36, 49, 64, 81]

/-- None stands in for a refused reply; each present digit selects a table entry. -/
def maybe (host : Nat → Option (Fin 5)) : Nat :=
  (List.range 4).foldl (fun acc n => acc + match host n with | none => 7 | some d => table5.get d) 0

/-- An empty array stands in for a refused reply. -/
def digits (host : Nat → Array (Fin 3)) : Nat := (host 2).foldl (fun acc d => acc * 10 + table3.get d) 0

/-- Fin 0 has no values: only none is a valid reply. -/
def none0 (host : Nat → Option (Fin 0)) : Nat := match host 1 with | none => 11 | some d => d.elim0

/-- A bound wider than 64 bits. -/
def wide (host : Nat → Option (Fin 184467440737095516170)) : Nat := match host 1 with | none => 0 | some d => d.val + 1

/-- Only the error branch is bounded; the ok branch stands in for a refused reply. -/
def failure (host : Nat → Except (Fin 7) Nat) : Nat := match host 3 with | .ok n => n | .error d => table7.get d

/-- The first case holds no Fin, so it stands in for a refused reply. -/
inductive Trailing where
  | label (text : String)
  | digit (value : Fin 10)

def late (host : Nat → Trailing) : Nat := match host 1 with | .label text => text.length | .digit d => table10.get d

/-- A record with a bounded field, reached only through an option. -/
structure Tile where
  digit : Fin 5
  count : Nat

def maybeTile (host : Nat → Option Tile) : Nat := match host 1 with | none => 3 | some tile => table5.get tile.digit + tile.count

/-- The second host callback runs only after the first reply; a refused first reply suppresses it. -/
def twice (first : Nat → Option (Fin 5)) (second : Nat → Nat) : Nat :=
  let a := match first 1 with | none => 7 | some d => table5.get d
  a + second a

/-- A plain export a host callback can reenter while a reply is pending. -/
def plain (n : Nat) : Nat := n + 1

/-! Composite families whose stand-in holds no Fin: an alias, List (Fin 0), a nested array, a product,
a record field and an Except ok branch. -/

abbrev MaybeDigit := Option (Fin 5)
def aliased (host : Nat → MaybeDigit) : Nat := match host 0 with | none => 1 | some d => d.val
def empty0 (host : Nat → List (Fin 0)) : Nat := (host 0).length
def nested (host : Nat → Option (Array (Fin 3))) : Nat := match host 0 with | none => 2 | some values => values.size
def product (host : Nat → Option (Fin 5) × Nat) : Nat := (host 0).2
structure Slot where
  digit : Option (Fin 5)
  count : Nat
def slotted (host : Nat → Slot) : Nat := (host 0).count
def success (host : Nat → Except Nat (Array (Fin 3))) : Nat := match host 0 with | .ok values => values.size | .error n => n
/-- A nonempty list reply: each element indexes its table. -/
def listed (host : Nat → List (Fin 3)) : Nat := (host 0).foldl (fun acc d => acc * 10 + table3.get d) 0

end FinReplies
