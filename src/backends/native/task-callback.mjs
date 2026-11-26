/**
 * Share the Lean worker-to-owner protocol across native hosts.
 *
 * @file
 */

/**
 * Request a host reply through a Lean promise without entering the host runtime.
 *
 * @param prefix - Private native symbol family for this adapter.
 * @param bounded - Acquire a shared Wasm wait slot before blocking a Lean worker.
 */
export const taskCallbackLean = (prefix,bounded=false) => `opaque CallbackPort : Type
@[extern "${prefix}_request"] opaque cbRequest {α β : Type} (port : @& CallbackPort) (slot : UInt32) (arg : α) (reply : IO.Promise (Except IO.Error β)) : BaseIO Unit
@[extern "${prefix}_track"] opaque cbTrack {α : Type} (port : @& CallbackPort) (task : @& Task α) : BaseIO Unit
def ${bounded ? "cbWaitForReply" : "cbInvoke"} {α β : Type} (port : CallbackPort) (slot : UInt32) (v : α) : IO β := do
  let p ← IO.Promise.new (α := Except IO.Error β)
  cbRequest port slot v p
  -- IO.ofExcept would stringify and allocate a different IO.Error.
  match ← IO.wait p.result! with
  | .ok value => return value
  | .error error => throw error
${bounded ? `@[extern "lean_bridge_wasm_callback_acquire_v1"] opaque cbAcquire : BaseIO Bool
@[extern "lean_bridge_wasm_callback_release_v1"] opaque cbRelease : BaseIO Unit
def cbInvoke {α β : Type} (port : CallbackPort) (slot : UInt32) (v : α) : IO β := do
  unless ← cbAcquire do throw (IO.userError "Lean callback concurrency limit reached")
  try cbWaitForReply port slot v finally cbRelease
` : ""}`;

/**
 * Read one-call positions from the checked public interface, not user-supplied
 * native slot numbers. A slot belongs to its declaration and each task start.
 *
 * @param api - Compiler-checked (and, if selected, reconciled) public interface.
 */
export const retainedOnceSlots = api => {
	const once = new Set(api.types.filter(t => t.kind === "callback" && t.callable.invocation === "once").map(t => t.id));
	return new Map(api.declarations.flatMap(d => {
		const slots = d.parameters.flatMap((p,i) => p.type.kind === "named" && once.has(p.type.id) ? [i] : []);
		return slots.length ? [[d.source.declaration,slots]] : [];
	}));
};

// Native worker protocols only. The private ref is never exposed to Lean
// application code. The same port lock guards concurrent worker admissions;
// it is released before making a request or running any application code.
export const nativeOnceLean = `
@[extern "lb_c_cb_budget_claim"] opaque cbBudgetClaim (port : @& CallbackPort) (used : @& IO.Ref Bool) : BaseIO Bool
@[extern "lb_c_cb_budget_error"] opaque cbBudgetError (port : @& CallbackPort) : BaseIO IO.Error
@[extern "lb_c_cb_budget_matches"] opaque cbBudgetMatches (actual expected : @& IO.Error) : Bool
def cbInvokeOnce {α β : Type} (port : CallbackPort) (used : IO.Ref Bool) (error : IO.Error) (slot : UInt32) (v : α) : IO β := do
  unless ← cbBudgetClaim port used do throw error
  cbInvoke port slot v
`;
export const nativeOncePrototypes = [
	"extern uint8_t lb_c_cb_budget_claim(lean_object *, lean_object *);"
	, "extern lean_object *lb_c_cb_budget_error(lean_object *);"
	, "extern uint8_t lb_c_cb_budget_matches(lean_object *, lean_object *);"
];
export const nativeOnceC = `
uint8_t lb_c_cb_budget_claim(lean_object *token, lean_object *used) {
    lb_port *p = lean_get_external_data(token);
    pthread_mutex_lock(&p->lock);
    /* Let the existing broker deliver expiration on a closed registration. */
    int closed = !LB_CB_OPEN(p);
    lean_object *old = closed ? lean_box(0) : lean_st_ref_swap(used, lean_box(1));
    pthread_mutex_unlock(&p->lock);
    uint8_t allowed = !lean_unbox(old); lean_dec(old); return allowed;
}
lean_object *lb_c_cb_budget_error(lean_object *token) {
    (void)token; return lean_mk_io_user_error(lean_mk_string("callback-already-invoked"));
}
uint8_t lb_c_cb_budget_matches(lean_object *actual, lean_object *expected) { return actual == expected; }
`;
