namespace OnboardingMedium

/-- Return the number of copied 32-bit integers. -/
def sampleCount (values : Array UInt32) : Nat := values.size

/-- Return the first copied 32-bit integer when present. -/
def firstSample (values : Array UInt32) : Option UInt32 := values[0]?

end OnboardingMedium
