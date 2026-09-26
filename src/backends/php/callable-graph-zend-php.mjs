/**
 * Public recursive PHP callables over a private, resource-owned Zend transport.
 *
 * @file
 */
import { phpCallableLiteral } from "./callable-graph-calls.mjs";
import { phpClosurePublic } from "./callables.mjs";
import { phpGraphWire } from "./copied-graph-wire.mjs";
import { copiedPhpWasmLoader } from "./php-wasm-copied-loader.mjs";

/** Conversion budgets belong to the complete call, including callback replies. */
export const phpZendGraphTransfers = String.raw`
final class CallableTransfers
{
    private static ?\Closure $walk = null;
    private static ?\Closure $validate = null;
    public static function check(int $type, mixed $value, GraphBudget $budget): void {
        self::$validate ??= \Closure::bind(static function($type, $value, $budget): void {
            foreach (Values::walk($value, $type, $budget) as $_) {}
        }, null, Values::class);
        (self::$validate)($type, $value, $budget);
    }
    public static function wire(int $type, mixed $value, bool $reading, GraphBudget $budget): mixed {
        self::$walk ??= \Closure::bind(static fn($type, $value, $reading, $budget) => GraphWire::walk($type, $value, $reading, $budget), null, GraphWire::class);
        $result = (self::$walk)($type, $value, $reading, $budget);
        if ($reading) {
            try { Values::check($type, $result); }
            catch (\TypeError|\ValueError $error) { throw new GraphInvalidWire($error->getMessage(), 0, $error); }
        }
        return $result;
    }
}

final class CallableFrame
{
    public ?\Throwable $failure = null;
    public bool $active = true;
    public readonly GraphBudget $validation;
    public readonly GraphBudget $writing;
    public readonly GraphBudget $reading;
    public function __construct() {
        $this->validation = new GraphBudget();
        $this->writing = new GraphBudget();
        $this->reading = new GraphBudget();
    }
}
`;

/** Native uint64 identities never pass through a 32-bit PHP integer. */
export const phpZendGraphLease = String.raw`
final class Lease
{
    private bool $closed = false;
    private int $active = 0;
    public function __construct(private \Closure $invoke, private \Closure $dispose, private mixed $token, private int $arity) {
        self::ensureCall();
        if (!is_resource($token)) throw new \LogicException('Expected a private Lean closure resource');
    }
    public static function ensureCall(): void {
        if (\Fiber::getCurrent() !== null) throw new \LogicException('Lean callables require the main PHP execution context');
    }
    public function isClosed(): bool { return $this->closed; }
    public function invoke(array $arguments): mixed {
        self::ensureCall();
        if ($this->closed) throw new \LogicException('Lean closure is closed');
        if (!array_is_list($arguments) || count($arguments) !== $this->arity)
            throw new \ArgumentCountError('Lean closure requires exactly ' . $this->arity . ' positional arguments');
        ++$this->active;
        try { return ($this->invoke)($this->token, $arguments); }
        finally { --$this->active; if ($this->closed && $this->active === 0) $this->release(); }
    }
    private function release(): void {
        $token = $this->token; $this->token = null;
        if ($token !== null) ($this->dispose)($token);
    }
    public function close(): void { $this->closed = true; if ($this->active === 0) $this->release(); }
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Lean closures cannot be serialized'); }
    public function __unserialize(array $data): void { throw new \LogicException('Lean closures cannot be unserialized'); }
    public function __destruct() { try { $this->close(); } catch (\Throwable $ignored) {} }
}
`;

/** Private wrapper state does not retain a callback after its downcall finishes. */
export const phpZendGraphCalls = String.raw`
    private static int $depth = 0;
    private static ?\Closure $wrap = null;
    private static function malformed(GraphInvalidWire $error): never {
        $retire = self::TRANSPORT . '\\retire'; $retire();
        throw new GRAPH_NAMESPACE\LeanBridgeError($error->getMessage(), 4, $error);
    }
    private static function decode(int $type, mixed $value, CallableFrame $frame): mixed {
        try { return CallableTransfers::wire($type, $value, true, $frame->reading); }
        catch (GraphInvalidWire $error) { self::malformed($error); }
    }
    private static function borrow(int $signature, mixed $value, CallableFrame $frame): \Closure {
        if (!is_callable($value)) throw new \TypeError('Expected a synchronous callable');
        $callback = \Closure::fromCallable($value); $reflection = new \ReflectionFunction($callback);
        if ($reflection->isGenerator() || $reflection->returnsReference()) throw new \TypeError('Lean callbacks cannot be generators or return references');
        foreach ($reflection->getParameters() as $parameter)
            if ($parameter->isPassedByReference()) throw new \TypeError('Lean callbacks cannot take reference parameters');
        $frame->validation->charge(32);
        $fn = self::CALLBACKS[$signature];
        return static function (mixed ...$wire) use ($callback, $frame, $fn): mixed {
            if (!$frame->active) throw new \LogicException('Lean callback has expired');
            if ($frame->failure !== null) throw $frame->failure;
            try {
                if (count($wire) !== count($fn['parameters'])) throw new GraphInvalidWire('Wrong native callback arity');
                $arguments = [];
                foreach ($fn['parameters'] as $index => $type) $arguments[] = self::decode($type, $wire[$index], $frame);
                $reply = $callback(...$arguments);
                CallableTransfers::check($fn['result'], $reply, $frame->validation);
                return CallableTransfers::wire($fn['result'], $reply, false, $frame->writing);
            } catch (GraphInvalidWire $error) {
                try { self::malformed($error); }
                catch (\Throwable $failure) { $frame->failure ??= $failure; throw $failure; }
            } catch (\Throwable $error) { $frame->failure ??= $error; throw $error; }
        };
    }
    private static function own(int $signature, mixed $token): GRAPH_NAMESPACE\LeanClosure {
        if (!is_resource($token)) self::malformed(new GraphInvalidWire('Malformed native Lean closure resource'));
        $close = self::TRANSPORT . '\\close' . $signature;
        try {
            $fn = self::CALLBACKS[$signature];
            $lease = new Lease(static fn($token, $args) => self::execute('invoke' . $signature,
                array_map(static fn($type) => ['type' => $type], $fn['parameters']), ['type' => $fn['result']], $args, $token),
                static fn($token) => $close($token), $token, count($fn['parameters']));
            self::$wrap ??= \Closure::bind(static fn(Lease $lease) => new GRAPH_NAMESPACE\LeanClosure($lease), null, GRAPH_NAMESPACE\LeanClosure::class);
            return (self::$wrap)($lease);
        } catch (\Throwable $error) { if (!isset($lease)) $close($token); throw $error; }
    }
    private static function execute(string $entry, array $parameters, array $result, array $arguments, mixed $token = null): mixed {
        Lease::ensureCall();
        if (!array_is_list($arguments) || count($arguments) !== count($parameters)) throw new \ArgumentCountError('Wrong Lean callable arity');
        if (self::$depth === 64) throw new \OverflowException('Lean calls exceed 64 reentry levels');
        $frame = new CallableFrame(); ++self::$depth;
        try {
            $inputs = [];
            // Validate the entire public call before loading a native extension.
            foreach ($parameters as $index => $site) {
                if (isset($site['callback'])) $inputs[$index] = self::borrow($site['callback'], $arguments[$index], $frame);
                else CallableTransfers::check($site['type'], $arguments[$index], $frame->validation);
            }
            foreach ($parameters as $index => $site)
                if (!isset($site['callback'])) $inputs[$index] = CallableTransfers::wire($site['type'], $arguments[$index], false, $frame->writing);
            ksort($inputs);
            $symbol = self::TRANSPORT . '\\' . $entry;
            if (!function_exists($symbol)) {
                try { \LeanBridge\CopiedPhpWasmV1\Loader::load(self::LIBRARY, $symbol); }
                catch (\Throwable $error) { throw new GRAPH_NAMESPACE\LeanBridgeError($error->getMessage(), 0, $error); }
            }
            try { $output = $token === null ? $symbol(...$inputs) : $symbol($token, ...$inputs); }
            catch (\Throwable $error) {
                if ($frame->failure !== null) throw $frame->failure;
                if ($error instanceof \Exception) throw new GRAPH_NAMESPACE\LeanBridgeError($error->getMessage(), $error->getCode(), $error);
                throw $error;
            }
            if ($frame->failure !== null) throw $frame->failure;
            return isset($result['callback']) ? self::own($result['callback'], $output) : self::decode($result['type'], $output, $frame);
        } finally { $frame->active = false; --self::$depth; }
    }
    public static function call(int $index, array $arguments): mixed {
        $fn = self::FUNCTIONS[$index] ?? throw new \TypeError('Unknown Lean callable');
        return self::execute('call' . $index, $fn['parameters'], $fn['result'], $arguments);
    }
`;

/**
 * Emit only PHP values and wrappers. Native generation and admission are separate.
 *
 * @param model - Finite wasm32 payloads and original public callable declarations.
 */
export const generateCallablePhpGraphZendPhp = model => {
	const files = { ...model.files }, value = site => site.callback ? { callback: site.callback.index } : { type: site.node.index };
	const callbacks = [...model.callbacks.values()].map(cb => ({ parameters: cb.parameters.map(node => node.index), result: cb.result.index }));
	const functions = model.functions.map(fn => ({ parameters: fn.parameters.map(value), result: value(fn.result) }));
	const doc = site => site.callback ? site.callback.docType : site.node.docType;
	files["src/Api.php"] += `\n${phpClosurePublic}\nrequire_once __DIR__ . '/Internal/Native.php';\n\n${model.functions.map(fn => `/**
${fn.parameters.map((site, index) => ` * @param ${doc(site)} $${fn.parameterNames[index]}`).join("\n")}
 * @return ${fn.result.callback ? "LeanClosure&" : ""}${doc(fn.result)}
 */
function ${fn.publicName}(${fn.parameterNames.map(name => `mixed $${name}`).join(", ")}): ${fn.result.callback ? "LeanClosure" : fn.result.node.publicType} {
    if (\\func_num_args() !== ${fn.parameters.length}) throw new \\ArgumentCountError('${fn.publicName} requires exactly ${fn.parameters.length} arguments');
    return Internal\\Native::call(${fn.index}, [${fn.parameterNames.map(name => `$${name}`).join(", ")}]);
}`).join("\n\n")}\n`;
	files["src/Internal/Wire.php"] = `<?php\ndeclare(strict_types=1);\nnamespace ${model.namespace}\\Internal;\nrequire_once __DIR__ . '/Values.php';\n${phpGraphWire.replaceAll("GRAPH_NAMESPACE", `\\${model.namespace}`)}\n`;
	files["src/Internal/Native.php"] = `<?php
declare(strict_types=1);
${copiedPhpWasmLoader}
namespace ${model.namespace}\\Internal {
require_once __DIR__ . '/Wire.php';
${phpZendGraphTransfers}
${phpZendGraphLease}
final class Native
{
    private const TRANSPORT = ${phpCallableLiteral(model.transport)};
    private const LIBRARY = ${phpCallableLiteral(model.library)};
    private const CALLBACKS = ${phpCallableLiteral(callbacks)};
    private const FUNCTIONS = ${phpCallableLiteral(functions)};
${phpZendGraphCalls.replaceAll("GRAPH_NAMESPACE", `\\${model.namespace}`)}
}
}
`;
	if(Object.values(files).reduce((size, text) => size + Buffer.byteLength(text), 0) > 16 * 1024 * 1024)
		throw new TypeError("PHP callable sources exceed 16 MiB");
	return files;
};
