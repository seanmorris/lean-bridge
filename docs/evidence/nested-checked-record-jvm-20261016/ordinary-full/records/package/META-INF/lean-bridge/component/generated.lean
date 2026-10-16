import NestedCheckedRecords

namespace LeanBridgeNativea63244d529ededa0

structure LbErased.NestedCheckedRecords.Packet where
  «digit» : _root_.Nat
  «word» : _root_.Nat

def LbErased.NestedCheckedRecords.Packet.erase (value : _root_.NestedCheckedRecords.Packet) : LbErased.NestedCheckedRecords.Packet :=
  LbErased.NestedCheckedRecords.Packet.mk (value.«digit»).val (value.«word»).val

def LbErased.NestedCheckedRecords.Packet.via_482737b68ef55b30 (value : LbErased.NestedCheckedRecords.Packet) : _root_.Option _root_.NestedCheckedRecords.Packet := do
  let a0 ← (if proof : (value.«digit») < 10 then _root_.Option.some (⟨(value.«digit»), proof⟩ : _root_.Fin 10) else _root_.Option.none)
  let a1 ← _root_.NestedCheckedRecords.mkWord value.«word»
  _root_.NestedCheckedRecords.mkPacket a0 a1

def LbErased.NestedCheckedRecords.Packet.via_7b0e6424ad905e25 (value : LbErased.NestedCheckedRecords.Packet) : _root_.Option _root_.NestedCheckedRecords.Packet := do
  let a0 ← (if proof : (value.«digit») < 10 then _root_.Option.some (⟨(value.«digit»), proof⟩ : _root_.Fin 10) else _root_.Option.none)
  let a1 ← _root_.NestedCheckedRecords.normalizeWord value.«word»
  _root_.NestedCheckedRecords.normalizePacket a0 a1

def LbErased.NestedCheckedRecords.Packet.via_9a97d62281b4c19e (value : LbErased.NestedCheckedRecords.Packet) : _root_.Option _root_.NestedCheckedRecords.Packet := do
  let a0 ← (if proof : (value.«digit») < 10 then _root_.Option.some (⟨(value.«digit»), proof⟩ : _root_.Fin 10) else _root_.Option.none)
  let a1 ← _root_.NestedCheckedRecords.normalizeWord value.«word»
  _root_.NestedCheckedRecords.mkPacket a0 a1

def LbErased.NestedCheckedRecords.Packet.via_fe5f293cdd3bd72c (value : LbErased.NestedCheckedRecords.Packet) : _root_.Option _root_.NestedCheckedRecords.Packet := do
  let a0 ← (if proof : (value.«digit») < 10 then _root_.Option.some (⟨(value.«digit»), proof⟩ : _root_.Fin 10) else _root_.Option.none)
  let a1 ← _root_.NestedCheckedRecords.mkWord value.«word»
  _root_.NestedCheckedRecords.normalizePacket a0 a1

inductive LbErased.NestedCheckedRecords.Choice where
  | «empty»  : LbErased.NestedCheckedRecords.Choice
  | «packet» (a0 : LbErased.NestedCheckedRecords.Packet) : LbErased.NestedCheckedRecords.Choice

def LbErased.NestedCheckedRecords.Choice.via_481621b8e8c54c107af90b37de2e23c237a701e57682910f941a1c3a2428ce15 (value : LbErased.NestedCheckedRecords.Choice) : _root_.Option _root_.NestedCheckedRecords.Choice :=
  match value with
  | .«empty»  => do pure (_root_.NestedCheckedRecords.Choice.empty )
  | .«packet» a0 => do let b0 ← (LbErased.NestedCheckedRecords.Packet.via_9a97d62281b4c19e (a0)); pure (_root_.NestedCheckedRecords.Choice.packet b0)

def LbErased.NestedCheckedRecords.Choice.erase (value : _root_.NestedCheckedRecords.Choice) : LbErased.NestedCheckedRecords.Choice :=
  match value with
  | .«empty»  => LbErased.NestedCheckedRecords.Choice.«empty» 
  | .«packet» a0 => LbErased.NestedCheckedRecords.Choice.«packet» (LbErased.NestedCheckedRecords.Packet.erase (a0))

structure LbErased.NestedCheckedRecords.Holder where
  «packet» : LbErased.NestedCheckedRecords.Packet
  «tag» : _root_.Nat

def LbErased.NestedCheckedRecords.Holder.via_6cdd88195adf57f5eb779028e8a8a757a48a20be67e3aca84c0ae10ab603682a (value : LbErased.NestedCheckedRecords.Holder) : _root_.Option _root_.NestedCheckedRecords.Holder := do
  let a0 ← (LbErased.NestedCheckedRecords.Packet.via_fe5f293cdd3bd72c (value.«packet»))
  let a1 ← (_root_.Option.some (value.«tag»))
  pure (_root_.NestedCheckedRecords.Holder.mk a0 a1)

def LbErased.NestedCheckedRecords.Holder.erase (value : _root_.NestedCheckedRecords.Holder) : LbErased.NestedCheckedRecords.Holder :=
  LbErased.NestedCheckedRecords.Holder.mk (LbErased.NestedCheckedRecords.Packet.erase (value.«packet»)) (value.«tag»)

@[export lb_736e6e42272689e8602e2ea4]
def f_lb_736e6e42272689e8602e2ea4 (a0 : (_root_.Array LbErased.NestedCheckedRecords.Packet)) : (_root_.Option (_root_.Array LbErased.NestedCheckedRecords.Packet)) :=
  match ((a0).mapM (fun _bridgeValue0 => (LbErased.NestedCheckedRecords.Packet.via_482737b68ef55b30 (_bridgeValue0)))) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some ((let _bridgeResult := _root_.NestedCheckedRecords.echoArray _bridgeSubtype0; ((_bridgeResult).map (fun _bridgeValue0 => (LbErased.NestedCheckedRecords.Packet.erase (_bridgeValue0))))))
  | .none =>
    _root_.Option.none

@[export lb_736e6e42272689e8602e2ea4_refinement_0_0_1]
def f_lb_736e6e42272689e8602e2ea4_refinement_0_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.mkWord value with
  | .some _ => 1
  | .none => 0

@[export lb_736e6e42272689e8602e2ea4_refinement_0_0]
def f_lb_736e6e42272689e8602e2ea4_refinement_0_0 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_482737b68ef55b30 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_5958d1767f4416b0c44cb0c8]
def f_lb_5958d1767f4416b0c44cb0c8 (a0 : LbErased.NestedCheckedRecords.Packet) : (_root_.Option _root_.Nat) :=
  match (LbErased.NestedCheckedRecords.Packet.via_482737b68ef55b30 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NestedCheckedRecords.first _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_5958d1767f4416b0c44cb0c8_refinement_0_1]
def f_lb_5958d1767f4416b0c44cb0c8_refinement_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.mkWord value with
  | .some _ => 1
  | .none => 0

@[export lb_5958d1767f4416b0c44cb0c8_refinement_0]
def f_lb_5958d1767f4416b0c44cb0c8_refinement_0 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_482737b68ef55b30 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_901886a48c494a07f1221bd4]
def f_lb_901886a48c494a07f1221bd4 (a0 : (_root_.Array LbErased.NestedCheckedRecords.Packet)) : (_root_.Option _root_.Nat) :=
  match ((a0).mapM (fun _bridgeValue0 => (LbErased.NestedCheckedRecords.Packet.via_482737b68ef55b30 (_bridgeValue0)))) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NestedCheckedRecords.inArray _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_901886a48c494a07f1221bd4_refinement_0_0_1]
def f_lb_901886a48c494a07f1221bd4_refinement_0_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.mkWord value with
  | .some _ => 1
  | .none => 0

@[export lb_901886a48c494a07f1221bd4_refinement_0_0]
def f_lb_901886a48c494a07f1221bd4_refinement_0_0 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_482737b68ef55b30 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_747af41a1169d20ede396a7c]
def f_lb_747af41a1169d20ede396a7c (a0 : LbErased.NestedCheckedRecords.Choice) : (_root_.Option _root_.Nat) :=
  match (LbErased.NestedCheckedRecords.Choice.via_481621b8e8c54c107af90b37de2e23c237a701e57682910f941a1c3a2428ce15 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NestedCheckedRecords.inChoice _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_747af41a1169d20ede396a7c_refinement_0_1_0_1]
def f_lb_747af41a1169d20ede396a7c_refinement_0_1_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.normalizeWord value with
  | .some _ => 1
  | .none => 0

@[export lb_747af41a1169d20ede396a7c_refinement_0_1_0]
def f_lb_747af41a1169d20ede396a7c_refinement_0_1_0 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_9a97d62281b4c19e (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_5c47339f5c461dfb7aca7095]
def f_lb_5c47339f5c461dfb7aca7095 (a0 : (_root_.Except LbErased.NestedCheckedRecords.Packet LbErased.NestedCheckedRecords.Packet)) : (_root_.Option _root_.Nat) :=
  match (match (a0) with | _root_.Except.ok _bridgeValue0 => ((LbErased.NestedCheckedRecords.Packet.via_fe5f293cdd3bd72c (_bridgeValue0))).map _root_.Except.ok | _root_.Except.error _bridgeValue0 => ((LbErased.NestedCheckedRecords.Packet.via_9a97d62281b4c19e (_bridgeValue0))).map _root_.Except.error) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NestedCheckedRecords.inExcept _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_5c47339f5c461dfb7aca7095_refinement_0_0_1]
def f_lb_5c47339f5c461dfb7aca7095_refinement_0_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.mkWord value with
  | .some _ => 1
  | .none => 0

@[export lb_5c47339f5c461dfb7aca7095_refinement_0_0]
def f_lb_5c47339f5c461dfb7aca7095_refinement_0_0 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_fe5f293cdd3bd72c (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_5c47339f5c461dfb7aca7095_refinement_0_1_1]
def f_lb_5c47339f5c461dfb7aca7095_refinement_0_1_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.normalizeWord value with
  | .some _ => 1
  | .none => 0

@[export lb_5c47339f5c461dfb7aca7095_refinement_0_1]
def f_lb_5c47339f5c461dfb7aca7095_refinement_0_1 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_9a97d62281b4c19e (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_83154aa7144b6a3870db30d4]
def f_lb_83154aa7144b6a3870db30d4 (a0 : LbErased.NestedCheckedRecords.Holder) : (_root_.Option _root_.Nat) :=
  match (LbErased.NestedCheckedRecords.Holder.via_6cdd88195adf57f5eb779028e8a8a757a48a20be67e3aca84c0ae10ab603682a (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NestedCheckedRecords.inHolder _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_83154aa7144b6a3870db30d4_refinement_0_0_1]
def f_lb_83154aa7144b6a3870db30d4_refinement_0_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.mkWord value with
  | .some _ => 1
  | .none => 0

@[export lb_83154aa7144b6a3870db30d4_refinement_0_0]
def f_lb_83154aa7144b6a3870db30d4_refinement_0_0 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_fe5f293cdd3bd72c (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_db4d19a4e1cc947e70cd771a]
def f_lb_db4d19a4e1cc947e70cd771a (a0 : (_root_.List LbErased.NestedCheckedRecords.Packet)) : (_root_.Option _root_.Nat) :=
  match ((a0).mapM (fun _bridgeValue0 => (LbErased.NestedCheckedRecords.Packet.via_7b0e6424ad905e25 (_bridgeValue0)))) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NestedCheckedRecords.inList _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_db4d19a4e1cc947e70cd771a_refinement_0_0_1]
def f_lb_db4d19a4e1cc947e70cd771a_refinement_0_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.normalizeWord value with
  | .some _ => 1
  | .none => 0

@[export lb_db4d19a4e1cc947e70cd771a_refinement_0_0]
def f_lb_db4d19a4e1cc947e70cd771a_refinement_0_0 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_7b0e6424ad905e25 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_132bf2f486b40fdf10a35ddf]
def f_lb_132bf2f486b40fdf10a35ddf (a0 : (_root_.Option LbErased.NestedCheckedRecords.Packet)) : (_root_.Option _root_.Nat) :=
  match (match (a0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue0 => ((LbErased.NestedCheckedRecords.Packet.via_9a97d62281b4c19e (_bridgeValue0))).map _root_.Option.some) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NestedCheckedRecords.inOption _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_132bf2f486b40fdf10a35ddf_refinement_0_0_1]
def f_lb_132bf2f486b40fdf10a35ddf_refinement_0_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.normalizeWord value with
  | .some _ => 1
  | .none => 0

@[export lb_132bf2f486b40fdf10a35ddf_refinement_0_0]
def f_lb_132bf2f486b40fdf10a35ddf_refinement_0_0 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_9a97d62281b4c19e (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_15be5b0eae9d80d6eda2e863]
def f_lb_15be5b0eae9d80d6eda2e863 (a0 : (_root_.Prod LbErased.NestedCheckedRecords.Packet LbErased.NestedCheckedRecords.Packet)) : (_root_.Option _root_.Nat) :=
  match (do let _bridgeValue0a ← (LbErased.NestedCheckedRecords.Packet.via_482737b68ef55b30 ((a0).fst)); let _bridgeValue0b ← (LbErased.NestedCheckedRecords.Packet.via_7b0e6424ad905e25 ((a0).snd)); pure (_bridgeValue0a, _bridgeValue0b)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NestedCheckedRecords.inProduct _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_15be5b0eae9d80d6eda2e863_refinement_0_0_1]
def f_lb_15be5b0eae9d80d6eda2e863_refinement_0_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.mkWord value with
  | .some _ => 1
  | .none => 0

@[export lb_15be5b0eae9d80d6eda2e863_refinement_0_0]
def f_lb_15be5b0eae9d80d6eda2e863_refinement_0_0 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_482737b68ef55b30 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_15be5b0eae9d80d6eda2e863_refinement_0_1_1]
def f_lb_15be5b0eae9d80d6eda2e863_refinement_0_1_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.normalizeWord value with
  | .some _ => 1
  | .none => 0

@[export lb_15be5b0eae9d80d6eda2e863_refinement_0_1]
def f_lb_15be5b0eae9d80d6eda2e863_refinement_0_1 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_7b0e6424ad905e25 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_057b765fe3895fbd2312f96f]
def f_lb_057b765fe3895fbd2312f96f (a0 : LbErased.NestedCheckedRecords.Packet) (a1 : LbErased.NestedCheckedRecords.Packet) : (_root_.Option _root_.Nat) :=
  match (LbErased.NestedCheckedRecords.Packet.via_482737b68ef55b30 (a0)) with
  | .some _bridgeSubtype0 =>
    match (LbErased.NestedCheckedRecords.Packet.via_7b0e6424ad905e25 (a1)) with
    | .some _bridgeSubtype1 =>
      _root_.Option.some (_root_.NestedCheckedRecords.pair _bridgeSubtype0 _bridgeSubtype1)
    | .none =>
      _root_.Option.none
  | .none =>
    _root_.Option.none

@[export lb_057b765fe3895fbd2312f96f_refinement_0_1]
def f_lb_057b765fe3895fbd2312f96f_refinement_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.mkWord value with
  | .some _ => 1
  | .none => 0

@[export lb_057b765fe3895fbd2312f96f_refinement_0]
def f_lb_057b765fe3895fbd2312f96f_refinement_0 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_482737b68ef55b30 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_057b765fe3895fbd2312f96f_refinement_1_1]
def f_lb_057b765fe3895fbd2312f96f_refinement_1_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.normalizeWord value with
  | .some _ => 1
  | .none => 0

@[export lb_057b765fe3895fbd2312f96f_refinement_1]
def f_lb_057b765fe3895fbd2312f96f_refinement_1 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_7b0e6424ad905e25 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_a27e360b7c6440a8dc40dc87]
def f_lb_a27e360b7c6440a8dc40dc87 (a0 : _root_.Nat) : (_root_.Array LbErased.NestedCheckedRecords.Packet) :=
  (let _bridgeResult := _root_.NestedCheckedRecords.produceArray a0; ((_bridgeResult).map (fun _bridgeValue0 => (LbErased.NestedCheckedRecords.Packet.erase (_bridgeValue0)))))

@[export lb_85f9f487f03e070ff66bb271]
def f_lb_85f9f487f03e070ff66bb271 (a0 : _root_.Nat) : (_root_.Option LbErased.NestedCheckedRecords.Packet) :=
  (let _bridgeResult := _root_.NestedCheckedRecords.produceOption a0; ((_bridgeResult).map (fun _bridgeValue0 => (LbErased.NestedCheckedRecords.Packet.erase (_bridgeValue0)))))

@[export lb_93083abb1dedb8e0ff0743dc]
def f_lb_93083abb1dedb8e0ff0743dc (a0 : LbErased.NestedCheckedRecords.Packet) : (_root_.Option _root_.Nat) :=
  match (LbErased.NestedCheckedRecords.Packet.via_7b0e6424ad905e25 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.NestedCheckedRecords.second _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_93083abb1dedb8e0ff0743dc_refinement_0_1]
def f_lb_93083abb1dedb8e0ff0743dc_refinement_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.NestedCheckedRecords.normalizeWord value with
  | .some _ => 1
  | .none => 0

@[export lb_93083abb1dedb8e0ff0743dc_refinement_0]
def f_lb_93083abb1dedb8e0ff0743dc_refinement_0 (value : LbErased.NestedCheckedRecords.Packet) : _root_.UInt8 :=
  match (LbErased.NestedCheckedRecords.Packet.via_7b0e6424ad905e25 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_tf35e9094c144406778d4_make]
def f_lb_tf35e9094c144406778d4_make (a0 : _root_.Nat) (a1 : _root_.Nat) : LbErased.NestedCheckedRecords.Packet :=
  LbErased.NestedCheckedRecords.Packet.mk a0 a1

@[export lb_tf35e9094c144406778d4_get0]
def f_lb_tf35e9094c144406778d4_get0 (value : LbErased.NestedCheckedRecords.Packet) : _root_.Nat :=
  value.«digit»

@[export lb_tf35e9094c144406778d4_get1]
def f_lb_tf35e9094c144406778d4_get1 (value : LbErased.NestedCheckedRecords.Packet) : _root_.Nat :=
  value.«word»

@[export lb_tcddeeeaf929e6028ab58_tag]
def f_lb_tcddeeeaf929e6028ab58_tag (value : LbErased.NestedCheckedRecords.Choice) : _root_.UInt32 :=
  match value with | .empty  => 0 | .packet _ => 1

@[export lb_tcddeeeaf929e6028ab58_make0]
def f_lb_tcddeeeaf929e6028ab58_make0 (_unit : _root_.Unit) : LbErased.NestedCheckedRecords.Choice :=
  LbErased.NestedCheckedRecords.Choice.«empty» 

@[export lb_tcddeeeaf929e6028ab58_make1]
def f_lb_tcddeeeaf929e6028ab58_make1 (a0 : LbErased.NestedCheckedRecords.Packet) : LbErased.NestedCheckedRecords.Choice :=
  LbErased.NestedCheckedRecords.Choice.«packet» a0

@[export lb_tcddeeeaf929e6028ab58_get1_0]
def f_lb_tcddeeeaf929e6028ab58_get1_0 (value : LbErased.NestedCheckedRecords.Choice) : LbErased.NestedCheckedRecords.Packet :=
  match value with | .packet item => item | _ => (LbErased.NestedCheckedRecords.Packet.mk 0 0)

@[export lb_t14d9022f57e0ccd06f81_has]
def f_lb_t14d9022f57e0ccd06f81_has (value : (_root_.Except LbErased.NestedCheckedRecords.Packet LbErased.NestedCheckedRecords.Packet)) : _root_.Bool :=
  match value with | .ok _ => true | .error _ => false

@[export lb_t14d9022f57e0ccd06f81_ok]
def f_lb_t14d9022f57e0ccd06f81_ok (value : LbErased.NestedCheckedRecords.Packet) : (_root_.Except LbErased.NestedCheckedRecords.Packet LbErased.NestedCheckedRecords.Packet) :=
  _root_.Except.ok value

@[export lb_t14d9022f57e0ccd06f81_get0]
def f_lb_t14d9022f57e0ccd06f81_get0 (value : (_root_.Except LbErased.NestedCheckedRecords.Packet LbErased.NestedCheckedRecords.Packet)) : LbErased.NestedCheckedRecords.Packet :=
  match value with | .ok item => item | _ => (LbErased.NestedCheckedRecords.Packet.mk 0 0)

@[export lb_t14d9022f57e0ccd06f81_error]
def f_lb_t14d9022f57e0ccd06f81_error (value : LbErased.NestedCheckedRecords.Packet) : (_root_.Except LbErased.NestedCheckedRecords.Packet LbErased.NestedCheckedRecords.Packet) :=
  _root_.Except.error value

@[export lb_t14d9022f57e0ccd06f81_get1]
def f_lb_t14d9022f57e0ccd06f81_get1 (value : (_root_.Except LbErased.NestedCheckedRecords.Packet LbErased.NestedCheckedRecords.Packet)) : LbErased.NestedCheckedRecords.Packet :=
  match value with | .error item => item | _ => (LbErased.NestedCheckedRecords.Packet.mk 0 0)

@[export lb_tcd336fb36ba39028fc07_make]
def f_lb_tcd336fb36ba39028fc07_make (a0 : LbErased.NestedCheckedRecords.Packet) (a1 : _root_.Nat) : LbErased.NestedCheckedRecords.Holder :=
  LbErased.NestedCheckedRecords.Holder.mk a0 a1

@[export lb_tcd336fb36ba39028fc07_get0]
def f_lb_tcd336fb36ba39028fc07_get0 (value : LbErased.NestedCheckedRecords.Holder) : LbErased.NestedCheckedRecords.Packet :=
  value.«packet»

@[export lb_tcd336fb36ba39028fc07_get1]
def f_lb_tcd336fb36ba39028fc07_get1 (value : LbErased.NestedCheckedRecords.Holder) : _root_.Nat :=
  value.«tag»

@[export lb_t60a009a91931a5562832_from_array]
def f_lb_t60a009a91931a5562832_from_array (value : (_root_.Array LbErased.NestedCheckedRecords.Packet)) : (_root_.List LbErased.NestedCheckedRecords.Packet) :=
  value.toList

@[export lb_t60a009a91931a5562832_to_array]
def f_lb_t60a009a91931a5562832_to_array (value : (_root_.List LbErased.NestedCheckedRecords.Packet)) : (_root_.Array LbErased.NestedCheckedRecords.Packet) :=
  let rec loop : _root_.Nat → (_root_.List LbErased.NestedCheckedRecords.Packet) → (_root_.Array LbErased.NestedCheckedRecords.Packet) → (_root_.Array LbErased.NestedCheckedRecords.Packet)
    | 0, _, acc => acc
    | _, [], acc => acc
    | fuel + 1, head :: tail, acc => loop fuel tail (acc.push head)
  loop 2097153 value #[]

@[export lb_tfbdb0eed1b69f3acda27_none]
def f_lb_tfbdb0eed1b69f3acda27_none (_unit : _root_.Unit) : (_root_.Option LbErased.NestedCheckedRecords.Packet) :=
  _root_.Option.none

@[export lb_tfbdb0eed1b69f3acda27_some]
def f_lb_tfbdb0eed1b69f3acda27_some (value : LbErased.NestedCheckedRecords.Packet) : (_root_.Option LbErased.NestedCheckedRecords.Packet) :=
  _root_.Option.some value

@[export lb_tfbdb0eed1b69f3acda27_has]
def f_lb_tfbdb0eed1b69f3acda27_has (value : (_root_.Option LbErased.NestedCheckedRecords.Packet)) : _root_.Bool :=
  match value with | .none => false | .some _ => true

@[export lb_tfbdb0eed1b69f3acda27_get0]
def f_lb_tfbdb0eed1b69f3acda27_get0 (value : (_root_.Option LbErased.NestedCheckedRecords.Packet)) : LbErased.NestedCheckedRecords.Packet :=
  match value with | .none => (LbErased.NestedCheckedRecords.Packet.mk 0 0) | .some item => item

@[export lb_tae5b2d5f055eddb8c5fc_make]
def f_lb_tae5b2d5f055eddb8c5fc_make (a0 : LbErased.NestedCheckedRecords.Packet) (a1 : LbErased.NestedCheckedRecords.Packet) : (_root_.Prod LbErased.NestedCheckedRecords.Packet LbErased.NestedCheckedRecords.Packet) :=
  _root_.Prod.mk a0 a1

@[export lb_tae5b2d5f055eddb8c5fc_get0]
def f_lb_tae5b2d5f055eddb8c5fc_get0 (value : (_root_.Prod LbErased.NestedCheckedRecords.Packet LbErased.NestedCheckedRecords.Packet)) : LbErased.NestedCheckedRecords.Packet :=
  value.1

@[export lb_tae5b2d5f055eddb8c5fc_get1]
def f_lb_tae5b2d5f055eddb8c5fc_get1 (value : (_root_.Prod LbErased.NestedCheckedRecords.Packet LbErased.NestedCheckedRecords.Packet)) : LbErased.NestedCheckedRecords.Packet :=
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

end LeanBridgeNativea63244d529ededa0
