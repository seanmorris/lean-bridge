import EditSpec

namespace LeanMyers

theorem scriptCheck_complete {α : Type} [DecidableEq α] {left right : List α} {operations : List Nat}
    (valid : ValidScript left right operations) : scriptCheck left right operations = true := by
  induction valid with
  | nil => rfl
  | keep valid ih => simpa [scriptCheck] using ih
  | delete valid ih => simpa [scriptCheck] using ih
  | insert valid ih => simpa [scriptCheck] using ih

theorem scriptCheck_sound {α : Type} [DecidableEq α] (left right : List α) (operations : List Nat)
    (checked : scriptCheck left right operations = true) : ValidScript left right operations := by
  induction operations generalizing left right with
  | nil =>
      cases left <;> cases right <;> simp only [scriptCheck, Bool.false_eq_true] at checked
      exact .nil
  | cons operation rest ih =>
      cases operation with
      | zero =>
          cases left with
          | nil => cases right <;> simp [scriptCheck] at checked
          | cons value left =>
              cases right with
              | nil => simp [scriptCheck] at checked
              | cons next right =>
                  simp only [scriptCheck, Bool.and_eq_true, decide_eq_true_eq] at checked
                  obtain ⟨same, checked⟩ := checked
                  subst next
                  exact .keep (ih left right checked)
      | succ operation =>
          cases operation with
          | zero =>
              cases left with
              | nil => cases right <;> simp [scriptCheck] at checked
              | cons value left => exact .delete (ih left right (by simpa [scriptCheck] using checked))
          | succ operation =>
              cases operation with
              | zero =>
                  cases right with
                  | nil => cases left <;> simp [scriptCheck] at checked
                  | cons value right => exact .insert (ih left right (by simpa [scriptCheck] using checked))
              | succ operation => cases left <;> cases right <;> simp [scriptCheck] at checked

theorem scriptCheck_iff {α : Type} [DecidableEq α] (left right : List α) (operations : List Nat) :
    scriptCheck left right operations = true ↔ ValidScript left right operations :=
  ⟨scriptCheck_sound left right operations, scriptCheck_complete⟩

theorem inputScriptCheck_iff (input : Input) (operations : Array Nat) :
    inputScriptCheck input operations = true ↔ ValidScript input.left.toList input.right.toList operations.toList :=
  scriptCheck_iff _ _ _

theorem replay_reconstructs {α : Type} [DecidableEq α] {left right : List α} {operations : List Nat}
    (valid : ValidScript left right operations) : replay left right operations = some right := by
  induction valid with
  | nil => rfl
  | keep valid ih => simp [replay, ih]
  | delete valid ih => simpa [replay] using ih
  | insert valid ih => simp [replay, ih]

theorem checked_reconstructs {α : Type} [DecidableEq α] (left right : List α) (operations : List Nat)
    (checked : scriptCheck left right operations = true) : replay left right operations = some right :=
  replay_reconstructs (scriptCheck_sound _ _ _ checked)

/-- A valid script reconstructs its target from the source and insert payload
alone. This does not supply the complete target to the patch application. -/
theorem applyOperations_reconstructs {α : Type} {left right : List α} {operations : List Nat}
    (valid : ValidScript left right operations) :
    applyOperations left (insertionPayload right operations) operations = some right := by
  induction valid with
  | nil => rfl
  | @keep value left right operations valid ih =>
      simpa [insertionPayload, applyOperations] using congrArg (Option.map (value :: ·)) ih
  | delete valid ih => simpa [insertionPayload, applyOperations] using ih
  | @insert value left right operations valid ih =>
      simpa [insertionPayload, applyOperations] using congrArg (Option.map (value :: ·)) ih

theorem insertionPayload_length {α : Type} {left right : List α} {operations : List Nat}
    (valid : ValidScript left right operations) :
    (insertionPayload right operations).length = operations.count 2 := by
  induction valid with
  | nil => rfl
  | keep valid ih => simpa [insertionPayload] using ih
  | delete valid ih => simpa [insertionPayload] using ih
  | insert valid ih => simp [insertionPayload, ih]

theorem valid_operation_codes {α : Type} {left right : List α} {operations : List Nat}
    (valid : ValidScript left right operations) : ∀ operation ∈ operations, operation ≤ 2 := by
  induction valid with
  | nil => simp
  | keep valid ih =>
      intro operation member
      rcases List.mem_cons.mp member with rfl | member
      · omega
      · exact ih operation member
  | delete valid ih =>
      intro operation member
      rcases List.mem_cons.mp member with rfl | member
      · omega
      · exact ih operation member
  | insert valid ih =>
      intro operation member
      rcases List.mem_cons.mp member with rfl | member
      · omega
      · exact ih operation member

theorem valid_script_length {α : Type} {left right : List α} {operations : List Nat}
    (valid : ValidScript left right operations) : operations.length ≤ left.length + right.length := by
  induction valid with
  | nil => simp
  | keep valid ih => simp only [List.length_cons]; omega
  | delete valid ih => simp only [List.length_cons]; omega
  | insert valid ih => simp only [List.length_cons]; omega

theorem scriptCost_length (operations : List Nat) : scriptCost operations ≤ operations.length := by
  induction operations with
  | nil => simp [scriptCost]
  | cons operation rest ih => simp only [scriptCost, List.length_cons]; split <;> omega

theorem valid_consumption {α : Type} {left right : List α} {operations : List Nat}
    (valid : ValidScript left right operations) :
    operations.count 0 + operations.count 1 = left.length ∧
      operations.count 0 + operations.count 2 = right.length := by
  induction valid with
  | nil => simp
  | keep valid ih => simp only [List.count_cons, List.length_cons]; simp; omega
  | delete valid ih => simp only [List.count_cons, List.length_cons]; simp; omega
  | insert valid ih => simp only [List.count_cons, List.length_cons]; simp; omega

theorem valid_cost_counts {α : Type} {left right : List α} {operations : List Nat}
    (valid : ValidScript left right operations) :
    scriptCost operations = operations.count 1 + operations.count 2 := by
  induction valid with
  | nil => simp [scriptCost]
  | keep valid ih => simpa [scriptCost] using ih
  | delete valid ih => simp [scriptCost, ih, Nat.add_assoc, Nat.add_comm]
  | insert valid ih => simp [scriptCost, ih, Nat.add_comm, Nat.add_left_comm]

theorem valid_zero_cost_equal {α : Type} {left right : List α} {operations : List Nat}
    (valid : ValidScript left right operations) (zero : scriptCost operations = 0) : left = right := by
  induction valid with
  | nil => rfl
  | keep valid ih =>
      simp only [scriptCost, ↓reduceIte, Nat.zero_add] at zero
      simp [ih zero]
  | delete valid ih => simp [scriptCost] at zero
  | insert valid ih => simp [scriptCost] at zero

theorem keep_all_valid {α : Type} (values : List α) :
    ValidScript values values (List.replicate values.length 0) := by
  induction values with
  | nil => exact .nil
  | cons value rest ih => simpa [List.replicate_succ] using ValidScript.keep (value := value) ih

theorem keep_all_cost (count : Nat) : scriptCost (List.replicate count 0) = 0 := by
  induction count with
  | zero => rfl
  | succ count ih => simp [List.replicate_succ, scriptCost, ih]

theorem optimal_zero_iff {α : Type} (left right : List α) (operations : List Nat)
    (optimal : OptimalScript left right operations) : scriptCost operations = 0 ↔ left = right := by
  constructor
  · exact valid_zero_cost_equal optimal.1
  · intro same
    subst right
    have bound := optimal.2 (List.replicate left.length 0) (keep_all_valid left)
    rw [keep_all_cost] at bound
    omega

theorem keep_all_optimal {α : Type} (values : List α) :
    OptimalScript values values (List.replicate values.length 0) := by
  refine ⟨keep_all_valid values, ?_⟩
  intro other _
  rw [keep_all_cost]
  exact Nat.zero_le _

theorem valid_empty_left_cost {α : Type} (right : List α) (operations : List Nat)
    (valid : ValidScript [] right operations) : scriptCost operations = right.length := by
  have consumed := valid_consumption valid
  have cost := valid_cost_counts valid
  simp only [List.length_nil] at consumed
  omega

theorem valid_empty_right_cost {α : Type} (left : List α) (operations : List Nat)
    (valid : ValidScript left [] operations) : scriptCost operations = left.length := by
  have consumed := valid_consumption valid
  have cost := valid_cost_counts valid
  simp only [List.length_nil] at consumed
  omega

def swapOperations (operations : List Nat) : List Nat :=
  operations.map (fun operation => if operation = 1 then 2 else if operation = 2 then 1 else operation)

theorem swapOperations_cost (operations : List Nat) : scriptCost (swapOperations operations) = scriptCost operations := by
  induction operations with
  | nil => rfl
  | cons operation rest ih =>
      simp only [swapOperations, List.map_cons, scriptCost]
      have tail := ih
      unfold swapOperations at tail
      rw [tail]
      by_cases deleted : operation = 1
      · simp [deleted]
      · by_cases inserted : operation = 2
        · simp [inserted]
        · simp [deleted, inserted]

theorem valid_swap {α : Type} {left right : List α} {operations : List Nat}
    (valid : ValidScript left right operations) : ValidScript right left (swapOperations operations) := by
  induction valid with
  | nil => exact .nil
  | keep valid ih => simpa [swapOperations] using ValidScript.keep ih
  | delete valid ih => simpa [swapOperations] using ValidScript.insert ih
  | insert valid ih => simpa [swapOperations] using ValidScript.delete ih

theorem optimal_swap {α : Type} {left right : List α} {operations : List Nat}
    (optimal : OptimalScript left right operations) : OptimalScript right left (swapOperations operations) := by
  refine ⟨valid_swap optimal.1, ?_⟩
  intro other valid
  have bound := optimal.2 (swapOperations other) (valid_swap valid)
  simpa only [swapOperations_cost] using bound

/-- Insertion/deletion distance is symmetric, even though a selected shortest
script and its reversed-direction counterpart may have different opcodes. -/
theorem optimal_distance_symmetric {α : Type} (left right : List α) (forward reverse : List Nat)
    (forwardOptimal : OptimalScript left right forward) (reverseOptimal : OptimalScript right left reverse) :
    scriptCost forward = scriptCost reverse := by
  have first := forwardOptimal.2 (swapOperations reverse) (valid_swap reverseOptimal.1)
  have second := reverseOptimal.2 (swapOperations forward) (valid_swap forwardOptimal.1)
  simp only [swapOperations_cost] at first second
  omega

theorem valid_length_difference {α : Type} {left right : List α} {operations : List Nat}
    (valid : ValidScript left right operations) :
    left.length ≤ right.length + scriptCost operations ∧
      right.length ≤ left.length + scriptCost operations := by
  have consumed := valid_consumption valid
  have cost := valid_cost_counts valid
  omega

theorem solves_operation_count (input : Input) (solution : Solution) (correct : Solves input solution) :
    solution.operations.size ≤ input.left.size + input.right.size := by
  simpa using valid_script_length correct.1.1

theorem solves_distance_bounded (input : Input) (solution : Solution) (correct : Solves input solution) :
    solution.distance ≤ input.left.size + input.right.size := by
  have cost := scriptCost_length solution.operations.toList
  have operations := solves_operation_count input solution correct
  have distance := correct.2
  simp only [Array.length_toList] at cost
  omega

theorem solves_opcode_bounded (input : Input) (solution : Solution) (correct : Solves input solution) :
    ∀ operation ∈ solution.operations, operation ≤ 2 := by
  intro operation member
  exact valid_operation_codes correct.1.1 operation (by simpa using member)

theorem solves_zero_iff (input : Input) (solution : Solution) (correct : Solves input solution) :
    solution.distance = 0 ↔ input.left = input.right := by
  rw [correct.2, optimal_zero_iff _ _ _ correct.1]
  exact Array.toList_inj

theorem potential_delete_suffix {α : Type} (value : α) (left right : List α)
    (potential : Nat → Nat → Nat) (bounds : PotentialBounds (value :: left) right potential) :
    PotentialBounds left right (fun row column => potential (row + 1) column) := by
  constructor
  · intro row column leftBound rightBound
    exact bounds.delete (row + 1) column (by simpa using leftBound) rightBound
  · intro row column leftBound rightBound
    exact bounds.insert (row + 1) column (by simpa using leftBound) rightBound
  · intro row column leftBound rightBound same
    exact bounds.keep (row + 1) column (by simpa using leftBound) rightBound (by simpa using same)

theorem potential_insert_suffix {α : Type} (value : α) (left right : List α)
    (potential : Nat → Nat → Nat) (bounds : PotentialBounds left (value :: right) potential) :
    PotentialBounds left right (fun row column => potential row (column + 1)) := by
  constructor
  · intro row column leftBound rightBound
    exact bounds.delete row (column + 1) leftBound (by simpa using rightBound)
  · intro row column leftBound rightBound
    exact bounds.insert row (column + 1) leftBound (by simpa using rightBound)
  · intro row column leftBound rightBound same
    exact bounds.keep row (column + 1) leftBound (by simpa using rightBound) (by simpa using same)

theorem potential_keep_suffix {α : Type} (leftValue rightValue : α) (left right : List α)
    (potential : Nat → Nat → Nat) (bounds : PotentialBounds (leftValue :: left) (rightValue :: right) potential) :
    PotentialBounds left right (fun row column => potential (row + 1) (column + 1)) := by
  exact potential_insert_suffix rightValue left right (fun row column => potential (row + 1) column)
    (potential_delete_suffix leftValue left (rightValue :: right) potential bounds)

/-- Every edit path obeys any locally checked potential. Equal keeps cost zero;
deletions and insertions each allow at most one unit of potential increase. -/
theorem potential_script_bound {α : Type} {left right : List α} {operations : List Nat}
    (valid : ValidScript left right operations) (potential : Nat → Nat → Nat)
    (bounds : PotentialBounds left right potential) :
    potential left.length right.length ≤ potential 0 0 + scriptCost operations := by
  induction valid generalizing potential with
  | nil => simp [scriptCost]
  | @keep value left right operations valid ih =>
      have tail := ih (fun row column => potential (row + 1) (column + 1))
        (potential_keep_suffix value value left right potential bounds)
      have first := bounds.keep 0 0 (by simp) (by simp) rfl
      simp only [Nat.zero_add] at first
      simp only [List.length_cons, scriptCost, ↓reduceIte, Nat.zero_add] at tail ⊢
      omega
  | @delete value left right operations valid ih =>
      have tail := ih (fun row column => potential (row + 1) column)
        (potential_delete_suffix value left right potential bounds)
      have first := bounds.delete 0 0 (by simp) (Nat.zero_le _)
      simp only [List.length_cons, scriptCost, Nat.one_ne_zero, ↓reduceIte] at tail ⊢
      omega
  | @insert value left right operations valid ih =>
      have tail := ih (fun row column => potential row (column + 1))
        (potential_insert_suffix value left right potential bounds)
      have first := bounds.insert 0 0 (Nat.zero_le _) (by simp)
      simp only [Nat.zero_add] at first
      simp [List.length_cons, scriptCost] at tail ⊢
      omega

theorem potential_lower_bound {α : Type} (left right : List α) (operations : List Nat)
    (potential : Nat → Nat → Nat) (distance : Nat) (bounds : PotentialBounds left right potential)
    (initial : potential 0 0 = 0) (final : potential left.length right.length = distance)
    (valid : ValidScript left right operations) : distance ≤ scriptCost operations := by
  have bound := potential_script_bound valid potential bounds
  omega

theorem potential_certifies_optimal {α : Type} (left right : List α) (operations : List Nat)
    (potential : Nat → Nat → Nat) (bounds : PotentialBounds left right potential)
    (initial : potential 0 0 = 0) (final : potential left.length right.length = scriptCost operations)
    (valid : ValidScript left right operations) : OptimalScript left right operations := by
  refine ⟨valid, ?_⟩
  intro other otherValid
  exact potential_lower_bound left right other potential (scriptCost operations) bounds initial final otherValid

end LeanMyers
