namespace FinContainers

/-- Transparent aliases keep their exact bounds inside containers. -/
abbrev Digit := Fin 10
abbrev Digits := Array Digit

/-- 2^70: wider than any machine word. -/
abbrev Huge := Fin 1180591620717411303424

/-- Every element is checked; the result's elements stay below the bound. -/
def mirrorAll (values : Digits) : Digits := values.map (fun d => ⟨9 - d.val, by omega⟩)

/-- Fin 0 has no values, so only the empty array is accepted. -/
def countNone (values : Array (Fin 0)) : Nat := values.size

/-- Lists are checked element by element, with a wide bound. -/
def sumHuge (values : List Huge) : Nat := values.foldl (fun acc v => acc + v.val) 0

/-- A present option value is checked; none is valid even for Fin 1. -/
def orDefault (value : Option (Fin 1)) : Nat := (value.map (·.val)).getD 7

/-- Nested containers: present digits are kept. -/
def present (values : Array (Option Digit)) : Digits := values.filterMap id

/-- Nested containers: rows are concatenated; no rows yields none. -/
def flatten (rows : List Digits) : Option (List Digit) :=
  if rows.isEmpty then none else some (rows.foldr (fun r acc => r.toList ++ acc) [])

/-- A late refined argument after an unrefined one. -/
def label (names : Array String) (offsets : Array (Fin 4)) : String :=
  String.intercalate "," ((names.zip offsets).map (fun (n, o) => s!"{n}:{o.val}")).toList

/-- A result-only container refinement. -/
def wrapAll (values : Array Nat) : Array (Fin 7) :=
  values.map (fun n => ⟨n % 7, Nat.mod_lt _ (by decide)⟩)

end FinContainers
