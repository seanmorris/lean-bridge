namespace Recursive

structure Scalars where
  unit : Unit
  bool : Bool
  u8 : UInt8
  u16 : UInt16
  u32 : UInt32
  u64 : UInt64
  i8 : Int8
  i16 : Int16
  i32 : Int32
  i64 : Int64
  natural : Nat
  integer : Int
  f32 : Float32
  f64 : Float
  text : String
  bytes : ByteArray
  char : Char
  word : USize
  signedWord : ISize

-- Deliberately put the recursive constructor before the finite leaf.
inductive Tree where
  | branch (children : List Tree)
  | leaf (payload : Scalars)

mutual
  inductive LeftTree where
    | next (right : RightTree)
    | leaf (value : UInt32)
  inductive RightTree where
    | many (lefts : Array LeftTree)
end

abbrev Forest := List Tree
abbrev TreeAlias := Tree

structure Envelope where
  tree : TreeAlias
  alternatives : Array Forest
  fallback : Option Tree
  outcome : Except String (Tree × Tree)
  marker : Option (Option Unit)

-- There need not be an inhabitant available for adapter fallback generation.
inductive Never where
  | again (value : Never)

inductive Spine where
  | next (value : Spine)
  | leaf (value : UInt32)

def tree (value : Tree) : Tree := value
def forest (value : Forest) : Forest := value
def envelope (value : Envelope) : Envelope := value
def scalars (value : Scalars) : Scalars := value
def left (value : LeftTree) : LeftTree := value
def right (value : RightTree) : RightTree := value
def never (value : Never) : Never := value
def spine (value : Spine) : Spine := value
def grow (value : Spine) : Spine := .next value
def empty : Tree := .branch []
def joinTrees (left right : Tree) : Tree := .branch [left, right]

def inspect (value : Scalars) : Bool :=
  value.unit == () && value.bool && value.u8 == 255 && value.u16 == 65535 &&
  value.u32 == 4294967295 && value.u64 == 18446744073709551615 &&
  value.i8 == -128 && value.i16 == -32768 && value.i32 == -2147483648 &&
  value.i64 == -9223372036854775808 &&
  value.natural == 340282366920938463463374607431768211457 &&
  value.integer == -340282366920938463463374607431768211457 &&
  value.f32 == 1.5 && value.f64 == -2.25 && value.text == "A\x00🌱" &&
  value.bytes == ByteArray.mk #[0, 255, 1] && value.char == '🌱' &&
  value.word == 4294967295 && value.signedWord == -2147483648

end Recursive
