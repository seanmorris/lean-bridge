import NominalSubtypes

namespace LeanBridgeNative7f8bfe55e5831a91

structure LbErased.NominalSubtypes.Envelope where
  «payload» : _root_.Nat
  «digit» : _root_.Nat

def LbErased.NominalSubtypes.Envelope.erase (value : _root_.NominalSubtypes.Envelope) : LbErased.NominalSubtypes.Envelope :=
  LbErased.NominalSubtypes.Envelope.mk (value.«payload»).val (value.«digit»).val

inductive LbErased.NominalSubtypes.Event where
  | «empty»  : LbErased.NominalSubtypes.Event
  | «box» (a0 : LbErased.NominalSubtypes.Envelope) : LbErased.NominalSubtypes.Event
  | «choices» (a0 : (_root_.Array (_root_.Option (_root_.Except _root_.Nat _root_.Nat)))) : LbErased.NominalSubtypes.Event

def LbErased.NominalSubtypes.Event.erase (value : _root_.NominalSubtypes.Event) : LbErased.NominalSubtypes.Event :=
  match value with
  | .«empty»  => LbErased.NominalSubtypes.Event.«empty» 
  | .«box» a0 => LbErased.NominalSubtypes.Event.«box» (LbErased.NominalSubtypes.Envelope.erase (a0))
  | .«choices» a0 => LbErased.NominalSubtypes.Event.«choices» ((a0).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (match (_bridgeValue1) with | _root_.Except.ok _bridgeValue2 => .ok (_bridgeValue2).val | _root_.Except.error _bridgeValue2 => .error (_bridgeValue2).val)))))

structure LbErased.NominalSubtypes.AliasPair where
  «left» : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope))
  «right» : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope))

def LbErased.NominalSubtypes.AliasPair.erase (value : _root_.NominalSubtypes.AliasPair) : LbErased.NominalSubtypes.AliasPair :=
  LbErased.NominalSubtypes.AliasPair.mk ((value.«left»).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (LbErased.NominalSubtypes.Envelope.erase (_bridgeValue1)))))) ((value.«right»).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (LbErased.NominalSubtypes.Envelope.erase (_bridgeValue1))))))

@[export lb_e6117b4a2c058276486949a3]
def f_lb_e6117b4a2c058276486949a3 (a0 : _root_.Nat) : (_root_.Array _root_.Nat) :=
  (let _bridgeResult := _root_.NominalSubtypes.arrayValues a0; ((_bridgeResult).map (fun _bridgeValue0 => (_bridgeValue0).val)))

@[export lb_c68be1e1f84c99c070a44992]
def f_lb_c68be1e1f84c99c070a44992 (a0 : _root_.Nat) : (_root_.Except _root_.Nat _root_.Nat) :=
  (let _bridgeResult := _root_.NominalSubtypes.branch a0; (match (_bridgeResult) with | _root_.Except.ok _bridgeValue0 => .ok (_bridgeValue0).val | _root_.Except.error _bridgeValue0 => .error (_bridgeValue0).val))

@[export lb_d8df7ac2dfbfe3b3b1460c5f]
def f_lb_d8df7ac2dfbfe3b3b1460c5f (a0 : _root_.Nat) : LbErased.NominalSubtypes.Event :=
  (let _bridgeResult := _root_.NominalSubtypes.eventChoices a0; (LbErased.NominalSubtypes.Event.erase (_bridgeResult)))

@[export lb_d4cfd58d7ddb8560ef50dc52]
def f_lb_d4cfd58d7ddb8560ef50dc52 (a0 : _root_.Nat) : LbErased.NominalSubtypes.Event :=
  (let _bridgeResult := _root_.NominalSubtypes.eventEmpty a0; (LbErased.NominalSubtypes.Event.erase (_bridgeResult)))

@[export lb_90cdba474b79f516c0b52978]
def f_lb_90cdba474b79f516c0b52978 (a0 : _root_.Nat) : LbErased.NominalSubtypes.Event :=
  (let _bridgeResult := _root_.NominalSubtypes.eventValue a0; (LbErased.NominalSubtypes.Event.erase (_bridgeResult)))

@[export lb_fe0216c702a5ebbfe74fc560]
def f_lb_fe0216c702a5ebbfe74fc560 (a0 : _root_.Nat) : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope)) :=
  (let _bridgeResult := _root_.NominalSubtypes.groupValues a0; ((_bridgeResult).map (fun _bridgeValue0 => ((_bridgeValue0).map (fun _bridgeValue1 => (LbErased.NominalSubtypes.Envelope.erase (_bridgeValue1)))))))

@[export lb_30775f99f7ee1962ca940d1a]
def f_lb_30775f99f7ee1962ca940d1a (a0 : _root_.Nat) : (_root_.List _root_.Nat) :=
  (let _bridgeResult := _root_.NominalSubtypes.listValues a0; ((_bridgeResult).map (fun _bridgeValue0 => (_bridgeValue0).val)))

@[export lb_fb21161d65be28d916dcac41]
def f_lb_fb21161d65be28d916dcac41 (a0 : _root_.Nat) : (_root_.Array _root_.Nat) :=
  (let _bridgeResult := _root_.NominalSubtypes.noItems a0; ((_bridgeResult).map (fun _bridgeValue0 => (_bridgeValue0).val)))

@[export lb_9686ecc5fe69d4a6438a0e6a]
def f_lb_9686ecc5fe69d4a6438a0e6a (a0 : _root_.Nat) : (_root_.Option _root_.Nat) :=
  (let _bridgeResult := _root_.NominalSubtypes.optional a0; ((_bridgeResult).map (fun _bridgeValue0 => (_bridgeValue0).val)))

@[export lb_0fffaedb5541aceb2b121d97]
def f_lb_0fffaedb5541aceb2b121d97 (a0 : _root_.Nat) : LbErased.NominalSubtypes.AliasPair :=
  (let _bridgeResult := _root_.NominalSubtypes.pairValues a0; (LbErased.NominalSubtypes.AliasPair.erase (_bridgeResult)))

@[export lb_1675ed3831b1403640f61957]
def f_lb_1675ed3831b1403640f61957 (a0 : _root_.Nat) : LbErased.NominalSubtypes.Envelope :=
  (let _bridgeResult := _root_.NominalSubtypes.produceEnvelope a0; (LbErased.NominalSubtypes.Envelope.erase (_bridgeResult)))

@[export lb_bb98c244bdedfd3d9997d34a]
def f_lb_bb98c244bdedfd3d9997d34a (a0 : _root_.Nat) : (_root_.Prod _root_.Nat _root_.Nat) :=
  (let _bridgeResult := _root_.NominalSubtypes.product a0; (((_bridgeResult).fst).val, ((_bridgeResult).snd).val))

@[export lb_a90151ccf6e7f9af5767c444]
def f_lb_a90151ccf6e7f9af5767c444 (a0 : _root_.Nat) : _root_.Nat :=
  (_root_.NominalSubtypes.scalar a0).val

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

@[export lb_t90fc0814fb0968a90151_make]
def f_lb_t90fc0814fb0968a90151_make (a0 : _root_.Nat) (a1 : _root_.Nat) : LbErased.NominalSubtypes.Envelope :=
  LbErased.NominalSubtypes.Envelope.mk a0 a1

@[export lb_t90fc0814fb0968a90151_get0]
def f_lb_t90fc0814fb0968a90151_get0 (value : LbErased.NominalSubtypes.Envelope) : _root_.Nat :=
  value.«payload»

@[export lb_t90fc0814fb0968a90151_get1]
def f_lb_t90fc0814fb0968a90151_get1 (value : LbErased.NominalSubtypes.Envelope) : _root_.Nat :=
  value.«digit»

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

@[export lb_t088895fe25b27367c934_make]
def f_lb_t088895fe25b27367c934_make (a0 : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope))) (a1 : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope))) : LbErased.NominalSubtypes.AliasPair :=
  LbErased.NominalSubtypes.AliasPair.mk a0 a1

@[export lb_t088895fe25b27367c934_get0]
def f_lb_t088895fe25b27367c934_get0 (value : LbErased.NominalSubtypes.AliasPair) : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope)) :=
  value.«left»

@[export lb_t088895fe25b27367c934_get1]
def f_lb_t088895fe25b27367c934_get1 (value : LbErased.NominalSubtypes.AliasPair) : (_root_.Array (_root_.Option LbErased.NominalSubtypes.Envelope)) :=
  value.«right»

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
