namespace NativeFin
inductive Tree where
  | leaf (digit : Fin 5)
  | branch (children : List Tree)
def recursiveSite (value : Tree) : Nat := match value with
  | .leaf digit => digit.val
  | .branch children => children.length
end NativeFin
