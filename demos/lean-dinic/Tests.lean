import Dinic

open LeanDinic

private def rawSolution (network : Network) : Solution :=
  match prepare network with
  | some prepared => candidate prepared
  | none => default

private def classic : Network := ⟨6, 0, 5, #[
  ⟨0, 1, 16⟩, ⟨0, 2, 13⟩, ⟨1, 2, 10⟩, ⟨2, 1, 4⟩,
  ⟨1, 3, 12⟩, ⟨3, 2, 9⟩, ⟨2, 4, 14⟩, ⟨4, 3, 7⟩,
  ⟨3, 5, 20⟩, ⟨4, 5, 4⟩]⟩

#guard (rawSolution classic).value = 23
#guard (rawSolution classic).cut = #[true, true, true, false, true, false]
#guard (rawSolution ⟨2, 0, 1, #[]⟩).value = 0
#guard (rawSolution ⟨2, 0, 1, #[]⟩).cut = #[true, false]
#guard (rawSolution ⟨2, 0, 1, #[⟨0, 1, 0⟩]⟩).value = 0
#guard (rawSolution ⟨2, 0, 1, #[⟨0, 1, 7⟩, ⟨0, 1, 11⟩, ⟨1, 0, 5⟩]⟩).flows =
  #[7, 11, 0]
#guard (rawSolution ⟨3, 0, 2, #[⟨0, 0, 100⟩, ⟨0, 1, 5⟩, ⟨1, 1, 100⟩,
    ⟨1, 2, 3⟩, ⟨2, 2, 100⟩]⟩).flows = #[0, 3, 0, 3, 0]
#guard (rawSolution ⟨2, 0, 1, #[⟨0, 1, 4294967295⟩, ⟨0, 1, 4294967295⟩]⟩).value =
  8589934590
#guard networkCheck ⟨0, 0, 0, #[]⟩ = false
#guard networkCheck ⟨2, 0, 0, #[]⟩ = false
#guard networkCheck ⟨2, 0, 1, #[⟨0, 2, 1⟩]⟩ = false
#guard reverseArc 8 = 9
#guard reverseArc 9 = 8
#guard augmentArc 0 3 #[7, 0] = #[4, 3]
#guard augmentArc 1 2 #[4, 3] = #[6, 1]

private def rerouting : Network := ⟨6, 0, 5, #[⟨0, 1, 1⟩, ⟨0, 2, 1⟩,
  ⟨1, 3, 1⟩, ⟨1, 4, 1⟩, ⟨2, 3, 1⟩, ⟨3, 5, 1⟩, ⟨4, 5, 1⟩]⟩

#guard (rawSolution rerouting).flows = #[1, 1, 0, 1, 1, 1, 1]
#guard certificateCheck classic (rawSolution classic)
#guard certificateCheck rerouting (rawSolution rerouting)
#guard !certificateCheck classic { rawSolution classic with value := 24 }
#guard !certificateCheck classic { rawSolution classic with flows := #[] }
#guard !certificateCheck classic { rawSolution classic with cut := Array.replicate 6 true }
#guard !certificateCheck classic { rawSolution classic with
  flows := (rawSolution classic).flows.setIfInBounds 0 17 }
#guard !certificateCheck classic { rawSolution classic with
  flows := (rawSolution classic).flows.setIfInBounds 4 0 }
#guard !certificateCheck classic { rawSolution classic with cut := #[true, false] }
#guard !certificateCheck classic { rawSolution classic with
  cut := #[true, false, false, false, false, false] }

private def tinyFallback : Network := ⟨2, 0, 1, #[⟨0, 1, 2⟩]⟩
private def corruptedTiny : Solution := ⟨#[3], #[true, false], 3⟩

#guard !certificateCheck tinyFallback corruptedTiny
#guard (if certificateCheck tinyFallback corruptedTiny then corruptedTiny
  else referenceSolve tinyFallback).value = 2
#guard certificateCheck tinyFallback (referenceSolve tinyFallback)

private def exhaustiveTiny (code : Nat) : Network :=
  ⟨3, 0, 2, #[⟨0, 1, code % 3⟩, ⟨0, 2, code / 3 % 3⟩,
    ⟨1, 0, code / 9 % 3⟩, ⟨1, 2, code / 27 % 3⟩,
    ⟨2, 0, code / 81 % 3⟩, ⟨2, 1, code / 243 % 3⟩]⟩

#guard (List.range 729).all (fun code =>
  let network := exhaustiveTiny code
  certificateCheck network (rawSolution network))

#guard (match prepare classic with
  | some prepared => (solveExport prepared).take 11
  | none => #[]) = #[0, 23, 0, 23, 0, 6, 10, 2, 3, 0, 0]

#guard (match prepare ⟨2, 0, 1, #[⟨0, 1, 4294967295⟩, ⟨0, 1, 4294967295⟩]⟩ with
  | some prepared => (solveExport prepared).take 11
  | none => #[]) = #[0, 4294967294, 1, 4294967294, 1, 2, 2, 1, 2, 0, 0]

#guard (match prepare ⟨2, 0, 1, #[⟨0, 1, 2⟩]⟩ with
  | some prepared => (solveTotalExport prepared).take 11
  | none => #[]) = #[0, 2, 0, 2, 0, 2, 1, 0, 0, 0, 1]

#guard (prepareExport 2 0 1 #[0, 1]).isNone
#guard (prepareExport 2 0 0 #[0, 1, 1]).isNone
#guard (prepareExport 2 0 1 #[0, 1, 1]).isSome

#print axioms networkCheck_sound
#print axioms reverseArc_involution
#print axioms augmentArc_pair_sum
#print axioms augmentArc_positive_progress
#print axioms findPath_fits
#print axioms findPath_saturates
#print axioms augmentUnitPath_feasible
#print axioms certificateCheck_sound
#print axioms maximumFlow_minimumCut_equal
#print axioms referenceSolve_correct
#print axioms exported_optimal
#print axioms exported_total_optimal
#print axioms exported_flow_cut_equal
#print axioms exported_certificate
