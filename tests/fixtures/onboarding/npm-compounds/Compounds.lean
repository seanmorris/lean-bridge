namespace Compounds

def option_unit (value : Option Unit) : Option Unit := value
def result_unit (value : Except Unit Unit) : Except Unit Unit :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_unit (value : Unit × Unit) : Unit × Unit := (value.2, value.1)

def option_bool (value : Option Bool) : Option Bool := value
def result_bool (value : Except Bool Bool) : Except Bool Bool :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_bool (value : Bool × Bool) : Bool × Bool := (value.2, value.1)

def option_uint8 (value : Option UInt8) : Option UInt8 := value
def result_uint8 (value : Except UInt8 UInt8) : Except UInt8 UInt8 :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_uint8 (value : UInt8 × UInt8) : UInt8 × UInt8 := (value.2, value.1)

def option_uint16 (value : Option UInt16) : Option UInt16 := value
def result_uint16 (value : Except UInt16 UInt16) : Except UInt16 UInt16 :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_uint16 (value : UInt16 × UInt16) : UInt16 × UInt16 := (value.2, value.1)

def option_uint32 (value : Option UInt32) : Option UInt32 := value
def result_uint32 (value : Except UInt32 UInt32) : Except UInt32 UInt32 :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_uint32 (value : UInt32 × UInt32) : UInt32 × UInt32 := (value.2, value.1)

def option_uint64 (value : Option UInt64) : Option UInt64 := value
def result_uint64 (value : Except UInt64 UInt64) : Except UInt64 UInt64 :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_uint64 (value : UInt64 × UInt64) : UInt64 × UInt64 := (value.2, value.1)

def option_int8 (value : Option Int8) : Option Int8 := value
def result_int8 (value : Except Int8 Int8) : Except Int8 Int8 :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_int8 (value : Int8 × Int8) : Int8 × Int8 := (value.2, value.1)

def option_int16 (value : Option Int16) : Option Int16 := value
def result_int16 (value : Except Int16 Int16) : Except Int16 Int16 :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_int16 (value : Int16 × Int16) : Int16 × Int16 := (value.2, value.1)

def option_int32 (value : Option Int32) : Option Int32 := value
def result_int32 (value : Except Int32 Int32) : Except Int32 Int32 :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_int32 (value : Int32 × Int32) : Int32 × Int32 := (value.2, value.1)

def option_int64 (value : Option Int64) : Option Int64 := value
def result_int64 (value : Except Int64 Int64) : Except Int64 Int64 :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_int64 (value : Int64 × Int64) : Int64 × Int64 := (value.2, value.1)

def option_nat (value : Option Nat) : Option Nat := value
def result_nat (value : Except Nat Nat) : Except Nat Nat :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_nat (value : Nat × Nat) : Nat × Nat := (value.2, value.1)

def option_int (value : Option Int) : Option Int := value
def result_int (value : Except Int Int) : Except Int Int :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_int (value : Int × Int) : Int × Int := (value.2, value.1)

def option_float32 (value : Option Float32) : Option Float32 := value
def result_float32 (value : Except Float32 Float32) : Except Float32 Float32 :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_float32 (value : Float32 × Float32) : Float32 × Float32 := (value.2, value.1)

def option_float64 (value : Option Float) : Option Float := value
def result_float64 (value : Except Float Float) : Except Float Float :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_float64 (value : Float × Float) : Float × Float := (value.2, value.1)

def option_string (value : Option String) : Option String := value
def result_string (value : Except String String) : Except String String :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_string (value : String × String) : String × String := (value.2, value.1)

def option_bytes (value : Option ByteArray) : Option ByteArray := value
def result_bytes (value : Except ByteArray ByteArray) : Except ByteArray ByteArray :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_bytes (value : ByteArray × ByteArray) : ByteArray × ByteArray := (value.2, value.1)

def option_char (value : Option Char) : Option Char := value
def result_char (value : Except Char Char) : Except Char Char :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_char (value : Char × Char) : Char × Char := (value.2, value.1)

def option_usize (value : Option USize) : Option USize := value
def result_usize (value : Except USize USize) : Except USize USize :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_usize (value : USize × USize) : USize × USize := (value.2, value.1)

def option_isize (value : Option ISize) : Option ISize := value
def result_isize (value : Except ISize ISize) : Except ISize ISize :=
  match value with | .ok x => .error x | .error x => .ok x
def tuple_isize (value : ISize × ISize) : ISize × ISize := (value.2, value.1)

def classify (value : Option (Option Unit)) : UInt32 :=
  match value with | none => 0 | some none => 1 | some (some _) => 2
def next (value : Option (Option Unit)) : Option (Option Unit) :=
  match value with | none => some none | some none => some (some ()) | some (some _) => none
def flip (value : Except (Option String) (UInt32 × Option Unit)) : Except (UInt32 × Option Unit) (Option String) :=
  match value with | .ok x => .error x | .error x => .ok x

structure Packet where
  choice : Option (Except String (Nat × Unit))
  products : (UInt32 × String) × (Bool × Char)
  rows : Array (Option (Except (ByteArray × Int) (String × UInt64)))
  nested : Except (Option Nat) (Option (Except String (UInt32 × Unit)))

def transform (value : Packet) : Packet :=
  { value with
    choice := value.choice.map (fun v => match v with | .ok (n, u) => .ok (n + 1, u) | .error s => .error (s ++ "!"))
    products := ((value.products.1.1 + 1, value.products.1.2 ++ "!"), (!value.products.2.1, value.products.2.2))
    rows := value.rows.reverse }

def duplicate (value : Option ByteArray) : Except String (Option (Array ByteArray)) :=
  match value with | none => .error "empty" | some bytes => .ok (some #[bytes, bytes])

abbrev Deep := (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Option (Except String (UInt32 × Unit))))))))))))))))))))))))))
def deep (value : Deep) : Deep := value
def make : Option (Except String (UInt64 × Unit)) := some (.ok (18446744073709551615, ()))

end Compounds
