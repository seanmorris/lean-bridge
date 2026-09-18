namespace Characters

/-- Preserve one Unicode scalar value, including NUL and supplementary characters. -/
def echo (value : Char) : Char := value

/-- Read the scalar value without interpreting a UTF-16 code unit. -/
def codePoint (value : Char) : UInt32 := value.val

/-- Turn one character into a string without normalization. -/
def text (value : Char) : String := String.singleton value

/-- Produce a supplementary-plane character. -/
def sprout : Char := '🌱'

/-- Mix Char with the existing scalar transport. -/
def choose (condition : Bool) (left right : Char) : Char :=
  if condition then left else right

theorem echo_spec (value : Char) : echo value = value := rfl
theorem codePoint_spec (value : Char) : codePoint value = value.val := rfl

end Characters
