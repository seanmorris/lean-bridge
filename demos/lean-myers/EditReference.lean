import EditProofs

/-! Total finite reference solver. It explores deletion, insertion, and equal
keep alternatives, and selects a shortest valid script. This simple fallback
has exponential worst-case cost and is bypassed by a certified Myers candidate. -/

namespace LeanMyers

def cheaper (first second : List Nat) : List Nat :=
  if scriptCost first ≤ scriptCost second then first else second

theorem cheaper_valid {α : Type} (left right : List α) (first second : List Nat)
    (firstValid : ValidScript left right first) (secondValid : ValidScript left right second) :
    ValidScript left right (cheaper first second) := by
  unfold cheaper
  split
  · exact firstValid
  · exact secondValid

theorem cheaper_le_first (first second : List Nat) : scriptCost (cheaper first second) ≤ scriptCost first := by
  unfold cheaper
  split <;> omega

theorem cheaper_le_second (first second : List Nat) : scriptCost (cheaper first second) ≤ scriptCost second := by
  unfold cheaper
  split <;> omega

theorem insert_all_valid {α : Type} (right : List α) : ValidScript [] right (List.replicate right.length 2) := by
  induction right with
  | nil => exact .nil
  | cons value right ih => simpa [List.replicate_succ] using ValidScript.insert (value := value) ih

theorem delete_all_valid {α : Type} (left : List α) : ValidScript left [] (List.replicate left.length 1) := by
  induction left with
  | nil => exact .nil
  | cons value left ih => simpa [List.replicate_succ] using ValidScript.delete (value := value) ih

theorem empty_left_unique {α : Type} (right : List α) (operations : List Nat)
    (valid : ValidScript [] right operations) : operations = List.replicate right.length 2 := by
  induction right generalizing operations with
  | nil => cases valid; rfl
  | cons value right ih =>
      cases valid with
      | insert valid => simpa [List.replicate_succ] using congrArg (2 :: ·) (ih _ valid)

theorem empty_right_unique {α : Type} (left : List α) (operations : List Nat)
    (valid : ValidScript left [] operations) : operations = List.replicate left.length 1 := by
  induction left generalizing operations with
  | nil => cases valid; rfl
  | cons value left ih =>
      cases valid with
      | delete valid => simpa [List.replicate_succ] using congrArg (1 :: ·) (ih _ valid)

def referenceScript {α : Type} [DecidableEq α] : List α → List α → List Nat
  | [], right => List.replicate right.length 2
  | left, [] => List.replicate left.length 1
  | value :: left, next :: right =>
      let deleted := 1 :: referenceScript left (next :: right)
      let inserted := 2 :: referenceScript (value :: left) right
      let changed := cheaper deleted inserted
      if value = next then cheaper (0 :: referenceScript left right) changed else changed
termination_by left right => left.length + right.length
decreasing_by
  all_goals simp_wf
  all_goals omega

theorem referenceScript_optimal {α : Type} [DecidableEq α] (left right : List α) :
    OptimalScript left right (referenceScript left right) := by
  have all (budget : Nat) : ∀ left right : List α, left.length + right.length = budget →
      OptimalScript left right (referenceScript left right) := by
    induction budget using Nat.strongRecOn with
    | ind budget ih =>
        intro left right size
        cases left with
        | nil =>
            rw [referenceScript]
            refine ⟨insert_all_valid right, ?_⟩
            intro other valid
            rw [empty_left_unique right other valid]
            exact Nat.le_refl _
        | cons value left =>
            cases right with
            | nil =>
                rw [referenceScript]
                · refine ⟨delete_all_valid (value :: left), ?_⟩
                  intro other valid
                  rw [empty_right_unique (value :: left) other valid]
                  exact Nat.le_refl _
                · simp
            | cons next right =>
                have deleted := ih (left.length + (next :: right).length) (by simp_all; omega)
                  left (next :: right) rfl
                have inserted := ih ((value :: left).length + right.length) (by simp_all; omega)
                  (value :: left) right rfl
                have kept := ih (left.length + right.length) (by simp_all; omega) left right rfl
                rw [referenceScript]
                have changedValid := cheaper_valid (value :: left) (next :: right)
                  (1 :: referenceScript left (next :: right)) (2 :: referenceScript (value :: left) right)
                  (.delete deleted.1) (.insert inserted.1)
                have deletedBound := cheaper_le_first
                  (1 :: referenceScript left (next :: right)) (2 :: referenceScript (value :: left) right)
                have insertedBound := cheaper_le_second
                  (1 :: referenceScript left (next :: right)) (2 :: referenceScript (value :: left) right)
                by_cases same : value = next
                · subst next
                  simp only [↓reduceIte]
                  have keepBound := cheaper_le_first (0 :: referenceScript left right)
                    (cheaper (1 :: referenceScript left (value :: right)) (2 :: referenceScript (value :: left) right))
                  have changeBound := cheaper_le_second (0 :: referenceScript left right)
                    (cheaper (1 :: referenceScript left (value :: right)) (2 :: referenceScript (value :: left) right))
                  refine ⟨cheaper_valid _ _ _ _ (.keep kept.1) changedValid, ?_⟩
                  intro other otherValid
                  cases otherValid with
                  | keep valid =>
                      have bound := kept.2 _ valid
                      simp only [scriptCost, ↓reduceIte, Nat.zero_add] at keepBound ⊢
                      omega
                  | delete valid =>
                      have bound := deleted.2 _ valid
                      simp only [scriptCost, Nat.one_ne_zero, ↓reduceIte] at deletedBound ⊢
                      omega
                  | insert valid =>
                      have bound := inserted.2 _ valid
                      simp [scriptCost] at insertedBound ⊢
                      omega
                · simp only [same, ↓reduceIte]
                  refine ⟨changedValid, ?_⟩
                  intro other otherValid
                  cases otherValid with
                  | keep valid => exact False.elim (same rfl)
                  | delete valid =>
                      have bound := deleted.2 _ valid
                      simp only [scriptCost, Nat.one_ne_zero, ↓reduceIte] at deletedBound ⊢
                      omega
                  | insert valid =>
                      have bound := inserted.2 _ valid
                      simp [scriptCost] at insertedBound ⊢
                      omega
  exact all (left.length + right.length) left right rfl

def referenceSolve (input : Input) : Solution :=
  let operations := referenceScript input.left.toList input.right.toList
  ⟨operations.toArray, scriptCost operations⟩

/-- The reference always returns a valid globally minimum insert/delete script.
There is no certificate-success or search-fuel premise. -/
theorem referenceSolve_correct (input : Input) : Solves input (referenceSolve input) := by
  simp only [Solves, referenceSolve, List.toList_toArray]
  exact ⟨referenceScript_optimal _ _, True.intro⟩

theorem referenceSolve_reconstructs (input : Input) :
    replay input.left.toList input.right.toList (referenceSolve input).operations.toList = some input.right.toList :=
  replay_reconstructs (referenceSolve_correct input).1.1

end LeanMyers
