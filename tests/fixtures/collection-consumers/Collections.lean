import Arrays
import Records

namespace Collections

def arrayReverseUnit := Arrays.reverseUnit
def arrayReverseBool := Arrays.reverseBool
def arrayReverseUInt8 := Arrays.reverseUInt8
def arrayReverseUInt16 := Arrays.reverseUInt16
def arrayReverseUInt32 := Arrays.reverseUInt32
def arrayReverseUInt64 := Arrays.reverseUInt64
def arrayReverseInt8 := Arrays.reverseInt8
def arrayReverseInt16 := Arrays.reverseInt16
def arrayReverseInt32 := Arrays.reverseInt32
def arrayReverseInt64 := Arrays.reverseInt64
def arrayReverseNat := Arrays.reverseNat
def arrayReverseInt := Arrays.reverseInt
def arrayReverseFloat32 := Arrays.reverseFloat32
def arrayReverseFloat64 := Arrays.reverseFloat64
def arrayReverseString := Arrays.reverseString
def arrayReverseBytes := Arrays.reverseBytes
def arrayReverseChar := Arrays.reverseChar
def arrayReverseUSize := Arrays.reverseUSize
def arrayReverseISize := Arrays.reverseISize
def arrayAdd := Arrays.add
def arrayTotal := Arrays.total
def arrayWords := Arrays.words
def arrayDuplicate := Arrays.duplicate
def arraySize := Arrays.size
def arrayCheckElements := Arrays.checkElements

def recordInspect := Records.inspect
def recordShuffle := Records.shuffle
def recordReverse := Records.reverse
def recordEmpty := Records.empty
def recordSingle := Records.single
def recordCount := Records.count
def recordMake := Records.make
def recordDuplicate := Records.duplicate

-- A fixed acyclic schema with 24 nested Arrays, not a recursive copied type.
def deep (xs : Array (Array (Array (Array (Array (Array (Array (Array
    (Array (Array (Array (Array (Array (Array (Array (Array
    (Array (Array (Array (Array (Array (Array (Array (Array UInt32)))))))))))))))))))))))) := xs

def generate (n : Nat) : Array Unit := Array.replicate n ()

end Collections
