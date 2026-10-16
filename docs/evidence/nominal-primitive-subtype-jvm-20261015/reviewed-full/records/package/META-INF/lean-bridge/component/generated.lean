import NominalPrimitiveSubtypes

namespace LeanBridgeNative19ad06f04a0c2d39

structure LbErased.NominalPrimitiveSubtypes.Packet where
  «unitValue» : _root_.Unit
  «boolValue» : _root_.Bool
  «uint8Value» : _root_.UInt8
  «uint16Value» : _root_.UInt16
  «uint32Value» : _root_.UInt32
  «uint64Value» : _root_.UInt64
  «int8Value» : _root_.Int8
  «int16Value» : _root_.Int16
  «int32Value» : _root_.Int32
  «int64Value» : _root_.Int64
  «natValue» : _root_.Nat
  «intValue» : _root_.Int
  «float32Value» : _root_.Float32
  «float64Value» : _root_.Float
  «textValue» : _root_.String
  «bytesValue» : _root_.ByteArray
  «charValue» : _root_.Char
  «usizeValue» : _root_.USize
  «isizeValue» : _root_.ISize
  «digit» : _root_.Nat

def LbErased.NominalPrimitiveSubtypes.Packet.via_2b8e1b1e9fa074c38f7ae950df618e1af971cf44da9d28a033dcc9535b8e489e (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Option _root_.NominalPrimitiveSubtypes.Packet := do
  let a0 ← _root_.NominalPrimitiveSubtypes.unitB value.«unitValue»
  let a1 ← _root_.NominalPrimitiveSubtypes.boolB value.«boolValue»
  let a2 ← _root_.NominalPrimitiveSubtypes.uint8B value.«uint8Value»
  let a3 ← _root_.NominalPrimitiveSubtypes.uint16B value.«uint16Value»
  let a4 ← _root_.NominalPrimitiveSubtypes.uint32B value.«uint32Value»
  let a5 ← _root_.NominalPrimitiveSubtypes.uint64B value.«uint64Value»
  let a6 ← _root_.NominalPrimitiveSubtypes.int8B value.«int8Value»
  let a7 ← _root_.NominalPrimitiveSubtypes.int16B value.«int16Value»
  let a8 ← _root_.NominalPrimitiveSubtypes.int32B value.«int32Value»
  let a9 ← _root_.NominalPrimitiveSubtypes.int64B value.«int64Value»
  let a10 ← _root_.NominalPrimitiveSubtypes.natB value.«natValue»
  let a11 ← _root_.NominalPrimitiveSubtypes.intB value.«intValue»
  let a12 ← _root_.NominalPrimitiveSubtypes.float32B value.«float32Value»
  let a13 ← _root_.NominalPrimitiveSubtypes.float64B value.«float64Value»
  let a14 ← _root_.NominalPrimitiveSubtypes.textB value.«textValue»
  let a15 ← _root_.NominalPrimitiveSubtypes.bytesB value.«bytesValue»
  let a16 ← _root_.NominalPrimitiveSubtypes.charB value.«charValue»
  let a17 ← _root_.NominalPrimitiveSubtypes.usizeB value.«usizeValue»
  let a18 ← _root_.NominalPrimitiveSubtypes.isizeB value.«isizeValue»
  let a19 ← (if proof : (value.«digit») < 3 then _root_.Option.some (⟨(value.«digit»), proof⟩ : _root_.Fin 3) else _root_.Option.none)
  pure (_root_.NominalPrimitiveSubtypes.Packet.mk a0 a1 a2 a3 a4 a5 a6 a7 a8 a9 a10 a11 a12 a13 a14 a15 a16 a17 a18 a19)

def LbErased.NominalPrimitiveSubtypes.Packet.via_75f9096e4bb003a323e14578a773b2dad1322ed28cdf67a8e22bd3662ee6d9d5 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Option _root_.NominalPrimitiveSubtypes.Packet := do
  let a0 ← _root_.NominalPrimitiveSubtypes.unitA value.«unitValue»
  let a1 ← _root_.NominalPrimitiveSubtypes.boolA value.«boolValue»
  let a2 ← _root_.NominalPrimitiveSubtypes.uint8A value.«uint8Value»
  let a3 ← _root_.NominalPrimitiveSubtypes.uint16A value.«uint16Value»
  let a4 ← _root_.NominalPrimitiveSubtypes.uint32A value.«uint32Value»
  let a5 ← _root_.NominalPrimitiveSubtypes.uint64A value.«uint64Value»
  let a6 ← _root_.NominalPrimitiveSubtypes.int8A value.«int8Value»
  let a7 ← _root_.NominalPrimitiveSubtypes.int16A value.«int16Value»
  let a8 ← _root_.NominalPrimitiveSubtypes.int32A value.«int32Value»
  let a9 ← _root_.NominalPrimitiveSubtypes.int64A value.«int64Value»
  let a10 ← _root_.NominalPrimitiveSubtypes.natA value.«natValue»
  let a11 ← _root_.NominalPrimitiveSubtypes.intA value.«intValue»
  let a12 ← _root_.NominalPrimitiveSubtypes.float32A value.«float32Value»
  let a13 ← _root_.NominalPrimitiveSubtypes.float64A value.«float64Value»
  let a14 ← _root_.NominalPrimitiveSubtypes.textA value.«textValue»
  let a15 ← _root_.NominalPrimitiveSubtypes.bytesA value.«bytesValue»
  let a16 ← _root_.NominalPrimitiveSubtypes.charA value.«charValue»
  let a17 ← _root_.NominalPrimitiveSubtypes.usizeA value.«usizeValue»
  let a18 ← _root_.NominalPrimitiveSubtypes.isizeA value.«isizeValue»
  let a19 ← (if proof : (value.«digit») < 3 then _root_.Option.some (⟨(value.«digit»), proof⟩ : _root_.Fin 3) else _root_.Option.none)
  pure (_root_.NominalPrimitiveSubtypes.Packet.mk a0 a1 a2 a3 a4 a5 a6 a7 a8 a9 a10 a11 a12 a13 a14 a15 a16 a17 a18 a19)

def LbErased.NominalPrimitiveSubtypes.Packet.via_a5fb4c23d069ba7976028d4edf99789b8a0db09d7098c9a5ce6a63ef31cc4c37 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Option _root_.NominalPrimitiveSubtypes.Packet := do
  let a0 ← _root_.NominalPrimitiveSubtypes.unitReject value.«unitValue»
  let a1 ← _root_.NominalPrimitiveSubtypes.boolA value.«boolValue»
  let a2 ← _root_.NominalPrimitiveSubtypes.uint8A value.«uint8Value»
  let a3 ← _root_.NominalPrimitiveSubtypes.uint16A value.«uint16Value»
  let a4 ← _root_.NominalPrimitiveSubtypes.uint32A value.«uint32Value»
  let a5 ← _root_.NominalPrimitiveSubtypes.uint64A value.«uint64Value»
  let a6 ← _root_.NominalPrimitiveSubtypes.int8A value.«int8Value»
  let a7 ← _root_.NominalPrimitiveSubtypes.int16A value.«int16Value»
  let a8 ← _root_.NominalPrimitiveSubtypes.int32A value.«int32Value»
  let a9 ← _root_.NominalPrimitiveSubtypes.int64A value.«int64Value»
  let a10 ← _root_.NominalPrimitiveSubtypes.natA value.«natValue»
  let a11 ← _root_.NominalPrimitiveSubtypes.intA value.«intValue»
  let a12 ← _root_.NominalPrimitiveSubtypes.float32A value.«float32Value»
  let a13 ← _root_.NominalPrimitiveSubtypes.float64A value.«float64Value»
  let a14 ← _root_.NominalPrimitiveSubtypes.textA value.«textValue»
  let a15 ← _root_.NominalPrimitiveSubtypes.bytesA value.«bytesValue»
  let a16 ← _root_.NominalPrimitiveSubtypes.charA value.«charValue»
  let a17 ← _root_.NominalPrimitiveSubtypes.usizeA value.«usizeValue»
  let a18 ← _root_.NominalPrimitiveSubtypes.isizeA value.«isizeValue»
  let a19 ← (if proof : (value.«digit») < 3 then _root_.Option.some (⟨(value.«digit»), proof⟩ : _root_.Fin 3) else _root_.Option.none)
  pure (_root_.NominalPrimitiveSubtypes.Packet.mk a0 a1 a2 a3 a4 a5 a6 a7 a8 a9 a10 a11 a12 a13 a14 a15 a16 a17 a18 a19)

def LbErased.NominalPrimitiveSubtypes.Packet.erase (value : _root_.NominalPrimitiveSubtypes.Packet) : LbErased.NominalPrimitiveSubtypes.Packet :=
  LbErased.NominalPrimitiveSubtypes.Packet.mk (value.«unitValue»).val (value.«boolValue»).val (value.«uint8Value»).val (value.«uint16Value»).val (value.«uint32Value»).val (value.«uint64Value»).val (value.«int8Value»).val (value.«int16Value»).val (value.«int32Value»).val (value.«int64Value»).val (value.«natValue»).val (value.«intValue»).val (value.«float32Value»).val (value.«float64Value»).val (value.«textValue»).val (value.«bytesValue»).val (value.«charValue»).val (value.«usizeValue»).val (value.«isizeValue»).val (value.«digit»).val

inductive LbErased.NominalPrimitiveSubtypes.Event where
  | «empty»  : LbErased.NominalPrimitiveSubtypes.Event
  | «box» (a0 : LbErased.NominalPrimitiveSubtypes.Packet) : LbErased.NominalPrimitiveSubtypes.Event
  | «choices» (a0 : (_root_.Array (_root_.Option (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet)))) : LbErased.NominalPrimitiveSubtypes.Event

def LbErased.NominalPrimitiveSubtypes.Event.via_77aa7dedb01ad10840cb5a7946b92cb44b4185dcb7687ede83f404811dcd1465 (value : LbErased.NominalPrimitiveSubtypes.Event) : _root_.Option _root_.NominalPrimitiveSubtypes.Event :=
  match value with
  | .«empty»  => do pure (_root_.NominalPrimitiveSubtypes.Event.empty )
  | .«box» a0 => do let b0 ← (LbErased.NominalPrimitiveSubtypes.Packet.via_75f9096e4bb003a323e14578a773b2dad1322ed28cdf67a8e22bd3662ee6d9d5 (a0)); pure (_root_.NominalPrimitiveSubtypes.Event.box b0)
  | .«choices» a0 => do let b0 ← ((a0).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((match (_bridgeValue1) with | _root_.Except.ok _bridgeValue2 => ((LbErased.NominalPrimitiveSubtypes.Packet.via_75f9096e4bb003a323e14578a773b2dad1322ed28cdf67a8e22bd3662ee6d9d5 (_bridgeValue2))).map _root_.Except.ok | _root_.Except.error _bridgeValue2 => ((LbErased.NominalPrimitiveSubtypes.Packet.via_2b8e1b1e9fa074c38f7ae950df618e1af971cf44da9d28a033dcc9535b8e489e (_bridgeValue2))).map _root_.Except.error)).map _root_.Option.some))); pure (_root_.NominalPrimitiveSubtypes.Event.choices b0)

def LbErased.NominalPrimitiveSubtypes.Event.via_e1bd9904600e1399e623b338378f49cfdb972dced19a4479b0956d7e2ba77a72 (value : LbErased.NominalPrimitiveSubtypes.Event) : _root_.Option _root_.NominalPrimitiveSubtypes.Event :=
  match value with
  | .«empty»  => do pure (_root_.NominalPrimitiveSubtypes.Event.empty )
  | .«box» a0 => do let b0 ← (LbErased.NominalPrimitiveSubtypes.Packet.via_2b8e1b1e9fa074c38f7ae950df618e1af971cf44da9d28a033dcc9535b8e489e (a0)); pure (_root_.NominalPrimitiveSubtypes.Event.box b0)
  | .«choices» a0 => do let b0 ← ((a0).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((match (_bridgeValue1) with | _root_.Except.ok _bridgeValue2 => ((LbErased.NominalPrimitiveSubtypes.Packet.via_2b8e1b1e9fa074c38f7ae950df618e1af971cf44da9d28a033dcc9535b8e489e (_bridgeValue2))).map _root_.Except.ok | _root_.Except.error _bridgeValue2 => ((LbErased.NominalPrimitiveSubtypes.Packet.via_75f9096e4bb003a323e14578a773b2dad1322ed28cdf67a8e22bd3662ee6d9d5 (_bridgeValue2))).map _root_.Except.error)).map _root_.Option.some))); pure (_root_.NominalPrimitiveSubtypes.Event.choices b0)

def LbErased.NominalPrimitiveSubtypes.Event.erase (value : _root_.NominalPrimitiveSubtypes.Event) : LbErased.NominalPrimitiveSubtypes.Event :=
  match value with
  | .«empty»  => LbErased.NominalPrimitiveSubtypes.Event.«empty» 
  | .«box» a0 => LbErased.NominalPrimitiveSubtypes.Event.«box» (LbErased.NominalPrimitiveSubtypes.Packet.erase (a0))
  | .«choices» a0 => LbErased.NominalPrimitiveSubtypes.Event.«choices» ((a0).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (match (_bridgeValue1) with | _root_.Except.ok _bridgeValue2 => .ok (LbErased.NominalPrimitiveSubtypes.Packet.erase (_bridgeValue2)) | _root_.Except.error _bridgeValue2 => .error (LbErased.NominalPrimitiveSubtypes.Packet.erase (_bridgeValue2)))))))

structure LbErased.NominalPrimitiveSubtypes.PacketPair where
  «left» : (_root_.Array (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet))
  «right» : (_root_.Array (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet))

def LbErased.NominalPrimitiveSubtypes.PacketPair.via_e24ef91163484ba691f05e7db97b86531fead22337f50c45cb1af11e1df4a96c (value : LbErased.NominalPrimitiveSubtypes.PacketPair) : _root_.Option _root_.NominalPrimitiveSubtypes.PacketPair := do
  let a0 ← ((value.«left»).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.NominalPrimitiveSubtypes.Packet.via_75f9096e4bb003a323e14578a773b2dad1322ed28cdf67a8e22bd3662ee6d9d5 (_bridgeValue1))).map _root_.Option.some)))
  let a1 ← ((value.«right»).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.NominalPrimitiveSubtypes.Packet.via_2b8e1b1e9fa074c38f7ae950df618e1af971cf44da9d28a033dcc9535b8e489e (_bridgeValue1))).map _root_.Option.some)))
  pure (_root_.NominalPrimitiveSubtypes.PacketPair.mk a0 a1)

def LbErased.NominalPrimitiveSubtypes.PacketPair.erase (value : _root_.NominalPrimitiveSubtypes.PacketPair) : LbErased.NominalPrimitiveSubtypes.PacketPair :=
  LbErased.NominalPrimitiveSubtypes.PacketPair.mk ((value.«left»).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (LbErased.NominalPrimitiveSubtypes.Packet.erase (_bridgeValue1)))))) ((value.«right»).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (LbErased.NominalPrimitiveSubtypes.Packet.erase (_bridgeValue1))))))

@[export lb_ad1aedc6e1a2dda5a7c9a643]
def f_lb_ad1aedc6e1a2dda5a7c9a643 (a0 : (_root_.Array (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet))) (a1 : (_root_.Array (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet))) : (_root_.Option (_root_.Array (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet))) :=
  match ((a0).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.NominalPrimitiveSubtypes.Packet.via_75f9096e4bb003a323e14578a773b2dad1322ed28cdf67a8e22bd3662ee6d9d5 (_bridgeValue1))).map _root_.Option.some))) with
  | .some _bridgeSubtype0 =>
    match ((a1).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.NominalPrimitiveSubtypes.Packet.via_2b8e1b1e9fa074c38f7ae950df618e1af971cf44da9d28a033dcc9535b8e489e (_bridgeValue1))).map _root_.Option.some))) with
    | .some _bridgeSubtype1 =>
      _root_.Option.some ((let _bridgeResult := _root_.NominalPrimitiveSubtypes.aliases _bridgeSubtype0 _bridgeSubtype1; ((_bridgeResult).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (LbErased.NominalPrimitiveSubtypes.Packet.erase (_bridgeValue1))))))))
    | .none =>
      _root_.Option.none
  | .none =>
    _root_.Option.none

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_0]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitA value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_1]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolA value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_2]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8A value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_3]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16A value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_4]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32A value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_5]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64A value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_6]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8A value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_7]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16A value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_8]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32A value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_9]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64A value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_10]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natA value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_11]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intA value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_12]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32A value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_13]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64A value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_14]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textA value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_15]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesA value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_16]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charA value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_17]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_18]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_0]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitB value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_1]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolB value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_2]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8B value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_3]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16B value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_4]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32B value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_5]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64B value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_6]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8B value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_7]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16B value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_8]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32B value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_9]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64B value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_10]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natB value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_11]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intB value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_12]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32B value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_13]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64B value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_14]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textB value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_15]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesB value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_16]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charB value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_17]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_18]
def f_lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda]
def f_lb_f830d4f947d8993755fe2eda (a0 : LbErased.NominalPrimitiveSubtypes.Packet) (a1 : LbErased.NominalPrimitiveSubtypes.Packet) : (_root_.Option (_root_.Prod LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet)) :=
  match (LbErased.NominalPrimitiveSubtypes.Packet.via_75f9096e4bb003a323e14578a773b2dad1322ed28cdf67a8e22bd3662ee6d9d5 (a0)) with
  | .some _bridgeSubtype0 =>
    match (LbErased.NominalPrimitiveSubtypes.Packet.via_2b8e1b1e9fa074c38f7ae950df618e1af971cf44da9d28a033dcc9535b8e489e (a1)) with
    | .some _bridgeSubtype1 =>
      _root_.Option.some ((let _bridgeResult := _root_.NominalPrimitiveSubtypes.combine _bridgeSubtype0 _bridgeSubtype1; ((LbErased.NominalPrimitiveSubtypes.Packet.erase ((_bridgeResult).fst)), (LbErased.NominalPrimitiveSubtypes.Packet.erase ((_bridgeResult).snd)))))
    | .none =>
      _root_.Option.none
  | .none =>
    _root_.Option.none

@[export lb_f830d4f947d8993755fe2eda_refinement_0_0]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitA value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_1]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolA value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_2]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8A value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_3]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16A value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_4]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32A value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_5]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64A value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_6]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8A value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_7]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16A value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_8]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32A value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_9]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64A value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_10]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natA value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_11]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intA value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_12]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32A value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_13]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64A value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_14]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textA value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_15]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesA value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_16]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charA value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_17]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_0_18]
def f_lb_f830d4f947d8993755fe2eda_refinement_0_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_0]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitB value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_1]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolB value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_2]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8B value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_3]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16B value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_4]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32B value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_5]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64B value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_6]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8B value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_7]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16B value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_8]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32B value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_9]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64B value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_10]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natB value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_11]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intB value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_12]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32B value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_13]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64B value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_14]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textB value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_15]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesB value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_16]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charB value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_17]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_f830d4f947d8993755fe2eda_refinement_1_18]
def f_lb_f830d4f947d8993755fe2eda_refinement_1_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934]
def f_lb_f444432e2b24d280246a5934 (a0 : LbErased.NominalPrimitiveSubtypes.Packet) : (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet) :=
  match (LbErased.NominalPrimitiveSubtypes.Packet.via_75f9096e4bb003a323e14578a773b2dad1322ed28cdf67a8e22bd3662ee6d9d5 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some ((let _bridgeResult := _root_.NominalPrimitiveSubtypes.echoA _bridgeSubtype0; (LbErased.NominalPrimitiveSubtypes.Packet.erase (_bridgeResult))))
  | .none =>
    _root_.Option.none

@[export lb_f444432e2b24d280246a5934_refinement_0_0]
def f_lb_f444432e2b24d280246a5934_refinement_0_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitA value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_1]
def f_lb_f444432e2b24d280246a5934_refinement_0_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolA value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_2]
def f_lb_f444432e2b24d280246a5934_refinement_0_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8A value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_3]
def f_lb_f444432e2b24d280246a5934_refinement_0_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16A value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_4]
def f_lb_f444432e2b24d280246a5934_refinement_0_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32A value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_5]
def f_lb_f444432e2b24d280246a5934_refinement_0_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64A value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_6]
def f_lb_f444432e2b24d280246a5934_refinement_0_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8A value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_7]
def f_lb_f444432e2b24d280246a5934_refinement_0_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16A value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_8]
def f_lb_f444432e2b24d280246a5934_refinement_0_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32A value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_9]
def f_lb_f444432e2b24d280246a5934_refinement_0_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64A value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_10]
def f_lb_f444432e2b24d280246a5934_refinement_0_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natA value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_11]
def f_lb_f444432e2b24d280246a5934_refinement_0_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intA value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_12]
def f_lb_f444432e2b24d280246a5934_refinement_0_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32A value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_13]
def f_lb_f444432e2b24d280246a5934_refinement_0_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64A value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_14]
def f_lb_f444432e2b24d280246a5934_refinement_0_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textA value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_15]
def f_lb_f444432e2b24d280246a5934_refinement_0_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesA value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_16]
def f_lb_f444432e2b24d280246a5934_refinement_0_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charA value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_17]
def f_lb_f444432e2b24d280246a5934_refinement_0_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_f444432e2b24d280246a5934_refinement_0_18]
def f_lb_f444432e2b24d280246a5934_refinement_0_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b]
def f_lb_fcd46ebe42d8a5f37879812b (a0 : LbErased.NominalPrimitiveSubtypes.Packet) : (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet) :=
  match (LbErased.NominalPrimitiveSubtypes.Packet.via_2b8e1b1e9fa074c38f7ae950df618e1af971cf44da9d28a033dcc9535b8e489e (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some ((let _bridgeResult := _root_.NominalPrimitiveSubtypes.echoB _bridgeSubtype0; (LbErased.NominalPrimitiveSubtypes.Packet.erase (_bridgeResult))))
  | .none =>
    _root_.Option.none

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_0]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitB value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_1]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolB value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_2]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8B value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_3]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16B value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_4]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32B value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_5]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64B value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_6]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8B value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_7]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16B value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_8]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32B value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_9]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64B value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_10]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natB value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_11]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intB value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_12]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32B value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_13]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64B value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_14]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textB value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_15]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesB value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_16]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charB value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_17]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_fcd46ebe42d8a5f37879812b_refinement_0_18]
def f_lb_fcd46ebe42d8a5f37879812b_refinement_0_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679]
def f_lb_7418bd537393e68a59611679 (a0 : LbErased.NominalPrimitiveSubtypes.Event) : (_root_.Option LbErased.NominalPrimitiveSubtypes.Event) :=
  match (LbErased.NominalPrimitiveSubtypes.Event.via_77aa7dedb01ad10840cb5a7946b92cb44b4185dcb7687ede83f404811dcd1465 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some ((let _bridgeResult := _root_.NominalPrimitiveSubtypes.echoEventA _bridgeSubtype0; (LbErased.NominalPrimitiveSubtypes.Event.erase (_bridgeResult))))
  | .none =>
    _root_.Option.none

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_0]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_1]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_2]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_3]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_4]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_5]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_6]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_7]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_8]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_9]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_10]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_11]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_12]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_13]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_14]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_15]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_16]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_17]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_1_0_18]
def f_lb_7418bd537393e68a59611679_refinement_0_1_0_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_0]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_1]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_2]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_3]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_4]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_5]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_6]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_7]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_8]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_9]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_10]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_11]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_12]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_13]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64A value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_14]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_15]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_16]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_17]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_18]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_0]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitB value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_1]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolB value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_2]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8B value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_3]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16B value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_4]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32B value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_5]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64B value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_6]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8B value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_7]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16B value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_8]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32B value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_9]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64B value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_10]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natB value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_11]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intB value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_12]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32B value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_13]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64B value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_14]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textB value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_15]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesB value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_16]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charB value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_17]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_18]
def f_lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871]
def f_lb_2ff268195b6929b7f5ecf871 (a0 : LbErased.NominalPrimitiveSubtypes.Event) : (_root_.Option LbErased.NominalPrimitiveSubtypes.Event) :=
  match (LbErased.NominalPrimitiveSubtypes.Event.via_e1bd9904600e1399e623b338378f49cfdb972dced19a4479b0956d7e2ba77a72 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some ((let _bridgeResult := _root_.NominalPrimitiveSubtypes.echoEventB _bridgeSubtype0; (LbErased.NominalPrimitiveSubtypes.Event.erase (_bridgeResult))))
  | .none =>
    _root_.Option.none

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_0]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_1]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_2]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_3]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_4]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_5]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_6]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_7]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_8]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_9]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_10]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_11]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_12]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_13]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_14]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_15]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_16]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_17]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_18]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_0]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_1]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_2]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_3]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_4]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_5]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_6]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_7]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_8]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_9]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_10]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_11]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_12]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_13]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64B value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_14]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_15]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_16]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_17]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_18]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_0]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitA value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_1]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolA value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_2]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8A value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_3]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16A value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_4]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32A value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_5]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64A value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_6]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8A value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_7]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16A value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_8]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32A value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_9]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64A value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_10]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natA value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_11]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intA value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_12]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32A value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_13]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64A value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_14]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textA value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_15]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesA value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_16]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charA value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_17]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_18]
def f_lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce]
def f_lb_fe44a84c56da309434fd70ce (a0 : LbErased.NominalPrimitiveSubtypes.PacketPair) : (_root_.Option LbErased.NominalPrimitiveSubtypes.PacketPair) :=
  match (LbErased.NominalPrimitiveSubtypes.PacketPair.via_e24ef91163484ba691f05e7db97b86531fead22337f50c45cb1af11e1df4a96c (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some ((let _bridgeResult := _root_.NominalPrimitiveSubtypes.echoPair _bridgeSubtype0; (LbErased.NominalPrimitiveSubtypes.PacketPair.erase (_bridgeResult))))
  | .none =>
    _root_.Option.none

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_0]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitA value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_1]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolA value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_2]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8A value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_3]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16A value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_4]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32A value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_5]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64A value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_6]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8A value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_7]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16A value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_8]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32A value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_9]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64A value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_10]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natA value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_11]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intA value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_12]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32A value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_13]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64A value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_14]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textA value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_15]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesA value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_16]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charA value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_17]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_18]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_0]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitB value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_1]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolB value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_2]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8B value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_3]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16B value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_4]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32B value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_5]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64B value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_6]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8B value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_7]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16B value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_8]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32B value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_9]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64B value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_10]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natB value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_11]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intB value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_12]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32B value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_13]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64B value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_14]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textB value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_15]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesB value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_16]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charB value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_17]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_18]
def f_lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeB value with
  | .some _ => 1
  | .none => 0

@[export lb_4d420414dfdb252510c59482]
def f_lb_4d420414dfdb252510c59482 (a0 : _root_.NominalPrimitiveSubtypes.RawPacket) : (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet) :=
  (let _bridgeResult := _root_.NominalPrimitiveSubtypes.produce a0; ((_bridgeResult).map (fun _bridgeValue0 => (LbErased.NominalPrimitiveSubtypes.Packet.erase (_bridgeValue0)))))

@[export lb_e791062d392a94a18563a45f]
def f_lb_e791062d392a94a18563a45f (a0 : _root_.NominalPrimitiveSubtypes.RawPacket) : LbErased.NominalPrimitiveSubtypes.Event :=
  (let _bridgeResult := _root_.NominalPrimitiveSubtypes.produceChoices a0; (LbErased.NominalPrimitiveSubtypes.Event.erase (_bridgeResult)))

@[export lb_e721c226f4fcff66a4ffea0f]
def f_lb_e721c226f4fcff66a4ffea0f (a0 : _root_.NominalPrimitiveSubtypes.RawPacket) : LbErased.NominalPrimitiveSubtypes.Event :=
  (let _bridgeResult := _root_.NominalPrimitiveSubtypes.produceEvent a0; (LbErased.NominalPrimitiveSubtypes.Event.erase (_bridgeResult)))

@[export lb_2c1c751c1667dd64cd4c3fe3]
def f_lb_2c1c751c1667dd64cd4c3fe3 (a0 : _root_.NominalPrimitiveSubtypes.RawPacket) : (_root_.Array (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet)) :=
  (let _bridgeResult := _root_.NominalPrimitiveSubtypes.produceGroup a0; ((_bridgeResult).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (LbErased.NominalPrimitiveSubtypes.Packet.erase (_bridgeValue1)))))))

@[export lb_a54b47645ca8b931f9ef293a]
def f_lb_a54b47645ca8b931f9ef293a (a0 : _root_.NominalPrimitiveSubtypes.RawPacket) : LbErased.NominalPrimitiveSubtypes.PacketPair :=
  (let _bridgeResult := _root_.NominalPrimitiveSubtypes.producePair a0; (LbErased.NominalPrimitiveSubtypes.PacketPair.erase (_bridgeResult)))

@[export lb_0ca05a58ebc875690e9ebfb5]
def f_lb_0ca05a58ebc875690e9ebfb5 (a0 : LbErased.NominalPrimitiveSubtypes.Packet) : (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet) :=
  match (LbErased.NominalPrimitiveSubtypes.Packet.via_a5fb4c23d069ba7976028d4edf99789b8a0db09d7098c9a5ce6a63ef31cc4c37 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some ((let _bridgeResult := _root_.NominalPrimitiveSubtypes.refuseUnit _bridgeSubtype0; (LbErased.NominalPrimitiveSubtypes.Packet.erase (_bridgeResult))))
  | .none =>
    _root_.Option.none

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_0]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_0 (value : _root_.Unit) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.unitReject value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_1]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_1 (value : _root_.Bool) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.boolA value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_2]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_2 (value : _root_.UInt8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint8A value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_3]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_3 (value : _root_.UInt16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint16A value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_4]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_4 (value : _root_.UInt32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint32A value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_5]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_5 (value : _root_.UInt64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.uint64A value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_6]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_6 (value : _root_.Int8) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int8A value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_7]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_7 (value : _root_.Int16) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int16A value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_8]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_8 (value : _root_.Int32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int32A value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_9]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_9 (value : _root_.Int64) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.int64A value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_10]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_10 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.natA value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_11]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_11 (value : _root_.Int) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.intA value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_12]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_12 (value : _root_.Float32) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float32A value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_13]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_13 (value : _root_.Float) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.float64A value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_14]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_14 (value : _root_.String) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.textA value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_15]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_15 (value : _root_.ByteArray) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.bytesA value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_16]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_16 (value : _root_.Char) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.charA value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_17]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_17 (value : _root_.USize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.usizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_0ca05a58ebc875690e9ebfb5_refinement_0_18]
def f_lb_0ca05a58ebc875690e9ebfb5_refinement_0_18 (value : _root_.ISize) : _root_.UInt8 :=
  match _root_.NominalPrimitiveSubtypes.isizeA value with
  | .some _ => 1
  | .none => 0

@[export lb_2df79ff835926bf7b8864ec6]
def f_lb_2df79ff835926bf7b8864ec6 (unit : _root_.Unit) : _root_.UInt32 :=
  _root_.NominalPrimitiveSubtypes.wordBits 

@[export lb_t980449f277836feadaee_make]
def f_lb_t980449f277836feadaee_make (a0 : _root_.Unit) (a1 : _root_.Bool) (a2 : _root_.UInt8) (a3 : _root_.UInt16) (a4 : _root_.UInt32) (a5 : _root_.UInt64) (a6 : _root_.Int8) (a7 : _root_.Int16) (a8 : _root_.Int32) (a9 : _root_.Int64) (a10 : _root_.Nat) (a11 : _root_.Int) (a12 : _root_.Float32) (a13 : _root_.Float) (a14 : _root_.String) (a15 : _root_.ByteArray) (a16 : _root_.Char) (a17 : _root_.USize) (a18 : _root_.ISize) (a19 : _root_.Nat) : LbErased.NominalPrimitiveSubtypes.Packet :=
  LbErased.NominalPrimitiveSubtypes.Packet.mk a0 a1 a2 a3 a4 a5 a6 a7 a8 a9 a10 a11 a12 a13 a14 a15 a16 a17 a18 a19

@[export lb_t980449f277836feadaee_get0]
def f_lb_t980449f277836feadaee_get0 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Unit :=
  value.«unitValue»

@[export lb_t980449f277836feadaee_get1]
def f_lb_t980449f277836feadaee_get1 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Bool :=
  value.«boolValue»

@[export lb_t980449f277836feadaee_get2]
def f_lb_t980449f277836feadaee_get2 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.UInt8 :=
  value.«uint8Value»

@[export lb_t980449f277836feadaee_get3]
def f_lb_t980449f277836feadaee_get3 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.UInt16 :=
  value.«uint16Value»

@[export lb_t980449f277836feadaee_get4]
def f_lb_t980449f277836feadaee_get4 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.UInt32 :=
  value.«uint32Value»

@[export lb_t980449f277836feadaee_get5]
def f_lb_t980449f277836feadaee_get5 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.UInt64 :=
  value.«uint64Value»

@[export lb_t980449f277836feadaee_get6]
def f_lb_t980449f277836feadaee_get6 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Int8 :=
  value.«int8Value»

@[export lb_t980449f277836feadaee_get7]
def f_lb_t980449f277836feadaee_get7 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Int16 :=
  value.«int16Value»

@[export lb_t980449f277836feadaee_get8]
def f_lb_t980449f277836feadaee_get8 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Int32 :=
  value.«int32Value»

@[export lb_t980449f277836feadaee_get9]
def f_lb_t980449f277836feadaee_get9 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Int64 :=
  value.«int64Value»

@[export lb_t980449f277836feadaee_get10]
def f_lb_t980449f277836feadaee_get10 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Nat :=
  value.«natValue»

@[export lb_t980449f277836feadaee_get11]
def f_lb_t980449f277836feadaee_get11 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Int :=
  value.«intValue»

@[export lb_t980449f277836feadaee_get12]
def f_lb_t980449f277836feadaee_get12 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Float32 :=
  value.«float32Value»

@[export lb_t980449f277836feadaee_get13]
def f_lb_t980449f277836feadaee_get13 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Float :=
  value.«float64Value»

@[export lb_t980449f277836feadaee_get14]
def f_lb_t980449f277836feadaee_get14 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.String :=
  value.«textValue»

@[export lb_t980449f277836feadaee_get15]
def f_lb_t980449f277836feadaee_get15 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.ByteArray :=
  value.«bytesValue»

@[export lb_t980449f277836feadaee_get16]
def f_lb_t980449f277836feadaee_get16 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Char :=
  value.«charValue»

@[export lb_t980449f277836feadaee_get17]
def f_lb_t980449f277836feadaee_get17 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.USize :=
  value.«usizeValue»

@[export lb_t980449f277836feadaee_get18]
def f_lb_t980449f277836feadaee_get18 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.ISize :=
  value.«isizeValue»

@[export lb_t980449f277836feadaee_get19]
def f_lb_t980449f277836feadaee_get19 (value : LbErased.NominalPrimitiveSubtypes.Packet) : _root_.Nat :=
  value.«digit»

@[export lb_td552bec1d6b17ed5222c_none]
def f_lb_td552bec1d6b17ed5222c_none (unit : _root_.Unit) : (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet) :=
  _root_.Option.none

@[export lb_td552bec1d6b17ed5222c_some]
def f_lb_td552bec1d6b17ed5222c_some (value : LbErased.NominalPrimitiveSubtypes.Packet) : (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet) :=
  _root_.Option.some value

@[export lb_td552bec1d6b17ed5222c_has]
def f_lb_td552bec1d6b17ed5222c_has (value : (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet)) : _root_.Bool :=
  match value with | .none => false | .some _ => true

@[export lb_td552bec1d6b17ed5222c_get0]
def f_lb_td552bec1d6b17ed5222c_get0 (value : (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet)) : LbErased.NominalPrimitiveSubtypes.Packet :=
  match value with | .none => (LbErased.NominalPrimitiveSubtypes.Packet.mk () false 0 0 0 0 0 0 0 0 0 0 0 0 "" _root_.ByteArray.empty (_root_.Char.ofNat 0) 0 0 0) | .some item => item

@[export lb_t493235f6d5e0c330066f_make]
def f_lb_t493235f6d5e0c330066f_make (a0 : LbErased.NominalPrimitiveSubtypes.Packet) (a1 : LbErased.NominalPrimitiveSubtypes.Packet) : (_root_.Prod LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet) :=
  _root_.Prod.mk a0 a1

@[export lb_t493235f6d5e0c330066f_get0]
def f_lb_t493235f6d5e0c330066f_get0 (value : (_root_.Prod LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet)) : LbErased.NominalPrimitiveSubtypes.Packet :=
  value.1

@[export lb_t493235f6d5e0c330066f_get1]
def f_lb_t493235f6d5e0c330066f_get1 (value : (_root_.Prod LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet)) : LbErased.NominalPrimitiveSubtypes.Packet :=
  value.2

@[export lb_td367e4fc052df6d1c32d_has]
def f_lb_td367e4fc052df6d1c32d_has (value : (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet)) : _root_.Bool :=
  match value with | .ok _ => true | .error _ => false

@[export lb_td367e4fc052df6d1c32d_ok]
def f_lb_td367e4fc052df6d1c32d_ok (value : LbErased.NominalPrimitiveSubtypes.Packet) : (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet) :=
  _root_.Except.ok value

@[export lb_td367e4fc052df6d1c32d_get0]
def f_lb_td367e4fc052df6d1c32d_get0 (value : (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet)) : LbErased.NominalPrimitiveSubtypes.Packet :=
  match value with | .ok item => item | _ => (LbErased.NominalPrimitiveSubtypes.Packet.mk () false 0 0 0 0 0 0 0 0 0 0 0 0 "" _root_.ByteArray.empty (_root_.Char.ofNat 0) 0 0 0)

@[export lb_td367e4fc052df6d1c32d_error]
def f_lb_td367e4fc052df6d1c32d_error (value : LbErased.NominalPrimitiveSubtypes.Packet) : (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet) :=
  _root_.Except.error value

@[export lb_td367e4fc052df6d1c32d_get1]
def f_lb_td367e4fc052df6d1c32d_get1 (value : (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet)) : LbErased.NominalPrimitiveSubtypes.Packet :=
  match value with | .error item => item | _ => (LbErased.NominalPrimitiveSubtypes.Packet.mk () false 0 0 0 0 0 0 0 0 0 0 0 0 "" _root_.ByteArray.empty (_root_.Char.ofNat 0) 0 0 0)

@[export lb_t5a1383905e3435e418a9_none]
def f_lb_t5a1383905e3435e418a9_none (unit : _root_.Unit) : (_root_.Option (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet)) :=
  _root_.Option.none

@[export lb_t5a1383905e3435e418a9_some]
def f_lb_t5a1383905e3435e418a9_some (value : (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet)) : (_root_.Option (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet)) :=
  _root_.Option.some value

@[export lb_t5a1383905e3435e418a9_has]
def f_lb_t5a1383905e3435e418a9_has (value : (_root_.Option (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet))) : _root_.Bool :=
  match value with | .none => false | .some _ => true

@[export lb_t5a1383905e3435e418a9_get0]
def f_lb_t5a1383905e3435e418a9_get0 (value : (_root_.Option (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet))) : (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet) :=
  match value with | .none => (_root_.Except.ok (LbErased.NominalPrimitiveSubtypes.Packet.mk () false 0 0 0 0 0 0 0 0 0 0 0 0 "" _root_.ByteArray.empty (_root_.Char.ofNat 0) 0 0 0)) | .some item => item

@[export lb_t466ade0f8f5195fb9b51_tag]
def f_lb_t466ade0f8f5195fb9b51_tag (value : LbErased.NominalPrimitiveSubtypes.Event) : _root_.UInt32 :=
  match value with | .empty  => 0 | .box _ => 1 | .choices _ => 2

@[export lb_t466ade0f8f5195fb9b51_make0]
def f_lb_t466ade0f8f5195fb9b51_make0 (unit : _root_.Unit) : LbErased.NominalPrimitiveSubtypes.Event :=
  LbErased.NominalPrimitiveSubtypes.Event.«empty» 

@[export lb_t466ade0f8f5195fb9b51_make1]
def f_lb_t466ade0f8f5195fb9b51_make1 (a0 : LbErased.NominalPrimitiveSubtypes.Packet) : LbErased.NominalPrimitiveSubtypes.Event :=
  LbErased.NominalPrimitiveSubtypes.Event.«box» a0

@[export lb_t466ade0f8f5195fb9b51_get1_0]
def f_lb_t466ade0f8f5195fb9b51_get1_0 (value : LbErased.NominalPrimitiveSubtypes.Event) : LbErased.NominalPrimitiveSubtypes.Packet :=
  match value with | .box item => item | _ => (LbErased.NominalPrimitiveSubtypes.Packet.mk () false 0 0 0 0 0 0 0 0 0 0 0 0 "" _root_.ByteArray.empty (_root_.Char.ofNat 0) 0 0 0)

@[export lb_t466ade0f8f5195fb9b51_make2]
def f_lb_t466ade0f8f5195fb9b51_make2 (a0 : (_root_.Array (_root_.Option (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet)))) : LbErased.NominalPrimitiveSubtypes.Event :=
  LbErased.NominalPrimitiveSubtypes.Event.«choices» a0

@[export lb_t466ade0f8f5195fb9b51_get2_0]
def f_lb_t466ade0f8f5195fb9b51_get2_0 (value : LbErased.NominalPrimitiveSubtypes.Event) : (_root_.Array (_root_.Option (_root_.Except LbErased.NominalPrimitiveSubtypes.Packet LbErased.NominalPrimitiveSubtypes.Packet))) :=
  match value with | .choices item => item | _ => #[]

@[export lb_td7082fc66e9da4808b9a_make]
def f_lb_td7082fc66e9da4808b9a_make (a0 : (_root_.Array (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet))) (a1 : (_root_.Array (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet))) : LbErased.NominalPrimitiveSubtypes.PacketPair :=
  LbErased.NominalPrimitiveSubtypes.PacketPair.mk a0 a1

@[export lb_td7082fc66e9da4808b9a_get0]
def f_lb_td7082fc66e9da4808b9a_get0 (value : LbErased.NominalPrimitiveSubtypes.PacketPair) : (_root_.Array (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet)) :=
  value.«left»

@[export lb_td7082fc66e9da4808b9a_get1]
def f_lb_td7082fc66e9da4808b9a_get1 (value : LbErased.NominalPrimitiveSubtypes.PacketPair) : (_root_.Array (_root_.Option LbErased.NominalPrimitiveSubtypes.Packet)) :=
  value.«right»

@[export lb_t6ed79f4a8a3bc4358259_make]
def f_lb_t6ed79f4a8a3bc4358259_make (a0 : _root_.Unit) (a1 : _root_.Bool) (a2 : _root_.UInt8) (a3 : _root_.UInt16) (a4 : _root_.UInt32) (a5 : _root_.UInt64) (a6 : _root_.Int8) (a7 : _root_.Int16) (a8 : _root_.Int32) (a9 : _root_.Int64) (a10 : _root_.Nat) (a11 : _root_.Int) (a12 : _root_.Float32) (a13 : _root_.Float) (a14 : _root_.String) (a15 : _root_.ByteArray) (a16 : _root_.Char) (a17 : _root_.USize) (a18 : _root_.ISize) (a19 : _root_.Nat) : _root_.NominalPrimitiveSubtypes.RawPacket :=
  _root_.NominalPrimitiveSubtypes.RawPacket.mk a0 a1 a2 a3 a4 a5 a6 a7 a8 a9 a10 a11 a12 a13 a14 a15 a16 a17 a18 a19

@[export lb_t6ed79f4a8a3bc4358259_get0]
def f_lb_t6ed79f4a8a3bc4358259_get0 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.Unit :=
  _root_.NominalPrimitiveSubtypes.RawPacket.unitValue value

@[export lb_t6ed79f4a8a3bc4358259_get1]
def f_lb_t6ed79f4a8a3bc4358259_get1 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.Bool :=
  _root_.NominalPrimitiveSubtypes.RawPacket.boolValue value

@[export lb_t6ed79f4a8a3bc4358259_get2]
def f_lb_t6ed79f4a8a3bc4358259_get2 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.UInt8 :=
  _root_.NominalPrimitiveSubtypes.RawPacket.uint8Value value

@[export lb_t6ed79f4a8a3bc4358259_get3]
def f_lb_t6ed79f4a8a3bc4358259_get3 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.UInt16 :=
  _root_.NominalPrimitiveSubtypes.RawPacket.uint16Value value

@[export lb_t6ed79f4a8a3bc4358259_get4]
def f_lb_t6ed79f4a8a3bc4358259_get4 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.UInt32 :=
  _root_.NominalPrimitiveSubtypes.RawPacket.uint32Value value

@[export lb_t6ed79f4a8a3bc4358259_get5]
def f_lb_t6ed79f4a8a3bc4358259_get5 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.UInt64 :=
  _root_.NominalPrimitiveSubtypes.RawPacket.uint64Value value

@[export lb_t6ed79f4a8a3bc4358259_get6]
def f_lb_t6ed79f4a8a3bc4358259_get6 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.Int8 :=
  _root_.NominalPrimitiveSubtypes.RawPacket.int8Value value

@[export lb_t6ed79f4a8a3bc4358259_get7]
def f_lb_t6ed79f4a8a3bc4358259_get7 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.Int16 :=
  _root_.NominalPrimitiveSubtypes.RawPacket.int16Value value

@[export lb_t6ed79f4a8a3bc4358259_get8]
def f_lb_t6ed79f4a8a3bc4358259_get8 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.Int32 :=
  _root_.NominalPrimitiveSubtypes.RawPacket.int32Value value

@[export lb_t6ed79f4a8a3bc4358259_get9]
def f_lb_t6ed79f4a8a3bc4358259_get9 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.Int64 :=
  _root_.NominalPrimitiveSubtypes.RawPacket.int64Value value

@[export lb_t6ed79f4a8a3bc4358259_get10]
def f_lb_t6ed79f4a8a3bc4358259_get10 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.Nat :=
  _root_.NominalPrimitiveSubtypes.RawPacket.natValue value

@[export lb_t6ed79f4a8a3bc4358259_get11]
def f_lb_t6ed79f4a8a3bc4358259_get11 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.Int :=
  _root_.NominalPrimitiveSubtypes.RawPacket.intValue value

@[export lb_t6ed79f4a8a3bc4358259_get12]
def f_lb_t6ed79f4a8a3bc4358259_get12 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.Float32 :=
  _root_.NominalPrimitiveSubtypes.RawPacket.float32Value value

@[export lb_t6ed79f4a8a3bc4358259_get13]
def f_lb_t6ed79f4a8a3bc4358259_get13 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.Float :=
  _root_.NominalPrimitiveSubtypes.RawPacket.float64Value value

@[export lb_t6ed79f4a8a3bc4358259_get14]
def f_lb_t6ed79f4a8a3bc4358259_get14 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.String :=
  _root_.NominalPrimitiveSubtypes.RawPacket.textValue value

@[export lb_t6ed79f4a8a3bc4358259_get15]
def f_lb_t6ed79f4a8a3bc4358259_get15 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.ByteArray :=
  _root_.NominalPrimitiveSubtypes.RawPacket.bytesValue value

@[export lb_t6ed79f4a8a3bc4358259_get16]
def f_lb_t6ed79f4a8a3bc4358259_get16 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.Char :=
  _root_.NominalPrimitiveSubtypes.RawPacket.charValue value

@[export lb_t6ed79f4a8a3bc4358259_get17]
def f_lb_t6ed79f4a8a3bc4358259_get17 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.USize :=
  _root_.NominalPrimitiveSubtypes.RawPacket.usizeValue value

@[export lb_t6ed79f4a8a3bc4358259_get18]
def f_lb_t6ed79f4a8a3bc4358259_get18 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.ISize :=
  _root_.NominalPrimitiveSubtypes.RawPacket.isizeValue value

@[export lb_t6ed79f4a8a3bc4358259_get19]
def f_lb_t6ed79f4a8a3bc4358259_get19 (value : _root_.NominalPrimitiveSubtypes.RawPacket) : _root_.Nat :=
  _root_.NominalPrimitiveSubtypes.RawPacket.digit value

@[export lb_native_nat_text]
def f_lb_native_nat_text (value : _root_.Nat) : _root_.String :=
  _root_.Nat.repr value

@[export lb_native_int_text]
def f_lb_native_int_text (value : _root_.Int) : _root_.String :=
  _root_.Int.repr value

@[export lb_native_int_parse]
def f_lb_native_int_parse (value : _root_.String) : _root_.Int :=
  _root_.String.toInt! value

end LeanBridgeNative19ad06f04a0c2d39
