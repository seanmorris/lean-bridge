import RecursiveCheckedRecords
set_option maxRecDepth 10000
namespace LeanBridgeNativea1d30b9a0f384ed5
structure LbErased.RecursiveCheckedRecords.Packet where
  «value» : _root_.Nat
  «digit» : _root_.Nat
  «tail» : (_root_.Option LbErased.RecursiveCheckedRecords.Packet)

def LbErased.RecursiveCheckedRecords.Packet.erase (value : _root_.RecursiveCheckedRecords.Packet) : LbErased.RecursiveCheckedRecords.Packet :=
  match value with
  | { «value» := a0, «digit» := a1, «tail» := a2, .. } => LbErased.RecursiveCheckedRecords.Packet.mk (a0).val (a1).val (match (a2) with | _root_.Option.none => _root_.Option.none | _root_.Option.some _bridgeValue0 => _root_.Option.some (LbErased.RecursiveCheckedRecords.Packet.erase (_bridgeValue0)))

def LbErased.RecursiveCheckedRecords.Packet.via_5b2d9cecaeed7529 (value : LbErased.RecursiveCheckedRecords.Packet) : _root_.Option _root_.RecursiveCheckedRecords.Packet :=
  match value with
  | ⟨a0, a1, a2⟩ => do
    let b0 ← _root_.RecursiveCheckedRecords.plusTwo a0
    let b1 ← (if proof : (a1) < 3 then _root_.Option.some (⟨(a1), proof⟩ : _root_.Fin 3) else _root_.Option.none)
    let b2 ← (match (a2) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue0 => ((LbErased.RecursiveCheckedRecords.Packet.via_5b2d9cecaeed7529 (_bridgeValue0))).map _root_.Option.some)
    _root_.RecursiveCheckedRecords.normalizePacket b0 b1 b2

def LbErased.RecursiveCheckedRecords.Packet.via_738d92def9c0ab42 (value : LbErased.RecursiveCheckedRecords.Packet) : _root_.Option _root_.RecursiveCheckedRecords.Packet :=
  match value with
  | ⟨a0, a1, a2⟩ => do
    let b0 ← _root_.RecursiveCheckedRecords.plusOne a0
    let b1 ← (if proof : (a1) < 3 then _root_.Option.some (⟨(a1), proof⟩ : _root_.Fin 3) else _root_.Option.none)
    let b2 ← (match (a2) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue0 => ((LbErased.RecursiveCheckedRecords.Packet.via_738d92def9c0ab42 (_bridgeValue0))).map _root_.Option.some)
    _root_.RecursiveCheckedRecords.mkPacket b0 b1 b2

def LbErased.RecursiveCheckedRecords.Packet.validFin (value : LbErased.RecursiveCheckedRecords.Packet) : _root_.Bool :=
  match value with
  | ⟨_bridgeFinField0, _bridgeFinField1, _bridgeFinField2⟩ => (decide ((_bridgeFinField1) < 3)) && (match (_bridgeFinField2) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue0 => (LbErased.RecursiveCheckedRecords.Packet.validFin (_bridgeFinValue0)))

def carrierValue {α : Type} (value : _root_.Array α) : _root_.Option α :=
  if bound : 0 < value.size then
    if value.size == 1 then .some (value[0]'bound) else .none
  else .none

def carrierResult {α : Type} (value : _root_.Option α) : _root_.Array α :=
  match value with | .none => #[] | .some result => #[result]

def carrierCollect {α : Type} (values : _root_.Array (_root_.Array α)) : _root_.Option (_root_.Array α) := Id.run do
  if values.size > 262144 then return .none
  let mut result := #[]
  for value in values do
    match carrierValue value with
    | .none => return .none
    | .some item => result := result.push item
  return .some result

def carrierListItems {α : Type} (values : _root_.List α) : _root_.Array (_root_.Array α) :=
  let rec loop : _root_.Nat → _root_.List α → _root_.Array (_root_.Array α) → _root_.Array (_root_.Array α)
    | 0, _, acc => acc
    | _, [], acc => acc
    | fuel + 1, head :: tail, acc => loop fuel tail (acc.push #[head])
  loop 262145 values #[]

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_make]
def make3cdb6e7435d0b988c5ab (a0 : (_root_.Array _root_.Nat)) (a1 : (_root_.Array _root_.Nat)) (a2 : (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet))) : (_root_.Array LbErased.RecursiveCheckedRecords.Packet) :=
  carrierResult (do
    let a0 ← carrierValue a0
    let a1 ← carrierValue a1
    let a2 ← carrierValue a2
    pure (({ «value» := a0, «digit» := a1, «tail» := a2 } : LbErased.RecursiveCheckedRecords.Packet))
  )

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field0]
def field03cdb6e7435d0b988c5ab (value : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : (_root_.Array _root_.Nat) :=
  carrierResult (do
    let value ← carrierValue value
    pure value.«value»
  )

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field1]
def field13cdb6e7435d0b988c5ab (value : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : (_root_.Array _root_.Nat) :=
  carrierResult (do
    let value ← carrierValue value
    pure value.«digit»
  )

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field2]
def field23cdb6e7435d0b988c5ab (value : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet)) :=
  carrierResult (do
    let value ← carrierValue value
    pure value.«tail»
  )

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_796129d6f57eb5b14908_branch]
def branch796129d6f57eb5b14908 (value : (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet))) : _root_.UInt32 :=
  match carrierValue value with
  | .none => 4294967295
  | .some value =>
    match value with
    | .none => 0
    | .some _ => 1

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_796129d6f57eb5b14908_none]
def none796129d6f57eb5b14908 (_bridgeUnit : _root_.Unit) : (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet)) :=
  carrierResult (do
    pure (.none)
  )

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_796129d6f57eb5b14908_make0]
def make0796129d6f57eb5b14908 (a0 : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet)) :=
  carrierResult (do
    let a0 ← carrierValue a0
    pure (.some a0)
  )

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_796129d6f57eb5b14908_field0]
def field0796129d6f57eb5b14908 (value : (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet))) : (_root_.Array LbErased.RecursiveCheckedRecords.Packet) :=
  carrierResult (do
    let value ← carrierValue value
    match value with
    | .some child => pure child
    | _ => .none
  )

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_1ee7f471296218fa6414_make]
def make1ee7f471296218fa6414 (values : _root_.Array (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet))) : (_root_.Array (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet))) :=
  carrierResult (do
    let values ← carrierCollect values
    pure values
  )

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_1ee7f471296218fa6414_items]
def items1ee7f471296218fa6414 (value : (_root_.Array (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet)))) : (_root_.Array (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet))) :=
  match carrierValue value with
  | .none => #[]
  | .some values => (values.extract 0 262145).map (fun child => #[child])

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_branch]
def branch30b9cb19321dad5070fa (value : (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet))) : _root_.UInt32 :=
  match carrierValue value with
  | .none => 4294967295
  | .some value =>
    match value with
    | .none => 0
    | .some _ => 1

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_none]
def none30b9cb19321dad5070fa (_bridgeUnit : _root_.Unit) : (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet)) :=
  carrierResult (do
    pure (.none)
  )

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_make0]
def make030b9cb19321dad5070fa (a0 : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet)) :=
  carrierResult (do
    let a0 ← carrierValue a0
    pure (.some a0)
  )

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_field0]
def field030b9cb19321dad5070fa (value : (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet))) : (_root_.Array LbErased.RecursiveCheckedRecords.Packet) :=
  carrierResult (do
    let value ← carrierValue value
    match value with
    | .some child => pure child
    | _ => .none
  )

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_adc23788b11cdeb3b9ab_make]
def makeadc23788b11cdeb3b9ab (a0 : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : (_root_.Array LbErased.RecursiveCheckedRecords.Packet) :=
  carrierResult (do
    let a0 ← carrierValue a0
    pure (a0)
  )

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_adc23788b11cdeb3b9ab_field0]
def field0adc23788b11cdeb3b9ab (value : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : (_root_.Array LbErased.RecursiveCheckedRecords.Packet) :=
  carrierResult (do
    let value ← carrierValue value
    pure value
  )

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_fin_guard_0]
def export0_fin_guard_0 (carrier : _root_.Array LbErased.RecursiveCheckedRecords.Packet) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some _bridgeValue =>
    if (LbErased.RecursiveCheckedRecords.Packet.validFin (_bridgeValue)) then 1 else 0

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_refinement_0]
def export0_refinement_0 (carrier : _root_.Array LbErased.RecursiveCheckedRecords.Packet) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    if (LbErased.RecursiveCheckedRecords.Packet.validFin (value)) then
      match (LbErased.RecursiveCheckedRecords.Packet.via_738d92def9c0ab42 (value)) with
      | .some _ => 1
      | .none => 0
    else 0

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_graph_refinement_0_71ba01578b385b329e98]
def export0_graph_refinement_0_71ba01578b385b329e98 (carrier : (_root_.Array _root_.Nat)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match _root_.RecursiveCheckedRecords.plusOne value with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_graph_refinement_0_8b6f9e05ee7b31aa9e96]
def export0_graph_refinement_0_8b6f9e05ee7b31aa9e96 (carrier : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match (LbErased.RecursiveCheckedRecords.Packet.via_738d92def9c0ab42 (value)) with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_9a14c44da851e2d4fdfbfb9b_lean]
def export0 (a0 : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : (_root_.Array LbErased.RecursiveCheckedRecords.Packet) :=
  carrierResult (do
    let a0 ← carrierValue a0
    if (LbErased.RecursiveCheckedRecords.Packet.validFin (a0)) then
      match (LbErased.RecursiveCheckedRecords.Packet.via_738d92def9c0ab42 (a0)) with
      | .some _bridgeSubtype0 =>
        pure ((let _bridgeResult := _root_.RecursiveCheckedRecords.echo _bridgeSubtype0; (LbErased.RecursiveCheckedRecords.Packet.erase (_bridgeResult))))
      | .none =>
        .none
    else
      .none
  )

@[export lean_bridge_b1c46fbb29fb86a306017349_fin_guard_0]
def export1_fin_guard_0 (carrier : _root_.Array (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet))) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some _bridgeValue =>
    if ((_bridgeValue).all (fun _bridgeFinValue0 => (match (_bridgeFinValue0) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue1 => (LbErased.RecursiveCheckedRecords.Packet.validFin (_bridgeFinValue1))))) then 1 else 0

@[export lean_bridge_b1c46fbb29fb86a306017349_refinement_0]
def export1_refinement_0 (carrier : _root_.Array (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet))) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    if ((value).all (fun _bridgeFinValue0 => (match (_bridgeFinValue0) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue1 => (LbErased.RecursiveCheckedRecords.Packet.validFin (_bridgeFinValue1))))) then
      match ((value).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.RecursiveCheckedRecords.Packet.via_5b2d9cecaeed7529 (_bridgeValue1))).map _root_.Option.some))) with
      | .some _ => 1
      | .none => 0
    else 0

@[export lean_bridge_b1c46fbb29fb86a306017349_graph_refinement_0_262d1fa6be548d6d1dd0]
def export1_graph_refinement_0_262d1fa6be548d6d1dd0 (carrier : (_root_.Array _root_.Nat)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match _root_.RecursiveCheckedRecords.plusTwo value with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_b1c46fbb29fb86a306017349_graph_refinement_0_88f1c5c2e3a6ba3c4460]
def export1_graph_refinement_0_88f1c5c2e3a6ba3c4460 (carrier : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match (LbErased.RecursiveCheckedRecords.Packet.via_5b2d9cecaeed7529 (value)) with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_b1c46fbb29fb86a306017349_lean]
def export1 (a0 : (_root_.Array (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet)))) : (_root_.Array (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet))) :=
  carrierResult (do
    let a0 ← carrierValue a0
    if ((a0).all (fun _bridgeFinValue0 => (match (_bridgeFinValue0) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue1 => (LbErased.RecursiveCheckedRecords.Packet.validFin (_bridgeFinValue1))))) then
      match ((a0).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.RecursiveCheckedRecords.Packet.via_5b2d9cecaeed7529 (_bridgeValue1))).map _root_.Option.some))) with
      | .some _bridgeSubtype0 =>
        pure ((let _bridgeResult := _root_.RecursiveCheckedRecords.echoGroups _bridgeSubtype0; ((_bridgeResult).map (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.none | _root_.Option.some _bridgeValue1 => _root_.Option.some (LbErased.RecursiveCheckedRecords.Packet.erase (_bridgeValue1)))))))
      | .none =>
        .none
    else
      .none
  )

@[export lean_bridge_8540c0aac676a8863cdff838_fin_guard_0]
def export2_fin_guard_0 (carrier : _root_.Array LbErased.RecursiveCheckedRecords.Packet) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some _bridgeValue =>
    if (LbErased.RecursiveCheckedRecords.Packet.validFin (_bridgeValue)) then 1 else 0

@[export lean_bridge_8540c0aac676a8863cdff838_refinement_0]
def export2_refinement_0 (carrier : _root_.Array LbErased.RecursiveCheckedRecords.Packet) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    if (LbErased.RecursiveCheckedRecords.Packet.validFin (value)) then
      match (LbErased.RecursiveCheckedRecords.Packet.via_738d92def9c0ab42 (value)) with
      | .some _ => 1
      | .none => 0
    else 0

@[export lean_bridge_8540c0aac676a8863cdff838_graph_refinement_0_71ba01578b385b329e98]
def export2_graph_refinement_0_71ba01578b385b329e98 (carrier : (_root_.Array _root_.Nat)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match _root_.RecursiveCheckedRecords.plusOne value with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_8540c0aac676a8863cdff838_graph_refinement_0_8b6f9e05ee7b31aa9e96]
def export2_graph_refinement_0_8b6f9e05ee7b31aa9e96 (carrier : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match (LbErased.RecursiveCheckedRecords.Packet.via_738d92def9c0ab42 (value)) with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_8540c0aac676a8863cdff838_lean]
def export2 (a0 : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : (_root_.Array _root_.Nat) :=
  carrierResult (do
    let a0 ← carrierValue a0
    if (LbErased.RecursiveCheckedRecords.Packet.validFin (a0)) then
      match (LbErased.RecursiveCheckedRecords.Packet.via_738d92def9c0ab42 (a0)) with
      | .some _bridgeSubtype0 =>
        pure (_root_.RecursiveCheckedRecords.first _bridgeSubtype0)
      | .none =>
        .none
    else
      .none
  )

@[export lean_bridge_24b13094b4039f73d0959480_fin_guard_0]
def export3_fin_guard_0 (carrier : _root_.Array (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet))) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some _bridgeValue =>
    if ((_bridgeValue).all (fun _bridgeFinValue0 => (match (_bridgeFinValue0) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue1 => (LbErased.RecursiveCheckedRecords.Packet.validFin (_bridgeFinValue1))))) then 1 else 0

@[export lean_bridge_24b13094b4039f73d0959480_refinement_0]
def export3_refinement_0 (carrier : _root_.Array (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet))) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    if ((value).all (fun _bridgeFinValue0 => (match (_bridgeFinValue0) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue1 => (LbErased.RecursiveCheckedRecords.Packet.validFin (_bridgeFinValue1))))) then
      match ((value).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.RecursiveCheckedRecords.Packet.via_738d92def9c0ab42 (_bridgeValue1))).map _root_.Option.some))) with
      | .some _ => 1
      | .none => 0
    else 0

@[export lean_bridge_24b13094b4039f73d0959480_graph_refinement_0_71ba01578b385b329e98]
def export3_graph_refinement_0_71ba01578b385b329e98 (carrier : (_root_.Array _root_.Nat)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match _root_.RecursiveCheckedRecords.plusOne value with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_24b13094b4039f73d0959480_graph_refinement_0_8b6f9e05ee7b31aa9e96]
def export3_graph_refinement_0_8b6f9e05ee7b31aa9e96 (carrier : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match (LbErased.RecursiveCheckedRecords.Packet.via_738d92def9c0ab42 (value)) with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_24b13094b4039f73d0959480_lean]
def export3 (a0 : (_root_.Array (_root_.Array (_root_.Option LbErased.RecursiveCheckedRecords.Packet)))) : (_root_.Array _root_.Nat) :=
  carrierResult (do
    let a0 ← carrierValue a0
    if ((a0).all (fun _bridgeFinValue0 => (match (_bridgeFinValue0) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue1 => (LbErased.RecursiveCheckedRecords.Packet.validFin (_bridgeFinValue1))))) then
      match ((a0).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.RecursiveCheckedRecords.Packet.via_738d92def9c0ab42 (_bridgeValue1))).map _root_.Option.some))) with
      | .some _bridgeSubtype0 =>
        pure (_root_.RecursiveCheckedRecords.groups _bridgeSubtype0)
      | .none =>
        .none
    else
      .none
  )

@[export lean_bridge_df0f714db6fdbd3762d5e0a5_fin_guard_0]
def export4_fin_guard_0 (carrier : _root_.Array _root_.Nat) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some _bridgeValue =>
    if true then 1 else 0

@[export lean_bridge_df0f714db6fdbd3762d5e0a5_lean]
def export4 (a0 : (_root_.Array _root_.Nat)) : (_root_.Array LbErased.RecursiveCheckedRecords.Packet) :=
  carrierResult (do
    let a0 ← carrierValue a0
    pure ((let _bridgeResult := _root_.RecursiveCheckedRecords.produce a0; (LbErased.RecursiveCheckedRecords.Packet.erase (_bridgeResult))))
  )

@[export lean_bridge_c3338006aea7f276ff222c0c_fin_guard_0]
def export5_fin_guard_0 (carrier : _root_.Array LbErased.RecursiveCheckedRecords.Packet) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some _bridgeValue =>
    if (LbErased.RecursiveCheckedRecords.Packet.validFin (_bridgeValue)) then 1 else 0

@[export lean_bridge_c3338006aea7f276ff222c0c_refinement_0]
def export5_refinement_0 (carrier : _root_.Array LbErased.RecursiveCheckedRecords.Packet) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    if (LbErased.RecursiveCheckedRecords.Packet.validFin (value)) then
      match (LbErased.RecursiveCheckedRecords.Packet.via_5b2d9cecaeed7529 (value)) with
      | .some _ => 1
      | .none => 0
    else 0

@[export lean_bridge_c3338006aea7f276ff222c0c_graph_refinement_0_262d1fa6be548d6d1dd0]
def export5_graph_refinement_0_262d1fa6be548d6d1dd0 (carrier : (_root_.Array _root_.Nat)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match _root_.RecursiveCheckedRecords.plusTwo value with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_c3338006aea7f276ff222c0c_graph_refinement_0_88f1c5c2e3a6ba3c4460]
def export5_graph_refinement_0_88f1c5c2e3a6ba3c4460 (carrier : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match (LbErased.RecursiveCheckedRecords.Packet.via_5b2d9cecaeed7529 (value)) with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_c3338006aea7f276ff222c0c_lean]
def export5 (a0 : (_root_.Array LbErased.RecursiveCheckedRecords.Packet)) : (_root_.Array _root_.Nat) :=
  carrierResult (do
    let a0 ← carrierValue a0
    if (LbErased.RecursiveCheckedRecords.Packet.validFin (a0)) then
      match (LbErased.RecursiveCheckedRecords.Packet.via_5b2d9cecaeed7529 (a0)) with
      | .some _bridgeSubtype0 =>
        pure (_root_.RecursiveCheckedRecords.second _bridgeSubtype0)
      | .none =>
        .none
    else
      .none
  )

end LeanBridgeNativea1d30b9a0f384ed5
