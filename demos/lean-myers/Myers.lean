import EditCertificate
import EditReference
import ScoreCertificate

namespace LeanMyers

structure CertifiedResult (input : Input) where
  solution : Solution
  usedFallback : Bool
  correct : Solves input solution

def fallback (input : Input) : CertifiedResult input :=
  ⟨referenceSolve input, true, referenceSolve_correct input⟩

/-- The optimized wavefront proposes a script. A token-score lower bound
certifies common edits in linear time; order-sensitive cases use a band
potential. An independently proved finite reference handles any rejection. -/
def solvePrepared (prepared : Prepared) : CertifiedResult prepared.input :=
  let solution := myers prepared.input
  if quick : fastScoreCheck prepared.input solution = true then
    ⟨solution, false, fastScoreCheck_sound prepared.input solution quick⟩
  else
    let proposed := Candidate.mk solution (buildPotential prepared.input solution.distance)
    if checked : certificateCheck prepared.input proposed = true then
      ⟨solution, false, certificateCheck_sound prepared.input proposed checked⟩
    else fallback prepared.input

/-- Header: status, distance, source length, target length, operation count,
fallback flag. Each remaining word is 0=keep, 1=delete, or 2=insert. -/
def serialize (input : Input) (result : CertifiedResult input) : Array Nat :=
  #[0, result.solution.distance, input.left.size, input.right.size,
    result.solution.operations.size, if result.usedFallback then 1 else 0] ++ result.solution.operations

@[export lean_myers_prepare]
def prepareExport (left right : Array Nat) : Prepared := prepare left right

@[export lean_myers_solve]
def solveExport (prepared : Prepared) : Array Nat := serialize prepared.input (solvePrepared prepared)

@[export lean_myers_solve_total]
def solveTotalExport (prepared : Prepared) : Array Nat := serialize prepared.input (fallback prepared.input)

theorem solve_total (input : Input) : Solves input (solvePrepared ⟨input⟩).solution :=
  (solvePrepared ⟨input⟩).correct

theorem solve_shortest (prepared : Prepared) :
    OptimalScript prepared.input.left.toList prepared.input.right.toList
      (solvePrepared prepared).solution.operations.toList :=
  (solvePrepared prepared).correct.1

theorem solve_reconstructs (prepared : Prepared) :
    replay prepared.input.left.toList prepared.input.right.toList
      (solvePrepared prepared).solution.operations.toList = some prepared.input.right.toList :=
  replay_reconstructs (solve_shortest prepared).1

theorem serialize_size (input : Input) (result : CertifiedResult input) :
    (serialize input result).size = 6 + result.solution.operations.size := by simp [serialize]

theorem serialize_operation (input : Input) (result : CertifiedResult input) (index : Nat) :
    (serialize input result)[6 + index]? = result.solution.operations[index]? := by
  unfold serialize
  rw [Array.getElem?_append_right (by simp)]
  simp

theorem serialize_distance (input : Input) (result : CertifiedResult input) :
    get (serialize input result) 1 0 = result.solution.distance := by
  simp only [get, Array.getD_eq_getD_getElem?, serialize]
  rw [Array.getElem?_append_left (by simp)]
  rfl

theorem serialize_count (input : Input) (result : CertifiedResult input) :
    get (serialize input result) 4 0 = result.solution.operations.size := by
  simp only [get, Array.getD_eq_getD_getElem?, serialize]
  rw [Array.getElem?_append_left (by simp)]
  rfl

def decodeSolution (words : Array Nat) : Solution :=
  ⟨Array.ofFn (fun index : Fin (get words 4 0) => get words (6 + index.val) 0), get words 1 0⟩

theorem decode_serialize (input : Input) (result : CertifiedResult input) :
    decodeSolution (serialize input result) = result.solution := by
  have operations : (decodeSolution (serialize input result)).operations = result.solution.operations := by
    apply Array.ext
    · simp [decodeSolution, serialize_count]
    · intro index _ bound
      simp [decodeSolution, get, Array.getD_eq_getD_getElem?, serialize_operation,
        Array.getElem?_eq_getElem bound]
  have distance : (decodeSolution (serialize input result)).distance = result.solution.distance :=
    serialize_distance input result
  have same (left right : Solution) (ops : left.operations = right.operations)
      (dist : left.distance = right.distance) : left = right := by
    cases left; cases right; cases ops; cases dist; rfl
  exact same _ _ operations distance

/-- The exact operation words returned through the FFI reconstruct the target
and use the fewest possible insertions and deletions. -/
theorem exported_shortest (prepared : Prepared) :
    Solves prepared.input (decodeSolution (solveExport prepared)) := by
  rw [solveExport, decode_serialize]
  exact (solvePrepared prepared).correct

theorem exported_total_shortest (prepared : Prepared) :
    Solves prepared.input (decodeSolution (solveTotalExport prepared)) := by
  rw [solveTotalExport, decode_serialize]
  exact (fallback prepared.input).correct

theorem exported_reconstructs (prepared : Prepared) :
    replay prepared.input.left.toList prepared.input.right.toList
      (decodeSolution (solveExport prepared)).operations.toList = some prepared.input.right.toList :=
  replay_reconstructs (exported_shortest prepared).1.1

/-- Applying the returned script needs only the original sequence and the
inserted values, not the complete target sequence. -/
theorem exported_patch_reconstructs (prepared : Prepared) :
    applyOperations prepared.input.left.toList
      (insertionPayload prepared.input.right.toList (decodeSolution (solveExport prepared)).operations.toList)
      (decodeSolution (solveExport prepared)).operations.toList = some prepared.input.right.toList :=
  applyOperations_reconstructs (exported_shortest prepared).1.1

theorem exported_zero_iff (prepared : Prepared) :
    (decodeSolution (solveExport prepared)).distance = 0 ↔ prepared.input.left = prepared.input.right :=
  solves_zero_iff _ _ (exported_shortest prepared)

theorem serialize_words_bounded (input : Input) (result : CertifiedResult input)
    (size : input.left.size + input.right.size ≤ 4096) :
    ∀ word ∈ serialize input result, word < 4294967296 := by
  have operations := solves_operation_count input result.solution result.correct
  have distance := solves_distance_bounded input result.solution result.correct
  intro word member
  simp only [serialize, Array.mem_append] at member
  rcases member with header | opcode
  · simp only [List.mem_toArray, List.mem_cons, List.not_mem_nil, or_false] at header
    rcases header with status | edits | left | right | count | flag
    · subst word; decide
    · subst word; omega
    · subst word; omega
    · subst word; omega
    · subst word; omega
    · subst word; split <;> decide
  · have bound := solves_opcode_bounded input result.solution result.correct word opcode
    omega

theorem solveExport_words_bounded (prepared : Prepared)
    (size : prepared.input.left.size + prepared.input.right.size ≤ 4096) :
    ∀ word ∈ solveExport prepared, word < 4294967296 :=
  serialize_words_bounded _ _ size

theorem solveTotalExport_words_bounded (prepared : Prepared)
    (size : prepared.input.left.size + prepared.input.right.size ≤ 4096) :
    ∀ word ∈ solveTotalExport prepared, word < 4294967296 :=
  serialize_words_bounded _ _ size

theorem solveExport_size_bounded (prepared : Prepared) :
    (solveExport prepared).size ≤ 6 + prepared.input.left.size + prepared.input.right.size := by
  have operations := solves_operation_count prepared.input (solvePrepared prepared).solution
    (solvePrepared prepared).correct
  rw [solveExport, serialize_size]
  omega

end LeanMyers
