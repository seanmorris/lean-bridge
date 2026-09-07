import AhoCorasick

open LeanAhoCorasick

def classic : PatternTable := {
  offsets := #[0, 2, 5, 8, 12]
  tokens := #[104, 101, 115, 104, 101, 104, 105, 115, 104, 101, 114, 115]
}

#eval scan (compile 256 classic) #[117, 115, 104, 101, 114, 115]

example : patternsValid 256 classic = true := by native_decide
example : (compileCertified 256 classic).isSome = true := by native_decide

example : scan (compile 256 classic) #[117, 115, 104, 101, 114, 115] =
    #[0, 2, 4, 1, 1, 4, 3, 2, 6] := by native_decide

def duplicateOverlap : PatternTable := {
  offsets := #[0, 1, 3, 5]
  tokens := #[97, 97, 97, 97, 97]
}

example : scan (compile 256 duplicateOverlap) #[97, 97] =
    #[0, 0, 1, 0, 1, 2, 1, 0, 2, 2, 0, 2] := by native_decide

example : patternsValid 256 { offsets := #[0, 0], tokens := #[] } = false := by native_decide

example : scan (compile 256 classic) #[] = #[] := by native_decide
