namespace OnboardingAsync

/-- Read a value through Lean's effect system. -/
def readValue (value : String) : IO String := pure value

end OnboardingAsync
