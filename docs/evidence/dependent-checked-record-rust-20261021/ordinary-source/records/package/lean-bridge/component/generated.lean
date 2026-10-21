import DependentRecords

namespace LeanBridgeNativeca8ca903379eb247

structure LbErased.DependentRecords.Dependent where
  «bound» : _root_.Nat
  «below» : _root_.Nat

def LbErased.DependentRecords.Dependent.erase (value : _root_.DependentRecords.Dependent) : LbErased.DependentRecords.Dependent :=
  LbErased.DependentRecords.Dependent.mk (value.«bound») (value.«below»).val

def LbErased.DependentRecords.Dependent.via_de910be546383ee2 (value : LbErased.DependentRecords.Dependent) : _root_.Option _root_.DependentRecords.Dependent := do
  let a0 ← (_root_.Option.some (value.«bound»))
  let a1 ← (_root_.Option.some (value.«below»))
  _root_.DependentRecords.mkDependent a0 a1

@[export lb_e59e187300c993f56dccdfb9]
def f_lb_e59e187300c993f56dccdfb9 (a0 : _root_.Nat) : LbErased.DependentRecords.Dependent :=
  (let _bridgeResult := _root_.DependentRecords.dependentResult a0; (LbErased.DependentRecords.Dependent.erase (_bridgeResult)))

@[export lb_5c4342be8d065a841e1981ff]
def f_lb_5c4342be8d065a841e1981ff (a0 : LbErased.DependentRecords.Dependent) : (_root_.Option LbErased.DependentRecords.Dependent) :=
  match (LbErased.DependentRecords.Dependent.via_de910be546383ee2 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some ((let _bridgeResult := _root_.DependentRecords.dependentRoundtrip _bridgeSubtype0; (LbErased.DependentRecords.Dependent.erase (_bridgeResult))))
  | .none =>
    _root_.Option.none

@[export lb_5c4342be8d065a841e1981ff_refinement_0]
def f_lb_5c4342be8d065a841e1981ff_refinement_0 (value : LbErased.DependentRecords.Dependent) : _root_.UInt8 :=
  match (LbErased.DependentRecords.Dependent.via_de910be546383ee2 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_6742bb14f123c11405a71a1d]
def f_lb_6742bb14f123c11405a71a1d (a0 : LbErased.DependentRecords.Dependent) : (_root_.Option _root_.Nat) :=
  match (LbErased.DependentRecords.Dependent.via_de910be546383ee2 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.DependentRecords.dependentTotal _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_6742bb14f123c11405a71a1d_refinement_0]
def f_lb_6742bb14f123c11405a71a1d_refinement_0 (value : LbErased.DependentRecords.Dependent) : _root_.UInt8 :=
  match (LbErased.DependentRecords.Dependent.via_de910be546383ee2 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_t9c7fb003d50bbc5bd05d_make]
def f_lb_t9c7fb003d50bbc5bd05d_make (a0 : _root_.Nat) (a1 : _root_.Nat) : LbErased.DependentRecords.Dependent :=
  LbErased.DependentRecords.Dependent.mk a0 a1

@[export lb_t9c7fb003d50bbc5bd05d_get0]
def f_lb_t9c7fb003d50bbc5bd05d_get0 (value : LbErased.DependentRecords.Dependent) : _root_.Nat :=
  value.«bound»

@[export lb_t9c7fb003d50bbc5bd05d_get1]
def f_lb_t9c7fb003d50bbc5bd05d_get1 (value : LbErased.DependentRecords.Dependent) : _root_.Nat :=
  value.«below»

@[export lb_native_nat_text]
def f_lb_native_nat_text (value : _root_.Nat) : _root_.String :=
  _root_.Nat.repr value

@[export lb_native_int_text]
def f_lb_native_int_text (value : _root_.Int) : _root_.String :=
  _root_.Int.repr value

@[export lb_native_int_parse]
def f_lb_native_int_parse (value : _root_.String) : _root_.Int :=
  _root_.String.toInt! value

end LeanBridgeNativeca8ca903379eb247
