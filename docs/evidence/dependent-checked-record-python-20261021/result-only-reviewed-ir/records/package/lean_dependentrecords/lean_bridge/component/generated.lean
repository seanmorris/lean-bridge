import DependentRecords

namespace LeanBridgeNativeca8ca903379eb247

structure LbErased.DependentRecords.Dependent where
  «bound» : _root_.Nat
  «below» : _root_.Nat

def LbErased.DependentRecords.Dependent.erase (value : _root_.DependentRecords.Dependent) : LbErased.DependentRecords.Dependent :=
  LbErased.DependentRecords.Dependent.mk (value.«bound») (value.«below»).val

@[export lb_e59e187300c993f56dccdfb9]
def f_lb_e59e187300c993f56dccdfb9 (a0 : _root_.Nat) : LbErased.DependentRecords.Dependent :=
  (let _bridgeResult := _root_.DependentRecords.dependentResult a0; (LbErased.DependentRecords.Dependent.erase (_bridgeResult)))

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
