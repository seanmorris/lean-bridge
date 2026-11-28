prelude
import Init.System.Promise

@[extern "lb_jst_test_observe"] opaque observeWorker {α : Type} (value : @& α) : BaseIO Unit
@[extern "lb_jst_test_canceled"] opaque observeCancellation (canceled : Bool) : BaseIO Unit

-- This is an ordinary Lean worker holding an opaque application value.
-- It neither knows the object's representation nor calls into JS.
@[export lb_jst_test_park] def parkIdentity {α : Type} (value : α) (gate : IO.Promise Bool) : BaseIO (Task α) :=
  BaseIO.asTask do
    observeWorker value
    let _ ← IO.wait gate.result?
    observeCancellation (← IO.checkCanceled)
    return value
