namespace InheritedRecords

/-- A plain parent record. -/
structure Point where
  x : Nat
  y : Nat

/-- One subobject parent: the record carries it as its toPoint field, as Lean declares it. -/
structure Labeled extends Point where
  label : String

/-- A parent with a checked field; its bound is checked wherever the child crosses. -/
structure Digit where
  digit : Fin 10

/-- Two subobject parents beside an own field. -/
structure Tagged extends Digit, Point where
  tag : String

/-- A second level of inheritance: toLabeled holds toPoint. -/
structure Stamped extends Labeled where
  stamp : Nat

/-- Overlapping parents: Lean keeps Labeled as a subobject and flattens Tagged's remaining fields. -/
structure Merged extends Labeled, Tagged where
  extra : Nat

def move (value : Labeled) : Labeled := { value with x := value.x + 1, label := value.label ++ "!" }
def total (value : Tagged) : Nat := value.digit.val + value.x + value.y + value.tag.length
def restamp (value : Stamped) : Stamped := { value with stamp := value.stamp + 1, y := value.y * 2 }
def mergedTotal (value : Merged) : Nat := value.x + value.digit.val + value.extra
def bump (value : Tagged) : Tagged := { value with digit := ⟨(value.digit.val + 1) % 10, Nat.mod_lt _ (by decide)⟩ }

end InheritedRecords
