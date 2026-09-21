namespace Shapes

inductive Signal where
  | idle
  | stopped
  | data (count : UInt32) (label : String)
  | marker (value : Unit)

inductive Mode where
  | first
  | second
  | third

structure Packet where
  events : List Signal
  fallback : Option Signal

inductive Nested where
  | empty
  | packet (value : Packet)
  | outcome (value : Except String (Signal × Mode))

def echo (value : Signal) : Signal := value
def mode (value : Mode) : Mode := value
def nested (value : Nested) : Nested := value
def signals (value : Array (List Signal)) : Array (List Signal) := value

inductive Scalars where
  | absent
  | all (unit : Unit) (bool : Bool) (u8 : UInt8) (u16 : UInt16)
      (u32 : UInt32) (u64 : UInt64) (i8 : Int8) (i16 : Int16)
      (i32 : Int32) (i64 : Int64) (natural : Nat) (integer : Int)
      (f32 : Float32) (f64 : Float) (text : String) (bytes : ByteArray)
      (char : Char) (word : USize) (signedWord : ISize)

def scalars (value : Scalars) : Scalars := value

inductive Anonymous where
  | number : UInt32 → Anonymous
  | pair : UInt32 → String → Anonymous
  | collision (arg1 : UInt32) : String → Anonymous

def anonymous (value : Anonymous) : Anonymous := value

inductive Tree where
  | leaf (value : UInt32)
  | branch (children : List Tree)

inductive Generic (α : Type) where
  | one (value : α)

inductive Indexed : Nat → Type where
  | zero : Indexed 0

inductive WithProof where
  | value (n : Nat) (proof : n = n)

inductive WithCallback where
  | value (run : UInt32 → UInt32)

inductive WithReservedField where
  | value (kind : UInt32)

inductive WithDependency where
  | value (size : Nat) (index : Fin size)

inductive Empty where

def tree (value : Tree) : Tree := value
def generic (value : Generic UInt32) : Generic UInt32 := value
def indexed (value : Indexed 0) : Indexed 0 := value
def proof (value : WithProof) : WithProof := value
def callback (value : WithCallback) : WithCallback := value
def reserved (value : WithReservedField) : WithReservedField := value
def dependent (value : WithDependency) : WithDependency := value
def empty (value : Empty) : Empty := value

end Shapes
