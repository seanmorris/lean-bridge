import AhoCorasickCore

/-! Checked public guarantees for the executable Aho–Corasick component. -/

namespace LeanAhoCorasick

theorem machineCheck_sound {machine : Machine}
    (checked : decide (MachineInvariant machine) = true) : MachineInvariant machine := by
  exact of_decide_eq_true checked

theorem compile_machine_invariant {alphabetSize : Nat} {table : PatternTable}
    {machine : { value : Machine // MachineInvariant value }}
    (_compiled : compileCertified alphabetSize table = some machine) :
    MachineInvariant machine.val := by
  exact machine.property

theorem compile_trie_invariant {alphabetSize : Nat} {table : PatternTable}
    {machine : { value : Machine // MachineInvariant value }}
    (compiled : compileCertified alphabetSize table = some machine) :
    TrieInvariant machine.val := by
  have valid := compile_machine_invariant compiled
  unfold MachineInvariant machineInvariantCheck at valid
  unfold TrieInvariant
  simp_all

theorem compile_failure_invariant {alphabetSize : Nat} {table : PatternTable}
    {machine : { value : Machine // MachineInvariant value }}
    (compiled : compileCertified alphabetSize table = some machine) :
    FailureInvariant machine.val := by
  have valid := compile_machine_invariant compiled
  unfold MachineInvariant machineInvariantCheck at valid
  unfold FailureInvariant
  simp_all

theorem resultCheck_sound {machine : Machine} {input result : Array Nat}
    (checked : decide (ExactResult machine input result) = true) : ExactResult machine input result := by
  exact of_decide_eq_true checked

theorem scan_result_correct {machine : Machine} {input : Array Nat}
    {result : { value : Array Nat // ExactResult machine input value }}
    (_computed : scanCertified machine input = some result) :
    ExactResult machine input result.val := by
  exact result.property

theorem scan_matches_sound {machine : Machine} {input : Array Nat}
    {result : { value : Array Nat // ExactResult machine input value }}
    (computed : scanCertified machine input = some result) :
    soundCheck machine.table input result.val = true := by
  exact (scan_result_correct computed).1

theorem scan_matches_complete {machine : Machine} {input : Array Nat}
    {result : { value : Array Nat // ExactResult machine input value }}
    (computed : scanCertified machine input = some result) :
    completeCheck machine input result.val = true := by
  exact (scan_result_correct computed).2

end LeanAhoCorasick
