namespace Words

structure Sample where
  natural : USize
  integer : ISize
  unsignedValues : Array USize
  signedValues : Array ISize

def keepUnsigned (value : USize) : USize := value
def keepSigned (value : ISize) : ISize := value
def unsignedText (value : USize) : String := toString value.toNat
def signedText (value : ISize) : String := toString value.toInt
def advanceUnsigned (value : USize) : USize := value + 1
def advanceSigned (value : ISize) : ISize := value + 1
def wordBits : UInt32 := System.Platform.numBits.toUInt32
def keepUnsignedValues (value : Array USize) : Array USize := value
def keepSignedValues (value : Array ISize) : Array ISize := value
def keepUnsignedRows (value : Array (Array USize)) : Array (Array USize) := value
def keepSignedRows (value : Array (Array ISize)) : Array (Array ISize) := value
def keepSample (value : Sample) : Sample := value

theorem keepUnsigned_spec (value : USize) : keepUnsigned value = value := rfl
theorem keepSigned_spec (value : ISize) : keepSigned value = value := rfl
theorem keepSample_spec (value : Sample) : keepSample value = value := rfl

end Words
