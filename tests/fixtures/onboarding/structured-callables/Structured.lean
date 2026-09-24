namespace Structured

structure Payload where
  text : String
  rows : Array (Option String)
  count : Nat
  nested : Option (Except String (UInt64 × Unit))

inductive Packet where
  | empty
  | payload (label : String) (rows : Array (Option String))
  | counts (positive : Nat) (negative : Int)

abbrev Alias := Payload

inductive Tree where
  | leaf (value : Nat)
  | branch (children : Array Tree)

def callArray (value : Array (Option String)) (callback : Array (Option String) → Array (Option String)) := callback value
def twiceArray (value : Array (Option String)) (callback : Array (Option String) → Array (Option String)) := callback (callback value)
def makeArray (captured : Array (Option String)) : Bool → Array (Option String) → Array (Option String) := fun selected value => if selected then captured else value

def callList (value : List (Except String (UInt32 × String))) (callback : List (Except String (UInt32 × String)) → List (Except String (UInt32 × String))) := callback value
def twiceList (value : List (Except String (UInt32 × String))) (callback : List (Except String (UInt32 × String)) → List (Except String (UInt32 × String))) := callback (callback value)
def makeList (captured : List (Except String (UInt32 × String))) : Bool → List (Except String (UInt32 × String)) → List (Except String (UInt32 × String)) := fun selected value => if selected then captured else value

def callOption (value : Option (Option Unit)) (callback : Option (Option Unit) → Option (Option Unit)) := callback value
def twiceOption (value : Option (Option Unit)) (callback : Option (Option Unit) → Option (Option Unit)) := callback (callback value)
def makeOption (captured : Option (Option Unit)) : Bool → Option (Option Unit) → Option (Option Unit) := fun selected value => if selected then captured else value

def callResult (value : Except (Array String) (Option UInt32)) (callback : Except (Array String) (Option UInt32) → Except (Array String) (Option UInt32)) := callback value
def twiceResult (value : Except (Array String) (Option UInt32)) (callback : Except (Array String) (Option UInt32) → Except (Array String) (Option UInt32)) := callback (callback value)
def makeResult (captured : Except (Array String) (Option UInt32)) : Bool → Except (Array String) (Option UInt32) → Except (Array String) (Option UInt32) := fun selected value => if selected then captured else value

def callTuple (value : String × (ByteArray × Nat)) (callback : (String × (ByteArray × Nat)) → String × (ByteArray × Nat)) := callback value
def twiceTuple (value : String × (ByteArray × Nat)) (callback : (String × (ByteArray × Nat)) → String × (ByteArray × Nat)) := callback (callback value)
def makeTuple (captured : String × (ByteArray × Nat)) : Bool → (String × (ByteArray × Nat)) → String × (ByteArray × Nat) := fun selected value => if selected then captured else value

def callRecord (value : Payload) (callback : Payload → Payload) := callback value
def twiceRecord (value : Payload) (callback : Payload → Payload) := callback (callback value)
def makeRecord (captured : Payload) : Bool → Payload → Payload := fun selected value => if selected then captured else value

def callVariant (value : Packet) (callback : Packet → Packet) := callback value
def twiceVariant (value : Packet) (callback : Packet → Packet) := callback (callback value)
def makeVariant (captured : Packet) : Bool → Packet → Packet := fun selected value => if selected then captured else value

def callAlias (value : Alias) (callback : Alias → Alias) := callback value
def twiceAlias (value : Alias) (callback : Alias → Alias) := callback (callback value)
def makeAlias (captured : Alias) : Bool → Alias → Alias := fun selected value => if selected then captured else value

def callRecursive (value : Tree) (callback : Tree → Tree) := callback value
def twiceRecursive (value : Tree) (callback : Tree → Tree) := callback (callback value)
def makeRecursive (captured : Tree) : Bool → Tree → Tree := fun selected value => if selected then captured else value

def retainRecord (callback : Payload → Payload) : Payload → Payload := callback
def afterFailure (value : Payload) (callback : Payload → Payload) : String := (callback value).text

end Structured
