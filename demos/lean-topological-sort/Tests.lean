import TopologicalSort

open LeanTopologicalSort

#eval solve 4 #[0, 1, 0, 2, 1, 3, 2, 3]
#eval solve 3 #[0, 1, 1, 2, 2, 0]
#eval solve 2 #[0, 2]

#check solve_result_correct
#check solve_order_correct
#check solve_cycle_correct
#check solve_total
#check solveGraph_total
#print axioms solve_total
#print axioms solveGraph_no_failure

#guard decide (solveTotal 0 #[] = some (.order #[]))
#guard (solveTotal 1 #[0, 0]).isSome
#guard (solveTotal 4 #[0, 1, 0, 1, 1, 2, 2, 3]).isSome
#guard (solveTotal 4 #[0, 1, 1, 2, 2, 1, 2, 3]).isSome
#guard (solveTotal 2 #[0, 2]).isNone
example : solve 2 #[0] = none := by decide

example (count : Nat) (edges : Array Nat) (valid : edgesValid count edges = true) :
    ∃ result, solve count edges = some result ∧ ResultValid count edges result :=
  solve_total count edges valid
