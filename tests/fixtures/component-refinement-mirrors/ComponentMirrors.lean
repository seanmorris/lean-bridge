import NominalConversion

namespace NominalConversion

abbrev EnvelopeAlias := Envelope
abbrev Envelopes := Array EnvelopeAlias
abbrev DigitAlias := Fin 3

structure Digit where
  newDigit ::
  value : DigitAlias

structure WithDigit where
  payload : Positive
  digit : Digit

def echoAliases (values : Envelopes) : Envelopes := values
def withDigit (value : WithDigit) : Nat := value.payload.val * 100 + value.digit.value.val
def echoDigit (value : Digit) : Digit := value

end NominalConversion
