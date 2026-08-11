namespace OnboardingAmbiguousLifetime

/-- Invoke a callback now. A different implementation could retain it, so lifetime inference must fail closed. -/
def invokeCallback (callback : Nat → Nat) (value : Nat) : Nat := callback value

end OnboardingAmbiguousLifetime
