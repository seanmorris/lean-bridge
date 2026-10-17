import MutualCheckedRecords
set_option maxRecDepth 10000
namespace LeanBridgeNative4ca822048b145659
mutual
structure LbErased.MutualCheckedRecords.Envelope where
  «value» : _root_.Nat
  «mode» : _root_.Nat
  «next» : (_root_.Option LbErased.MutualCheckedRecords.Step)
inductive LbErased.MutualCheckedRecords.Step where
  | «stop»  : LbErased.MutualCheckedRecords.Step
  | «more» (a0 : LbErased.MutualCheckedRecords.Envelope) : LbErased.MutualCheckedRecords.Step
end

mutual
def LbErased.MutualCheckedRecords.Envelope.erase (value : _root_.MutualCheckedRecords.Envelope) : LbErased.MutualCheckedRecords.Envelope :=
  match value with
  | { «value» := a0, «mode» := a1, «next» := a2, .. } => LbErased.MutualCheckedRecords.Envelope.mk (a0).val (a1).val (match (a2) with | _root_.Option.none => _root_.Option.none | _root_.Option.some _bridgeValue0 => _root_.Option.some (LbErased.MutualCheckedRecords.Step.erase (_bridgeValue0)))

def LbErased.MutualCheckedRecords.Envelope.via_78916d7071decafb (value : LbErased.MutualCheckedRecords.Envelope) : _root_.Option _root_.MutualCheckedRecords.Envelope :=
  match value with
  | ⟨a0, a1, a2⟩ => do
    let b0 ← _root_.MutualCheckedRecords.plusOne a0
    let b1 ← (if proof : (a1) < 3 then _root_.Option.some (⟨(a1), proof⟩ : _root_.Fin 3) else _root_.Option.none)
    let b2 ← (match (a2) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue0 => ((LbErased.MutualCheckedRecords.Step.via_82322f6e5607bb8c323482e16a9eaad401af8376fd9e1913116dbb562f53abdc (_bridgeValue0))).map _root_.Option.some)
    _root_.MutualCheckedRecords.mkEnvelope b0 b1 b2

def LbErased.MutualCheckedRecords.Envelope.via_eee05ba486245947 (value : LbErased.MutualCheckedRecords.Envelope) : _root_.Option _root_.MutualCheckedRecords.Envelope :=
  match value with
  | ⟨a0, a1, a2⟩ => do
    let b0 ← _root_.MutualCheckedRecords.plusTwo a0
    let b1 ← (if proof : (a1) < 3 then _root_.Option.some (⟨(a1), proof⟩ : _root_.Fin 3) else _root_.Option.none)
    let b2 ← (match (a2) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue0 => ((LbErased.MutualCheckedRecords.Step.via_a942a5ab7edd5de57b75a216e338834bcfacdf5c0a068365bdcbd69ab73528ca (_bridgeValue0))).map _root_.Option.some)
    _root_.MutualCheckedRecords.normalizeEnvelope b0 b1 b2

def LbErased.MutualCheckedRecords.Step.via_82322f6e5607bb8c323482e16a9eaad401af8376fd9e1913116dbb562f53abdc (value : LbErased.MutualCheckedRecords.Step) : _root_.Option _root_.MutualCheckedRecords.Step :=
  match value with
  | .«stop»  => do pure (_root_.MutualCheckedRecords.Step.stop )
  | .«more» a0 => do let b0 ← (LbErased.MutualCheckedRecords.Envelope.via_78916d7071decafb (a0)); pure (_root_.MutualCheckedRecords.Step.more b0)

def LbErased.MutualCheckedRecords.Step.via_a942a5ab7edd5de57b75a216e338834bcfacdf5c0a068365bdcbd69ab73528ca (value : LbErased.MutualCheckedRecords.Step) : _root_.Option _root_.MutualCheckedRecords.Step :=
  match value with
  | .«stop»  => do pure (_root_.MutualCheckedRecords.Step.stop )
  | .«more» a0 => do let b0 ← (LbErased.MutualCheckedRecords.Envelope.via_eee05ba486245947 (a0)); pure (_root_.MutualCheckedRecords.Step.more b0)

def LbErased.MutualCheckedRecords.Step.erase (value : _root_.MutualCheckedRecords.Step) : LbErased.MutualCheckedRecords.Step :=
  match value with
  | .«stop»  => LbErased.MutualCheckedRecords.Step.«stop» 
  | .«more» a0 => LbErased.MutualCheckedRecords.Step.«more» (LbErased.MutualCheckedRecords.Envelope.erase (a0))

end

mutual
def LbErased.MutualCheckedRecords.Envelope.validFin (value : LbErased.MutualCheckedRecords.Envelope) : _root_.Bool :=
  match value with
  | ⟨_bridgeFinField0, _bridgeFinField1, _bridgeFinField2⟩ => (decide ((_bridgeFinField1) < 3)) && (match (_bridgeFinField2) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue0 => (LbErased.MutualCheckedRecords.Step.validFin (_bridgeFinValue0)))

def LbErased.MutualCheckedRecords.Step.validFin (value : LbErased.MutualCheckedRecords.Step) : _root_.Bool :=
  match value with
  | .«stop»  => true
  | .«more» _bridgeFinField0 => (LbErased.MutualCheckedRecords.Envelope.validFin (_bridgeFinField0))

end

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

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_d0c2f97dc81cba81a9e3_make]
def maked0c2f97dc81cba81a9e3 (a0 : (_root_.Array _root_.Nat)) (a1 : (_root_.Array _root_.Nat)) (a2 : (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Step))) : (_root_.Array LbErased.MutualCheckedRecords.Envelope) :=
  carrierResult (do
    let a0 ← carrierValue a0
    let a1 ← carrierValue a1
    let a2 ← carrierValue a2
    pure (({ «value» := a0, «mode» := a1, «next» := a2 } : LbErased.MutualCheckedRecords.Envelope))
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_d0c2f97dc81cba81a9e3_field0]
def field0d0c2f97dc81cba81a9e3 (value : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : (_root_.Array _root_.Nat) :=
  carrierResult (do
    let value ← carrierValue value
    pure value.«value»
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_d0c2f97dc81cba81a9e3_field1]
def field1d0c2f97dc81cba81a9e3 (value : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : (_root_.Array _root_.Nat) :=
  carrierResult (do
    let value ← carrierValue value
    pure value.«mode»
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_d0c2f97dc81cba81a9e3_field2]
def field2d0c2f97dc81cba81a9e3 (value : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Step)) :=
  carrierResult (do
    let value ← carrierValue value
    pure value.«next»
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_eb736b1bf29637ae6a7a_branch]
def brancheb736b1bf29637ae6a7a (value : (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Step))) : _root_.UInt32 :=
  match carrierValue value with
  | .none => 4294967295
  | .some value =>
    match value with
    | .none => 0
    | .some _ => 1

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_eb736b1bf29637ae6a7a_none]
def noneeb736b1bf29637ae6a7a (_bridgeUnit : _root_.Unit) : (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Step)) :=
  carrierResult (do
    pure (.none)
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_eb736b1bf29637ae6a7a_make0]
def make0eb736b1bf29637ae6a7a (a0 : (_root_.Array LbErased.MutualCheckedRecords.Step)) : (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Step)) :=
  carrierResult (do
    let a0 ← carrierValue a0
    pure (.some a0)
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_eb736b1bf29637ae6a7a_field0]
def field0eb736b1bf29637ae6a7a (value : (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Step))) : (_root_.Array LbErased.MutualCheckedRecords.Step) :=
  carrierResult (do
    let value ← carrierValue value
    match value with
    | .some child => pure child
    | _ => .none
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_fd8b5e5cd01b3f098ee1_branch]
def branchfd8b5e5cd01b3f098ee1 (value : (_root_.Array LbErased.MutualCheckedRecords.Step)) : _root_.UInt32 :=
  match carrierValue value with
  | .none => 4294967295
  | .some value =>
    match value with
    | .«stop»  => 0
    | .«more» _ => 1

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_fd8b5e5cd01b3f098ee1_make0]
def make0fd8b5e5cd01b3f098ee1 (_bridgeUnit : _root_.Unit) : (_root_.Array LbErased.MutualCheckedRecords.Step) :=
  carrierResult (do
    pure (.«stop» )
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_fd8b5e5cd01b3f098ee1_make1]
def make1fd8b5e5cd01b3f098ee1 (a0 : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : (_root_.Array LbErased.MutualCheckedRecords.Step) :=
  carrierResult (do
    let a0 ← carrierValue a0
    pure (.«more» a0)
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_fd8b5e5cd01b3f098ee1_case1_field0]
def case1_field0fd8b5e5cd01b3f098ee1 (value : (_root_.Array LbErased.MutualCheckedRecords.Step)) : (_root_.Array LbErased.MutualCheckedRecords.Envelope) :=
  carrierResult (do
    let value ← carrierValue value
    match value with
    | .«more» child => pure child
    | _ => .none
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_65957f8f9adac4e8a249_make]
def make65957f8f9adac4e8a249 (values : _root_.Array (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope))) : (_root_.Array (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope))) :=
  carrierResult (do
    let values ← carrierCollect values
    pure values
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_65957f8f9adac4e8a249_items]
def items65957f8f9adac4e8a249 (value : (_root_.Array (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope)))) : (_root_.Array (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope))) :=
  match carrierValue value with
  | .none => #[]
  | .some values => (values.extract 0 262145).map (fun child => #[child])

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_e9dbc7e3c3b419d0a087_branch]
def branche9dbc7e3c3b419d0a087 (value : (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope))) : _root_.UInt32 :=
  match carrierValue value with
  | .none => 4294967295
  | .some value =>
    match value with
    | .none => 0
    | .some _ => 1

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_e9dbc7e3c3b419d0a087_none]
def nonee9dbc7e3c3b419d0a087 (_bridgeUnit : _root_.Unit) : (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope)) :=
  carrierResult (do
    pure (.none)
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_e9dbc7e3c3b419d0a087_make0]
def make0e9dbc7e3c3b419d0a087 (a0 : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope)) :=
  carrierResult (do
    let a0 ← carrierValue a0
    pure (.some a0)
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_e9dbc7e3c3b419d0a087_field0]
def field0e9dbc7e3c3b419d0a087 (value : (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope))) : (_root_.Array LbErased.MutualCheckedRecords.Envelope) :=
  carrierResult (do
    let value ← carrierValue value
    match value with
    | .some child => pure child
    | _ => .none
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_97ce35f0dd7bd593a821_make]
def make97ce35f0dd7bd593a821 (a0 : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : (_root_.Array LbErased.MutualCheckedRecords.Envelope) :=
  carrierResult (do
    let a0 ← carrierValue a0
    pure (a0)
  )

@[export lean_bridge_b93734338d8f12ed96612e52_recursive_97ce35f0dd7bd593a821_field0]
def field097ce35f0dd7bd593a821 (value : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : (_root_.Array LbErased.MutualCheckedRecords.Envelope) :=
  carrierResult (do
    let value ← carrierValue value
    pure value
  )

@[export lean_bridge_b93734338d8f12ed96612e52_fin_guard_0]
def export0_fin_guard_0 (carrier : _root_.Array LbErased.MutualCheckedRecords.Envelope) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some _bridgeValue =>
    if (LbErased.MutualCheckedRecords.Envelope.validFin (_bridgeValue)) then 1 else 0

@[export lean_bridge_b93734338d8f12ed96612e52_refinement_0]
def export0_refinement_0 (carrier : _root_.Array LbErased.MutualCheckedRecords.Envelope) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    if (LbErased.MutualCheckedRecords.Envelope.validFin (value)) then
      match (LbErased.MutualCheckedRecords.Envelope.via_78916d7071decafb (value)) with
      | .some _ => 1
      | .none => 0
    else 0

@[export lean_bridge_b93734338d8f12ed96612e52_graph_refinement_0_dcb8ec285e33c1c5011c]
def export0_graph_refinement_0_dcb8ec285e33c1c5011c (carrier : (_root_.Array _root_.Nat)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match _root_.MutualCheckedRecords.plusOne value with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_b93734338d8f12ed96612e52_graph_refinement_0_ee78e99abfc85cedd28d]
def export0_graph_refinement_0_ee78e99abfc85cedd28d (carrier : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match (LbErased.MutualCheckedRecords.Envelope.via_78916d7071decafb (value)) with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_b93734338d8f12ed96612e52_lean]
def export0 (a0 : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : (_root_.Array LbErased.MutualCheckedRecords.Envelope) :=
  carrierResult (do
    let a0 ← carrierValue a0
    if (LbErased.MutualCheckedRecords.Envelope.validFin (a0)) then
      match (LbErased.MutualCheckedRecords.Envelope.via_78916d7071decafb (a0)) with
      | .some _bridgeSubtype0 =>
        pure ((let _bridgeResult := _root_.MutualCheckedRecords.echo _bridgeSubtype0; (LbErased.MutualCheckedRecords.Envelope.erase (_bridgeResult))))
      | .none =>
        .none
    else
      .none
  )

@[export lean_bridge_c2c1eed7ec1642970f377b9b_fin_guard_0]
def export1_fin_guard_0 (carrier : _root_.Array (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope))) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some _bridgeValue =>
    if ((_bridgeValue).all (fun _bridgeFinValue0 => (match (_bridgeFinValue0) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue1 => (LbErased.MutualCheckedRecords.Envelope.validFin (_bridgeFinValue1))))) then 1 else 0

@[export lean_bridge_c2c1eed7ec1642970f377b9b_refinement_0]
def export1_refinement_0 (carrier : _root_.Array (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope))) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    if ((value).all (fun _bridgeFinValue0 => (match (_bridgeFinValue0) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue1 => (LbErased.MutualCheckedRecords.Envelope.validFin (_bridgeFinValue1))))) then
      match ((value).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.MutualCheckedRecords.Envelope.via_eee05ba486245947 (_bridgeValue1))).map _root_.Option.some))) with
      | .some _ => 1
      | .none => 0
    else 0

@[export lean_bridge_c2c1eed7ec1642970f377b9b_graph_refinement_0_7214b53bf51ec9b2e7dc]
def export1_graph_refinement_0_7214b53bf51ec9b2e7dc (carrier : (_root_.Array _root_.Nat)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match _root_.MutualCheckedRecords.plusTwo value with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_c2c1eed7ec1642970f377b9b_graph_refinement_0_f876f341e734dd025087]
def export1_graph_refinement_0_f876f341e734dd025087 (carrier : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match (LbErased.MutualCheckedRecords.Envelope.via_eee05ba486245947 (value)) with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_c2c1eed7ec1642970f377b9b_lean]
def export1 (a0 : (_root_.Array (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope)))) : (_root_.Array (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope))) :=
  carrierResult (do
    let a0 ← carrierValue a0
    if ((a0).all (fun _bridgeFinValue0 => (match (_bridgeFinValue0) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue1 => (LbErased.MutualCheckedRecords.Envelope.validFin (_bridgeFinValue1))))) then
      match ((a0).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.MutualCheckedRecords.Envelope.via_eee05ba486245947 (_bridgeValue1))).map _root_.Option.some))) with
      | .some _bridgeSubtype0 =>
        pure ((let _bridgeResult := _root_.MutualCheckedRecords.echoGroups _bridgeSubtype0; ((_bridgeResult).map (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.none | _root_.Option.some _bridgeValue1 => _root_.Option.some (LbErased.MutualCheckedRecords.Envelope.erase (_bridgeValue1)))))))
      | .none =>
        .none
    else
      .none
  )

@[export lean_bridge_d471b4117ccac362de6872c5_fin_guard_0]
def export2_fin_guard_0 (carrier : _root_.Array LbErased.MutualCheckedRecords.Envelope) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some _bridgeValue =>
    if (LbErased.MutualCheckedRecords.Envelope.validFin (_bridgeValue)) then 1 else 0

@[export lean_bridge_d471b4117ccac362de6872c5_refinement_0]
def export2_refinement_0 (carrier : _root_.Array LbErased.MutualCheckedRecords.Envelope) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    if (LbErased.MutualCheckedRecords.Envelope.validFin (value)) then
      match (LbErased.MutualCheckedRecords.Envelope.via_78916d7071decafb (value)) with
      | .some _ => 1
      | .none => 0
    else 0

@[export lean_bridge_d471b4117ccac362de6872c5_graph_refinement_0_dcb8ec285e33c1c5011c]
def export2_graph_refinement_0_dcb8ec285e33c1c5011c (carrier : (_root_.Array _root_.Nat)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match _root_.MutualCheckedRecords.plusOne value with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_d471b4117ccac362de6872c5_graph_refinement_0_ee78e99abfc85cedd28d]
def export2_graph_refinement_0_ee78e99abfc85cedd28d (carrier : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match (LbErased.MutualCheckedRecords.Envelope.via_78916d7071decafb (value)) with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_d471b4117ccac362de6872c5_lean]
def export2 (a0 : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : (_root_.Array _root_.Nat) :=
  carrierResult (do
    let a0 ← carrierValue a0
    if (LbErased.MutualCheckedRecords.Envelope.validFin (a0)) then
      match (LbErased.MutualCheckedRecords.Envelope.via_78916d7071decafb (a0)) with
      | .some _bridgeSubtype0 =>
        pure (_root_.MutualCheckedRecords.first _bridgeSubtype0)
      | .none =>
        .none
    else
      .none
  )

@[export lean_bridge_80dc06e94320d76de7e8afc6_fin_guard_0]
def export3_fin_guard_0 (carrier : _root_.Array (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope))) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some _bridgeValue =>
    if ((_bridgeValue).all (fun _bridgeFinValue0 => (match (_bridgeFinValue0) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue1 => (LbErased.MutualCheckedRecords.Envelope.validFin (_bridgeFinValue1))))) then 1 else 0

@[export lean_bridge_80dc06e94320d76de7e8afc6_refinement_0]
def export3_refinement_0 (carrier : _root_.Array (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope))) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    if ((value).all (fun _bridgeFinValue0 => (match (_bridgeFinValue0) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue1 => (LbErased.MutualCheckedRecords.Envelope.validFin (_bridgeFinValue1))))) then
      match ((value).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.MutualCheckedRecords.Envelope.via_78916d7071decafb (_bridgeValue1))).map _root_.Option.some))) with
      | .some _ => 1
      | .none => 0
    else 0

@[export lean_bridge_80dc06e94320d76de7e8afc6_graph_refinement_0_dcb8ec285e33c1c5011c]
def export3_graph_refinement_0_dcb8ec285e33c1c5011c (carrier : (_root_.Array _root_.Nat)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match _root_.MutualCheckedRecords.plusOne value with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_80dc06e94320d76de7e8afc6_graph_refinement_0_ee78e99abfc85cedd28d]
def export3_graph_refinement_0_ee78e99abfc85cedd28d (carrier : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match (LbErased.MutualCheckedRecords.Envelope.via_78916d7071decafb (value)) with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_80dc06e94320d76de7e8afc6_lean]
def export3 (a0 : (_root_.Array (_root_.Array (_root_.Option LbErased.MutualCheckedRecords.Envelope)))) : (_root_.Array _root_.Nat) :=
  carrierResult (do
    let a0 ← carrierValue a0
    if ((a0).all (fun _bridgeFinValue0 => (match (_bridgeFinValue0) with | _root_.Option.none => true | _root_.Option.some _bridgeFinValue1 => (LbErased.MutualCheckedRecords.Envelope.validFin (_bridgeFinValue1))))) then
      match ((a0).mapM (fun _bridgeValue0 => (match (_bridgeValue0) with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some _bridgeValue1 => ((LbErased.MutualCheckedRecords.Envelope.via_78916d7071decafb (_bridgeValue1))).map _root_.Option.some))) with
      | .some _bridgeSubtype0 =>
        pure (_root_.MutualCheckedRecords.groups _bridgeSubtype0)
      | .none =>
        .none
    else
      .none
  )

@[export lean_bridge_f1dd7ff5b67060930f091dae_fin_guard_0]
def export4_fin_guard_0 (carrier : _root_.Array _root_.Nat) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some _bridgeValue =>
    if true then 1 else 0

@[export lean_bridge_f1dd7ff5b67060930f091dae_lean]
def export4 (a0 : (_root_.Array _root_.Nat)) : (_root_.Array LbErased.MutualCheckedRecords.Envelope) :=
  carrierResult (do
    let a0 ← carrierValue a0
    pure ((let _bridgeResult := _root_.MutualCheckedRecords.produce a0; (LbErased.MutualCheckedRecords.Envelope.erase (_bridgeResult))))
  )

@[export lean_bridge_84236b8271f83e0e4db02cf4_fin_guard_0]
def export5_fin_guard_0 (carrier : _root_.Array LbErased.MutualCheckedRecords.Envelope) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some _bridgeValue =>
    if (LbErased.MutualCheckedRecords.Envelope.validFin (_bridgeValue)) then 1 else 0

@[export lean_bridge_84236b8271f83e0e4db02cf4_refinement_0]
def export5_refinement_0 (carrier : _root_.Array LbErased.MutualCheckedRecords.Envelope) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    if (LbErased.MutualCheckedRecords.Envelope.validFin (value)) then
      match (LbErased.MutualCheckedRecords.Envelope.via_eee05ba486245947 (value)) with
      | .some _ => 1
      | .none => 0
    else 0

@[export lean_bridge_84236b8271f83e0e4db02cf4_graph_refinement_0_7214b53bf51ec9b2e7dc]
def export5_graph_refinement_0_7214b53bf51ec9b2e7dc (carrier : (_root_.Array _root_.Nat)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match _root_.MutualCheckedRecords.plusTwo value with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_84236b8271f83e0e4db02cf4_graph_refinement_0_f876f341e734dd025087]
def export5_graph_refinement_0_f876f341e734dd025087 (carrier : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : _root_.UInt8 :=
  match carrierValue carrier with
  | .none => 0
  | .some value =>
    match (LbErased.MutualCheckedRecords.Envelope.via_eee05ba486245947 (value)) with
    | .some _ => 1
    | .none => 0

@[export lean_bridge_84236b8271f83e0e4db02cf4_lean]
def export5 (a0 : (_root_.Array LbErased.MutualCheckedRecords.Envelope)) : (_root_.Array _root_.Nat) :=
  carrierResult (do
    let a0 ← carrierValue a0
    if (LbErased.MutualCheckedRecords.Envelope.validFin (a0)) then
      match (LbErased.MutualCheckedRecords.Envelope.via_eee05ba486245947 (a0)) with
      | .some _bridgeSubtype0 =>
        pure (_root_.MutualCheckedRecords.second _bridgeSubtype0)
      | .none =>
        .none
    else
      .none
  )

end LeanBridgeNative4ca822048b145659
