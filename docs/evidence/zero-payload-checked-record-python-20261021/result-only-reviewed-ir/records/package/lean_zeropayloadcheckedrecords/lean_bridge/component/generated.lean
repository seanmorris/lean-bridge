import ZeroPayloadCheckedRecords

namespace LeanBridgeNatived43d7c5a9f170f3c

structure LbErased.ZeroPayloadCheckedRecords.Witness where

def LbErased.ZeroPayloadCheckedRecords.Witness.erase (value : _root_.ZeroPayloadCheckedRecords.Witness) : LbErased.ZeroPayloadCheckedRecords.Witness :=
  LbErased.ZeroPayloadCheckedRecords.Witness.mk 

inductive LbErased.ZeroPayloadCheckedRecords.Mark where
  | «blank»  : LbErased.ZeroPayloadCheckedRecords.Mark
  | «marked» (a0 : LbErased.ZeroPayloadCheckedRecords.Witness) : LbErased.ZeroPayloadCheckedRecords.Mark

def LbErased.ZeroPayloadCheckedRecords.Mark.erase (value : _root_.ZeroPayloadCheckedRecords.Mark) : LbErased.ZeroPayloadCheckedRecords.Mark :=
  match value with
  | .«blank»  => LbErased.ZeroPayloadCheckedRecords.Mark.«blank» 
  | .«marked» a0 => LbErased.ZeroPayloadCheckedRecords.Mark.«marked» (LbErased.ZeroPayloadCheckedRecords.Witness.erase (a0))

structure LbErased.ZeroPayloadCheckedRecords.Token where
  «tag» : _root_.Unit

def LbErased.ZeroPayloadCheckedRecords.Token.erase (value : _root_.ZeroPayloadCheckedRecords.Token) : LbErased.ZeroPayloadCheckedRecords.Token :=
  LbErased.ZeroPayloadCheckedRecords.Token.mk value.«tag»

@[export lb_cde1a97bb44e62e5508a2ab3]
def f_lb_cde1a97bb44e62e5508a2ab3 (a0 : _root_.Bool) : (_root_.Option LbErased.ZeroPayloadCheckedRecords.Witness) :=
  (let _bridgeResult := _root_.ZeroPayloadCheckedRecords.maybeWitness a0; ((_bridgeResult).map (fun _bridgeValue0 => (LbErased.ZeroPayloadCheckedRecords.Witness.erase (_bridgeValue0)))))

@[export lb_3190b0fd601d06277d65cc15]
def f_lb_3190b0fd601d06277d65cc15 (a0 : _root_.Bool) : LbErased.ZeroPayloadCheckedRecords.Mark :=
  (let _bridgeResult := _root_.ZeroPayloadCheckedRecords.produceMark a0; (LbErased.ZeroPayloadCheckedRecords.Mark.erase (_bridgeResult)))

@[export lb_53d00d3f28c820ff014ddaab]
def f_lb_53d00d3f28c820ff014ddaab (_unit : _root_.Unit) : _root_.ZeroPayloadCheckedRecords.Marker :=
  _root_.ZeroPayloadCheckedRecords.produceMarker 

@[export lb_582f4605f271fe1a26173078]
def f_lb_582f4605f271fe1a26173078 (_unit : _root_.Unit) : LbErased.ZeroPayloadCheckedRecords.Token :=
  (let _bridgeResult := _root_.ZeroPayloadCheckedRecords.produceToken ; (LbErased.ZeroPayloadCheckedRecords.Token.erase (_bridgeResult)))

@[export lb_e28f59b3ac170ab2f8d671cf]
def f_lb_e28f59b3ac170ab2f8d671cf (_unit : _root_.Unit) : LbErased.ZeroPayloadCheckedRecords.Witness :=
  (let _bridgeResult := _root_.ZeroPayloadCheckedRecords.produceWitness ; (LbErased.ZeroPayloadCheckedRecords.Witness.erase (_bridgeResult)))

@[export lb_77f288f49ad4518952eca999]
def f_lb_77f288f49ad4518952eca999 (a0 : _root_.Nat) : (_root_.Array LbErased.ZeroPayloadCheckedRecords.Witness) :=
  (let _bridgeResult := _root_.ZeroPayloadCheckedRecords.witnesses a0; ((_bridgeResult).map (fun _bridgeValue0 => (LbErased.ZeroPayloadCheckedRecords.Witness.erase (_bridgeValue0)))))

@[export lb_t34d3e5dc58186a7e28fe_make]
def f_lb_t34d3e5dc58186a7e28fe_make (_unit : _root_.Unit) : LbErased.ZeroPayloadCheckedRecords.Witness :=
  LbErased.ZeroPayloadCheckedRecords.Witness.mk 

@[export lb_t69a9586cb343e910790a_none]
def f_lb_t69a9586cb343e910790a_none (_unit : _root_.Unit) : (_root_.Option LbErased.ZeroPayloadCheckedRecords.Witness) :=
  _root_.Option.none

@[export lb_t69a9586cb343e910790a_some]
def f_lb_t69a9586cb343e910790a_some (value : LbErased.ZeroPayloadCheckedRecords.Witness) : (_root_.Option LbErased.ZeroPayloadCheckedRecords.Witness) :=
  _root_.Option.some value

@[export lb_t69a9586cb343e910790a_has]
def f_lb_t69a9586cb343e910790a_has (value : (_root_.Option LbErased.ZeroPayloadCheckedRecords.Witness)) : _root_.Bool :=
  match value with | .none => false | .some _ => true

@[export lb_t69a9586cb343e910790a_get0]
def f_lb_t69a9586cb343e910790a_get0 (value : (_root_.Option LbErased.ZeroPayloadCheckedRecords.Witness)) : LbErased.ZeroPayloadCheckedRecords.Witness :=
  match value with | .none => (LbErased.ZeroPayloadCheckedRecords.Witness.mk ) | .some item => item

@[export lb_tfb04270e7e168afb2516_tag]
def f_lb_tfb04270e7e168afb2516_tag (value : LbErased.ZeroPayloadCheckedRecords.Mark) : _root_.UInt32 :=
  match value with | .blank  => 0 | .marked _ => 1

@[export lb_tfb04270e7e168afb2516_make0]
def f_lb_tfb04270e7e168afb2516_make0 (_unit : _root_.Unit) : LbErased.ZeroPayloadCheckedRecords.Mark :=
  LbErased.ZeroPayloadCheckedRecords.Mark.«blank» 

@[export lb_tfb04270e7e168afb2516_make1]
def f_lb_tfb04270e7e168afb2516_make1 (a0 : LbErased.ZeroPayloadCheckedRecords.Witness) : LbErased.ZeroPayloadCheckedRecords.Mark :=
  LbErased.ZeroPayloadCheckedRecords.Mark.«marked» a0

@[export lb_tfb04270e7e168afb2516_get1_0]
def f_lb_tfb04270e7e168afb2516_get1_0 (value : LbErased.ZeroPayloadCheckedRecords.Mark) : LbErased.ZeroPayloadCheckedRecords.Witness :=
  match value with | .marked item => item | _ => (LbErased.ZeroPayloadCheckedRecords.Witness.mk )

@[export lb_tc0930e24985d380f1be0_make]
def f_lb_tc0930e24985d380f1be0_make (_unit : _root_.Unit) : _root_.ZeroPayloadCheckedRecords.Marker :=
  _root_.ZeroPayloadCheckedRecords.Marker.mk 

@[export lb_t57b6486affb0e5f49fdf_make]
def f_lb_t57b6486affb0e5f49fdf_make (a0 : _root_.Unit) : LbErased.ZeroPayloadCheckedRecords.Token :=
  LbErased.ZeroPayloadCheckedRecords.Token.mk a0

@[export lb_t57b6486affb0e5f49fdf_get0]
def f_lb_t57b6486affb0e5f49fdf_get0 (value : LbErased.ZeroPayloadCheckedRecords.Token) : _root_.Unit :=
  value.«tag»

@[export lb_native_nat_text]
def f_lb_native_nat_text (value : _root_.Nat) : _root_.String :=
  _root_.Nat.repr value

@[export lb_native_int_text]
def f_lb_native_int_text (value : _root_.Int) : _root_.String :=
  _root_.Int.repr value

@[export lb_native_int_parse]
def f_lb_native_int_parse (value : _root_.String) : _root_.Int :=
  _root_.String.toInt! value

end LeanBridgeNatived43d7c5a9f170f3c
