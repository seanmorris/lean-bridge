import Budget

namespace Racing

def race (n : UInt32) (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask do
    let a ← IO.asTask (f n)
    let b ← IO.asTask (f (n + 1))
    let x ← IO.wait a
    let y ← IO.wait b
    match x, y with
    | .ok _, .error e | .error e, .ok _ => throw e
    | _, _ => throw (IO.userError "expected precisely one admission")

def duringStart (n : UInt32) (f : UInt32 → IO UInt32) : IO (Task (Except IO.Error UInt32)) := do
  let x ← f n
  let y ← f x
  return Task.pure (.ok y)

def replace (n : UInt32) (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) :=
  IO.asTask do
    let x ← f n
    try f x catch _ => throw (IO.userError "callback-already-invoked")

end Racing
