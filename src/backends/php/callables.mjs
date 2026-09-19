/**
 * Request-bounded PHP FFI trampolines and owned, invokable Lean closures.
 *
 * @file
 */

/**
 * Resolve a copied value or primitive callable without exposing its C layout.
 *
 * @param model - Admitted PHP projection.
 * @param ref - Canonical type reference.
 */
export const phpValue = (model, ref) => model.surface.copy(ref) ?? model.surface.callbacks.get(ref.id);
const callable = value => Boolean(value.type?.callable);

/** Public lifetime API. All arguments stay mixed to prevent weak-call coercion. */
export const phpClosurePublic = String.raw`
final class LeanClosure
{
    private function __construct(private Internal\Lease $lease) {}
    private function __clone() {}
    public function __invoke(mixed ...$arguments): mixed { return $this->lease->invoke($arguments); }
    public function isClosed(): bool { return $this->lease->isClosed(); }
    public function close(): void { $this->lease->close(); }
    public function __serialize(): array { throw new \LogicException('Lean closures cannot be serialized'); }
    public function __unserialize(array $data): void { throw new \LogicException('Lean closures cannot be unserialized'); }
}
`;

/** Private state, shared by the FFI calls and compiled lifetime tests. */
export const phpCallableState = String.raw`
final class CallFrame
{
    public ?\Throwable $failure = null;
    public array $ids = [];
}

final class Lease
{
    private int $pid;
    private bool $closed = false;
    private int $active = 0;
    public function __construct(private \Closure $invoke, private \Closure $dispose, private \FFI\CData $output, private int $arity) {
        self::ensureCall(); $this->pid = getmypid();
    }
    public static function ensureCall(): void {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        if (\Fiber::getCurrent() !== null) throw new \LogicException('Lean callables require the main PHP execution context');
    }
    public function isClosed(): bool { \LeanBridge\CopiedNativeV1\Runtime::ensureProcess(); return $this->closed; }
    public function invoke(array $arguments): mixed {
        self::ensureCall();
        if ($this->closed) throw new \LogicException('Lean closure is closed');
        if (!array_is_list($arguments) || count($arguments) !== $this->arity) throw new \ArgumentCountError('Lean closure requires exactly ' . $this->arity . ' positional arguments');
        ++$this->active;
        try { return ($this->invoke)($this->output, $arguments); }
        finally { --$this->active; if ($this->closed && $this->active === 0) ($this->dispose)($this->output); }
    }
    public function close(): void {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        $this->closed = true;
        if ($this->active === 0) ($this->dispose)($this->output);
    }
    public function __destruct() {
        // Never enter inherited native state while a forked child shuts down.
        try { if (isset($this->pid) && $this->pid === getmypid()) $this->close(); } catch (\Throwable $ignored) {}
    }
}
`;

/**
 * Emit the same pointer-based primitive callable ABI used by other native hosts.
 *
 * @param model - Admitted native PHP projection.
 */
export const phpCallableDefinitions = model => [...model.surface.callbacks.values()].map(value => {
	const { parameters, result } = value.type.callable, output = phpValue(model, result.type);
	const args = parameters.map(site => { const input = phpValue(model, site.type); return input.ctype + (input.aggregate ? " *" : ""); });
	const tail = [...args, ...output.scalarName === "unit" ? [] : [`${output.ctype} *`], "BridgeError *"].join(", ");
	return `typedef struct { int (*call)(void *, ${tail}); void *context; } ${value.ctype};
typedef struct ${value.ownedType} ${value.ownedType};
int ${value.ownedType}_call(${value.ownedType} *, ${tail});
void ${value.ownedType}_dispose(${value.ownedType} **);`;
}).join("\n");

/**
 * Generate a scoped downcall, retaining the first callback failure until cleanup.
 *
 * @param model - Admitted PHP projection.
 * @param options - One ordinary or returned-function signature.
 * @param options.name - Private PHP method name.
 * @param options.symbol - Native entry point.
 * @param options.parameters - Canonical argument sites.
 * @param options.result - Canonical result site.
 * @param options.closure - Include an owned function token.
 */
export const phpNativeCall = (model, { name, symbol, parameters, result, closure = false }) => {
	const inputs = parameters.map(site => phpValue(model, site.type)), output = phpValue(model, result.type);
	const owned = callable(output), unit = output.scalarName === "unit", callbacks = inputs.some(callable);
	return `    public static function ${name}(${[...closure ? ["\\FFI\\CData $token"] : [], ...inputs.map((_, i) => `mixed $arg${i}`)].join(", ")}): mixed {
        \\LeanBridge\\CopiedNativeV1\\Runtime::ensureProcess();
        ${owned || closure || callbacks ? "Lease::ensureCall();" : ""}
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        ${callbacks ? "$frame = new CallFrame();" : ""}
        ${unit ? "" : `$out = $ffi->new('${owned ? output.ownedType + " *" : output.ctype}');`}
        $error = $ffi->new('BridgeError');
        try {
${inputs.map((value, i) => `            $input${i} = ${callable(value) ? `self::borrow${value.index}($arg${i}, $scope, $validation, $frame)` : `self::to${value.index}(Checks::check${value.index}($arg${i}, $validation), $scope)`};`).join("\n")}
            $status = $ffi->${symbol}(${[...closure ? ["$token"] : [], ...inputs.map((value, i) => value.aggregate || callable(value) ? `\\FFI::addr($input${i})` : `$input${i}->cdata`), ...unit ? [] : ["\\FFI::addr($out)"], "\\FFI::addr($error)"].join(", ")});
            ${callbacks ? "if ($frame->failure !== null) throw $frame->failure;" : ""}
            if ($status !== 0) {
                $message = $error->message === null || \\FFI::isNull($error->message) ? 'Native Lean call failed' : \\FFI::string($error->message, min($error->message_length, 16384));
                throw new \\${model.namespace}\\LeanBridgeError($message, $status);
            }
            ${owned ? `$owned = self::own${output.index}($out, $ffi); $out = null; return $owned;` : `return ${unit ? "null" : `self::from${output.index}($out${output.aggregate ? "" : "->cdata"}, $scope)`};`}
        } finally {
            try { ${owned ? `if ($out !== null) $ffi->${output.ownedType}_dispose(\\FFI::addr($out));` : output.aggregate ? `$ffi->${output.name}_clear(\\FFI::addr($out));` : "/* No native output owner. */"} }
            finally {
                ${callbacks ? "foreach ($frame->ids as $id) unset(self::$contexts[$id]);" : ""}
                $scope->close();
            }
        }
    }`;
};

/**
 * Cache one trampoline per signature; never retain a caller in an FFI closure.
 *
 * @param model - Admitted PHP projection.
 */
export const phpCallableRuntime = model => !model.surface.callbacks.size ? "" : `
    private static array $stubs = [];
    private static array $contexts = [];
    private static int $nextContext = 0;
    private static ?\\Closure $wrap = null;
${[...model.surface.callbacks.values()].map(value => {
	const i = value.index, { parameters, result } = value.type.callable, output = phpValue(model, result.type), unit = output.scalarName === "unit";
	const args = ["$context", ...parameters.map((_, n) => `$arg${n}`), ...unit ? [] : ["$output"], "$error"];
	return `    private static function borrow${i}(mixed $value, Scope $scope, Budget $validation, CallFrame $frame): \\FFI\\CData {
        if (!is_callable($value)) throw new \\TypeError('Expected a synchronous callable');
        $callback = \\Closure::fromCallable($value);
        $reflection = new \\ReflectionFunction($callback);
        if ($reflection->isGenerator() || $reflection->returnsReference()) throw new \\TypeError('Lean callbacks cannot be generators or return references');
        foreach ($reflection->getParameters() as $parameter) if ($parameter->isPassedByReference()) throw new \\TypeError('Lean callbacks cannot take reference parameters');
        $ffi = $scope->ffi;
        if (!isset(self::$stubs[${i}])) {
            $stub = $ffi->new('${value.ctype}');
            $stub->call = static function (${args.join(", ")}): int {
                $state = null;
                try {
                    $id = self::$ffi->cast('uint64_t *', $context)[0];
                    $state = self::$contexts[$id] ?? null;
                    if ($state === null || $state[3]->failure !== null) return 4;
                    [$callback, $scope, $validation, $frame] = $state;
                    $result = $callback(${parameters.map((site, n) => { const v = phpValue(model, site.type); return `self::from${v.index}($arg${n}${v.aggregate ? "[0]" : ""}, $scope)`; }).join(", ")});
                    $checked = Checks::check${output.index}($result, $validation);
                    ${unit ? "" : `$converted = self::to${output.index}($checked, $scope);\n                    $output[0] = $converted${output.aggregate ? "" : "->cdata"};`}
                    return 0;
                } catch (\\Throwable $failure) {
                    if ($state !== null) $state[3]->failure ??= $failure;
                    return 4;
                }
            };
            self::$stubs[${i}] = $stub;
        }
        if (self::$nextContext === PHP_INT_MAX) throw new \\OverflowException('Lean callback context identities exhausted');
        $id = ++self::$nextContext;
        $context = $scope->allocate('uint64_t'); $context->cdata = $id;
        $input = $scope->allocate('${value.ctype}');
        $input->call = self::$stubs[${i}]->call; $input->context = \\FFI::addr($context);
        $frame->ids[] = $id;
        self::$contexts[$id] = [$callback, $scope, $validation, $frame];
        return $input;
    }
    private static function own${i}(\\FFI\\CData $output, \\FFI $ffi): \\${model.namespace}\\LeanClosure {
        if (\\FFI::isNull($output)) throw new \\RuntimeException('Missing returned Lean closure');
        $lease = new Lease(static fn($token, $args) => self::invoke${i}($token, ...$args),
            static function ($pointer) use ($ffi): void { $ffi->${value.ownedType}_dispose(\\FFI::addr($pointer)); }, $output, ${parameters.length});
        self::$wrap ??= \\Closure::bind(static fn(Lease $lease) => new \\${model.namespace}\\LeanClosure($lease), null, \\${model.namespace}\\LeanClosure::class);
        return (self::$wrap)($lease);
    }
${phpNativeCall(model, { name: `invoke${i}`, symbol: value.ownedType + "_call", parameters, result, closure: true })}`;
}).join("\n")}`;
