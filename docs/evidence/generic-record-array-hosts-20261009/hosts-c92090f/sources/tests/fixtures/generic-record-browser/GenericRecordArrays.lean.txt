namespace GenericRecords

/-- An Array argument: the instantiation names Array Nat, and the field holds one. -/
abbrev ArrayBox := Box (Array Nat)
/-- An Array of named instantiations, and an instantiation whose argument is an Array of one. -/
abbrev BoxRow := Array NatBox
abbrev RowBox := Box (Array NatBox)

def pushCount (value : ArrayBox) : ArrayBox := ⟨value.value.push value.count, value.count + 1⟩
def rowTotal (values : BoxRow) : Nat := values.foldl (fun acc box => acc + box.value * box.count) 0
def rowOf (count : Nat) : BoxRow := (Array.range count).map fun n => ⟨n, count⟩
def rowBoxSum (value : RowBox) : Nat := value.value.foldl (fun acc box => acc + box.value) value.count

end GenericRecords
