import OnboardingMedium.Collections

namespace OnboardingMedium

/-- Clamp a natural number to an inclusive upper bound. -/
def clamp (limit value : Nat) : Nat := Nat.min limit value

/-- Preserve a copied optional integer. -/
def optionalInt (value : Option Int) : Option Int := value

/-- Report whether a copied byte buffer contains data. -/
def hasBytes (value : ByteArray) : Bool := value.size > 0

end OnboardingMedium
