import CheckedRecordValueIndices

namespace LeanBridgeNative767c615eabad08d7

structure LbErased.CheckedRecordValueIndices.Ab where
  «size» : _root_.Nat

def LbErased.CheckedRecordValueIndices.Ab.erase (value : _root_.CheckedRecordValueIndices.Ab) : LbErased.CheckedRecordValueIndices.Ab :=
  LbErased.CheckedRecordValueIndices.Ab.mk value.«size»

def LbErased.CheckedRecordValueIndices.Ab.via_e588d9bdb3d379ef (value : LbErased.CheckedRecordValueIndices.Ab) : _root_.Option _root_.CheckedRecordValueIndices.Ab :=
  _root_.CheckedRecordValueIndices.mkAb value.«size»

structure LbErased.CheckedRecordValueIndices.EmptySized where
  «data» : (_root_.Array _root_.Nat)

def LbErased.CheckedRecordValueIndices.EmptySized.erase (value : _root_.CheckedRecordValueIndices.EmptySized) : LbErased.CheckedRecordValueIndices.EmptySized :=
  LbErased.CheckedRecordValueIndices.EmptySized.mk value.«data»

def LbErased.CheckedRecordValueIndices.EmptySized.via_d429ea3e1295fc0f (value : LbErased.CheckedRecordValueIndices.EmptySized) : _root_.Option _root_.CheckedRecordValueIndices.EmptySized :=
  _root_.CheckedRecordValueIndices.mkEmptySized value.«data»

structure LbErased.CheckedRecordValueIndices.EmptyToken where
  «count» : _root_.Nat

def LbErased.CheckedRecordValueIndices.EmptyToken.erase (value : _root_.CheckedRecordValueIndices.EmptyToken) : LbErased.CheckedRecordValueIndices.EmptyToken :=
  LbErased.CheckedRecordValueIndices.EmptyToken.mk value.«count»

def LbErased.CheckedRecordValueIndices.EmptyToken.via_f5a122b446de815e (value : LbErased.CheckedRecordValueIndices.EmptyToken) : _root_.Option _root_.CheckedRecordValueIndices.EmptyToken :=
  _root_.CheckedRecordValueIndices.mkEmptyToken value.«count»

structure LbErased.CheckedRecordValueIndices.Off where
  «count» : _root_.Nat

def LbErased.CheckedRecordValueIndices.Off.erase (value : _root_.CheckedRecordValueIndices.Off) : LbErased.CheckedRecordValueIndices.Off :=
  LbErased.CheckedRecordValueIndices.Off.mk value.«count»

def LbErased.CheckedRecordValueIndices.Off.via_bfbfb3c2c8437f1c (value : LbErased.CheckedRecordValueIndices.Off) : _root_.Option _root_.CheckedRecordValueIndices.Off :=
  _root_.CheckedRecordValueIndices.mkOff value.«count»

structure LbErased.CheckedRecordValueIndices.On where
  «count» : _root_.Nat

def LbErased.CheckedRecordValueIndices.On.erase (value : _root_.CheckedRecordValueIndices.On) : LbErased.CheckedRecordValueIndices.On :=
  LbErased.CheckedRecordValueIndices.On.mk value.«count»

def LbErased.CheckedRecordValueIndices.On.via_95ebf36a2c0c8a1f (value : LbErased.CheckedRecordValueIndices.On) : _root_.Option _root_.CheckedRecordValueIndices.On :=
  _root_.CheckedRecordValueIndices.mkOn value.«count»

structure LbErased.CheckedRecordValueIndices.UnicodeToken where
  «count» : _root_.Nat

def LbErased.CheckedRecordValueIndices.UnicodeToken.erase (value : _root_.CheckedRecordValueIndices.UnicodeToken) : LbErased.CheckedRecordValueIndices.UnicodeToken :=
  LbErased.CheckedRecordValueIndices.UnicodeToken.mk value.«count»

def LbErased.CheckedRecordValueIndices.UnicodeToken.via_f8fb33b3fb13a1d8 (value : LbErased.CheckedRecordValueIndices.UnicodeToken) : _root_.Option _root_.CheckedRecordValueIndices.UnicodeToken :=
  _root_.CheckedRecordValueIndices.mkUnicodeToken value.«count»

structure LbErased.CheckedRecordValueIndices.WideToken where
  «count» : _root_.Nat

def LbErased.CheckedRecordValueIndices.WideToken.erase (value : _root_.CheckedRecordValueIndices.WideToken) : LbErased.CheckedRecordValueIndices.WideToken :=
  LbErased.CheckedRecordValueIndices.WideToken.mk value.«count»

def LbErased.CheckedRecordValueIndices.WideToken.via_cd973733db144020 (value : LbErased.CheckedRecordValueIndices.WideToken) : _root_.Option _root_.CheckedRecordValueIndices.WideToken :=
  _root_.CheckedRecordValueIndices.mkWideToken value.«count»

structure LbErased.CheckedRecordValueIndices.ZeroToken where
  «count» : _root_.Nat

def LbErased.CheckedRecordValueIndices.ZeroToken.erase (value : _root_.CheckedRecordValueIndices.ZeroToken) : LbErased.CheckedRecordValueIndices.ZeroToken :=
  LbErased.CheckedRecordValueIndices.ZeroToken.mk value.«count»

def LbErased.CheckedRecordValueIndices.ZeroToken.via_a1593fbc16b6437b (value : LbErased.CheckedRecordValueIndices.ZeroToken) : _root_.Option _root_.CheckedRecordValueIndices.ZeroToken :=
  _root_.CheckedRecordValueIndices.mkZeroToken value.«count»

@[export lb_aa7389f0b324bcc872e58eb7]
def f_lb_aa7389f0b324bcc872e58eb7 (a0 : LbErased.CheckedRecordValueIndices.Ab) : (_root_.Option _root_.Nat) :=
  match (LbErased.CheckedRecordValueIndices.Ab.via_e588d9bdb3d379ef (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.CheckedRecordValueIndices.abStringIndex _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_aa7389f0b324bcc872e58eb7_refinement_0]
def f_lb_aa7389f0b324bcc872e58eb7_refinement_0 (value : LbErased.CheckedRecordValueIndices.Ab) : _root_.UInt8 :=
  match (LbErased.CheckedRecordValueIndices.Ab.via_e588d9bdb3d379ef (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_bc7bc77b17e26626a1e79470]
def f_lb_bc7bc77b17e26626a1e79470 (a0 : LbErased.CheckedRecordValueIndices.EmptySized) : (_root_.Option _root_.Nat) :=
  match (LbErased.CheckedRecordValueIndices.EmptySized.via_d429ea3e1295fc0f (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.CheckedRecordValueIndices.emptySizedIndex _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_bc7bc77b17e26626a1e79470_refinement_0]
def f_lb_bc7bc77b17e26626a1e79470_refinement_0 (value : LbErased.CheckedRecordValueIndices.EmptySized) : _root_.UInt8 :=
  match (LbErased.CheckedRecordValueIndices.EmptySized.via_d429ea3e1295fc0f (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_9317a25424a9625bb91b8651]
def f_lb_9317a25424a9625bb91b8651 (a0 : LbErased.CheckedRecordValueIndices.EmptyToken) : (_root_.Option _root_.Nat) :=
  match (LbErased.CheckedRecordValueIndices.EmptyToken.via_f5a122b446de815e (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.CheckedRecordValueIndices.emptyStringIndex _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_9317a25424a9625bb91b8651_refinement_0]
def f_lb_9317a25424a9625bb91b8651_refinement_0 (value : LbErased.CheckedRecordValueIndices.EmptyToken) : _root_.UInt8 :=
  match (LbErased.CheckedRecordValueIndices.EmptyToken.via_f5a122b446de815e (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_8171c54f4160a22ad89a1929]
def f_lb_8171c54f4160a22ad89a1929 (a0 : LbErased.CheckedRecordValueIndices.Off) : (_root_.Option _root_.Nat) :=
  match (LbErased.CheckedRecordValueIndices.Off.via_bfbfb3c2c8437f1c (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.CheckedRecordValueIndices.falseBoolIndex _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_8171c54f4160a22ad89a1929_refinement_0]
def f_lb_8171c54f4160a22ad89a1929_refinement_0 (value : LbErased.CheckedRecordValueIndices.Off) : _root_.UInt8 :=
  match (LbErased.CheckedRecordValueIndices.Off.via_bfbfb3c2c8437f1c (value)) with
  | .some _ => 1
  | .none => 0

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

@[export lb_d1b030ebab8bb6628451db44]
def f_lb_d1b030ebab8bb6628451db44 (a0 : LbErased.CheckedRecordValueIndices.On) : (_root_.Option _root_.Nat) :=
  match (LbErased.CheckedRecordValueIndices.On.via_95ebf36a2c0c8a1f (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.CheckedRecordValueIndices.trueBoolIndex _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_d1b030ebab8bb6628451db44_refinement_0]
def f_lb_d1b030ebab8bb6628451db44_refinement_0 (value : LbErased.CheckedRecordValueIndices.On) : _root_.UInt8 :=
  match (LbErased.CheckedRecordValueIndices.On.via_95ebf36a2c0c8a1f (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_35b0d02ac4b5686e440a8198]
def f_lb_35b0d02ac4b5686e440a8198 (a0 : LbErased.CheckedRecordValueIndices.UnicodeToken) : (_root_.Option _root_.Nat) :=
  match (LbErased.CheckedRecordValueIndices.UnicodeToken.via_f8fb33b3fb13a1d8 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.CheckedRecordValueIndices.unicodeStringIndex _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_35b0d02ac4b5686e440a8198_refinement_0]
def f_lb_35b0d02ac4b5686e440a8198_refinement_0 (value : LbErased.CheckedRecordValueIndices.UnicodeToken) : _root_.UInt8 :=
  match (LbErased.CheckedRecordValueIndices.UnicodeToken.via_f8fb33b3fb13a1d8 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_629d14b28988602cba2f4f16]
def f_lb_629d14b28988602cba2f4f16 (a0 : LbErased.CheckedRecordValueIndices.WideToken) : (_root_.Option _root_.Nat) :=
  match (LbErased.CheckedRecordValueIndices.WideToken.via_cd973733db144020 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.CheckedRecordValueIndices.wideNatIndex _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_629d14b28988602cba2f4f16_refinement_0]
def f_lb_629d14b28988602cba2f4f16_refinement_0 (value : LbErased.CheckedRecordValueIndices.WideToken) : _root_.UInt8 :=
  match (LbErased.CheckedRecordValueIndices.WideToken.via_cd973733db144020 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_2ddd8644625ba5d077273f54]
def f_lb_2ddd8644625ba5d077273f54 (a0 : LbErased.CheckedRecordValueIndices.ZeroToken) : (_root_.Option _root_.Nat) :=
  match (LbErased.CheckedRecordValueIndices.ZeroToken.via_a1593fbc16b6437b (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.CheckedRecordValueIndices.zeroNatIndex _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_2ddd8644625ba5d077273f54_refinement_0]
def f_lb_2ddd8644625ba5d077273f54_refinement_0 (value : LbErased.CheckedRecordValueIndices.ZeroToken) : _root_.UInt8 :=
  match (LbErased.CheckedRecordValueIndices.ZeroToken.via_a1593fbc16b6437b (value)) with
  | .some _ => 1
  | .none => 0

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
