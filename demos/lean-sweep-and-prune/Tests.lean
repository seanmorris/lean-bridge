import Sweep

open LeanSweep

private def run (bounds : Array Int) (dimensions axis : Nat) : Option (Array Nat) :=
  (prepareExport bounds dimensions axis).map solveExport

#guard run #[] 2 0 = some #[0, 0, 2, 0, 0, 0]
#guard run #[0, 0, 1, 1] 2 0 = some #[0, 1, 2, 0, 0, 0]
#guard run #[0, 0, 1, 1, 1, 1, 2, 2] 2 0 = some #[0, 2, 2, 0, 1, 1, 0, 1, 0, 1]
#guard run #[0, 0, 1, 1, 1, 2, 2, 3] 2 0 = some #[0, 2, 2, 0, 1, 0, 0, 1]
#guard run #[0, 0, 1, 1, 1, 2, 2, 3] 2 1 = some #[0, 2, 2, 1, 0, 0]
#guard run #[0, 0, 0, 0, 0, 0, 0, 0] 2 0 = some #[0, 2, 2, 0, 1, 1, 0, 1, 0, 1]
#guard run #[-2147483648, -2147483648, 2147483647, 2147483647,
    0, 0, 0, 0] 2 1 = some #[0, 2, 2, 1, 1, 1, 0, 1, 0, 1]
#guard run #[0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2] 3 2 =
  some #[0, 2, 3, 2, 1, 1, 0, 1, 0, 1]
#guard run #[0, 0, 0, 1, 1, 1, 0, 0, 2, 1, 1, 3] 3 0 =
  some #[0, 2, 3, 0, 1, 0, 0, 1]
#guard run #[0, 0, 0, 1, 1, 1, 0, 0, 2, 1, 1, 3] 3 2 =
  some #[0, 2, 3, 2, 0, 0]
#guard (prepareExport #[] 0 0).isNone
#guard (prepareExport #[] 1 0).isNone
#guard (prepareExport #[] 4 0).isNone
#guard (prepareExport #[] 2 2).isNone
#guard (prepareExport #[0, 0, 1] 2 0).isNone
#guard (prepareExport #[1, 0, 0, 1] 2 0).isNone
#guard (prepareExport #[0, 1, 1, 0] 2 0).isNone
#guard (prepareExport #[-2147483649, 0, 1, 1] 2 0).isNone
#guard (prepareExport #[0, 0, 2147483648, 1] 2 0).isNone
#guard (prepareExport (Array.replicate (1025 * 4) 0) 2 0).isNone

private def finiteBoxes : List (Array Int) :=
  (List.range 3).flatMap (fun (low : Nat) => (List.range 3).filterMap (fun (high : Nat) =>
    if low ≤ high then some #[(low : Int), 0, (high : Int), 1] else none))

private def pairKey (pair : Pair) : Nat := 1024 * pair.1 + pair.2

private def agrees (bounds : Array Int) (axis : Nat) : Bool :=
  match prepare bounds 2 axis with
  | none => false
  | some prepared =>
    let result := solvePrepared prepared
    let all := (List.range prepared.entries.size).flatMap (fun left =>
      (List.range prepared.entries.size).filterMap (fun right =>
        if left < right then some (left, right) else none))
    let candidates := all.filter (fun pair => decide (overlapAxis axis
      (entryAt prepared.entries pair.1) (entryAt prepared.entries pair.2)))
    let overlaps := all.filter (pairOverlapCheck prepared)
    decide ((result.candidates.toList.map pairKey).mergeSort = (candidates.map pairKey).mergeSort) &&
      decide ((result.overlaps.toList.map pairKey).mergeSort = (overlaps.map pairKey).mergeSort)

#guard finiteBoxes.all (fun a => finiteBoxes.all (fun b => finiteBoxes.all (fun c =>
  agrees (a ++ b ++ c) 0 && agrees (a ++ b ++ c) 1)))

#print axioms sweepPairs_exact
#print axioms activeInvariant_step
#print axioms sweepArray_refines
#print axioms pruneEmit_refines
#print axioms solvePrepared_eq_solveFused
#print axioms sweepFused_eq_sweepPruned
#print axioms solve_total
#print axioms exported_candidates_exact
#print axioms exported_overlaps_exact
#print axioms exported_candidates_unique
#print axioms exported_overlaps_unique
#print axioms decode_serialize
#print axioms solveExport_words_bounded
#print axioms solveExport_size_bounded
#print axioms solveExport_capacity_bounded
