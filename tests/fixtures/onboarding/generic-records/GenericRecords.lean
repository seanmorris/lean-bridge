namespace GenericRecords

/-- A generic pair; every export names a closed instantiation with an abbrev. -/
structure Pair (α β : Type) where
  first : α
  second : β

/-- A generic box with an unparameterized field beside the parameter. -/
structure Box (α : Type) where
  value : α
  count : Nat

/-- A universe-polymorphic structure: the instantiation fixes its levels as well as its arguments. -/
structure Tagged (α : Type u) (β : Type v) where
  tag : α
  payload : β

abbrev WordPair := Pair String Nat
abbrev TaggedNat := Tagged String Nat
abbrev NatBox := Box Nat
abbrev TextBox := Box String
/-- A second alias of the same application: a distinct host type with the same layout. -/
abbrev NatBoxAgain := Box Nat
/-- Nesting through aliases: options and lists of named instantiations, and an instantiation of one. -/
abbrev MaybeBox := Box (Option Nat)
abbrev Boxes := List NatBox
abbrev BoxPair := Pair NatBox TextBox

def swap (value : WordPair) : Pair Nat String := ⟨value.second, value.first⟩
def swapNamed (value : WordPair) : WordPair := ⟨value.first ++ "!", value.second + 1⟩
def bump (value : NatBox) : NatBox := ⟨value.value + 1, value.count + 1⟩
def shout (value : TextBox) : TextBox := ⟨value.value ++ "!", value.count⟩
def again (value : NatBoxAgain) : NatBoxAgain := ⟨value.value * 2, value.count⟩
def orZero (value : MaybeBox) : Nat := value.value.getD 0 + value.count
def total (values : Boxes) : Nat := values.foldl (fun acc box => acc + box.value) 0
def firstBoxes (count : Nat) : Option Boxes := if count == 0 then none else some ((List.range count).map fun n => ⟨n, count⟩)
def unpair (value : BoxPair) : Nat := value.first.value + value.second.value.length
def retag (value : TaggedNat) : TaggedNat := ⟨value.tag ++ "#", value.payload + 1⟩

end GenericRecords
