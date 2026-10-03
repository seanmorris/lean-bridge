/**
 * Public PHP ownership values, opaque Zend bindings and typed call frames.
 *
 * @file
 */
import { phpCallableLiteral as literal } from "./callable-graph-calls.mjs";
import { copiedPhpWasmLoader } from "./php-wasm-copied-loader.mjs";
import { ownedZendPhpWire } from "./owned-zend-wire.mjs";
import { ownedZendBorrowFiles, ownedZendBorrowPhpRuntime } from "./owned-zend-borrows.mjs";

const runtime = String.raw`
final class ZendBinding implements ResourceBinding
{
    public function __construct(private int $type, private mixed $resource) { $this->check(); }
    public function check(): void {
        if (!isset($this->type) || !is_resource($this->resource)) throw new \TypeError('Expected an initialized Zend identity');
        Native::identity('check', $this->type, $this->resource);
    }
    public function close(): void { Native::identity('close', $this->type, $this->resource); }
    public function retain(): ResourceBinding {
        $this->check(); return new self($this->type, Native::identity('retain', $this->type, $this->resource));
    }
    public function wire(int $type): mixed {
        if ($type !== $this->type) throw new \TypeError('Wrong nominal Zend identity');
        $this->check(); return $this->resource;
    }
    public function invoke(array $arguments): mixed {
        $this->check();
        return Native::invoke($this->type, ResourceAccess::wrap(GraphTypes::NODES[$this->type]['classes'][0], $this), $arguments);
    }
    // The Zend resource destructor handles implicit release, including in a
    // Fiber. A PHP destructor must not turn that into an explicit native call.
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Zend identities cannot be serialized'); }
    public function __unserialize(array $data): void { throw new \LogicException('Zend identities cannot be deserialized'); }
}

final class ZendFrame
{
    public bool $active = true;
    public ?\Throwable $failure = null;
    public readonly GraphBudget $validation;
    public readonly GraphBudget $writing;
    public readonly GraphBudget $reading;
    private static ?\Closure $validate = null;
    public function __construct() {
        $this->validation = new GraphBudget(); $this->writing = new GraphBudget(); $this->reading = new GraphBudget();
    }
    public function check(int $type, mixed $value): void {
        self::$validate ??= \Closure::bind(static function($type, $value, $budget): void {
            foreach (Values::walk($value, $type, $budget) as $_) {}
        }, null, Values::class);
        (self::$validate)($type, $value, $this->validation);
    }
}

final class Native
{
    private const TRANSPORT = @TRANSPORT@;
    private const LIBRARY = @LIBRARY@;
    private const FUNCTIONS = @FUNCTIONS@;
    private const CALLBACKS = @CALLBACKS@;
    private static int $depth = 0;
    private static function main(): void {
        if (\Fiber::getCurrent() !== null) throw new @NAMESPACE@\LeanBridgeError('Lean calls require the main PHP execution context', 5);
    }
    private static function symbol(string $entry): string {
        $symbol = self::TRANSPORT . '\\' . $entry;
        if (!function_exists($symbol)) {
            try { \LeanBridge\CopiedPhpWasmV1\Loader::load(self::LIBRARY, $symbol); }
            catch (\Throwable $error) { throw new @NAMESPACE@\LeanBridgeError($error->getMessage(), 7, $error); }
        }
        return $symbol;
    }
    public static function identity(string $entry, int $type, mixed $resource): mixed {
        self::main();
        if (!in_array($entry, ['check', 'close', 'retain'], true)) throw new \TypeError('Unknown identity operation');
        $symbol = self::symbol($entry);
        try { return $symbol($type, $resource); }
        catch (\Exception $error) { throw new @NAMESPACE@\LeanBridgeError($error->getMessage(), $error->getCode(), $error); }
    }
    private static function malformed(GraphInvalidWire $error): never {
        $retire = self::symbol('retire'); $retire();
        throw new @NAMESPACE@\LeanBridgeError($error->getMessage(), 9, $error);
    }
    private static function decode(int $type, mixed $value, ZendFrame $frame): mixed {
        try { return GraphWire::transfer($type, $value, true, $frame->reading); }
        catch (GraphInvalidWire $error) { self::malformed($error); }
    }
    private static function callback(mixed $value, int $arity): \Closure {
        if (!is_callable($value)) throw new \TypeError('Expected a synchronous PHP callable or generated Lean closure');
        $callback = \Closure::fromCallable($value); $reflection = new \ReflectionFunction($callback);
        if ($reflection->isGenerator() || $reflection->returnsReference()) throw new \TypeError('Callbacks cannot yield or return references');
        foreach ($reflection->getParameters() as $parameter)
            if ($parameter->isPassedByReference()) throw new \TypeError('Callback arguments cannot be references');
        if ($reflection->getNumberOfRequiredParameters() > $arity
            || (!$reflection->isVariadic() && $reflection->getNumberOfParameters() < $arity))
            throw new \ArgumentCountError('PHP callable does not accept the declared Lean callback arity');
        return $callback;
    }
    private static function prepare(int $type, mixed $value, ZendFrame $frame): array {
        $signature = self::CALLBACKS[$type];
        $explicit = $value instanceof @NAMESPACE@\WithRecovery;
        $fallback = $explicit ? $value->value : null; $value = $explicit ? $value->callback : $value;
        if ($value instanceof Resource) {
            if ($explicit) throw new \TypeError('A returned Lean closure does not accept a PHP recovery wrapper');
            $frame->check($type, $value); return ['closure' => $value];
        }
        if (!$explicit && !$signature['automaticRecovery']) throw new \TypeError('This callback requires with_recovery and a typed result value');
        $callback = self::callback($value, count($signature['parameters']) - 1);
        if ($explicit) $frame->check($signature['result'], $fallback);
        return ['call' => $callback, 'explicit' => $explicit, 'fallback' => $fallback];
    }
    private static function host(int $type, array $prepared, ZendFrame $frame): mixed {
        if (isset($prepared['closure'])) return GraphWire::transfer($type, $prepared['closure'], false, $frame->writing);
        $signature = self::CALLBACKS[$type]; $callback = $prepared['call'];
        $parameters = array_slice($signature['parameters'], 1);
        $invoke = static function(mixed ...$wire) use ($frame, $callback, $signature, $parameters): mixed {
            if (!$frame->active) throw new \LogicException('Lean callback has expired');
            if ($frame->failure !== null) throw $frame->failure;
            \LeanBridge\CopiedPhpWasmV1\Loader::enterCallback();
            try {
                if (count($wire) !== count($parameters)) throw new GraphInvalidWire('Wrong native callback arity');
                $arguments = [];
                foreach ($parameters as $index => $type) $arguments[] = self::decode($type, $wire[$index], $frame);
                $reply = $callback(...$arguments);
                $frame->check($signature['result'], $reply);
                return GraphWire::transfer($signature['result'], $reply, false, $frame->writing);
            } catch (GraphInvalidWire $error) {
                try { self::malformed($error); }
                catch (\Throwable $failure) { $frame->failure ??= $failure; throw $failure; }
            } catch (\Throwable $error) { $frame->failure ??= $error; throw $error; }
            finally { \LeanBridge\CopiedPhpWasmV1\Loader::leaveCallback(); }
        };
        $fallback = $prepared['explicit'] ? GraphWire::transfer($signature['result'], $prepared['fallback'], false, $frame->writing) : null;
        return [$invoke, $prepared['explicit'], $fallback];
    }
    private static function execute(array $fn, array $arguments): mixed {
        self::main();
        if (!array_is_list($arguments) || count($arguments) !== count($fn['parameters'])) throw new \ArgumentCountError('Wrong Lean call arity');
        if (self::$depth >= 64) throw new \OverflowException('Lean calls exceed 64 reentry levels');
        $frame = new ZendFrame(); $prepared = [];
        // Validate every ordinary argument and recovery value before loading
        // the extension or allocating any native identity.
        foreach ($fn['parameters'] as $index => $type) {
            if ($fn['host'][$index]) $prepared[$index] = self::prepare($type, $arguments[$index], $frame);
            else $frame->check($type, $arguments[$index]);
        }
        ++self::$depth;
        try {
            $inputs = [];
            foreach ($fn['parameters'] as $index => $type)
                $inputs[] = $fn['host'][$index] ? self::host($type, $prepared[$index], $frame)
                    : GraphWire::transfer($type, $arguments[$index], false, $frame->writing);
            $symbol = self::symbol($fn['entry']);
            try { $wire = $symbol(...$inputs); }
            catch (\Throwable $error) {
                if ($frame->failure !== null) throw $frame->failure;
                if ($error instanceof \Exception) throw new @NAMESPACE@\LeanBridgeError($error->getMessage(), $error->getCode(), $error);
                throw $error;
            }
            if ($frame->failure !== null) throw $frame->failure;
            return self::decode($fn['result'], $wire, $frame);
        } finally { $frame->active = false; --self::$depth; }
    }
    public static function call(int $index, array $arguments): mixed {
        return self::execute(self::FUNCTIONS[$index] ?? throw new \TypeError('Unknown Lean export'), $arguments);
    }
    public static function invoke(int $type, Resource $closure, array $arguments): mixed {
        if (!array_is_list($arguments)) throw new \ArgumentCountError('Lean closure requires positional arguments');
        return self::execute(self::CALLBACKS[$type] ?? throw new \TypeError('Resource is not a Lean closure'), [$closure, ...$arguments]);
    }
    public static function close(): void {
        self::main();
        if (self::$depth !== 0) throw new \LogicException('Cannot close the runtime during a Lean call');
        $close = self::symbol('shutdown'); $close();
    }
}
`;

/**
 * Idiomatic public values and callback APIs, without numeric identities or FFI.
 *
 * @param model - Exact wasm32 ownership type and call schema.
 */
export const generateOwnedPhpZendPhp = model => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const wholeOwners = model.anchoredResults || model.wholeOwners;
	let runtimeSource = runtime;
	if(model.hostCallbacks === false)
	{
		const start = runtimeSource.indexOf("    private static function callback("), end = runtimeSource.indexOf("    private static function execute(");
		if(start < 0 || end <= start) throw new TypeError("Zend callback runtime source anchor changed");
		runtimeSource = runtimeSource.slice(0, start) + runtimeSource.slice(end);
	}
	const signature = (fn, entry) => ({ entry
		, parameters: fn.parameters.map(id => nodes.get(id).index)
		, host: fn.hostArguments, result: nodes.get(fn.result).index
		, ...wholeOwners ? {
			whole: nodes.get(fn.result).representation !== "copied"
			, wholeParameters: fn.parameters.flatMap((_, index) => fn.anchor === index || fn.transfers?.includes(index) ? [index] : [])
		} : {}
		, ...model.callbackResultAnchors && Object.hasOwn(fn, "automaticRecovery")
			? { anchor: fn.anchor === undefined ? null : fn.anchor - 1 } : {}
		, ...Object.hasOwn(fn, "automaticRecovery") ? { automaticRecovery: fn.automaticRecovery } : {} });
	const functions = model.functions.map(fn => signature(fn, `call${fn.index}`));
	const callbacks = Object.fromEntries(model.callbacks.map(fn => [fn.type, signature(fn, `invoke${fn.index}`)]));
	const files = ownedZendBorrowFiles(model);
	files["src/Api.php"] += model.hostCallbacks === false ? "\n" : `
final readonly class WithRecovery
{
    public function __construct(public mixed $callback, public mixed $value) {
        if (\\func_num_args() !== 2) throw new \\ArgumentCountError('WithRecovery requires a callback and typed value');
    }
}
function with_recovery(mixed $callback, mixed $value): WithRecovery {
    if (\\func_num_args() !== 2) throw new \\ArgumentCountError('with_recovery requires two arguments');
    return new WithRecovery($callback, $value);
}
`;
	files["src/Api.php"] += `\
require_once __DIR__ . '/Internal/Native.php';
${model.functions.map(fn => `/**
${fn.parameters.map((id, index) => ` * @param ${wholeOwners && (fn.anchor === index || fn.transfers?.includes(index)) ? nodes.get(id).ownerType ?? `Value<${nodes.get(id).docType}>` : fn.hostArguments[index] ? `callable|${nodes.get(id).docType}|WithRecovery` : nodes.get(id).docType} $${fn.publicParameters[index]}`).join("\n")}${fn.transfers?.length ? `\n * Consumes ${wholeOwners ? "original whole owners" : "resource leases"} in ${fn.transfers.map(index => "$" + fn.publicParameters[index]).join(", ")} at the Lean call boundary.` : ""}
 * @return ${fn.whole ? nodes.get(fn.result).ownerType ?? `Value<${nodes.get(fn.result).docType}>` : nodes.get(fn.result).docType}
 */
function ${fn.publicName}(${fn.publicParameters.map(name => `mixed $${name}`).join(", ")}): ${fn.whole ? nodes.get(fn.result).ownerType ?? "Value" : nodes.get(fn.result).publicType} {
    if (\\func_num_args() !== ${fn.parameters.length}) throw new \\ArgumentCountError('${fn.publicName} requires exactly ${fn.parameters.length} arguments');
    return Internal\\Native::call(${fn.index}, [${fn.publicParameters.map(name => `$${name}`).join(", ")}]);
}`).join("\n\n")}
`;
	files["src/Internal/Wire.php"] = `<?php\ndeclare(strict_types=1);\nnamespace ${model.namespace}\\Internal;\nrequire_once __DIR__ . '/Values.php';\n${ownedZendPhpWire(model.namespace)}\n`;
	files["src/Internal/Native.php"] = `<?php\ndeclare(strict_types=1);\n${copiedPhpWasmLoader}\nnamespace ${model.namespace}\\Internal {\nrequire_once __DIR__ . '/Wire.php';\n${ownedZendBorrowPhpRuntime(runtimeSource, model, literal)
		.replaceAll("@NAMESPACE@", `\\${model.namespace}`)
		.replace("@TRANSPORT@", literal(model.transport)).replace("@LIBRARY@", literal(model.library))
		.replace("@FUNCTIONS@", literal(functions)).replace("@CALLBACKS@", literal(callbacks))}\n}\n`;
	if(Object.values(files).reduce((bytes, source) => bytes + Buffer.byteLength(source), 0) > 16 * 1024 * 1024)
		throw new TypeError("Owned Zend PHP sources exceed 16 MiB");
	return files;
};
