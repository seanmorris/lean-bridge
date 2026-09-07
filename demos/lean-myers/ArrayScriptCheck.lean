import EditProofs

/-! Allocation-free array traversal for script validation and cost. The checked
array path is proved equivalent to the generic list semantics. -/

namespace LeanMyers

def arrayScriptFrom (input : Input) (operations : Array Nat) : Nat → Nat → Nat → Nat → Bool
  | 0, _, row, column => row == input.left.size && column == input.right.size
  | fuel + 1, index, row, column =>
      let operation := operations.getD index 3
      if operation = 0 then
        if row < input.left.size ∧ column < input.right.size then
          input.left.getD row 0 == input.right.getD column 0 &&
            arrayScriptFrom input operations fuel (index + 1) (row + 1) (column + 1)
        else false
      else if operation = 1 then
        if row < input.left.size then arrayScriptFrom input operations fuel (index + 1) (row + 1) column
        else false
      else if operation = 2 then
        if column < input.right.size then arrayScriptFrom input operations fuel (index + 1) row (column + 1)
        else false
      else false

def arrayScriptValid (input : Input) (operations : Array Nat) : Bool :=
  arrayScriptFrom input operations operations.size 0 0 0

theorem dropNatArray_cons (values : Array Nat) (index fallback : Nat) (bound : index < values.size) :
    values.toList.drop index = values.getD index fallback :: values.toList.drop (index + 1) := by
  rw [List.drop_eq_getElem_cons (by simpa using bound)]
  simp [Array.getD, bound]

theorem dropNatArray_empty (values : Array Nat) : values.toList.drop values.size = [] := by
  simp

theorem valid_nil_iff {α : Type} (left right : List α) :
    ValidScript left right [] ↔ left = [] ∧ right = [] := by
  constructor
  · intro valid; cases valid; exact ⟨rfl, rfl⟩
  · rintro ⟨rfl, rfl⟩; exact .nil

theorem valid_keep_iff {α : Type} (value next : α) (left right : List α) (operations : List Nat) :
    ValidScript (value :: left) (next :: right) (0 :: operations) ↔ value = next ∧ ValidScript left right operations := by
  constructor
  · intro valid; cases valid; exact ⟨rfl, by assumption⟩
  · rintro ⟨rfl, valid⟩; exact .keep valid

theorem valid_delete_iff {α : Type} (value : α) (left right : List α) (operations : List Nat) :
    ValidScript (value :: left) right (1 :: operations) ↔ ValidScript left right operations := by
  constructor
  · intro valid; cases valid; assumption
  · exact ValidScript.delete

theorem valid_insert_iff {α : Type} (value : α) (left right : List α) (operations : List Nat) :
    ValidScript left (value :: right) (2 :: operations) ↔ ValidScript left right operations := by
  constructor
  · intro valid; cases valid; assumption
  · exact ValidScript.insert

theorem arrayScriptFrom_iff (input : Input) (operations : Array Nat) (fuel index row column : Nat)
    (remaining : index + fuel = operations.size)
    (rowBound : row ≤ input.left.size) (columnBound : column ≤ input.right.size) :
    arrayScriptFrom input operations fuel index row column = true ↔
      ValidScript (input.left.toList.drop row) (input.right.toList.drop column) (operations.toList.drop index) := by
  induction fuel generalizing index row column with
  | zero =>
      have last : index = operations.size := by omega
      rw [last, dropNatArray_empty]
      simp only [arrayScriptFrom, Bool.and_eq_true, beq_iff_eq,
        valid_nil_iff, List.drop_eq_nil_iff, Array.length_toList]
      omega
  | succ fuel ih =>
      have operationBound : index < operations.size := by omega
      have next : index + 1 + fuel = operations.size := by omega
      rw [dropNatArray_cons operations index 3 operationBound]
      simp only [arrayScriptFrom]
      by_cases keep : operations.getD index 3 = 0
      · simp only [keep, ↓reduceIte]
        by_cases left : row < input.left.size
        · rw [dropNatArray_cons input.left row 0 left]
          by_cases right : column < input.right.size
          · rw [dropNatArray_cons input.right column 0 right]
            simp only [left, right, and_self, ↓reduceIte, Bool.and_eq_true, beq_iff_eq, valid_keep_iff,
              ih (index + 1) (row + 1) (column + 1) next (by omega) (by omega)]
          · have last : column = input.right.size := by omega
            simp [last, dropNatArray_empty]
            intro valid
            have used := valid_consumption valid
            simp at used
        · have last : row = input.left.size := by omega
          simp [last, dropNatArray_empty]
          intro valid
          have used := valid_consumption valid
          simp at used
      · simp only [keep, ↓reduceIte]
        by_cases delete : operations.getD index 3 = 1
        · simp only [delete, ↓reduceIte]
          by_cases left : row < input.left.size
          · rw [dropNatArray_cons input.left row 0 left]
            simp only [left, ↓reduceIte, valid_delete_iff,
              ih (index + 1) (row + 1) column next (by omega) columnBound]
          · have last : row = input.left.size := by omega
            simp [last, dropNatArray_empty]
            intro valid
            have used := valid_consumption valid
            simp at used
        · simp only [delete, ↓reduceIte]
          by_cases insert : operations.getD index 3 = 2
          · simp only [insert, ↓reduceIte]
            by_cases right : column < input.right.size
            · rw [dropNatArray_cons input.right column 0 right]
              simp only [right, ↓reduceIte, valid_insert_iff,
                ih (index + 1) row (column + 1) next rowBound (by omega)]
            · have last : column = input.right.size := by omega
              simp [last, dropNatArray_empty]
              intro valid
              have used := valid_consumption valid
              simp at used
          · simp only [insert, ↓reduceIte, Bool.false_eq_true, false_iff]
            intro valid
            have bounded := valid_operation_codes valid (operations.getD index 3) (by simp)
            omega

theorem arrayScriptValid_iff (input : Input) (operations : Array Nat) :
    arrayScriptValid input operations = true ↔ ValidScript input.left.toList input.right.toList operations.toList := by
  simpa [arrayScriptValid] using arrayScriptFrom_iff input operations operations.size 0 0 0 (by simp) (Nat.zero_le _) (Nat.zero_le _)

def arrayScriptCost (operations : Array Nat) : Nat :=
  operations.foldl (fun total operation => total + if operation = 0 then 0 else 1) 0

theorem foldl_scriptCost (operations : List Nat) (total : Nat) :
    operations.foldl (fun current operation => current + if operation = 0 then 0 else 1) total =
      total + scriptCost operations := by
  induction operations generalizing total with
  | nil => simp [scriptCost]
  | cons operation rest ih => simp only [List.foldl_cons, ih, scriptCost]; omega

theorem arrayScriptCost_eq (operations : Array Nat) : arrayScriptCost operations = scriptCost operations.toList := by
  rw [arrayScriptCost, ← Array.foldl_toList]
  exact (foldl_scriptCost operations.toList 0).trans (Nat.zero_add _)

def arrayScriptCheck (input : Input) (solution : Solution) : Bool :=
  arrayScriptValid input solution.operations && arrayScriptCost solution.operations == solution.distance

theorem arrayScriptCheck_iff (input : Input) (solution : Solution) :
    arrayScriptCheck input solution = true ↔
      ValidScript input.left.toList input.right.toList solution.operations.toList ∧
        scriptCost solution.operations.toList = solution.distance := by
  simp [arrayScriptCheck, Bool.and_eq_true, arrayScriptValid_iff, arrayScriptCost_eq]

theorem arrayScriptCheck_equivalent (input : Input) (solution : Solution) :
    arrayScriptCheck input solution = (inputScriptCheck input solution.operations &&
      scriptCost solution.operations.toList == solution.distance) := by
  apply Bool.eq_iff_iff.mpr
  simp [arrayScriptCheck_iff, Bool.and_eq_true, inputScriptCheck_iff]

#guard arrayScriptCheck ⟨#[], #[]⟩ ⟨#[], 0⟩
#guard arrayScriptCheck ⟨#[0, 4294967295], #[0, 2147483648]⟩ ⟨#[0, 1, 2], 2⟩
#guard !arrayScriptCheck ⟨#[], #[]⟩ ⟨#[0], 0⟩
#guard !arrayScriptCheck ⟨#[], #[1]⟩ ⟨#[1], 1⟩
#guard !arrayScriptCheck ⟨#[1], #[]⟩ ⟨#[2], 1⟩
#guard !arrayScriptCheck ⟨#[1], #[2]⟩ ⟨#[0], 0⟩
#guard !arrayScriptCheck ⟨#[1], #[2]⟩ ⟨#[1, 2], 1⟩
#guard !arrayScriptCheck ⟨#[1], #[1]⟩ ⟨#[3], 1⟩
#guard !arrayScriptCheck ⟨#[1, 2], #[1, 2]⟩ ⟨#[0], 0⟩

end LeanMyers
