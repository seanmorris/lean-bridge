import NominalSubtypes

namespace LeanBridgeNative7f8bfe55e5831a91

structure LbErased.NominalSubtypes.Envelope where
  «payload» : _root_.Nat
  «digit» : _root_.Nat

def LbErased.NominalSubtypes.Envelope.via_527a6d50b1d0a881d1744eb0ff86e9e63bf899a683c841c27b18fa63226bd1b7 (value : LbErased.NominalSubtypes.Envelope) : _root_.Option _root_.NominalSubtypes.Envelope := do
  let a0 ← _root_.NominalSubtypes.plusTwo value.«payload»
  let a1 ← (if proof : (value.«digit») < 3 then _root_.Option.some (⟨(value.«digit»), proof⟩ : _root_.Fin 3) else _root_.Option.none)
  pure (_root_.NominalSubtypes.Envelope.mk a0 a1)

def LbErased.NominalSubtypes.Envelope.via_781835bfdd6951dda0dc5fd471a9e33e2b4f7543d4e5d7cdccb42ae3be8ecc3d (value : LbErased.NominalSubtypes.Envelope) : _root_.Option _root_.NominalSubtypes.Envelope := do
  let a0 ← _root_.NominalSubtypes.plusOne value.«payload»
  let a1 ← (if proof : (value.«digit») < 3 then _root_.Option.some (⟨(value.«digit»), proof⟩ : _root_.Fin 3) else _root_.Option.none)
  pure (_root_.NominalSubtypes.Envelope.mk a0 a1)

def LbErased.NominalSubtypes.Envelope.erase (value : _root_.NominalSubtypes.Envelope) : LbErased.NominalSubtypes.Envelope :=
  LbErased.NominalSubtypes.Envelope.mk (value.«payload»).val (value.«digit»).val

inductive LbErased.NominalSubtypes.Event where
  | «empty»  : LbErased.NominalSubtypes.Event
  | «box» (a0 : LbErased.NominalSubtypes.Envelope) : LbErased.NominalSubtypes.Event
  | «choices» (a0 : (_root_.Array (_root_.Option (_root_.Except _root_.Nat _root_.Nat)))) : LbErased.NominalSubtypes.Event

def LbErased.NominalSubtypes.Event.via_71d63b6b31c7a790d6179b8d8f210f4527de1cad2abc73ed0db72a1f68884ce5 (value : LbErased.NominalSubtypes.Event) : _root_.Option _root_.NominalSubtypes.Event :=
  match value with
  | .«empty»  => do pure (_root_.NominalSubtypes.Event.empty )
  | .«box» a0 => do let b0 ← (LbErased.NominalSubtypes.Envelope.via_527a6d50b1d0a881d1744eb0ff86e9e63bf899a683c841c27b18fa63226bd1b7 (a0)); pure (_root_.NominalSubtypes.Event.box b0)
  | .«choices» a0 => do let b0 ← ((a0).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((match (_bridgeValue1) with | _root_.Except.ok _bridgeValue2 => (_root_.NominalSubtypes.plusTwo _bridgeValue2).map _root_.Except.ok | _root_.Except.error _bridgeValue2 => (_root_.NominalSubtypes.plusOne _bridgeValue2).map _root_.Except.error)).map _root_.Option.some))); pure (_root_.NominalSubtypes.Event.choices b0)

def LbErased.NominalSubtypes.Event.via_cddf6717bce0c808ac0c01e9a1e4368a28f6f1adab1659522349aaadb58f9127 (value : LbErased.NominalSubtypes.Event) : _root_.Option _root_.NominalSubtypes.Event :=
  match value with
  | .«empty»  => do pure (_root_.NominalSubtypes.Event.empty )
  | .«box» a0 => do let b0 ← (LbErased.NominalSubtypes.Envelope.via_781835bfdd6951dda0dc5fd471a9e33e2b4f7543d4e5d7cdccb42ae3be8ecc3d (a0)); pure (_root_.NominalSubtypes.Event.box b0)
  | .«choices» a0 => do let b0 ← ((a0).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((match (_bridgeValue1) with | _root_.Except.ok _bridgeValue2 => (_root_.NominalSubtypes.plusOne _bridgeValue2).map _root_.Except.ok | _root_.Except.error _bridgeValue2 => (_root_.NominalSubtypes.plusTwo _bridgeValue2).map _root_.Except.error)).map _root_.Option.some))); pure (_root_.NominalSubtypes.Event.choices b0)

def LbErased.NominalSubtypes.Event.erase (value : _root_.NominalSubtypes.Event) : LbErased.NominalSubtypes.Event :=
  match value with
  | .«empty»  => LbErased.NominalSubtypes.Event.«empty» 
  | .«box» a0 => LbErased.NominalSubtypes.Event.«box» (LbErased.NominalSubtypes.Envelope.erase (a0))
  | .«choices» a0 => LbErased.NominalSubtypes.Event.«choices» ((a0).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (match (_bridgeValue1) with | _root_.Except.ok _bridgeValue2 => .ok (_bridgeValue2).val | _root_.Except.error _bridgeValue2 => .error (_bridgeValue2).val)))))

structure LbErased.NominalSubtypes.AliasPair where
  «left» : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope))
  «right» : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope))

def LbErased.NominalSubtypes.AliasPair.via_cbdb7660c2ed6b268006c79a29f89b542e116b03ffbe0fe06757b361d43476c6 (value : LbErased.NominalSubtypes.AliasPair) : _root_.Option _root_.NominalSubtypes.AliasPair := do
  let a0 ← ((value.«left»).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.NominalSubtypes.Envelope.via_781835bfdd6951dda0dc5fd471a9e33e2b4f7543d4e5d7cdccb42ae3be8ecc3d (_bridgeValue1))).map _root_.Option.some)))
  let a1 ← ((value.«right»).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.NominalSubtypes.Envelope.via_527a6d50b1d0a881d1744eb0ff86e9e63bf899a683c841c27b18fa63226bd1b7 (_bridgeValue1))).map _root_.Option.some)))
  pure (_root_.NominalSubtypes.AliasPair.mk a0 a1)

def LbErased.NominalSubtypes.AliasPair.erase (value : _root_.NominalSubtypes.AliasPair) : LbErased.NominalSubtypes.AliasPair :=
  LbErased.NominalSubtypes.AliasPair.mk ((value.«left»).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (LbErased.NominalSubtypes.Envelope.erase (_bridgeValue1)))))) ((value.«right»).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (LbErased.NominalSubtypes.Envelope.erase (_bridgeValue1))))))

structure LbErased.NominalSubtypes.Pair where
  «left» : LbErased.NominalSubtypes.Envelope
  «right» : LbErased.NominalSubtypes.Envelope

def LbErased.NominalSubtypes.Pair.via_c2c10385fef0cffeac756f6b55b2caa01d03ca6f22fd291a48a7779a2a6d51f9 (value : LbErased.NominalSubtypes.Pair) : _root_.Option _root_.NominalSubtypes.Pair := do
  let a0 ← (LbErased.NominalSubtypes.Envelope.via_781835bfdd6951dda0dc5fd471a9e33e2b4f7543d4e5d7cdccb42ae3be8ecc3d (value.«left»))
  let a1 ← (LbErased.NominalSubtypes.Envelope.via_527a6d50b1d0a881d1744eb0ff86e9e63bf899a683c841c27b18fa63226bd1b7 (value.«right»))
  pure (_root_.NominalSubtypes.Pair.mk a0 a1)

def LbErased.NominalSubtypes.Pair.erase (value : _root_.NominalSubtypes.Pair) : LbErased.NominalSubtypes.Pair :=
  LbErased.NominalSubtypes.Pair.mk (LbErased.NominalSubtypes.Envelope.erase (value.«left»)) (LbErased.NominalSubtypes.Envelope.erase (value.«right»))

@[export lb_3748c7dfb58492cd91254d26]
def f_lb_3748c7dfb58492cd91254d26 (a0 : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope))) (a1 : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope))) : (_root_.Option _root_.Nat) :=
  match ((a0).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.NominalSubtypes.Envelope.via_781835bfdd6951dda0dc5fd471a9e33e2b4f7543d4e5d7cdccb42ae3be8ecc3d (_bridgeValue1))).map _root_.Option.some))) with
  | .some _bridgeSubtype0 =>
    match ((a1).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.NominalSubtypes.Envelope.via_527a6d50b1d0a881d1744eb0ff86e9e63bf899a683c841c27b18fa63226bd1b7 (_bridgeValue1))).map _root_.Option.some))) with
    | .some _bridgeSubtype1 =>
      _root_.Option.some (_root_.NominalSubtypes.aliases _bridgeSubtype0 _bridgeSubtype1)
    | .none =>
      _root_.Option.none
  | .none =>
    _root_.Option.none

@[export lb_3748c7dfb58492cd91254d26_refinement_0_0_0_0]
def f_lb_3748c7dfb58492cd91254d26_refinement_0_0_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusOne value with
  | .some _ => 1
  | .none => 0

@[export lb_3748c7dfb58492cd91254d26_refinement_1_0_0_0]
def f_lb_3748c7dfb58492cd91254d26_refinement_1_0_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusTwo value with
  | .some _ => 1
  | .none => 0

@[export lb_e6117b4a2c058276486949a3]
def f_lb_e6117b4a2c058276486949a3 (a0 : _root_.Nat) : (_root_.Array _root_.Nat) :=
  (let _bridgeResult := _root_.NominalSubtypes.arrayValues a0; ((_bridgeResult).map (fun _bridgeValue0 => (_bridgeValue0).val)))

@[export lb_c68be1e1f84c99c070a44992]
def f_lb_c68be1e1f84c99c070a44992 (a0 : _root_.Nat) : (_root_.Except _root_.Nat _root_.Nat) :=
  (let _bridgeResult := _root_.NominalSubtypes.branch a0; (match (_bridgeResult) with | _root_.Except.ok _bridgeValue0 => .ok (_bridgeValue0).val | _root_.Except.error _bridgeValue0 => .error (_bridgeValue0).val))

@[export lb_daf0377c7093092f7b8a2ed8]
def f_lb_daf0377c7093092f7b8a2ed8 (a0 : LbErased.NominalSubtypes.Envelope) (a1 : LbErased.NominalSubtypes.Envelope) : (_root_.Option _root_.Nat) :=
  match (LbErased.NominalSubtypes.Envelope.via_781835bfdd6951dda0dc5fd471a9e33e2b4f7543d4e5d7cdccb42ae3be8ecc3d (a0)) with
  | .some _bridgeSubtype0 =>
    match (LbErased.NominalSubtypes.Envelope.via_527a6d50b1d0a881d1744eb0ff86e9e63bf899a683c841c27b18fa63226bd1b7 (a1)) with
    | .some _bridgeSubtype1 =>
      _root_.Option.some (_root_.NominalSubtypes.combine _bridgeSubtype0 _bridgeSubtype1)
    | .none =>
      _root_.Option.none
  | .none =>
    _root_.Option.none

@[export lb_daf0377c7093092f7b8a2ed8_refinement_0_0]
def f_lb_daf0377c7093092f7b8a2ed8_refinement_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusOne value with
  | .some _ => 1
  | .none => 0

@[export lb_daf0377c7093092f7b8a2ed8_refinement_1_0]
def f_lb_daf0377c7093092f7b8a2ed8_refinement_1_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusTwo value with
  | .some _ => 1
  | .none => 0

@[export lb_0857e1ed4aaf9c46904fe907]
def f_lb_0857e1ed4aaf9c46904fe907 (a0 : LbErased.NominalSubtypes.Envelope) : (_root_.Option LbErased.NominalSubtypes.Envelope) :=
  match (LbErased.NominalSubtypes.Envelope.via_781835bfdd6951dda0dc5fd471a9e33e2b4f7543d4e5d7cdccb42ae3be8ecc3d (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some ((let _bridgeResult := _root_.NominalSubtypes.echoEnvelope _bridgeSubtype0; (LbErased.NominalSubtypes.Envelope.erase (_bridgeResult))))
  | .none =>
    _root_.Option.none

@[export lb_0857e1ed4aaf9c46904fe907_refinement_0_0]
def f_lb_0857e1ed4aaf9c46904fe907_refinement_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusOne value with
  | .some _ => 1
  | .none => 0

@[export lb_3130b31f2b54800f3c5305b6]
def f_lb_3130b31f2b54800f3c5305b6 (a0 : LbErased.NominalSubtypes.Event) : (_root_.Option LbErased.NominalSubtypes.Event) :=
  match (LbErased.NominalSubtypes.Event.via_cddf6717bce0c808ac0c01e9a1e4368a28f6f1adab1659522349aaadb58f9127 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some ((let _bridgeResult := _root_.NominalSubtypes.echoEvent _bridgeSubtype0; (LbErased.NominalSubtypes.Event.erase (_bridgeResult))))
  | .none =>
    _root_.Option.none

@[export lb_3130b31f2b54800f3c5305b6_refinement_0_1_0_0]
def f_lb_3130b31f2b54800f3c5305b6_refinement_0_1_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusOne value with
  | .some _ => 1
  | .none => 0

@[export lb_3130b31f2b54800f3c5305b6_refinement_0_2_0_0_0_0]
def f_lb_3130b31f2b54800f3c5305b6_refinement_0_2_0_0_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusOne value with
  | .some _ => 1
  | .none => 0

@[export lb_3130b31f2b54800f3c5305b6_refinement_0_2_0_0_0_1]
def f_lb_3130b31f2b54800f3c5305b6_refinement_0_2_0_0_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusTwo value with
  | .some _ => 1
  | .none => 0

@[export lb_520e1c8263f474b50f99b104]
def f_lb_520e1c8263f474b50f99b104 (a0 : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope))) : (_root_.Option (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope))) :=
  match ((a0).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.NominalSubtypes.Envelope.via_781835bfdd6951dda0dc5fd471a9e33e2b4f7543d4e5d7cdccb42ae3be8ecc3d (_bridgeValue1))).map _root_.Option.some))) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some ((let _bridgeResult := _root_.NominalSubtypes.echoGroups _bridgeSubtype0; ((_bridgeResult).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (LbErased.NominalSubtypes.Envelope.erase (_bridgeValue1))))))))
  | .none =>
    _root_.Option.none

@[export lb_520e1c8263f474b50f99b104_refinement_0_0_0_0]
def f_lb_520e1c8263f474b50f99b104_refinement_0_0_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusOne value with
  | .some _ => 1
  | .none => 0

@[export lb_c141598aa043753e0a6404a3]
def f_lb_c141598aa043753e0a6404a3 (a0 : LbErased.NominalSubtypes.AliasPair) : (_root_.Option LbErased.NominalSubtypes.AliasPair) :=
  match (LbErased.NominalSubtypes.AliasPair.via_cbdb7660c2ed6b268006c79a29f89b542e116b03ffbe0fe06757b361d43476c6 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some ((let _bridgeResult := _root_.NominalSubtypes.echoPair _bridgeSubtype0; (LbErased.NominalSubtypes.AliasPair.erase (_bridgeResult))))
  | .none =>
    _root_.Option.none

@[export lb_c141598aa043753e0a6404a3_refinement_0_0_0_0_0]
def f_lb_c141598aa043753e0a6404a3_refinement_0_0_0_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusOne value with
  | .some _ => 1
  | .none => 0

@[export lb_c141598aa043753e0a6404a3_refinement_0_1_0_0_0]
def f_lb_c141598aa043753e0a6404a3_refinement_0_1_0_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusTwo value with
  | .some _ => 1
  | .none => 0

@[export lb_d8df7ac2dfbfe3b3b1460c5f]
def f_lb_d8df7ac2dfbfe3b3b1460c5f (a0 : _root_.Nat) : LbErased.NominalSubtypes.Event :=
  (let _bridgeResult := _root_.NominalSubtypes.eventChoices a0; (LbErased.NominalSubtypes.Event.erase (_bridgeResult)))

@[export lb_d4cfd58d7ddb8560ef50dc52]
def f_lb_d4cfd58d7ddb8560ef50dc52 (a0 : _root_.Nat) : LbErased.NominalSubtypes.Event :=
  (let _bridgeResult := _root_.NominalSubtypes.eventEmpty a0; (LbErased.NominalSubtypes.Event.erase (_bridgeResult)))

@[export lb_836f5736fc807cf3d52332a8]
def f_lb_836f5736fc807cf3d52332a8 (a0 : LbErased.NominalSubtypes.Event) : (_root_.Option _root_.Nat) :=
  match (LbErased.NominalSubtypes.Event.via_cddf6717bce0c808ac0c01e9a1e4368a28f6f1adab1659522349aaadb58f9127 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NominalSubtypes.eventFirst _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_836f5736fc807cf3d52332a8_refinement_0_1_0_0]
def f_lb_836f5736fc807cf3d52332a8_refinement_0_1_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusOne value with
  | .some _ => 1
  | .none => 0

@[export lb_836f5736fc807cf3d52332a8_refinement_0_2_0_0_0_0]
def f_lb_836f5736fc807cf3d52332a8_refinement_0_2_0_0_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusOne value with
  | .some _ => 1
  | .none => 0

@[export lb_836f5736fc807cf3d52332a8_refinement_0_2_0_0_0_1]
def f_lb_836f5736fc807cf3d52332a8_refinement_0_2_0_0_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusTwo value with
  | .some _ => 1
  | .none => 0

@[export lb_d80fcef28cbece8bf39f7be6]
def f_lb_d80fcef28cbece8bf39f7be6 (a0 : LbErased.NominalSubtypes.Event) : (_root_.Option _root_.Nat) :=
  match (LbErased.NominalSubtypes.Event.via_71d63b6b31c7a790d6179b8d8f210f4527de1cad2abc73ed0db72a1f68884ce5 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NominalSubtypes.eventSecond _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_d80fcef28cbece8bf39f7be6_refinement_0_1_0_0]
def f_lb_d80fcef28cbece8bf39f7be6_refinement_0_1_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusTwo value with
  | .some _ => 1
  | .none => 0

@[export lb_d80fcef28cbece8bf39f7be6_refinement_0_2_0_0_0_0]
def f_lb_d80fcef28cbece8bf39f7be6_refinement_0_2_0_0_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusTwo value with
  | .some _ => 1
  | .none => 0

@[export lb_d80fcef28cbece8bf39f7be6_refinement_0_2_0_0_0_1]
def f_lb_d80fcef28cbece8bf39f7be6_refinement_0_2_0_0_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusOne value with
  | .some _ => 1
  | .none => 0

@[export lb_90cdba474b79f516c0b52978]
def f_lb_90cdba474b79f516c0b52978 (a0 : _root_.Nat) : LbErased.NominalSubtypes.Event :=
  (let _bridgeResult := _root_.NominalSubtypes.eventValue a0; (LbErased.NominalSubtypes.Event.erase (_bridgeResult)))

@[export lb_bf4a2541d27b77f9e2561f26]
def f_lb_bf4a2541d27b77f9e2561f26 (a0 : LbErased.NominalSubtypes.Envelope) : (_root_.Option _root_.Nat) :=
  match (LbErased.NominalSubtypes.Envelope.via_781835bfdd6951dda0dc5fd471a9e33e2b4f7543d4e5d7cdccb42ae3be8ecc3d (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NominalSubtypes.first _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_bf4a2541d27b77f9e2561f26_refinement_0_0]
def f_lb_bf4a2541d27b77f9e2561f26_refinement_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusOne value with
  | .some _ => 1
  | .none => 0

@[export lb_fe0216c702a5ebbfe74fc560]
def f_lb_fe0216c702a5ebbfe74fc560 (a0 : _root_.Nat) : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope)) :=
  (let _bridgeResult := _root_.NominalSubtypes.groupValues a0; ((_bridgeResult).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (LbErased.NominalSubtypes.Envelope.erase (_bridgeValue1)))))))

@[export lb_5e8bbc0f751366e2ffd88f8d]
def f_lb_5e8bbc0f751366e2ffd88f8d (a0 : LbErased.NominalSubtypes.AliasPair) : (_root_.Option _root_.Nat) :=
  match (LbErased.NominalSubtypes.AliasPair.via_cbdb7660c2ed6b268006c79a29f89b542e116b03ffbe0fe06757b361d43476c6 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NominalSubtypes.inspectAliasPair _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_5e8bbc0f751366e2ffd88f8d_refinement_0_0_0_0_0]
def f_lb_5e8bbc0f751366e2ffd88f8d_refinement_0_0_0_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusOne value with
  | .some _ => 1
  | .none => 0

@[export lb_5e8bbc0f751366e2ffd88f8d_refinement_0_1_0_0_0]
def f_lb_5e8bbc0f751366e2ffd88f8d_refinement_0_1_0_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusTwo value with
  | .some _ => 1
  | .none => 0

@[export lb_30775f99f7ee1962ca940d1a]
def f_lb_30775f99f7ee1962ca940d1a (a0 : _root_.Nat) : (_root_.List _root_.Nat) :=
  (let _bridgeResult := _root_.NominalSubtypes.listValues a0; ((_bridgeResult).map (fun _bridgeValue0 => (_bridgeValue0).val)))

@[export lb_b873cf2f2731a105d83aaeae]
def f_lb_b873cf2f2731a105d83aaeae (a0 : LbErased.NominalSubtypes.Pair) : (_root_.Option _root_.Nat) :=
  match (LbErased.NominalSubtypes.Pair.via_c2c10385fef0cffeac756f6b55b2caa01d03ca6f22fd291a48a7779a2a6d51f9 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NominalSubtypes.nested _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_b873cf2f2731a105d83aaeae_refinement_0_0_0]
def f_lb_b873cf2f2731a105d83aaeae_refinement_0_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusOne value with
  | .some _ => 1
  | .none => 0

@[export lb_b873cf2f2731a105d83aaeae_refinement_0_1_0]
def f_lb_b873cf2f2731a105d83aaeae_refinement_0_1_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusTwo value with
  | .some _ => 1
  | .none => 0

@[export lb_fb21161d65be28d916dcac41]
def f_lb_fb21161d65be28d916dcac41 (a0 : _root_.Nat) : (_root_.Array _root_.Nat) :=
  (let _bridgeResult := _root_.NominalSubtypes.noItems a0; ((_bridgeResult).map (fun _bridgeValue0 => (_bridgeValue0).val)))

@[export lb_9686ecc5fe69d4a6438a0e6a]
def f_lb_9686ecc5fe69d4a6438a0e6a (a0 : _root_.Nat) : (_root_.Option _root_.Nat) :=
  (let _bridgeResult := _root_.NominalSubtypes.optional a0; ((_bridgeResult).map (fun _bridgeValue0 => (_bridgeValue0).val)))

@[export lb_0fffaedb5541aceb2b121d97]
def f_lb_0fffaedb5541aceb2b121d97 (a0 : _root_.Nat) : LbErased.NominalSubtypes.AliasPair :=
  (let _bridgeResult := _root_.NominalSubtypes.pairValues a0; (LbErased.NominalSubtypes.AliasPair.erase (_bridgeResult)))

@[export lb_15d9d6482d088a2aeae57e49]
def f_lb_15d9d6482d088a2aeae57e49 (a0 : _root_.Nat) : (_root_.Option _root_.Nat) :=
  if _bridgeFin0 : (a0) < 3 then
    _root_.Option.some (_root_.NominalSubtypes.plainFin ⟨a0, _bridgeFin0⟩)
  else
    _root_.Option.none

@[export lb_1675ed3831b1403640f61957]
def f_lb_1675ed3831b1403640f61957 (a0 : _root_.Nat) : LbErased.NominalSubtypes.Envelope :=
  (let _bridgeResult := _root_.NominalSubtypes.produceEnvelope a0; (LbErased.NominalSubtypes.Envelope.erase (_bridgeResult)))

@[export lb_bb98c244bdedfd3d9997d34a]
def f_lb_bb98c244bdedfd3d9997d34a (a0 : _root_.Nat) : (_root_.Prod _root_.Nat _root_.Nat) :=
  (let _bridgeResult := _root_.NominalSubtypes.product a0; (((_bridgeResult).fst).val, ((_bridgeResult).snd).val))

@[export lb_a90151ccf6e7f9af5767c444]
def f_lb_a90151ccf6e7f9af5767c444 (a0 : _root_.Nat) : _root_.Nat :=
  (_root_.NominalSubtypes.scalar a0).val

@[export lb_5633e9a71959a57d229c02d9]
def f_lb_5633e9a71959a57d229c02d9 (a0 : LbErased.NominalSubtypes.Envelope) : (_root_.Option _root_.Nat) :=
  match (LbErased.NominalSubtypes.Envelope.via_527a6d50b1d0a881d1744eb0ff86e9e63bf899a683c841c27b18fa63226bd1b7 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NominalSubtypes.second _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_5633e9a71959a57d229c02d9_refinement_0_0]
def f_lb_5633e9a71959a57d229c02d9_refinement_0_0 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NominalSubtypes.plusTwo value with
  | .some _ => 1
  | .none => 0

@[export lb_t90fc0814fb0968a90151_make]
def f_lb_t90fc0814fb0968a90151_make (a0 : _root_.Nat) (a1 : _root_.Nat) : LbErased.NominalSubtypes.Envelope :=
  LbErased.NominalSubtypes.Envelope.mk a0 a1

@[export lb_t90fc0814fb0968a90151_get0]
def f_lb_t90fc0814fb0968a90151_get0 (value : LbErased.NominalSubtypes.Envelope) : _root_.Nat :=
  value.«payload»

@[export lb_t90fc0814fb0968a90151_get1]
def f_lb_t90fc0814fb0968a90151_get1 (value : LbErased.NominalSubtypes.Envelope) : _root_.Nat :=
  value.«digit»

@[export lb_t2d856855000adeb791a2_none]
def f_lb_t2d856855000adeb791a2_none (unit : _root_.Unit) : (_root_.Option LbErased.NominalSubtypes.Envelope) :=
  _root_.Option.none

@[export lb_t2d856855000adeb791a2_some]
def f_lb_t2d856855000adeb791a2_some (value : LbErased.NominalSubtypes.Envelope) : (_root_.Option LbErased.NominalSubtypes.Envelope) :=
  _root_.Option.some value

@[export lb_t2d856855000adeb791a2_has]
def f_lb_t2d856855000adeb791a2_has (value : (_root_.Option LbErased.NominalSubtypes.Envelope)) : _root_.Bool :=
  match value with | .none => false | .some _ => true

@[export lb_t2d856855000adeb791a2_get0]
def f_lb_t2d856855000adeb791a2_get0 (value : (_root_.Option LbErased.NominalSubtypes.Envelope)) : LbErased.NominalSubtypes.Envelope :=
  match value with | .none => (LbErased.NominalSubtypes.Envelope.mk 0 0) | .some item => item

@[export lb_ta95d99ff5a42e8c098e6_has]
def f_lb_ta95d99ff5a42e8c098e6_has (value : (_root_.Except _root_.Nat _root_.Nat)) : _root_.Bool :=
  match value with | .ok _ => true | .error _ => false

@[export lb_ta95d99ff5a42e8c098e6_ok]
def f_lb_ta95d99ff5a42e8c098e6_ok (value : _root_.Nat) : (_root_.Except _root_.Nat _root_.Nat) :=
  _root_.Except.ok value

@[export lb_ta95d99ff5a42e8c098e6_get0]
def f_lb_ta95d99ff5a42e8c098e6_get0 (value : (_root_.Except _root_.Nat _root_.Nat)) : _root_.Nat :=
  match value with | .ok item => item | _ => 0

@[export lb_ta95d99ff5a42e8c098e6_error]
def f_lb_ta95d99ff5a42e8c098e6_error (value : _root_.Nat) : (_root_.Except _root_.Nat _root_.Nat) :=
  _root_.Except.error value

@[export lb_ta95d99ff5a42e8c098e6_get1]
def f_lb_ta95d99ff5a42e8c098e6_get1 (value : (_root_.Except _root_.Nat _root_.Nat)) : _root_.Nat :=
  match value with | .error item => item | _ => 0

@[export lb_tc7aa542980540fb600fa_none]
def f_lb_tc7aa542980540fb600fa_none (unit : _root_.Unit) : (_root_.Option (_root_.Except _root_.Nat _root_.Nat)) :=
  _root_.Option.none

@[export lb_tc7aa542980540fb600fa_some]
def f_lb_tc7aa542980540fb600fa_some (value : (_root_.Except _root_.Nat _root_.Nat)) : (_root_.Option (_root_.Except _root_.Nat _root_.Nat)) :=
  _root_.Option.some value

@[export lb_tc7aa542980540fb600fa_has]
def f_lb_tc7aa542980540fb600fa_has (value : (_root_.Option (_root_.Except _root_.Nat _root_.Nat))) : _root_.Bool :=
  match value with | .none => false | .some _ => true

@[export lb_tc7aa542980540fb600fa_get0]
def f_lb_tc7aa542980540fb600fa_get0 (value : (_root_.Option (_root_.Except _root_.Nat _root_.Nat))) : (_root_.Except _root_.Nat _root_.Nat) :=
  match value with | .none => (_root_.Except.ok 0) | .some item => item

@[export lb_tca0d998129b5c191a0d3_tag]
def f_lb_tca0d998129b5c191a0d3_tag (value : LbErased.NominalSubtypes.Event) : _root_.UInt32 :=
  match value with | .empty  => 0 | .box _ => 1 | .choices _ => 2

@[export lb_tca0d998129b5c191a0d3_make0]
def f_lb_tca0d998129b5c191a0d3_make0 (unit : _root_.Unit) : LbErased.NominalSubtypes.Event :=
  LbErased.NominalSubtypes.Event.«empty» 

@[export lb_tca0d998129b5c191a0d3_make1]
def f_lb_tca0d998129b5c191a0d3_make1 (a0 : LbErased.NominalSubtypes.Envelope) : LbErased.NominalSubtypes.Event :=
  LbErased.NominalSubtypes.Event.«box» a0

@[export lb_tca0d998129b5c191a0d3_get1_0]
def f_lb_tca0d998129b5c191a0d3_get1_0 (value : LbErased.NominalSubtypes.Event) : LbErased.NominalSubtypes.Envelope :=
  match value with | .box item => item | _ => (LbErased.NominalSubtypes.Envelope.mk 0 0)

@[export lb_tca0d998129b5c191a0d3_make2]
def f_lb_tca0d998129b5c191a0d3_make2 (a0 : (_root_.Array (_root_.Option (_root_.Except _root_.Nat _root_.Nat)))) : LbErased.NominalSubtypes.Event :=
  LbErased.NominalSubtypes.Event.«choices» a0

@[export lb_tca0d998129b5c191a0d3_get2_0]
def f_lb_tca0d998129b5c191a0d3_get2_0 (value : LbErased.NominalSubtypes.Event) : (_root_.Array (_root_.Option (_root_.Except _root_.Nat _root_.Nat))) :=
  match value with | .choices item => item | _ => #[]

@[export lb_t088895fe25b27367c934_make]
def f_lb_t088895fe25b27367c934_make (a0 : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope))) (a1 : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope))) : LbErased.NominalSubtypes.AliasPair :=
  LbErased.NominalSubtypes.AliasPair.mk a0 a1

@[export lb_t088895fe25b27367c934_get0]
def f_lb_t088895fe25b27367c934_get0 (value : LbErased.NominalSubtypes.AliasPair) : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope)) :=
  value.«left»

@[export lb_t088895fe25b27367c934_get1]
def f_lb_t088895fe25b27367c934_get1 (value : LbErased.NominalSubtypes.AliasPair) : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope)) :=
  value.«right»

@[export lb_tf487892807ab67e30881_from_array]
def f_lb_tf487892807ab67e30881_from_array (value : (_root_.Array _root_.Nat)) : (_root_.List _root_.Nat) :=
  value.toList

@[export lb_tf487892807ab67e30881_to_array]
def f_lb_tf487892807ab67e30881_to_array (value : (_root_.List _root_.Nat)) : (_root_.Array _root_.Nat) :=
  let rec loop : _root_.Nat → (_root_.List _root_.Nat) → (_root_.Array _root_.Nat) → (_root_.Array _root_.Nat)
    | 0, _, acc => acc
    | _, [], acc => acc
    | fuel + 1, head :: tail, acc => loop fuel tail (acc.push head)
  loop 2097153 value #[]

@[export lb_t3192fd5c3c5f9017c8f9_make]
def f_lb_t3192fd5c3c5f9017c8f9_make (a0 : LbErased.NominalSubtypes.Envelope) (a1 : LbErased.NominalSubtypes.Envelope) : LbErased.NominalSubtypes.Pair :=
  LbErased.NominalSubtypes.Pair.mk a0 a1

@[export lb_t3192fd5c3c5f9017c8f9_get0]
def f_lb_t3192fd5c3c5f9017c8f9_get0 (value : LbErased.NominalSubtypes.Pair) : LbErased.NominalSubtypes.Envelope :=
  value.«left»

@[export lb_t3192fd5c3c5f9017c8f9_get1]
def f_lb_t3192fd5c3c5f9017c8f9_get1 (value : LbErased.NominalSubtypes.Pair) : LbErased.NominalSubtypes.Envelope :=
  value.«right»

@[export lb_t3d0403c7f86fde2ead4d_none]
def f_lb_t3d0403c7f86fde2ead4d_none (unit : _root_.Unit) : (_root_.Option _root_.Nat) :=
  _root_.Option.none

@[export lb_t3d0403c7f86fde2ead4d_some]
def f_lb_t3d0403c7f86fde2ead4d_some (value : _root_.Nat) : (_root_.Option _root_.Nat) :=
  _root_.Option.some value

@[export lb_t3d0403c7f86fde2ead4d_has]
def f_lb_t3d0403c7f86fde2ead4d_has (value : (_root_.Option _root_.Nat)) : _root_.Bool :=
  match value with | .none => false | .some _ => true

@[export lb_t3d0403c7f86fde2ead4d_get0]
def f_lb_t3d0403c7f86fde2ead4d_get0 (value : (_root_.Option _root_.Nat)) : _root_.Nat :=
  match value with | .none => 0 | .some item => item

@[export lb_t75ac24c77bb2fef233a2_make]
def f_lb_t75ac24c77bb2fef233a2_make (a0 : _root_.Nat) (a1 : _root_.Nat) : (_root_.Prod _root_.Nat _root_.Nat) :=
  _root_.Prod.mk a0 a1

@[export lb_t75ac24c77bb2fef233a2_get0]
def f_lb_t75ac24c77bb2fef233a2_get0 (value : (_root_.Prod _root_.Nat _root_.Nat)) : _root_.Nat :=
  value.1

@[export lb_t75ac24c77bb2fef233a2_get1]
def f_lb_t75ac24c77bb2fef233a2_get1 (value : (_root_.Prod _root_.Nat _root_.Nat)) : _root_.Nat :=
  value.2

@[export lb_native_nat_text]
def f_lb_native_nat_text (value : _root_.Nat) : _root_.String :=
  _root_.Nat.repr value

@[export lb_native_int_text]
def f_lb_native_int_text (value : _root_.Int) : _root_.String :=
  _root_.Int.repr value

@[export lb_native_int_parse]
def f_lb_native_int_parse (value : _root_.String) : _root_.Int :=
  _root_.String.toInt! value

end LeanBridgeNative7f8bfe55e5831a91
