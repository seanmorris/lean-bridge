namespace PerlRefinements

/-- A checked machine word: the unboxed base passes by value through XS. -/
abbrev Digit32 := { value : UInt32 // value < 10 }
def checkedDigit32 (value : UInt32) : Option Digit32 :=
  if h : value < 10 then some ⟨value, h⟩ else none

/-- A checked UInt32 parameter; the result is a plain word. -/
def twice (value : Digit32) : UInt32 := value.val * 2

/-- A result-only checked word: the host receives the base value. -/
def wrap32 (value : UInt32) : Digit32 := (checkedDigit32 (value % 10)).getD ⟨0, by decide⟩

/-- A checked word after an unchecked String: the second argument is rejected after the first converts. -/
def tag (label : String) (value : Digit32) : String := label ++ toString value.val

/-- Fin 0 under an option inside an array: only an absent element is valid. -/
def countAbsent (values : Array (Option (Fin 0))) : Nat := values.size

/-- Fin 0 inside an array under an option: `none` and `some #[]` are valid. -/
def emptyRows (value : Option (Array (Fin 0))) : Nat := (value.map (·.size)).getD 7

/-- Fin 0 in nested arrays: every inner array must be empty. -/
def nestedEmpty (rows : Array (Array (Fin 0))) : Nat := rows.size

/-- A present nested leaf with an ordinary bound, for the positive control. -/
def nestedDigits (rows : List (Option (Fin 3))) : Nat := (rows.filterMap id).foldl (fun acc v => acc + v.val) 0

end PerlRefinements
