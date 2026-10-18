import InheritedCheckedRecords

namespace LeanBridgeNative95491bb762dabafa

structure LbErased.InheritedCheckedRecords.Span where
  «lo» : _root_.Nat
  «hi» : _root_.Nat

def LbErased.InheritedCheckedRecords.Span.erase (value : _root_.InheritedCheckedRecords.Span) : LbErased.InheritedCheckedRecords.Span :=
  LbErased.InheritedCheckedRecords.Span.mk (value.«lo») (value.«hi»)

structure LbErased.InheritedCheckedRecords.Ticket where
  «toSpan» : LbErased.InheritedCheckedRecords.Span
  «word» : _root_.Nat

def LbErased.InheritedCheckedRecords.Ticket.erase (value : _root_.InheritedCheckedRecords.Ticket) : LbErased.InheritedCheckedRecords.Ticket :=
  LbErased.InheritedCheckedRecords.Ticket.mk (LbErased.InheritedCheckedRecords.Span.erase (value.«toSpan»)) (value.«word»).val

structure LbErased.InheritedCheckedRecords.Stamped where
  «toTicket» : LbErased.InheritedCheckedRecords.Ticket
  «mark» : _root_.Nat

def LbErased.InheritedCheckedRecords.Stamped.erase (value : _root_.InheritedCheckedRecords.Stamped) : LbErased.InheritedCheckedRecords.Stamped :=
  LbErased.InheritedCheckedRecords.Stamped.mk (LbErased.InheritedCheckedRecords.Ticket.erase (value.«toTicket»)) (value.«mark»).val

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
