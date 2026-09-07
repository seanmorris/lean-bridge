import ArrayScriptCheck

/-! Linear-time score certificates. Any token score between minus one and one
gives a lower bound on insert/delete distance. A hashed count difference chooses
the scores, but the checker recomputes the weighted difference on the actual
sequences. Hash collisions can weaken the bound; they cannot make it unsound. -/

namespace LeanMyers

def scoreSum {α : Type} (score : α → Int) : List α → Int
  | [] => 0
  | value :: rest => score value + scoreSum score rest

theorem score_lower_bound {α : Type} (score : α → Int)
    (bounded : ∀ value, -1 ≤ score value ∧ score value ≤ 1)
    {left right : List α} {operations : List Nat} (valid : ValidScript left right operations) :
    scoreSum score right - scoreSum score left ≤ (scriptCost operations : Int) := by
  induction valid with
  | nil => simp [scoreSum, scriptCost]
  | @keep value left right operations valid ih =>
      simp only [scoreSum, scriptCost, ↓reduceIte, Nat.zero_add]
      omega
  | @delete value left right operations valid ih =>
      have bounds := bounded value
      simp [scoreSum, scriptCost]
      omega
  | @insert value left right operations valid ih =>
      have bounds := bounded value
      simp [scoreSum, scriptCost]
      omega

theorem score_certifies_optimal {α : Type} (left right : List α) (operations : List Nat)
    (score : α → Int) (bounded : ∀ value, -1 ≤ score value ∧ score value ≤ 1)
    (equal : scoreSum score right - scoreSum score left = (scriptCost operations : Int))
    (valid : ValidScript left right operations) : OptimalScript left right operations := by
  refine ⟨valid, ?_⟩
  intro other otherValid
  have bound := score_lower_bound score bounded otherValid
  rw [equal] at bound
  exact_mod_cast bound

/-- Histogram entries are only a heuristic for choosing a bounded score. Their
relationship to token counts is not a premise of certificate soundness. -/
def scoreHistogram (input : Input) (bucketCount : Nat) : Array Int :=
  let before := input.left.foldl (fun counts token =>
    let index := token % bucketCount
    counts.setIfInBounds index (counts.getD index 0 - 1)) (Array.replicate bucketCount 0)
  input.right.foldl (fun counts token =>
    let index := token % bucketCount
    counts.setIfInBounds index (counts.getD index 0 + 1)) before

def tokenScore (histogram : Array Int) (token : Nat) : Int :=
  let value := histogram[token % histogram.size]?.getD 0
  if value > 0 then 1 else if value < 0 then -1 else 0

theorem tokenScore_bounded (histogram : Array Int) (token : Nat) :
    -1 ≤ tokenScore histogram token ∧ tokenScore histogram token ≤ 1 := by
  unfold tokenScore
  dsimp only
  split
  · decide
  · split <;> decide

def arrayScore (histogram : Array Int) (values : Array Nat) : Int :=
  values.foldl (fun total token => total + tokenScore histogram token) 0

theorem foldl_scoreSum {α : Type} (score : α → Int) (values : List α) (total : Int) :
    values.foldl (fun current value => current + score value) total = total + scoreSum score values := by
  induction values generalizing total with
  | nil => simp [scoreSum]
  | cons value rest ih =>
      simp only [List.foldl_cons, ih, scoreSum]
      omega

theorem arrayScore_eq (histogram : Array Int) (values : Array Nat) :
    arrayScore histogram values = scoreSum (tokenScore histogram) values.toList := by
  rw [arrayScore, ← Array.foldl_toList]
  exact (foldl_scoreSum (tokenScore histogram) values.toList 0).trans (Int.zero_add _)

def weightedDifference (input : Input) (histogram : Array Int) : Int :=
  arrayScore histogram input.right - arrayScore histogram input.left

def scoreCertificateCheck (input : Input) (solution : Solution) (bucketCount : Nat := 257) : Bool :=
  arrayScriptCheck input solution &&
    weightedDifference input (scoreHistogram input bucketCount) == (solution.distance : Int)

theorem scoreCertificateCheck_sound (input : Input) (solution : Solution) (bucketCount : Nat)
    (checked : scoreCertificateCheck input solution bucketCount = true) : Solves input solution := by
  simp only [scoreCertificateCheck, arrayScriptCheck_equivalent, Bool.and_eq_true, beq_iff_eq] at checked
  have valid := (inputScriptCheck_iff input solution.operations).mp checked.1.1
  have cost := checked.1.2
  have equal := checked.2
  simp only [weightedDifference, arrayScore_eq] at equal
  refine ⟨?_, cost.symm⟩
  apply score_certifies_optimal input.left.toList input.right.toList solution.operations.toList
    (tokenScore (scoreHistogram input bucketCount)) (tokenScore_bounded _)
  · simpa only [cost] using equal
  · exact valid

def fastScoreCheck (input : Input) (solution : Solution) : Bool :=
  arrayScriptCheck input solution &&
    (solution.distance == 0 ||
      weightedDifference input (scoreHistogram input 257) == (solution.distance : Int) ||
      weightedDifference input (scoreHistogram input 1021) == (solution.distance : Int))

theorem fastScoreCheck_sound (input : Input) (solution : Solution)
    (checked : fastScoreCheck input solution = true) : Solves input solution := by
  simp only [fastScoreCheck, arrayScriptCheck_equivalent, Bool.and_eq_true, Bool.or_eq_true, beq_iff_eq] at checked
  rcases checked.2 with (zero | first) | second
  · have valid := (inputScriptCheck_iff input solution.operations).mp checked.1.1
    have cost := checked.1.2
    refine ⟨⟨valid, ?_⟩, cost.symm⟩
    intro other _
    rw [cost, zero]
    exact Nat.zero_le _
  · apply scoreCertificateCheck_sound input solution 257
    simpa only [scoreCertificateCheck, arrayScriptCheck_equivalent, Bool.and_eq_true, beq_iff_eq] using And.intro checked.1 first
  · apply scoreCertificateCheck_sound input solution 1021
    simpa only [scoreCertificateCheck, arrayScriptCheck_equivalent, Bool.and_eq_true, beq_iff_eq] using And.intro checked.1 second

#guard fastScoreCheck ⟨#[1, 2], #[1, 2]⟩ ⟨#[0, 0], 0⟩
#guard fastScoreCheck ⟨#[1, 2], #[1, 2, 1]⟩ ⟨#[0, 0, 2], 1⟩
#guard fastScoreCheck ⟨#[1, 2], #[2]⟩ ⟨#[1, 0], 1⟩
#guard !scoreCertificateCheck ⟨#[0], #[257]⟩ ⟨#[1, 2], 2⟩ 257
#guard scoreCertificateCheck ⟨#[0], #[257]⟩ ⟨#[1, 2], 2⟩ 1021
#guard fastScoreCheck ⟨#[0], #[257]⟩ ⟨#[1, 2], 2⟩
#guard !fastScoreCheck ⟨#[0], #[262397]⟩ ⟨#[1, 2], 2⟩
#guard !fastScoreCheck ⟨#[1, 2], #[2, 1]⟩ ⟨#[1, 0, 2], 2⟩
#guard !fastScoreCheck ⟨#[1], #[1]⟩ ⟨#[1, 2], 2⟩
#guard !fastScoreCheck ⟨#[1], #[2]⟩ ⟨#[0], 0⟩
#guard !fastScoreCheck ⟨#[1], #[2]⟩ ⟨#[1, 2], 1⟩
#guard fastScoreCheck ⟨#[4294967295], #[2147483648]⟩ ⟨#[1, 2], 2⟩
#guard !scoreCertificateCheck ⟨#[1], #[2]⟩ ⟨#[1, 2], 2⟩ 0
#guard !scoreCertificateCheck ⟨#[1], #[2]⟩ ⟨#[1, 2], 2⟩ 1

end LeanMyers
