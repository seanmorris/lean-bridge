namespace OnboardingCustomMarshaling

/-- An amount whose host representation needs a reviewed decimal policy. -/
structure Money where
  minorUnits : Int
  currency : String

/-- Add two amounts after the adapter confirms matching currencies. -/
def addMoney (left right : Money) : Money :=
  { left with minorUnits := left.minorUnits + right.minorUnits }

end OnboardingCustomMarshaling
