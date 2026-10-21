namespace CallbackCheckedRecords

/-- A closed interval: the proof relates the two payload fields. -/
structure Interval where
  lo : Nat
  hi : Nat
  ordered : lo ≤ hi

abbrev Positive := { value : Nat // 0 < value }

/-- A proof-backed record whose first payload field is itself a checked Subtype. -/
structure Weighted where
  weight : Positive
  limit : Nat
  within : weight.val ≤ limit

/-- Checked constructors: the only way a host payload becomes a checked record. -/
@[noinline] def mkInterval (lo hi : Nat) : Option Interval :=
  if h : lo ≤ hi then some ⟨lo, hi, h⟩ else none

def checkedPositive (value : Nat) : Option Positive :=
  if bound : 0 < value then some ⟨value, bound⟩ else none

def mkWeighted (weight : Positive) (limit : Nat) : Option Weighted :=
  if h : weight.val ≤ limit then some ⟨weight, limit, h⟩ else none

/-- The host receives a proof-backed interval and must construct the one it replies with. -/
def callHost (callback : Interval → Interval) : Nat :=
  let reply := callback ⟨1, 3, by decide⟩
  reply.hi - reply.lo

/-- A leased closure constructs its interval argument before running; its result is plain. -/
def makeClosure (_seed : Nat) : Interval → Nat :=
  fun value => value.hi - value.lo

/-- A plain marker before the checked record in both directions. -/
def callHostMixed (callback : Nat → Interval → Interval) : Nat :=
  let reply := callback 7 ⟨1, 3, by decide⟩
  reply.hi - reply.lo

/-- A leased closure with a checked argument and a Lean-produced interval result. -/
def makeMixedClosure (_seed : Nat) : Nat → Interval → Interval :=
  fun _marker value => value

/-- Checked records inside structural containers keep their direction. -/
def callHostContainer
    (callback : Option Interval → Except String (Option Interval)) :
    Except String (Option Interval) :=
  callback none

def makeContainerClosure (_seed : Nat) : Array (Option Interval) → Option Interval :=
  fun _values => none

/-- A refined payload field keeps its own Subtype direction below the record. -/
def callHostNested (callback : Weighted → Weighted) : Nat :=
  let reply := callback ⟨⟨1, by decide⟩, 2, by decide⟩
  reply.limit - reply.weight.val

def makeNestedClosure (_seed : Nat) : Weighted → Nat :=
  fun value => value.limit - value.weight.val

end CallbackCheckedRecords
