namespace LeanLinkSpike.Alpha

structure Box where
  value : UInt32
  label : String

structure Payload where
  enabled : Bool
  count : UInt32
  label : String
  bytes : ByteArray
  values : Array UInt32

structure TransformOwner where
  transform : UInt32 → UInt32

@[export lean_link_alpha_box]
def box (value : UInt32) : Box :=
  { value, label := "alpha" }

set_option compiler.ignoreBorrowAnnotation true in
  @[export lean_link_alpha_read]
  def read (box : @& Box) : UInt32 :=
    box.value

@[export lean_link_alpha_payload]
def payload
    (enabled : Bool)
    (count : UInt32)
    (label : String)
    (bytes : ByteArray)
    (values : Array UInt32) : Payload :=
  { enabled, count, label, bytes, values }

@[export lean_link_alpha_round_trip]
def roundTrip (payload : Payload) : Payload :=
  { payload with
    enabled := !payload.enabled
    count := payload.count + 1 }

@[export lean_link_alpha_with_callback]
def withCallback
    (value : UInt32)
    (transform : UInt32 → UInt32) : UInt32 :=
  transform (value + 1) + 1

@[export lean_link_alpha_make_adder]
def makeAdder (base : UInt32) : TransformOwner :=
  { transform := fun value => base + value }

@[export lean_link_alpha_payload_enabled]
def payloadEnabled (payload : Payload) : Bool :=
  payload.enabled

@[export lean_link_alpha_payload_count]
def payloadCount (payload : Payload) : UInt32 :=
  payload.count

@[export lean_link_alpha_payload_label]
def payloadLabel (payload : Payload) : String :=
  payload.label

@[export lean_link_alpha_payload_bytes]
def payloadBytes (payload : Payload) : ByteArray :=
  payload.bytes

@[export lean_link_alpha_payload_values]
def payloadValues (payload : Payload) : Array UInt32 :=
  payload.values

end LeanLinkSpike.Alpha
