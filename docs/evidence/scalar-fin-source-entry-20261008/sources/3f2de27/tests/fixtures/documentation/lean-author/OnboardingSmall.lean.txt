namespace OnboardingSmall

/-- Add two natural numbers. -/
def add (left right : Nat) : Nat := left + right

/-- Return whether a copied UTF-8 string is empty. -/
def isEmpty (value : String) : Bool := value.isEmpty

/-- Swapping the inputs preserves the sum. -/
theorem add_commutative (left right : Nat) :
    add left right = add right left :=
  Nat.add_comm left right

#print axioms add_commutative

end OnboardingSmall
