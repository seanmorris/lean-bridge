import CheckedRecordValueIndices

namespace LeanBridgeNative767c615eabad08d7

structure LbErased.CheckedRecordValueIndices.Ab where
  «size» : _root_.Nat

def LbErased.CheckedRecordValueIndices.Ab.erase (value : _root_.CheckedRecordValueIndices.Ab) : LbErased.CheckedRecordValueIndices.Ab :=
  LbErased.CheckedRecordValueIndices.Ab.mk value.«size»

structure LbErased.CheckedRecordValueIndices.EmptySized where
  «data» : (_root_.Array _root_.Nat)

def LbErased.CheckedRecordValueIndices.EmptySized.erase (value : _root_.CheckedRecordValueIndices.EmptySized) : LbErased.CheckedRecordValueIndices.EmptySized :=
  LbErased.CheckedRecordValueIndices.EmptySized.mk value.«data»

structure LbErased.CheckedRecordValueIndices.EmptyToken where
  «count» : _root_.Nat

def LbErased.CheckedRecordValueIndices.EmptyToken.erase (value : _root_.CheckedRecordValueIndices.EmptyToken) : LbErased.CheckedRecordValueIndices.EmptyToken :=
  LbErased.CheckedRecordValueIndices.EmptyToken.mk value.«count»

structure LbErased.CheckedRecordValueIndices.Off where
  «count» : _root_.Nat

def LbErased.CheckedRecordValueIndices.Off.erase (value : _root_.CheckedRecordValueIndices.Off) : LbErased.CheckedRecordValueIndices.Off :=
  LbErased.CheckedRecordValueIndices.Off.mk value.«count»

structure LbErased.CheckedRecordValueIndices.On where
  «count» : _root_.Nat

def LbErased.CheckedRecordValueIndices.On.erase (value : _root_.CheckedRecordValueIndices.On) : LbErased.CheckedRecordValueIndices.On :=
  LbErased.CheckedRecordValueIndices.On.mk value.«count»

structure LbErased.CheckedRecordValueIndices.UnicodeToken where
  «count» : _root_.Nat

def LbErased.CheckedRecordValueIndices.UnicodeToken.erase (value : _root_.CheckedRecordValueIndices.UnicodeToken) : LbErased.CheckedRecordValueIndices.UnicodeToken :=
  LbErased.CheckedRecordValueIndices.UnicodeToken.mk value.«count»

structure LbErased.CheckedRecordValueIndices.WideToken where
  «count» : _root_.Nat

def LbErased.CheckedRecordValueIndices.WideToken.erase (value : _root_.CheckedRecordValueIndices.WideToken) : LbErased.CheckedRecordValueIndices.WideToken :=
  LbErased.CheckedRecordValueIndices.WideToken.mk value.«count»

structure LbErased.CheckedRecordValueIndices.ZeroToken where
  «count» : _root_.Nat

def LbErased.CheckedRecordValueIndices.ZeroToken.erase (value : _root_.CheckedRecordValueIndices.ZeroToken) : LbErased.CheckedRecordValueIndices.ZeroToken :=
  LbErased.CheckedRecordValueIndices.ZeroToken.mk value.«count»

@[export lb_4d7bad0a7665bc1e177e4091]
def f_lb_4d7bad0a7665bc1e177e4091 (_unit : _root_.Unit) : LbErased.CheckedRecordValueIndices.Ab :=
  (let _bridgeResult := _root_.CheckedRecordValueIndices.produceAb ; (LbErased.CheckedRecordValueIndices.Ab.erase (_bridgeResult)))

@[export lb_2cb2ac73cad1bf0e92f223f2]
def f_lb_2cb2ac73cad1bf0e92f223f2 (_unit : _root_.Unit) : LbErased.CheckedRecordValueIndices.EmptySized :=
  (let _bridgeResult := _root_.CheckedRecordValueIndices.produceEmptySized ; (LbErased.CheckedRecordValueIndices.EmptySized.erase (_bridgeResult)))

@[export lb_1c301039413f26b466ffc0ac]
def f_lb_1c301039413f26b466ffc0ac (a0 : _root_.Nat) : LbErased.CheckedRecordValueIndices.EmptyToken :=
  (let _bridgeResult := _root_.CheckedRecordValueIndices.produceEmptyString a0; (LbErased.CheckedRecordValueIndices.EmptyToken.erase (_bridgeResult)))

@[export lb_4aa58b13819217d37533c8be]
def f_lb_4aa58b13819217d37533c8be (_unit : _root_.Unit) : LbErased.CheckedRecordValueIndices.Off :=
  (let _bridgeResult := _root_.CheckedRecordValueIndices.produceFalseBool ; (LbErased.CheckedRecordValueIndices.Off.erase (_bridgeResult)))

@[export lb_fa4a826e4cfc4b858bea336d]
def f_lb_fa4a826e4cfc4b858bea336d (_unit : _root_.Unit) : LbErased.CheckedRecordValueIndices.On :=
  (let _bridgeResult := _root_.CheckedRecordValueIndices.produceTrueBool ; (LbErased.CheckedRecordValueIndices.On.erase (_bridgeResult)))

@[export lb_c3c99619aef987f5fd710b1d]
def f_lb_c3c99619aef987f5fd710b1d (a0 : _root_.Nat) : LbErased.CheckedRecordValueIndices.UnicodeToken :=
  (let _bridgeResult := _root_.CheckedRecordValueIndices.produceUnicodeString a0; (LbErased.CheckedRecordValueIndices.UnicodeToken.erase (_bridgeResult)))

@[export lb_ee4a5ad2bcd3cf6bb8065218]
def f_lb_ee4a5ad2bcd3cf6bb8065218 (a0 : _root_.Nat) : LbErased.CheckedRecordValueIndices.WideToken :=
  (let _bridgeResult := _root_.CheckedRecordValueIndices.produceWideNat a0; (LbErased.CheckedRecordValueIndices.WideToken.erase (_bridgeResult)))

@[export lb_de7d470e18379efff61de31b]
def f_lb_de7d470e18379efff61de31b (a0 : _root_.Nat) : LbErased.CheckedRecordValueIndices.ZeroToken :=
  (let _bridgeResult := _root_.CheckedRecordValueIndices.produceZeroNat a0; (LbErased.CheckedRecordValueIndices.ZeroToken.erase (_bridgeResult)))

@[export lb_te6e782ea1d9b18dc3e44_make]
def f_lb_te6e782ea1d9b18dc3e44_make (a0 : _root_.Nat) : LbErased.CheckedRecordValueIndices.Ab :=
  LbErased.CheckedRecordValueIndices.Ab.mk a0

@[export lb_te6e782ea1d9b18dc3e44_get0]
def f_lb_te6e782ea1d9b18dc3e44_get0 (value : LbErased.CheckedRecordValueIndices.Ab) : _root_.Nat :=
  value.«size»

@[export lb_t97a1bccb66cfd61c7d52_make]
def f_lb_t97a1bccb66cfd61c7d52_make (a0 : (_root_.Array _root_.Nat)) : LbErased.CheckedRecordValueIndices.EmptySized :=
  LbErased.CheckedRecordValueIndices.EmptySized.mk a0

@[export lb_t97a1bccb66cfd61c7d52_get0]
def f_lb_t97a1bccb66cfd61c7d52_get0 (value : LbErased.CheckedRecordValueIndices.EmptySized) : (_root_.Array _root_.Nat) :=
  value.«data»

@[export lb_t0ac37d04b2c3f2e53e25_make]
def f_lb_t0ac37d04b2c3f2e53e25_make (a0 : _root_.Nat) : LbErased.CheckedRecordValueIndices.EmptyToken :=
  LbErased.CheckedRecordValueIndices.EmptyToken.mk a0

@[export lb_t0ac37d04b2c3f2e53e25_get0]
def f_lb_t0ac37d04b2c3f2e53e25_get0 (value : LbErased.CheckedRecordValueIndices.EmptyToken) : _root_.Nat :=
  value.«count»

@[export lb_ta9c042e57916781102d9_make]
def f_lb_ta9c042e57916781102d9_make (a0 : _root_.Nat) : LbErased.CheckedRecordValueIndices.Off :=
  LbErased.CheckedRecordValueIndices.Off.mk a0

@[export lb_ta9c042e57916781102d9_get0]
def f_lb_ta9c042e57916781102d9_get0 (value : LbErased.CheckedRecordValueIndices.Off) : _root_.Nat :=
  value.«count»

@[export lb_td74f96c3ad55654fb4e2_make]
def f_lb_td74f96c3ad55654fb4e2_make (a0 : _root_.Nat) : LbErased.CheckedRecordValueIndices.On :=
  LbErased.CheckedRecordValueIndices.On.mk a0

@[export lb_td74f96c3ad55654fb4e2_get0]
def f_lb_td74f96c3ad55654fb4e2_get0 (value : LbErased.CheckedRecordValueIndices.On) : _root_.Nat :=
  value.«count»

@[export lb_ta8d5e8c0b6bc9e7e0253_make]
def f_lb_ta8d5e8c0b6bc9e7e0253_make (a0 : _root_.Nat) : LbErased.CheckedRecordValueIndices.UnicodeToken :=
  LbErased.CheckedRecordValueIndices.UnicodeToken.mk a0

@[export lb_ta8d5e8c0b6bc9e7e0253_get0]
def f_lb_ta8d5e8c0b6bc9e7e0253_get0 (value : LbErased.CheckedRecordValueIndices.UnicodeToken) : _root_.Nat :=
  value.«count»

@[export lb_t15b03e27f4c8772be0ea_make]
def f_lb_t15b03e27f4c8772be0ea_make (a0 : _root_.Nat) : LbErased.CheckedRecordValueIndices.WideToken :=
  LbErased.CheckedRecordValueIndices.WideToken.mk a0

@[export lb_t15b03e27f4c8772be0ea_get0]
def f_lb_t15b03e27f4c8772be0ea_get0 (value : LbErased.CheckedRecordValueIndices.WideToken) : _root_.Nat :=
  value.«count»

@[export lb_tcd43cc36cead5a0e3bc7_make]
def f_lb_tcd43cc36cead5a0e3bc7_make (a0 : _root_.Nat) : LbErased.CheckedRecordValueIndices.ZeroToken :=
  LbErased.CheckedRecordValueIndices.ZeroToken.mk a0

@[export lb_tcd43cc36cead5a0e3bc7_get0]
def f_lb_tcd43cc36cead5a0e3bc7_get0 (value : LbErased.CheckedRecordValueIndices.ZeroToken) : _root_.Nat :=
  value.«count»

@[export lb_native_nat_text]
def f_lb_native_nat_text (value : _root_.Nat) : _root_.String :=
  _root_.Nat.repr value

@[export lb_native_int_text]
def f_lb_native_int_text (value : _root_.Int) : _root_.String :=
  _root_.Int.repr value

@[export lb_native_int_parse]
def f_lb_native_int_parse (value : _root_.String) : _root_.Int :=
  _root_.String.toInt! value

end LeanBridgeNative767c615eabad08d7
