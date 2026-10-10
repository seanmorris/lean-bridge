namespace FinRecords

/-- A bounded field beside an ordinary one. -/
structure Tile where
  digit : Fin 5
  count : Nat

/-- A refined record nested in another, beside the outer record's own bound. -/
structure Nest where
  inner : Tile
  tag : Fin 3

/-- Heap fields come before the bound, so a rejection must leave them unallocated or released. -/
structure Late where
  label : String
  items : Array Nat
  digit : Fin 5

/-- Fin 0 has no values: only an absent option is valid. -/
structure Slot where
  maybe : Option (Fin 0)
  count : Nat

/-- Only the active case is checked. -/
inductive Shape where
  | circle (radius : Fin 10)
  | label (text : String)
  | empty

/-- The never case can never be built; the other case is always valid. -/
inductive Gate where
  | closed
  | never (value : Fin 0)

-- The dispatch probe counts calls of these two sources, so Lean must not inline them into their adapters.
@[noinline] def tileSum (value : Tile) : Nat := value.digit.val + value.count

def nestSum (value : Nest) : Nat := value.inner.digit.val + value.inner.count + value.tag.val * 100

def lateSum (value : Late) : Nat := value.label.length + value.items.foldl (· + ·) 0 + value.digit.val * 1000

def slotCount (value : Slot) : Nat := match value.maybe with
  | none => value.count
  | some z => z.elim0

@[noinline] def shapeSize (value : Shape) : Nat := match value with
  | .circle r => r.val
  | .label t => t.length + 1000
  | .empty => 7

def gateOpen (value : Gate) : Nat := match value with
  | .closed => 1
  | .never z => z.elim0

def tiles (values : Array Tile) : Nat := values.foldl (fun acc b => acc + b.digit.val + b.count) 0

def maybeShape (value : Option Shape) : Nat := match value with
  | none => 99
  | some s => shapeSize s

/-- A List of refined records: every element's fields are checked. -/
def tileList (values : List Tile) : Nat := values.foldl (fun acc b => acc + b.digit.val + b.count) 0

/-- A product of a refined record and a variant: both components are checked. -/
def tilePair (value : Tile × Shape) : Nat := tileSum value.1 + shapeSize value.2

/-- Except with a record on the ok branch and a variant on the error branch: only the active one is checked. -/
def tileExcept (value : Except Shape Tile) : Nat := match value with
  | .ok t => tileSum t
  | .error s => shapeSize s + 500

/-- Results carrying bounds are produced by Lean and arrive below them. -/
def bump (value : Tile) : Tile := { digit := ⟨(value.digit.val + 1) % 5, Nat.mod_lt _ (by decide)⟩, count := value.count + 1 }

def makeShape (n : Nat) : Shape := if h : n < 10 then .circle ⟨n, h⟩ else .label (toString n)

end FinRecords
