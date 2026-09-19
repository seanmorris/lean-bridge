/**
 * Synchronous C callback scopes and generation-checked Lean closure leases.
 *
 * @file
 */
import { nativeCType, nativeObjectType, nativeTypeKey, nativeCallbackDefault } from "../../build/native-model.mjs";
import { nativeCReference } from "./native-copied-values.mjs";

/**
 * Connect the public C callable ABI to the compiler-emitted Lean trampolines.
 *
 * @param model - Verified compiler model.
 * @param surface - Explicitly admitted C surface.
 */
export const generateNativeCallables = (model, surface) => {
	if(!surface.callbacks.size) return { source: "", vtable: "" };
	const p = surface.prefix, m = p.toUpperCase();
	const copy = type => surface.copy(nativeCReference(type));
	const id = type => `lb_copy_${copy(type).index}`;
	const callback = type => surface.callbacks.get(nativeCReference(type).id);
	const unit = type => type.kind === "primitive" && type.name === "unit";
	const cleanup = (type, name) => copy(type).aggregate ? `${copy(type).name}_clear(&${name});` : "";
	const types = model.types.filter(type => type.kind === "callback");
	const wasm = model.pointerBits === 32;
	const source = [`
/* The first error wins. Its text survives callback cleanup and nested calls. */
typedef struct lb_frame {
  struct lb_frame *previous;
  size_t budget;
  ${p}_status status;
  ${p}_error_code code;
  size_t message_length;
  char message[1024];
} lb_frame;
static _Thread_local lb_frame *lb_current;
static _Thread_local unsigned lb_depth;
static _Thread_local char lb_error_text[1024];
static void lb_record(lb_frame *frame, ${p}_status status, const ${p}_error *error, const char *fallback) {
  if (frame->status != ${m}_STATUS_OK) return;
  frame->status = status > ${m}_STATUS_OK && status <= ${m}_STATUS_UNEXPECTED_ERROR ? status : ${m}_STATUS_UNEXPECTED_ERROR;
  frame->code = error && error->code ? error->code : ${m}_ERROR_UNEXPECTED;
  const char *text = error && error->message ? error->message : fallback;
  size_t length = error && error->message ? error->message_length : strlen(fallback);
  if (length >= sizeof(frame->message)) length = sizeof(frame->message) - 1;
  memcpy(frame->message, text, length); frame->message[length] = 0; frame->message_length = length;
}
static void lb_observe(lb_frame *frame) {
  if (lb_native_callback_take_error()) lb_record(frame, ${m}_STATUS_INVALID_ARGUMENT, NULL, "Expired or wrong-thread host callback");
}
static int lb_enter(lb_frame *frame) {
  if (lb_current) lb_observe(lb_current);
  if (lb_depth == 64) return 0;
  *frame = (lb_frame){.previous = lb_current, .budget = 16u * 1024u * 1024u};
  lb_current = frame; ++lb_depth; return 1;
}
static ${p}_status lb_leave(lb_frame *frame, ${p}_error *error) {
  lb_observe(frame); lb_current = frame->previous; --lb_depth;
  if (error) {
    if (frame->status == ${m}_STATUS_OK) *error = (${p}_error){0};
    else {
      memcpy(lb_error_text, frame->message, sizeof(lb_error_text));
      *error = (${p}_error){frame->code, lb_error_text, frame->message_length};
    }
  }
  return frame->status;
}
/* Registry lookups never dereference a supplied token. Active calls retain a
   separate Lean reference, so disposing a lease during reentry is safe. */
typedef struct { uintptr_t token; ${wasm ? "uint64_t identity; " : ""}lean_object *value; const char *kind; pthread_t thread; pid_t process; } lb_lease;
static lb_lease lb_leases[4096];${wasm ? "\nstatic uintptr_t lb_next_lease; /* Never reuse a wasm32 token. */" : ""}
static pthread_mutex_t lb_lease_mutex = PTHREAD_MUTEX_INITIALIZER;
static inline uintptr_t lb_lease_store(lean_object *value, const char *kind) {
  pthread_mutex_lock(&lb_lease_mutex);
  size_t free_slot = 4096;
  for (size_t i = 0; i < 4096; ++i) {
    lb_lease *slot = &lb_leases[i];
    if (!slot->token) { free_slot = i; break; }
  }
  uintptr_t token = 0;
  if (free_slot < 4096) {
    lb_lease *slot = &lb_leases[free_slot];
    ${wasm ? `uint64_t identity = lb_next_lease < UINTPTR_MAX ? lean_bridge_native_identity_acquire(kind, slot) : 0;
    if (identity) token = ++lb_next_lease;` : "token = (uintptr_t)lean_bridge_native_identity_acquire(kind, slot);"}
    if (token) {
      lean_mark_mt(value);
      *slot = (lb_lease){token, ${wasm ? "identity, " : ""}value, kind, pthread_self(), getpid()};
    }
  }
  pthread_mutex_unlock(&lb_lease_mutex); return token;
}
static lean_object *lb_lease_borrow(uintptr_t token, const char *kind) {
  lean_object *value = NULL;
  pthread_mutex_lock(&lb_lease_mutex);
  for (size_t i = 0; token && i < 4096; ++i) {
    lb_lease *slot = &lb_leases[i];
    if (slot->token == token && !strcmp(slot->kind, kind) && slot->process == getpid() && pthread_equal(slot->thread, pthread_self())) {
      value = slot->value; lean_inc(value); break;
    }
  }
  pthread_mutex_unlock(&lb_lease_mutex); return value;
}
static void lb_lease_drop(uintptr_t token, const char *kind) {
  lean_object *value = NULL;
  pthread_mutex_lock(&lb_lease_mutex);
  for (size_t i = 0; token && i < 4096; ++i) {
    lb_lease *slot = &lb_leases[i];
    if (slot->token == token && !strcmp(slot->kind, kind) && slot->process == getpid()) {
      value = slot->value;
      (void)lean_bridge_native_identity_release(${wasm ? "slot->identity" : "token"}, kind, slot);
      *slot = (lb_lease){0};
      break;
    }
  }
  pthread_mutex_unlock(&lb_lease_mutex);
  if (value) lean_dec(value);
}
`];
	for(const type of types)
	{
		const cb = callback(type), key = nativeTypeKey(type);
		const lines = [`typedef struct { ${cb.name} host; lb_frame *frame; } lb_host_${key};`
			, `static inline ${nativeCType(type.result)} lb_invoke_${key}(void *raw, ${type.parameters.map((t, i) => `${nativeCType(t)} value${i}`).join(", ")}) {`
			, `  lb_host_${key} *host = raw; lb_frame *frame = host->frame;`
			, `  ${nativeCType(type.result)} result = ${nativeCallbackDefault(type.result)};`
			, `  ${copy(type.result).name} returned = {0};`
			, ...type.parameters.map((t, i) => `  ${copy(t).name} arg${i} = {0};`)
			, `  if (frame->status != ${m}_STATUS_OK) goto done;`];
		for(const [i, t] of type.parameters.entries())
		{
			lines.push(`  if (${id(t)}_out(value${i}, &arg${i}, &frame->budget) != 1) {`
				, `    lb_record(frame, ${m}_STATUS_INVALID_ARGUMENT, NULL, "Cannot copy callback argument or 16 MiB call limit exceeded"); goto done;`, "  }");
			if(copy(t).aggregate) lines.push(`  ${copy(t).name} view${i} = arg${i}; view${i}.owner = NULL; view${i}.release = NULL;`);
		}
		const args = type.parameters.map((t, i) => copy(t).aggregate ? `&view${i}` : `arg${i}`);
		lines.push(`  ${p}_error error = {0};`
			, `  ${p}_status status = host->host.call(${["host->host.context", ...args, ...(!unit(type.result) ? ["&returned"] : []), "&error"].join(", ")});`
			, `  if (status != ${m}_STATUS_OK) lb_record(frame, status, &error, "Host callback failed");`
			, "  lb_observe(frame);"
			, `  if (frame->status == ${m}_STATUS_OK) {`
			, `    if (!${id(type.result)}_check(&returned, &frame->budget)) lb_record(frame, ${m}_STATUS_INVALID_ARGUMENT, NULL, "Invalid callback result or 16 MiB call limit exceeded");`
			, "    else {"
			, ...(nativeObjectType(type.result) ? ["      lean_dec(result);"] : [])
			, `      result = ${id(type.result)}_in(&returned);`, "    }", "  }", "done:"
			, `  ${cleanup(type.result, "returned")}`
			, ...type.parameters.map((t, i) => `  ${cleanup(t, `arg${i}`)} ${nativeObjectType(t) ? `lean_dec(value${i});` : ""}`)
			, "  return result;", "}");
		source.push(lines.join("\n"));
	}

	const render = (signature, parameters, result, symbol, leaseType = null) => {
		const hostArgs = parameters.filter(parameter => parameter.type.kind === "callback");
		const lines = [signature, "  (void)context; lb_frame _lb_frame;"
			, '  if (!lb_enter(&_lb_frame)) return lb_failure(error, "C callback reentry limit (64) exceeded");'
			, ...hostArgs.map(({ name, type }) => `  uint64_t _lb_token_${name} = 0; lb_host_${nativeTypeKey(type)} _lb_host_${name} = {0};`)];
		const kind = t => JSON.stringify(`${model.component.id}:callback:${nativeTypeKey(t)}`);
		if(leaseType) lines.push(`  lean_object *_lb_closure = lb_lease_borrow(self, ${kind(leaseType)});`
			, `  if (!_lb_closure) { lb_record(&_lb_frame, ${m}_STATUS_INVALID_ARGUMENT, NULL, "Invalid, disposed, wrong-signature or wrong-thread Lean closure"); goto done; }`);
		if(!unit(result)) lines.push(`  if (!out) { lb_record(&_lb_frame, ${m}_STATUS_INVALID_ARGUMENT, NULL, "Null C result pointer"); goto done; }`);
		for(const { name, type } of parameters)
		{
			const invalid = type.kind === "callback" ? `!${name} || !${name}->call`
				: `${copy(type).aggregate ? `!${name} || ` : ""}!${id(type)}_check(${copy(type).aggregate ? name : `&${name}`}, &_lb_frame.budget)`;
			lines.push(`  if (${invalid}) { lb_record(&_lb_frame, ${m}_STATUS_INVALID_ARGUMENT, NULL, "Invalid C argument or 16 MiB call limit exceeded"); goto done; }`);
		}
		for(const { name, type } of hostArgs)
		{
			const key = nativeTypeKey(type);
			lines.push(`  _lb_host_${name} = (lb_host_${key}){*${name}, &_lb_frame};`
				, `  _lb_token_${name} = lb_native_callback_register((void (*)(void))lb_invoke_${key}, &_lb_host_${name});`
				, `  if (!_lb_token_${name}) { lb_record(&_lb_frame, ${m}_STATUS_UNEXPECTED_ERROR, NULL, "Native callback registry full"); goto done; }`);
		}
		const args = parameters.map(({ name, type }) => type.kind === "callback" ? `lb_t${nativeTypeKey(type)}_wrap(_lb_token_${name})` : `${id(type)}_in(${copy(type).aggregate ? name : `&${name}`})`);
		if(leaseType) args.unshift("_lb_closure");
		lines.push(`  ${nativeCType(result)} _lb_value = ${symbol}(${args.join(", ") || "lean_box(0)"});`);
		if(leaseType) lines.push("  _lb_closure = NULL; /* Consumed by the checked Lean call. */");
		for(const { name } of hostArgs) lines.push(`  if (lb_native_callback_wrong_thread(_lb_token_${name})) lb_record(&_lb_frame, ${m}_STATUS_INVALID_ARGUMENT, NULL, "Wrong-thread host callback");`);
		lines.push("  lb_observe(&_lb_frame);");
		if(result.kind === "callback") lines.push(`  if (_lb_frame.status == ${m}_STATUS_OK) {`
			, `    uintptr_t token = lb_lease_store(_lb_value, ${kind(result)});`
			, "    if (token) { *out = token; _lb_value = NULL; }"
			, `    else lb_record(&_lb_frame, ${m}_STATUS_UNEXPECTED_ERROR, NULL, "Lean closure registry full");`, "  }"
			, "  if (_lb_value) lean_dec(_lb_value);");
		else
		{
			if(!unit(result)) lines.push(`  if (_lb_frame.status == ${m}_STATUS_OK) {`
				, `    ${copy(result).name} copied = {0}; int status = ${id(result)}_out(_lb_value, &copied, &_lb_frame.budget);`
				, "    if (status == 1) *out = copied;"
				, `    else lb_record(&_lb_frame, ${m}_STATUS_UNEXPECTED_ERROR, NULL, "Cannot copy Lean result or 16 MiB call limit exceeded");`, "  }");
			if(nativeObjectType(result)) lines.push("  lean_dec(_lb_value);");
		}
		lines.push("done:");
		if(leaseType) lines.push("  if (_lb_closure) lean_dec(_lb_closure);");
		for(const { name } of hostArgs) lines.push(`  if (_lb_token_${name}) lb_native_callback_release(_lb_token_${name});`);
		lines.push("  return lb_leave(&_lb_frame, error);", "}");
		return lines.join("\n");
	};
	for(const fn of surface.functions)
	{
		const native = model.exports.find(item => `lean:${item.name}` === fn.declaration.id);
		if(!native.parameters.some(parameter => parameter.type.kind === "callback") && native.result.kind !== "callback") continue;
		source.push(render(`static ${p}_status lb_call_${fn.field}(${fn.signature}) {`, fn.parameters.map((parameter, i) => ({ name: parameter.name, type: native.parameters[i].type })), native.result, native.symbol));
	}
	const vtable = [];
	for(const type of types)
	{
		const cb = callback(type), key = nativeTypeKey(type);
		const parameters = type.parameters.map((type, i) => ({ name: `value${i}`, type }));
		const args = parameters.map(({ name, type }) => `${copy(type).aggregate ? "const " : ""}${copy(type).name}${copy(type).aggregate ? " *" : " "}${name}`);
		source.push(render(`static ${p}_status lb_owned_${key}(void *context, uintptr_t self, ${[...args, ...(!unit(type.result) ? [`${copy(type.result).name} *out`] : []), `${p}_error *error`].join(", ")}) {`, parameters, type.result, `lb_t${key}_call`, type));
		source.push(`static void lb_dispose_${key}(void *context, uintptr_t value) { (void)context; lb_lease_drop(value, ${JSON.stringify(`${model.component.id}:callback:${key}`)}); }`);
		vtable.push(`  .${cb.field}_call = lb_owned_${key}, .${cb.field}_dispose = lb_dispose_${key},`);
	}
	return { source: source.join("\n\n"), vtable: vtable.join("\n") };
};
