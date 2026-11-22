/**
 * Share the Lean worker-to-owner protocol across native hosts.
 *
 * @file
 */

/**
 * Request a host reply through a Lean promise without entering the host runtime.
 *
 * @param prefix - Private native symbol family for this adapter.
 */
export const taskCallbackLean = prefix => `opaque CallbackPort : Type
@[extern "${prefix}_request"] opaque cbRequest {α β : Type} (port : @& CallbackPort) (slot : UInt32) (arg : α) (reply : IO.Promise (Except IO.Error β)) : BaseIO Unit
@[extern "${prefix}_track"] opaque cbTrack {α : Type} (port : @& CallbackPort) (task : @& Task α) : BaseIO Unit
def cbInvoke {α β : Type} (port : CallbackPort) (slot : UInt32) (v : α) : IO β := do
  let p ← IO.Promise.new (α := Except IO.Error β)
  cbRequest port slot v p
  -- IO.ofExcept would stringify and allocate a different IO.Error.
  match ← IO.wait p.result! with
  | .ok value => return value
  | .error error => throw error
`;
