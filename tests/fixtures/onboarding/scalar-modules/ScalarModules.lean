import ScalarModules.Operations

namespace ScalarModules
/-- Compose functions from another local module. -/
def combined (a b : Nat) : Nat := Operations.double a + Operations.triple b
/-- Retain arbitrary-precision multiplication. -/
def square (a : Nat) : Nat := a * a
end ScalarModules
