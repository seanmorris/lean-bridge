import UnionFind

namespace LeanUnionFind.Tests

open LeanUnionFind

def chain : Array Nat := #[0, 1, 1, 2, 3, 4]
def chainResult : Option CertifiedPartition := certifiedPartition 6 chain

example : chainResult.isSome = true := by native_decide

example : (chainResult.map fun result => result.result.representatives) =
    some #[0, 0, 0, 3, 3, 5] := by native_decide

example (result : CertifiedPartition) (found : certifiedPartition 6 chain = some result) :
    arrayGet result.result.representatives 0 6 =
        arrayGet result.result.representatives 2 6 ↔
      Connected 6 chain 0 2 := by
  exact certifiedPartition_correct 6 chain result found 0 2 (by omega) (by omega)

def cyclic : Array Nat := #[0, 1, 1, 2, 2, 0, 2, 2, 4, 5]

example : (certifiedPartition 6 cyclic).isSome = true := by native_decide

example : linksValid 0 #[] = true := by native_decide
example : linksValid 3 #[0, 3] = false := by native_decide
example : linksValid 3 #[0] = false := by native_decide

def operationTrace : Array Nat := #[
  1, 0, 2,
  0, 0, 1,
  1, 0, 2,
  0, 1, 2,
  1, 0, 2
]

example : (runOperations 3 operationTrace).queries = #[0, 0, 1] := by native_decide

end LeanUnionFind.Tests
