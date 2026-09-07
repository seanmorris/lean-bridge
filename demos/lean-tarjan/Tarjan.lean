import TarjanCore
import TarjanChecks
import TarjanTotal

namespace LeanTarjan

structure CertifiedResult (input : Input) where
  labels : Array Nat
  usedFallback : Bool
  valid : PartitionSpec input.count input.edge labels

def certify (input : Input) (result : Candidate) : Option (CertifiedResult input) :=
  if checked : certificateCheck input result = true then
    some ⟨result.labels, false, certificate_partition (certificateCheck_sound input result checked)⟩
  else none

def fallback (input : Input) : CertifiedResult input :=
  ⟨totalLabels input.count input.edge, true, totalLabels_correct input.count input.edge⟩

/-- The iterative Tarjan result is checked in linear time. A proved total
reference handles any rejected candidate, without a successful-search premise. -/
def solvePrepared (prepared : Prepared) : CertifiedResult prepared.input :=
  match certify prepared.input (candidate prepared) with
  | some result => result
  | none => fallback prepared.input

/-- Wire format: one representative per vertex, followed by the fallback flag. -/
def serialize (input : Input) (result : CertifiedResult input) : Array Nat :=
  result.labels ++ #[if result.usedFallback then 1 else 0]

@[export lean_tarjan_prepare]
def prepareExport (count : UInt32) (offsets targets : Array Nat) : Option Prepared :=
  prepare ⟨count.toNat, offsets, targets⟩

@[export lean_tarjan_solve]
def solveExport (prepared : Prepared) : Array Nat :=
  serialize prepared.input (solvePrepared prepared)

@[export lean_tarjan_solve_total]
def solveTotalExport (prepared : Prepared) : Array Nat :=
  serialize prepared.input (fallback prepared.input)

theorem solve_prepared_correct (prepared : Prepared) :
    PartitionSpec prepared.input.count prepared.input.edge (solvePrepared prepared).labels :=
  (solvePrepared prepared).valid

theorem solve_same_iff (prepared : Prepared) (source target : Nat)
    (sourceBound : source < prepared.input.count) (targetBound : target < prepared.input.count) :
    labelAt (solvePrepared prepared).labels source = labelAt (solvePrepared prepared).labels target ↔
      Mutual prepared.input.count prepared.input.edge source target :=
  (solve_prepared_correct prepared).same_iff source sourceBound target targetBound

theorem solve_maximal (prepared : Prepared) (root : Nat) (bound : root < prepared.input.count) :
    IsStrongComponent prepared.input.count prepared.input.edge (fun vertex =>
      vertex < prepared.input.count ∧ labelAt (solvePrepared prepared).labels vertex =
        labelAt (solvePrepared prepared).labels root) :=
  partition_maximal (solve_prepared_correct prepared) root bound

theorem solve_total (input : Input) (shape : shapeCheck input = true) :
    ∃ prepared, prepare input = some prepared ∧
      PartitionSpec input.count input.edge (solvePrepared prepared).labels := by
  exact ⟨⟨input, reverseGraph input, shape⟩, by simp [prepare, shape],
    (solvePrepared ⟨input, reverseGraph input, shape⟩).valid⟩

theorem prepareExport_valid_iff (count : UInt32) (offsets targets : Array Nat) :
    (prepareExport count offsets targets).isSome = true ↔
      shapeCheck ⟨count.toNat, offsets, targets⟩ = true := by
  simp only [prepareExport, prepare]
  split <;> simp_all

theorem serialize_size (input : Input) (result : CertifiedResult input) :
    (serialize input result).size = input.count + 1 := by
  simp [serialize, result.valid.size]

theorem serialize_label (input : Input) (result : CertifiedResult input) (vertex : Nat)
    (bound : vertex < input.count) :
    (serialize input result)[vertex]? = some (labelAt result.labels vertex) := by
  have inside : vertex < result.labels.size := by rw [result.valid.size]; exact bound
  simp [serialize, Array.getElem?_push, inside, Nat.ne_of_lt inside, labelAt, Array.getD]

theorem solveExport_no_failure (prepared : Prepared) :
    (solveExport prepared).size = prepared.input.count + 1 :=
  serialize_size prepared.input (solvePrepared prepared)

/-- Equality of the exact serialized representatives returned through the FFI
is equivalent to mutual reachability, for every pair of input vertices. -/
theorem exported_same_iff (prepared : Prepared) (source target : Nat)
    (sourceBound : source < prepared.input.count) (targetBound : target < prepared.input.count) :
    (solveExport prepared)[source]? = (solveExport prepared)[target]? ↔
      Mutual prepared.input.count prepared.input.edge source target := by
  simp only [solveExport, serialize_label _ _ _ sourceBound, serialize_label _ _ _ targetBound,
    Option.some.injEq]
  exact solve_same_iff prepared source target sourceBound targetBound

theorem exported_total_same_iff (prepared : Prepared) (source target : Nat)
    (sourceBound : source < prepared.input.count) (targetBound : target < prepared.input.count) :
    (solveTotalExport prepared)[source]? = (solveTotalExport prepared)[target]? ↔
      Mutual prepared.input.count prepared.input.edge source target := by
  simp only [solveTotalExport, serialize_label _ _ _ sourceBound, serialize_label _ _ _ targetBound,
    Option.some.injEq]
  exact (fallback prepared.input).valid.same_iff source sourceBound target targetBound

end LeanTarjan
