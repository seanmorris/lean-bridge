/**
 * Synchronous Zend callbacks and resource-owned Lean functions for PHP-Wasm.
 *
 * @file
 */
import { phpValue } from "./callables.mjs";
const callable = value => Boolean(value.type?.callable);

/**
 * Keep the established primitive-only transport unchanged for older packages.
 *
 * @param model - Checked PHP projection with resolved callback payloads.
 */
export const hasStructuredZendCallables = model => [...model.surface.callbacks.values()].some(({ type }) =>
	[...type.callable.parameters, type.callable.result].some(site => !phpValue(model, site.type).scalarName));

/** Public wrappers share one lease, including saved first-class callables. */
export const phpZendLease = String.raw`
final class Lease
{
    private bool $closed = false;
    private int $active = 0;
    public function __construct(private \Closure $invoke, private \Closure $dispose, private mixed $token, private int $arity) { self::ensureCall(); }
    public static function ensureCall(): void {
        if (\Fiber::getCurrent() !== null) throw new \LogicException('Lean callables require the main PHP execution context');
    }
    public function isClosed(): bool { return $this->closed; }
    public function invoke(array $arguments): mixed {
        self::ensureCall();
        if ($this->closed) throw new \LogicException('Lean closure is closed');
        if (!array_is_list($arguments) || count($arguments) !== $this->arity) throw new \ArgumentCountError('Lean closure requires exactly ' . $this->arity . ' positional arguments');
        ++$this->active;
        try { return ($this->invoke)($this->token, $arguments); }
        finally { --$this->active; if ($this->closed && $this->active === 0) ($this->dispose)($this->token); }
    }
    public function close(): void { $this->closed = true; if ($this->active === 0) ($this->dispose)($this->token); }
    public function __destruct() { try { $this->close(); } catch (\Throwable $ignored) {} }
}
`;

/**
 * Generate public-value conversion around one private Zend call.
 *
 * @param model - Checked PHP projection.
 * @param transport - Private Zend namespace.
 * @param library - Optional lazy-load library basename.
 * @param root0 - Ordinary function or owned closure signature.
 * @param root0.name - PHP method name.
 * @param root0.entry - Zend entry point.
 * @param root0.parameters - Exact argument sites.
 * @param root0.result - Exact result site.
 * @param root0.closure - Include a private owned resource.
 */
export const phpZendCall = (model, transport, library, { name, entry, parameters, result, closure = false }) => {
	const args = parameters.map(site => phpValue(model, site.type)), out = phpValue(model, result.type);
	return `    public static function ${name}(${[...closure ? ["mixed $token"] : [], ...args.map((_, i) => `mixed $arg${i}`)].join(", ")}): mixed {
        ${closure || callable(out) || args.some(callable) ? "Lease::ensureCall();" : ""}
        $budget = new Budget(); $failure = null;
${args.map((value, i) => `        $input${i} = ${callable(value) ? `self::borrow${value.index}($arg${i}, $budget, $failure)` : `self::to${value.index}(Checks::check${value.index}($arg${i}, $budget))`};`).join("\n")}
        if (!function_exists('${transport}\\\\${entry}')) {
            ${library ? `try { \\LeanBridge\\CopiedPhpWasmV1\\Loader::load('${library}', '${transport}\\\\${entry}'); }
            catch (\\Throwable $error) { throw new \\${model.namespace}\\LeanBridgeError($error->getMessage(), 0, $error); }` : `throw new \\${model.namespace}\\LeanBridgeError('The generated Zend transport is not loaded');`}
        }
        try { $output = \\${transport}\\${entry}(${[...closure ? ["$token"] : [], ...args.map((_, i) => `$input${i}`)].join(", ")}); }
        catch (\\Throwable $error) {
            if ($failure !== null) throw $failure;
            if ($error instanceof \\Exception) throw new \\${model.namespace}\\LeanBridgeError($error->getMessage(), $error->getCode(), $error);
            throw $error;
        }
        return self::${callable(out) ? "own" : "from"}${out.index}($output);
    }`;
};

/**
 * Convert callbacks at PHP's exact-value boundary, not inside user code.
 *
 * @param model - Checked PHP projection.
 * @param transport - Private Zend namespace.
 */
export const phpZendCallableMethods = (model, transport) => `    private static ?\\Closure $wrap = null;
${[...model.surface.callbacks.values()].map(value => {
	const { parameters, result } = value.type.callable, out = phpValue(model, result.type), i = value.index;
	return `    private static function borrow${i}(mixed $value, Budget $budget, ?\\Throwable &$failure): \\Closure {
        if (!is_callable($value)) throw new \\TypeError('Expected a synchronous callable');
        $callback = \\Closure::fromCallable($value); $reflection = new \\ReflectionFunction($callback);
        if ($reflection->isGenerator() || $reflection->returnsReference()) throw new \\TypeError('Lean callbacks cannot be generators or return references');
        foreach ($reflection->getParameters() as $parameter) if ($parameter->isPassedByReference()) throw new \\TypeError('Lean callbacks cannot take reference parameters');
        return static function (${parameters.map((_, n) => `mixed $arg${n}`).join(", ")}) use ($callback, $budget, &$failure): mixed {
            try {
                $result = $callback(${parameters.map((site, n) => `self::from${phpValue(model, site.type).index}($arg${n})`).join(", ")});
                return self::to${out.index}(Checks::check${out.index}($result, $budget));
            } catch (\\Throwable $error) { $failure ??= $error; throw $error; }
        };
    }
    private static function own${i}(mixed $token): \\${model.namespace}\\LeanClosure {
        $lease = new Lease(static fn($token, $args) => self::invoke${i}($token, ...$args),
            static fn($token) => \\${transport}\\close${i}($token), $token, ${parameters.length});
        self::$wrap ??= \\Closure::bind(static fn(Lease $lease) => new \\${model.namespace}\\LeanClosure($lease), null, \\${model.namespace}\\LeanClosure::class);
        return (self::$wrap)($lease);
    }
${phpZendCall(model, transport, null, { name: `invoke${i}`, entry: `invoke${i}`, parameters, result, closure: true })}`;
}).join("\n")}`;

/**
 * Resource destruction owns disposal even if a PHP wrapper cannot be created.
 *
 * @param model - Checked PHP projection.
 */
export const zendCallableOwners = model => `
typedef struct { void *pointer; unsigned signature; } lb_owned;
static int lb_owned_type;
static void lb_owned_close(lb_owned *owner) {
  if (!owner || !owner->pointer) return;
  switch (owner->signature) {
${[...model.surface.callbacks.values()].map(value => `    case ${value.index}: { ${value.ownedType} *pointer = owner->pointer; ${value.ownedType}_dispose(&pointer); owner->pointer = pointer; break; }`).join("\n")}
  }
}
static void lb_owned_destroy(zend_resource *resource) { lb_owned *owner = resource->ptr; lb_owned_close(owner); LB_ZEND_FREE(owner); }
typedef struct { zval *callback; lb_scope *scope; int *bailout; } lb_borrow;
`;

/**
 * Catch Zend bailouts inside the callback so Lean can release its frame first.
 *
 * @param model - Checked PHP projection.
 */
export const zendCallableTrampolines = model => [...model.surface.callbacks.values()].map(value => {
	const { parameters, result } = value.type.callable, inputs = parameters.map(site => phpValue(model, site.type));
	const out = phpValue(model, result.type), unit = out.scalarName === "unit";
	const structured = hasStructuredZendCallables(model);
	return `static ${model.surface.prefix}_status lb_callback${value.index}(${["void *context", ...inputs.map((input, i) => `${input.ctype}${input.aggregate ? " const *" : ""} arg${i}`), ...unit ? [] : [`${out.ctype} *out`], `${model.surface.prefix}_error *error`].join(", ")}) {
  (void)error; lb_borrow *borrow = context; lb_scope *s = borrow->scope;
  if (EG(exception) || *borrow->bailout || s->error) return 4;
  typedef struct { zval args[${inputs.length}]; zval result; int success; } callback_frame;
  callback_frame *frame = lb_allocate(s, 1, sizeof(*frame));
  if (!frame) return 4;
${structured ? "  const int saved_copy_buffers = s->copy_buffers;\n" : ""}  zend_try {
    do {
${inputs.map((input, i) => `      if (!lb_from${input.index}(${input.aggregate ? "" : "&"}arg${i}, &frame->args[${i}], s)) break;`).join("\n")}
      if (call_user_function(EG(function_table), NULL, borrow->callback, &frame->result, ${inputs.length}, frame->args) != SUCCESS || EG(exception)) break;
      ${unit ? "uint8_t unit;" : ""}
      ${structured ? "s->copy_buffers = 1;\n      " : ""}if (!lb_to${out.index}(&frame->result, ${unit ? "&unit" : "out"}, s)) break;
      ${!structured && ["string", "bytes"].includes(out.scalarName) ? `void *copy = lb_allocate(s, out->length, 1); if (!copy) break;
      if (out->length) memcpy(copy, out->data, out->length); out->data = copy;` : ""}
      frame->success = 1;
    } while (0);
  } zend_catch { *borrow->bailout = 1; } zend_end_try();
${structured ? `  s->copy_buffers = saved_copy_buffers;
  for (unsigned i = 0; i < ${inputs.length}; i++) {
    zend_try { zval_ptr_dtor(&frame->args[i]); }
    zend_catch { *borrow->bailout = 1; } zend_end_try();
    ZVAL_UNDEF(&frame->args[i]);
  }
  zend_try { zval_ptr_dtor(&frame->result); }
  zend_catch { *borrow->bailout = 1; } zend_end_try();
  ZVAL_UNDEF(&frame->result);
  return frame->success && !EG(exception) && !*borrow->bailout ? 0 : 4;` : `  for (unsigned i = 0; i < ${inputs.length}; i++) zval_ptr_dtor(&frame->args[i]);
  zval_ptr_dtor(&frame->result);
  return frame->success ? 0 : 4;`}
}
ZEND_BEGIN_ARG_INFO_EX(lb_close_args${value.index}, 0, 0, 1)
  ZEND_ARG_INFO(0, token)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_close${value.index}) {
  zval *token; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_RESOURCE(token) ZEND_PARSE_PARAMETERS_END();
  lb_owned *owner = zend_fetch_resource_ex(token, "Lean closure", lb_owned_type);
  if (!owner) RETURN_THROWS();
  if (owner->signature != ${value.index}) { zend_type_error("Lean closure signature differs"); RETURN_THROWS(); }
  lb_owned_close(owner); RETURN_NULL();
}`;
}).join("\n");

/**
 * Emit scoped downcalls for ordinary functions and owned closure invocations.
 *
 * @param model - Checked PHP projection.
 */
export const zendCallableCalls = model => {
	const { surface } = model;
	const functions = surface.functions.map((fn, i) => ({ entry: `call${i}`, symbol: fn.name, parameters: fn.declaration.parameters, result: fn.declaration.result }));
	for(const value of surface.callbacks.values()) functions.push({ entry: `invoke${value.index}`, symbol: `${value.ownedType}_call`, ...value.type.callable, closure: value });
	return functions.map(({ entry, symbol, parameters, result, closure }) => {
		const args = parameters.map(site => phpValue(model, site.type)), out = phpValue(model, result.type), owned = callable(out), unit = out.scalarName === "unit", offset = closure ? 1 : 0;
		return `typedef struct {
  lb_scope scope; int status; int bailout;
  ${surface.prefix}_error error;
  ${args.map((arg, i) => `${arg.ctype} input${i}; ${callable(arg) ? `lb_borrow borrow${i};` : ""}`).join("\n  ")}
  ${closure ? "lb_owned *owner;" : ""}
  ${unit ? "" : `${owned ? out.ownedType + " *" : out.ctype} output;`}
} lb_context_${entry};
static void lb_cleanup_${entry}(lb_context_${entry} *ctx) {
  ${owned ? `${out.ownedType}_dispose(&ctx->output);` : out.aggregate ? `${out.name}_clear(&ctx->output);` : ""}
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute_${entry}(lb_context_${entry} *ctx, zval *args, zval *out) {
  (void)args;
  ${closure ? `ctx->owner = zend_fetch_resource_ex(&args[0], "Lean closure", lb_owned_type);
  if (!ctx->owner) return;
  if (ctx->owner->signature != ${closure.index} || !ctx->owner->pointer) { lb_fail(&ctx->scope, "Closed or wrong-signature Lean closure", 1); return; }` : ""}
${args.map((arg, i) => callable(arg) ? `  ctx->borrow${i} = (lb_borrow){ &args[${i + offset}], &ctx->scope, &ctx->bailout };
  ctx->input${i}.call = lb_callback${arg.index}; ctx->input${i}.context = &ctx->borrow${i};` : `  if (!lb_to${arg.index}(&args[${i + offset}], &ctx->input${i}, &ctx->scope)) return;`).join("\n")}
  ctx->status = ${symbol}(${[...closure ? ["ctx->owner->pointer"] : [], ...args.map((arg, i) => `${arg.aggregate || callable(arg) ? "&" : ""}ctx->input${i}`), ...unit ? [] : ["&ctx->output"], "&ctx->error"].join(", ")});
  if (ctx->status || EG(exception) || ctx->bailout) return;
  ${owned ? `lb_owned *owner = LB_ZEND_CALLOC(1, sizeof(*owner));
  if (!owner) { lb_fail(&ctx->scope, "Lean closure allocation failed", 0); return; }
  zend_resource *resource = NULL;
  zend_try { resource = zend_register_resource(owner, lb_owned_type); }
  zend_catch { LB_ZEND_FREE(owner); zend_bailout(); } zend_end_try();
  owner->signature = ${out.index}; owner->pointer = ctx->output; ctx->output = NULL;
  ZVAL_RES(out, resource);` : unit ? "ZVAL_NULL(out);" : `(void)lb_from${out.index}(&ctx->output, out, &ctx->scope);`}
}
ZEND_BEGIN_ARG_INFO_EX(lb_args_${entry}, 0, 0, ${args.length + offset})
${Array.from({ length: args.length + offset }, (_, i) => `  ZEND_ARG_INFO(0, arg${i})`).join("\n")}
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_${entry}) {
  if (ZEND_NUM_ARGS() != ${args.length + offset}) { zend_argument_count_error("Expected exactly ${args.length + offset} arguments"); RETURN_THROWS(); }
  zval args[${Math.max(1, args.length + offset)}];
  ${args.length + offset ? `if (zend_get_parameters_array_ex(${args.length + offset}, args) != SUCCESS) RETURN_THROWS();` : ""}
${hasStructuredZendCallables(model) ? `  if (sizeof(lb_context_${entry}) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }\n` : ""}  lb_context_${entry} *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ZVAL_NULL(return_value);
  zend_try { lb_execute_${entry}(ctx, args, return_value); }
  zend_catch { lb_cleanup_${entry}(ctx); zend_bailout(); } zend_end_try();
  int bailout = ctx->bailout, status = ctx->status, type_error = ctx->scope.type_error;
  const char *message = ctx->scope.error; char native_message[16385];
  if (status && !message) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (!lb_readable(&ctx->scope, ctx->error.message, length, 1, 1)) message = ctx->scope.error;
    else {
      if (length) memcpy(native_message, ctx->error.message, length); native_message[length] = 0;
      message = length ? native_message : "Compiled Lean call failed";
    }
  }
  lb_cleanup_${entry}(ctx);
  if (bailout) zend_bailout();
  if (EG(exception)) { zval_ptr_dtor(return_value); ZVAL_NULL(return_value); RETURN_THROWS(); }
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}`;
	}).join("\n");
};
