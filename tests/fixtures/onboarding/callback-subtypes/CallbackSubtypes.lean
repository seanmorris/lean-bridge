namespace CallbackSubtypes

abbrev Positive := { value : Nat // 0 < value }

def checkedPositive (value : Nat) : Option Positive :=
  if bound : 0 < value then some ⟨value, bound⟩ else none

def callHost (callback : Positive → Positive) : Positive :=
  callback ⟨1, by decide⟩

def makeClosure (_seed : Nat) : Positive → Positive :=
  fun value => value

def callHostContainer
    (callback : Option Positive → Except String (Option Positive)) :
    Except String (Option Positive) :=
  callback none

def makeContainerClosure (_seed : Nat) : Array (Option Positive) → Option Positive :=
  fun _values => none

end CallbackSubtypes
