namespace Glyphs

structure Label where
  marker : Char
  line : Array Char

def keep (value : Char) : Char := value
def point (value : Char) : UInt32 := value.val
def text (value : Char) : String := String.singleton value
def sprout : Char := '🌱'
def choose (condition : Bool) (left right : Char) : Char :=
  if condition then left else right
def keepArray (value : Array Char) : Array Char := value
def keepLabel (value : Label) : Label := value
def keepRows (value : Array (Array Char)) : Array (Array Char) := value

theorem keep_spec (value : Char) : keep value = value := rfl
theorem keepLabel_spec (value : Label) : keepLabel value = value := rfl

end Glyphs
