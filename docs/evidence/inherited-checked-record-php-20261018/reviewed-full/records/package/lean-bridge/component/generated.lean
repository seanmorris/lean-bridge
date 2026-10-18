import InheritedCheckedRecords

namespace LeanBridgeNative95491bb762dabafa

structure LbErased.InheritedCheckedRecords.Span where
  «lo» : _root_.Nat
  «hi» : _root_.Nat

def LbErased.InheritedCheckedRecords.Span.erase (value : _root_.InheritedCheckedRecords.Span) : LbErased.InheritedCheckedRecords.Span :=
  LbErased.InheritedCheckedRecords.Span.mk (value.«lo») (value.«hi»)

def LbErased.InheritedCheckedRecords.Span.via_7befbd112ae3b1ee (value : LbErased.InheritedCheckedRecords.Span) : _root_.Option _root_.InheritedCheckedRecords.Span := do
  let a0 ← (_root_.Option.some (value.«lo»))
  let a1 ← (_root_.Option.some (value.«hi»))
  _root_.InheritedCheckedRecords.mkSpan a0 a1

def LbErased.InheritedCheckedRecords.Span.via_e9ab10688382c7e1 (value : LbErased.InheritedCheckedRecords.Span) : _root_.Option _root_.InheritedCheckedRecords.Span := do
  let a0 ← (_root_.Option.some (value.«lo»))
  let a1 ← (_root_.Option.some (value.«hi»))
  _root_.InheritedCheckedRecords.normalizeSpan a0 a1

structure LbErased.InheritedCheckedRecords.Ticket where
  «toSpan» : LbErased.InheritedCheckedRecords.Span
  «word» : _root_.Nat

def LbErased.InheritedCheckedRecords.Ticket.erase (value : _root_.InheritedCheckedRecords.Ticket) : LbErased.InheritedCheckedRecords.Ticket :=
  LbErased.InheritedCheckedRecords.Ticket.mk (LbErased.InheritedCheckedRecords.Span.erase (value.«toSpan»)) (value.«word»).val

def LbErased.InheritedCheckedRecords.Ticket.via_058f318f16587344 (value : LbErased.InheritedCheckedRecords.Ticket) : _root_.Option _root_.InheritedCheckedRecords.Ticket := do
  let a0 ← (LbErased.InheritedCheckedRecords.Span.via_7befbd112ae3b1ee (value.«toSpan»))
  let a1 ← _root_.InheritedCheckedRecords.normalizeWord value.«word»
  _root_.InheritedCheckedRecords.normalizeTicket a0 a1

def LbErased.InheritedCheckedRecords.Ticket.via_3e3e46f28446fb88 (value : LbErased.InheritedCheckedRecords.Ticket) : _root_.Option _root_.InheritedCheckedRecords.Ticket := do
  let a0 ← (LbErased.InheritedCheckedRecords.Span.via_e9ab10688382c7e1 (value.«toSpan»))
  let a1 ← _root_.InheritedCheckedRecords.normalizeWord value.«word»
  _root_.InheritedCheckedRecords.mkTicket a0 a1

def LbErased.InheritedCheckedRecords.Ticket.via_46258f70859fe9f7 (value : LbErased.InheritedCheckedRecords.Ticket) : _root_.Option _root_.InheritedCheckedRecords.Ticket := do
  let a0 ← (LbErased.InheritedCheckedRecords.Span.via_e9ab10688382c7e1 (value.«toSpan»))
  let a1 ← _root_.InheritedCheckedRecords.normalizeWord value.«word»
  _root_.InheritedCheckedRecords.normalizeTicket a0 a1

def LbErased.InheritedCheckedRecords.Ticket.via_c6939ca082a238a0 (value : LbErased.InheritedCheckedRecords.Ticket) : _root_.Option _root_.InheritedCheckedRecords.Ticket := do
  let a0 ← (LbErased.InheritedCheckedRecords.Span.via_7befbd112ae3b1ee (value.«toSpan»))
  let a1 ← _root_.InheritedCheckedRecords.mkWord value.«word»
  _root_.InheritedCheckedRecords.mkTicket a0 a1

structure LbErased.InheritedCheckedRecords.Stamped where
  «toTicket» : LbErased.InheritedCheckedRecords.Ticket
  «mark» : _root_.Nat

def LbErased.InheritedCheckedRecords.Stamped.erase (value : _root_.InheritedCheckedRecords.Stamped) : LbErased.InheritedCheckedRecords.Stamped :=
  LbErased.InheritedCheckedRecords.Stamped.mk (LbErased.InheritedCheckedRecords.Ticket.erase (value.«toTicket»)) (value.«mark»).val

def LbErased.InheritedCheckedRecords.Stamped.via_fb549b4f4c9fa6f7 (value : LbErased.InheritedCheckedRecords.Stamped) : _root_.Option _root_.InheritedCheckedRecords.Stamped := do
  let a0 ← (LbErased.InheritedCheckedRecords.Ticket.via_c6939ca082a238a0 (value.«toTicket»))
  let a1 ← (if proof : (value.«mark») < 8 then _root_.Option.some (⟨(value.«mark»), proof⟩ : _root_.Fin 8) else _root_.Option.none)
  _root_.InheritedCheckedRecords.mkStamped a0 a1

@[export lb_25ec12ca230f337209516eb6]
def f_lb_25ec12ca230f337209516eb6 (a0 : LbErased.InheritedCheckedRecords.Ticket) : (_root_.Option _root_.Nat) :=
  match (LbErased.InheritedCheckedRecords.Ticket.via_3e3e46f28446fb88 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.InheritedCheckedRecords.aliased _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_25ec12ca230f337209516eb6_refinement_0_0]
def f_lb_25ec12ca230f337209516eb6_refinement_0_0 (value : LbErased.InheritedCheckedRecords.Span) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Span.via_e9ab10688382c7e1 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_25ec12ca230f337209516eb6_refinement_0_1]
def f_lb_25ec12ca230f337209516eb6_refinement_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.InheritedCheckedRecords.normalizeWord value with
  | .some _ => 1
  | .none => 0

@[export lb_25ec12ca230f337209516eb6_refinement_0]
def f_lb_25ec12ca230f337209516eb6_refinement_0 (value : LbErased.InheritedCheckedRecords.Ticket) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Ticket.via_3e3e46f28446fb88 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_ca5a38c02117fc35832e2681]
def f_lb_ca5a38c02117fc35832e2681 (a0 : LbErased.InheritedCheckedRecords.Ticket) : (_root_.Option LbErased.InheritedCheckedRecords.Ticket) :=
  match (LbErased.InheritedCheckedRecords.Ticket.via_058f318f16587344 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some ((let _bridgeResult := _root_.InheritedCheckedRecords.echo _bridgeSubtype0; (LbErased.InheritedCheckedRecords.Ticket.erase (_bridgeResult))))
  | .none =>
    _root_.Option.none

@[export lb_ca5a38c02117fc35832e2681_refinement_0_0]
def f_lb_ca5a38c02117fc35832e2681_refinement_0_0 (value : LbErased.InheritedCheckedRecords.Span) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Span.via_7befbd112ae3b1ee (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_ca5a38c02117fc35832e2681_refinement_0_1]
def f_lb_ca5a38c02117fc35832e2681_refinement_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.InheritedCheckedRecords.normalizeWord value with
  | .some _ => 1
  | .none => 0

@[export lb_ca5a38c02117fc35832e2681_refinement_0]
def f_lb_ca5a38c02117fc35832e2681_refinement_0 (value : LbErased.InheritedCheckedRecords.Ticket) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Ticket.via_058f318f16587344 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_5fa0650d7e3d0ca3c50c17e8]
def f_lb_5fa0650d7e3d0ca3c50c17e8 (a0 : LbErased.InheritedCheckedRecords.Ticket) : (_root_.Option _root_.Nat) :=
  match (LbErased.InheritedCheckedRecords.Ticket.via_c6939ca082a238a0 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.InheritedCheckedRecords.first _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_5fa0650d7e3d0ca3c50c17e8_refinement_0_0]
def f_lb_5fa0650d7e3d0ca3c50c17e8_refinement_0_0 (value : LbErased.InheritedCheckedRecords.Span) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Span.via_7befbd112ae3b1ee (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_5fa0650d7e3d0ca3c50c17e8_refinement_0_1]
def f_lb_5fa0650d7e3d0ca3c50c17e8_refinement_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.InheritedCheckedRecords.mkWord value with
  | .some _ => 1
  | .none => 0

@[export lb_5fa0650d7e3d0ca3c50c17e8_refinement_0]
def f_lb_5fa0650d7e3d0ca3c50c17e8_refinement_0 (value : LbErased.InheritedCheckedRecords.Ticket) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Ticket.via_c6939ca082a238a0 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_bb0100828f9f9e7c08651f56]
def f_lb_bb0100828f9f9e7c08651f56 (a0 : LbErased.InheritedCheckedRecords.Stamped) : (_root_.Option _root_.Nat) :=
  match (LbErased.InheritedCheckedRecords.Stamped.via_fb549b4f4c9fa6f7 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.InheritedCheckedRecords.nested _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_bb0100828f9f9e7c08651f56_refinement_0_0_0]
def f_lb_bb0100828f9f9e7c08651f56_refinement_0_0_0 (value : LbErased.InheritedCheckedRecords.Span) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Span.via_7befbd112ae3b1ee (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_bb0100828f9f9e7c08651f56_refinement_0_0_1]
def f_lb_bb0100828f9f9e7c08651f56_refinement_0_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.InheritedCheckedRecords.mkWord value with
  | .some _ => 1
  | .none => 0

@[export lb_bb0100828f9f9e7c08651f56_refinement_0_0]
def f_lb_bb0100828f9f9e7c08651f56_refinement_0_0 (value : LbErased.InheritedCheckedRecords.Ticket) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Ticket.via_c6939ca082a238a0 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_bb0100828f9f9e7c08651f56_refinement_0]
def f_lb_bb0100828f9f9e7c08651f56_refinement_0 (value : LbErased.InheritedCheckedRecords.Stamped) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Stamped.via_fb549b4f4c9fa6f7 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_309707c4324df1d6adbb987d]
def f_lb_309707c4324df1d6adbb987d (a0 : LbErased.InheritedCheckedRecords.Ticket) : (_root_.Option _root_.Nat) :=
  match (LbErased.InheritedCheckedRecords.Ticket.via_46258f70859fe9f7 (a0)) with
  | .some _bridgeSubtype0 =>
    _root_.Option.some (_root_.InheritedCheckedRecords.normalized _bridgeSubtype0)
  | .none =>
    _root_.Option.none

@[export lb_309707c4324df1d6adbb987d_refinement_0_0]
def f_lb_309707c4324df1d6adbb987d_refinement_0_0 (value : LbErased.InheritedCheckedRecords.Span) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Span.via_e9ab10688382c7e1 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_309707c4324df1d6adbb987d_refinement_0_1]
def f_lb_309707c4324df1d6adbb987d_refinement_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.InheritedCheckedRecords.normalizeWord value with
  | .some _ => 1
  | .none => 0

@[export lb_309707c4324df1d6adbb987d_refinement_0]
def f_lb_309707c4324df1d6adbb987d_refinement_0 (value : LbErased.InheritedCheckedRecords.Ticket) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Ticket.via_46258f70859fe9f7 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_289ea54556c6c6f756c13add]
def f_lb_289ea54556c6c6f756c13add (a0 : LbErased.InheritedCheckedRecords.Ticket) (a1 : LbErased.InheritedCheckedRecords.Ticket) : (_root_.Option _root_.Nat) :=
  match (LbErased.InheritedCheckedRecords.Ticket.via_c6939ca082a238a0 (a0)) with
  | .some _bridgeSubtype0 =>
    match (LbErased.InheritedCheckedRecords.Ticket.via_46258f70859fe9f7 (a1)) with
    | .some _bridgeSubtype1 =>
      _root_.Option.some (_root_.InheritedCheckedRecords.pair _bridgeSubtype0 _bridgeSubtype1)
    | .none =>
      _root_.Option.none
  | .none =>
    _root_.Option.none

@[export lb_289ea54556c6c6f756c13add_refinement_0_0]
def f_lb_289ea54556c6c6f756c13add_refinement_0_0 (value : LbErased.InheritedCheckedRecords.Span) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Span.via_7befbd112ae3b1ee (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_289ea54556c6c6f756c13add_refinement_0_1]
def f_lb_289ea54556c6c6f756c13add_refinement_0_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.InheritedCheckedRecords.mkWord value with
  | .some _ => 1
  | .none => 0

@[export lb_289ea54556c6c6f756c13add_refinement_0]
def f_lb_289ea54556c6c6f756c13add_refinement_0 (value : LbErased.InheritedCheckedRecords.Ticket) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Ticket.via_c6939ca082a238a0 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_289ea54556c6c6f756c13add_refinement_1_0]
def f_lb_289ea54556c6c6f756c13add_refinement_1_0 (value : LbErased.InheritedCheckedRecords.Span) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Span.via_e9ab10688382c7e1 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_289ea54556c6c6f756c13add_refinement_1_1]
def f_lb_289ea54556c6c6f756c13add_refinement_1_1 (value : _root_.Nat) : _root_.UInt8 :=
  match _root_.InheritedCheckedRecords.normalizeWord value with
  | .some _ => 1
  | .none => 0

@[export lb_289ea54556c6c6f756c13add_refinement_1]
def f_lb_289ea54556c6c6f756c13add_refinement_1 (value : LbErased.InheritedCheckedRecords.Ticket) : _root_.UInt8 :=
  match (LbErased.InheritedCheckedRecords.Ticket.via_46258f70859fe9f7 (value)) with
  | .some _ => 1
  | .none => 0

@[export lb_75e550af993806c790a65617]
def f_lb_75e550af993806c790a65617 (a0 : _root_.Nat) : LbErased.InheritedCheckedRecords.Ticket :=
  (let _bridgeResult := _root_.InheritedCheckedRecords.produce a0; (LbErased.InheritedCheckedRecords.Ticket.erase (_bridgeResult)))

@[export lb_2df70568191c40dd3c853dbc]
def f_lb_2df70568191c40dd3c853dbc (a0 : _root_.Nat) : LbErased.InheritedCheckedRecords.Stamped :=
  (let _bridgeResult := _root_.InheritedCheckedRecords.produceStamped a0; (LbErased.InheritedCheckedRecords.Stamped.erase (_bridgeResult)))

@[export lb_t2d191276e712f8e90a64_make]
def f_lb_t2d191276e712f8e90a64_make (a0 : _root_.Nat) (a1 : _root_.Nat) : LbErased.InheritedCheckedRecords.Span :=
  LbErased.InheritedCheckedRecords.Span.mk a0 a1

@[export lb_t2d191276e712f8e90a64_get0]
def f_lb_t2d191276e712f8e90a64_get0 (value : LbErased.InheritedCheckedRecords.Span) : _root_.Nat :=
  value.«lo»

@[export lb_t2d191276e712f8e90a64_get1]
def f_lb_t2d191276e712f8e90a64_get1 (value : LbErased.InheritedCheckedRecords.Span) : _root_.Nat :=
  value.«hi»

@[export lb_t315853af6092a0b959d6_make]
def f_lb_t315853af6092a0b959d6_make (a0 : LbErased.InheritedCheckedRecords.Span) (a1 : _root_.Nat) : LbErased.InheritedCheckedRecords.Ticket :=
  LbErased.InheritedCheckedRecords.Ticket.mk a0 a1

@[export lb_t315853af6092a0b959d6_get0]
def f_lb_t315853af6092a0b959d6_get0 (value : LbErased.InheritedCheckedRecords.Ticket) : LbErased.InheritedCheckedRecords.Span :=
  value.«toSpan»

@[export lb_t315853af6092a0b959d6_get1]
def f_lb_t315853af6092a0b959d6_get1 (value : LbErased.InheritedCheckedRecords.Ticket) : _root_.Nat :=
  value.«word»

@[export lb_t883791d3e6bd215ec557_make]
def f_lb_t883791d3e6bd215ec557_make (a0 : LbErased.InheritedCheckedRecords.Ticket) (a1 : _root_.Nat) : LbErased.InheritedCheckedRecords.Stamped :=
  LbErased.InheritedCheckedRecords.Stamped.mk a0 a1

@[export lb_t883791d3e6bd215ec557_get0]
def f_lb_t883791d3e6bd215ec557_get0 (value : LbErased.InheritedCheckedRecords.Stamped) : LbErased.InheritedCheckedRecords.Ticket :=
  value.«toTicket»

@[export lb_t883791d3e6bd215ec557_get1]
def f_lb_t883791d3e6bd215ec557_get1 (value : LbErased.InheritedCheckedRecords.Stamped) : _root_.Nat :=
  value.«mark»

@[export lb_native_nat_text]
def f_lb_native_nat_text (value : _root_.Nat) : _root_.String :=
  _root_.Nat.repr value

@[export lb_native_int_text]
def f_lb_native_int_text (value : _root_.Int) : _root_.String :=
  _root_.Int.repr value

@[export lb_native_int_parse]
def f_lb_native_int_parse (value : _root_.String) : _root_.Int :=
  _root_.String.toInt! value

end LeanBridgeNative95491bb762dabafa
