import Lru

open LeanLRU

private def sample : Cache Nat Nat :=
  (put (put (put (empty 3) 1 10).cache 2 20).cache 3 30).cache

example : sample.entries = #[(1, 10), (2, 20), (3, 30)] := by decide
example : (get sample 1).cache.entries = #[(2, 20), (3, 30), (1, 10)] := by decide
example : (put (get sample 1).cache 4 40).evicted = some (2, 20) := by decide
example : (put sample 2 99).cache.entries = #[(1, 10), (3, 30), (2, 99)] := by decide
example : (get sample 9).cache.entries = sample.entries := by decide
example : (put (empty 0 : Cache Nat Nat) 1 10).cache.entries = #[] := by decide
example : (put (empty 0 : Cache Nat Nat) 1 10).value = some 10 := by decide
example : Valid sample := by unfold Valid Unique; decide
example : (fastGet sample 3).cache.entries = sample.entries := by decide
example : (fastGet sample 3).value = some 30 := by decide
example : (put (put (empty 1 : Cache Nat Nat) 0 0).cache 0 99).evicted = none := by decide
example : (put (put (empty 1 : Cache Nat Nat) 0 0).cache 1 99).evicted = some (0, 0) := by decide
example : exportedBatch 2 #[1, 1, 10, 1, 2, 20, 0, 1, 0, 1, 3, 30] =
  #[2, 10, 0, 0, 2, 20, 0, 0, 1, 10, 0, 0, 4, 30, 2, 20] := by decide

-- The same verified operations also handle string keys and arbitrary values.
example : (get (put (empty 2 : Cache String (List Nat)) "asset" [2, 3]).cache "asset").value =
    some [2, 3] := by decide
