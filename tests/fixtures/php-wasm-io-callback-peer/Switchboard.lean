namespace Switchboard

def twice (value : UInt16) (step : UInt16 → UInt16) : UInt16 :=
  step (step value)

def make_adder (amount value : UInt16) : UInt16 := amount + value

def answer : UInt16 := 17

end Switchboard
