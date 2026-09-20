namespace Lists

def reverse_unit (xs : List Unit) : List Unit := xs.reverse
def reverse_bool (xs : List Bool) : List Bool := xs.reverse
def reverse_uint8 (xs : List UInt8) : List UInt8 := xs.reverse
def reverse_uint16 (xs : List UInt16) : List UInt16 := xs.reverse
def reverse_uint32 (xs : List UInt32) : List UInt32 := xs.reverse
def reverse_uint64 (xs : List UInt64) : List UInt64 := xs.reverse
def reverse_int8 (xs : List Int8) : List Int8 := xs.reverse
def reverse_int16 (xs : List Int16) : List Int16 := xs.reverse
def reverse_int32 (xs : List Int32) : List Int32 := xs.reverse
def reverse_int64 (xs : List Int64) : List Int64 := xs.reverse
def reverse_nat (xs : List Nat) : List Nat := xs.reverse
def reverse_int (xs : List Int) : List Int := xs.reverse
def reverse_float32 (xs : List Float32) : List Float32 := xs.reverse
def reverse_float64 (xs : List Float) : List Float := xs.reverse
def reverse_string (xs : List String) : List String := xs.reverse
def reverse_bytes (xs : List ByteArray) : List ByteArray := xs.reverse
def reverse_char (xs : List Char) : List Char := xs.reverse
def reverse_usize (xs : List USize) : List USize := xs.reverse
def reverse_isize (xs : List ISize) : List ISize := xs.reverse

structure Packet where
  sequences : List (List UInt32)
  branches : List (Option (Except String (Nat × Unit)))
  buffers : List ByteArray
  arrays : Array (List (Bool × Char))

def join (xs : List String) : String := String.intercalate "🌱" xs
def mix (xs : List (Array UInt32)) : Array (List UInt32) :=
  xs.reverse.toArray.map (fun row => row.toList.reverse)
def transform (value : Packet) : Packet := {
  sequences := value.sequences.reverse.map List.reverse
  branches := value.branches.reverse.map (fun value => match value with
    | none => none
    | some (.ok (n, u)) => some (.ok (n + 1, u))
    | some (.error text) => some (.error (text ++ "!")))
  buffers := value.buffers.reverse
  arrays := value.arrays.reverse.map List.reverse
}
def duplicate (value : ByteArray) : List ByteArray := [value, value]
def generate (n : Nat) : List UInt32 := List.replicate n 7
def nest (value : Option (List (Except String (List Unit)))) : Option (List (Except String (List Unit))) :=
  value.map (fun xs => xs.reverse.map (fun item => match item with
    | .ok units => .ok units.reverse
    | .error text => .error (text ++ "!")))
def swap (value : Except (List String) (List Nat × List UInt32)) : Except (List Nat × List UInt32) (List String) :=
  match value with
  | .ok (ns, words) => .error (ns.reverse, words.reverse)
  | .error texts => .ok texts.reverse

-- Three levels per alias. The expanded signature has twenty-four List levels.
abbrev L3 (α : Type) := List (List (List α))
abbrev L6 (α : Type) := L3 (L3 α)
abbrev L12 (α : Type) := L6 (L6 α)
def deep (value : L12 (L12 UInt32)) : L12 (L12 UInt32) := value

end Lists
