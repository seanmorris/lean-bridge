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

-- There need not be an inhabitant available for adapter fallback generation.
inductive Never where
  | again (value : Never)

def tree (value : Tree) : Tree := value
def forest (value : Forest) : Forest := value
def envelope (value : Envelope) : Envelope := value
def scalars (value : Scalars) : Scalars := value
def left (value : LeftTree) : LeftTree := value
def right (value : RightTree) : RightTree := value
def never (value : Never) : Never := value

end Recursive
