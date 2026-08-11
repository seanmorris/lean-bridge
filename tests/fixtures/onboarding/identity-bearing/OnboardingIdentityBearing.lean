namespace OnboardingIdentityBearing

/-- A stateful counter whose identity must survive host round trips. -/
structure Counter where
  value : Nat

/-- Read the current counter value. -/
def current (counter : Counter) : Nat := counter.value

end OnboardingIdentityBearing
