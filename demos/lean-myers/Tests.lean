import Myers

open LeanMyers

private def checks (left right : Array Nat) : Bool :=
  let input := Input.mk left right
  certificateCheck input (candidate input)

#guard (myers ⟨#[], #[]⟩).operations = #[]
#guard (myers ⟨#[1, 2, 3], #[1, 2, 3]⟩).operations = #[0, 0, 0]
#guard (myers ⟨#[1], #[2]⟩).distance = 2
#guard (myers ⟨#[], #[1, 2, 3]⟩).operations = #[2, 2, 2]
#guard (myers ⟨#[1, 2, 3], #[]⟩).operations = #[1, 1, 1]
#guard checks #[] #[]
#guard checks #[1, 2, 3] #[1, 2, 3]
#guard checks #[1] #[2]
#guard checks #[] #[1, 2, 3]
#guard checks #[1, 2, 3] #[]
#guard checks #[1, 2, 1, 2] #[2, 1, 2, 1]
#guard checks #[0, 4294967295, 2147483648] #[4294967295, 2147483648, 0]

private def binaryArrays : Nat → List (Array Nat)
  | 0 => [#[]]
  | depth + 1 => #[] :: (binaryArrays depth).flatMap (fun values => [values.push 0, values.push 1])

#guard (binaryArrays 5).all (fun left => (binaryArrays 5).all (fun right => checks left right))

private def edited : Input := ⟨#[1, 2], #[1, 3]⟩
private def editedCandidate : Candidate := candidate edited

#guard !certificateCheck edited { editedCandidate with solution := ⟨#[0, 0], 0⟩ }
#guard !certificateCheck edited { editedCandidate with solution := ⟨#[0, 1, 2], 3⟩ }
#guard !certificateCheck edited { editedCandidate with solution := ⟨#[3, 1, 2], 2⟩ }
#guard !certificateCheck edited { editedCandidate with potential := #[] }
#guard !certificateCheck edited { editedCandidate with
  potential := editedCandidate.potential.setIfInBounds 0 1 }
#guard !certificateCheck edited { editedCandidate with
  potential := editedCandidate.potential.setIfInBounds 1 3 }
#guard !certificateCheck edited { editedCandidate with
  potential := (Array.replicate 9 0).setIfInBounds 7 2 }
#guard !bandCheck edited 2 ((Array.replicate 9 0).setIfInBounds 7 2)
#guard !certificateCheck ⟨#[1], #[1]⟩ ⟨⟨#[1, 2], 2⟩, buildPotential ⟨#[1], #[1]⟩ 2⟩

#guard solveExport (prepare #[1, 2] #[1, 2]) = #[0, 0, 2, 2, 2, 0, 0, 0]
#guard solveExport (prepare #[] #[4294967295]) = #[0, 1, 0, 1, 1, 0, 2]
#guard (solveTotalExport (prepare #[1] #[2])).take 6 = #[0, 2, 1, 1, 2, 1]
#guard (referenceSolve ⟨#[1, 2, 1], #[2, 1, 2]⟩).distance = 2

#guard fastScoreCheck ⟨#[1, 2, 3], #[1, 8, 9, 3]⟩ (myers ⟨#[1, 2, 3], #[1, 8, 9, 3]⟩)
#guard !fastScoreCheck ⟨#[1, 2], #[2, 1]⟩ (myers ⟨#[1, 2], #[2, 1]⟩)
#guard !scoreCertificateCheck ⟨#[0], #[257]⟩ (myers ⟨#[0], #[257]⟩) 257
#guard fastScoreCheck ⟨#[0], #[257]⟩ (myers ⟨#[0], #[257]⟩)
#guard !fastScoreCheck ⟨#[0], #[262397]⟩ (myers ⟨#[0], #[262397]⟩)
#guard (solveExport (prepare #[0] #[262397])).take 6 = #[0, 2, 1, 1, 2, 0]
#guard !fastScoreCheck ⟨#[1], #[1]⟩ ⟨#[1, 2], 2⟩

#print axioms certificateCheck_sound
#print axioms snake_matches
#print axioms reconstructed_array_eq
#print axioms buildPotential_size
#print axioms buildPotential_band_bound
#print axioms potential_lower_bound
#print axioms referenceSolve_correct
#print axioms exported_shortest
#print axioms exported_reconstructs
#print axioms exported_patch_reconstructs
#print axioms solveExport_words_bounded
#print axioms fastScoreCheck_sound
