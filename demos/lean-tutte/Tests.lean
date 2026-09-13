import Tutte

open LeanTutte

def tiny : List Square := [⟨0, 0, 1, 0, 1⟩, ⟨1, 0, 1, 0, 1⟩]
#guard tilingCheck 2 1 tiny
#guard electricalCheck 2 1 [1, 0] tiny
#guard !perfectCheck tiny
#guard !tilingCheck 3 1 tiny
#guard !tilingCheck 1 1 tiny
#guard !tilingCheck 2 1 (tiny ++ tiny)
#guard !tilingCheck 2 1 [⟨0, 0, 0, 0, 1⟩]
#guard !electricalCheck 2 1 [2, 0] tiny
#guard !electricalCheck 2 1 [1, 0] [⟨0, 0, 1, 0, 8⟩]
#guard !simpleCheck [⟨0, 0, 1, 0, 1⟩, ⟨1, 0, 1, 0, 1⟩, ⟨0, 1, 2, 1, 2⟩]
#guard voltageSum (fun n => Int.ofNat (n * n)) 0 [3, 4, 1, 0] == 0

#print axioms exported_certificate
#print axioms closed_walk_zero
#print axioms simpleCheck_sound
#print axioms exported_threeConnected
