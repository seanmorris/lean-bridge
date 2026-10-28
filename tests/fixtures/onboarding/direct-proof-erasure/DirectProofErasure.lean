namespace DirectProofErasure

/-- Return one runtime word while two closed proof arguments remain compiler-owned. -/
@[noinline] def keep (_before : True) (value : UInt32) (_after : True) : UInt32 :=
  value

/-- The retained theorem relates the proof-erased API to its runtime payload. -/
theorem keep_eq (before : True) (value : UInt32) (after : True) :
    keep before value after = value := rfl

/-- A runtime-dependent proposition is deliberately not an erased host argument. -/
def conditional (value : UInt32) (_proof : value = 0) : UInt32 := value

/-- A theorem-valued export has no runtime API and remains explicitly refused. -/
def proofValue : True := True.intro

end DirectProofErasure
