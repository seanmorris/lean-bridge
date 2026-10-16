import NestedCheckedRecords

namespace LeanBridgeNativea63244d529ededa0

structure LbErased.NestedCheckedRecords.Packet where
  «digit» : _root_.Nat
  «word» : _root_.Nat

def LbErased.NestedCheckedRecords.Packet.erase (value : _root_.NestedCheckedRecords.Packet) : LbErased.NestedCheckedRecords.Packet :=
  LbErased.NestedCheckedRecords.Packet.mk (value.«digit»).val (value.«word»).val

@[export lb_a27e360b7c6440a8dc40dc87]
def f_lb_a27e360b7c6440a8dc40dc87 (a0 : _root_.Nat) : (_root_.Array LbErased.NestedCheckedRecords.Packet) :=
  (let _bridgeResult := _root_.NestedCheckedRecords.produceArray a0; ((_bridgeResult).map (fun _bridgeValue0 => (LbErased.NestedCheckedRecords.Packet.erase (_bridgeValue0)))))

@[export lb_85f9f487f03e070ff66bb271]
def f_lb_85f9f487f03e070ff66bb271 (a0 : _root_.Nat) : (_root_.Option LbErased.NestedCheckedRecords.Packet) :=
  (let _bridgeResult := _root_.NestedCheckedRecords.produceOption a0; ((_bridgeResult).map (fun _bridgeValue0 => (LbErased.NestedCheckedRecords.Packet.erase (_bridgeValue0)))))

@[export lb_tf35e9094c144406778d4_make]
def f_lb_tf35e9094c144406778d4_make (a0 : _root_.Nat) (a1 : _root_.Nat) : LbErased.NestedCheckedRecords.Packet :=
  LbErased.NestedCheckedRecords.Packet.mk a0 a1

@[export lb_tf35e9094c144406778d4_get0]
def f_lb_tf35e9094c144406778d4_get0 (value : LbErased.NestedCheckedRecords.Packet) : _root_.Nat :=
  value.«digit»

@[export lb_tf35e9094c144406778d4_get1]
def f_lb_tf35e9094c144406778d4_get1 (value : LbErased.NestedCheckedRecords.Packet) : _root_.Nat :=
  value.«word»

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
