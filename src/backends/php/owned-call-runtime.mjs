/**
 * Transactional PHP calls, typed callback recovery and original-error capture.
 *
 * @file
 */

/** Private native engine. No PHP exception can cross a C callback frame. */
export const ownedPhpCallRuntime = String.raw`
final class OwnedCallFrame
{
    public bool $active = true;
    public ?\Throwable $failure = null;
    public array $ids = [];
    public array $descriptors = [];
    public function __construct(public readonly OwnedConversionScope $scope) {}
}

final class OwnedCalls
{
    private readonly int $pid;
    private ?OwnedRuntime $runtime = null;
    private ?OwnedSchema $schema = null;
    private array $stubs = [];
    private array $contexts = [];
    private int $nextContext = 0;
    private int $depth = 0;
    public function __construct(private readonly \Closure $loader) { $this->pid = getmypid(); }
    private function context(): void {
        if (getmypid() !== $this->pid) OwnedRuntime::checked(6);
        if (\Fiber::getCurrent() !== null) OwnedRuntime::checked(5);
        $this->runtime?->affinity();
    }
    private function load(): OwnedRuntime {
        $this->context();
        if ($this->runtime === null) {
            $runtime = ($this->loader)();
            if (!$runtime instanceof OwnedRuntime) throw new \TypeError('Expected an authenticated owned PHP runtime');
            $runtime->affinity(); $schema = new OwnedSchema($runtime->ffi);
            $this->runtime = $runtime; $this->schema = $schema;
        }
        return $this->runtime;
    }
    public function close(): void {
        $this->context();
        if ($this->depth !== 0) throw new \LogicException('Cannot close the runtime during a Lean call');
        $this->runtime?->close();
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
    private static function validate(array $fn, array $arguments): array {
        if (!array_is_list($arguments) || count($arguments) !== count($fn['parameters'])) throw new \ArgumentCountError('Wrong Lean call arity');
        $types = []; $values = []; $callbacks = [];
        foreach ($fn['parameters'] as $index => $parameter) {
            $value = $arguments[$index]; $type = $parameter['type'];
            if (!$parameter['host']) { $types[] = $type; $values[] = $value; continue; }
            $signature = OwnedCallTypes::CALLBACKS[$type];
            $recovery = $value instanceof @NAMESPACE@\WithRecovery;
            $fallback = $recovery ? $value->value : null; $callback = $recovery ? $value->callback : $value;
            if ($callback instanceof Resource) {
                if ($recovery) throw new \TypeError('A returned Lean closure does not accept a PHP recovery wrapper');
                $types[] = $type; $values[] = $callback; $callbacks[$index] = ['closure' => $callback];
            } else {
                if ($signature['requiresRecovery'] && !$recovery) throw new \TypeError('This callback requires with_recovery and a value of its result type');
                $callbacks[$index] = ['call' => self::callback($callback, count($signature['parameters'])), 'hasRecovery' => $recovery, 'recovery' => $fallback];
                if ($recovery) { $types[] = $signature['result']; $values[] = $fallback; }
            }
        }
        // All ordinary arguments, identity arguments and recovery values share
        // one validation budget before the loader or FFI allocation runs.
        Values::checkMany($types, $values);
        return $callbacks;
    }
    private function wrap(int $type, \FFI\CData $handle, OwnedLease $lease): Resource {
        $class = $this->schema->nodes[$type]['class'];
        return ResourceAccess::wrap($class, new NativeBinding($lease, $handle,
            fn(NativeBinding $binding) => ResourceAccess::binding($this->execute(OwnedCallTypes::RETAINS[$type], [ResourceAccess::wrap($class, $binding)])),
            isset(OwnedCallTypes::CLOSURES[$type])
                ? fn(NativeBinding $binding, array $arguments) => $this->execute(OwnedCallTypes::CLOSURES[$type], [ResourceAccess::wrap($class, $binding), ...$arguments]) : null));
    }
    private function decode(int $type, \FFI\CData $pointer, OwnedConversionScope $scope, \Closure $identity): mixed {
        try {
            return OwnedConversions::read($type, $this->schema->ffi->cast('lb_php_owned_bytes', $pointer), $scope, $identity);
        } catch (\TypeError|\ValueError $error) { throw new OwnedInvalidNative('Malformed owned native result: ' . $error->getMessage()); }
    }
    private function invokeCallback(int $signature, mixed $context, mixed $session, array $arguments): int {
        $frame = null; $borrow = null;
        try {
            $this->context(); $schema = $this->schema;
            $id = $context === null ? 0 : $schema->address($schema->ffi->cast('lb_php_owned_bytes', $context));
            $entry = $this->contexts[$id] ?? null;
            if ($entry === null || $entry[0] !== $signature) return 10;
            [, $callback, $frame] = $entry;
            if (!$frame->active || $frame->failure !== null) return 10;
            $state = $frame->scope->state;
            if ($session === null || $schema->address($schema->ffi->cast('lb_php_owned_bytes', $session)) !== $schema->address($state->requireOpen()))
                throw new OwnedInvalidNative('Callback belongs to another ownership session');
            $cb = OwnedCallTypes::CALLBACKS[$signature];
            if (count($arguments) !== count($cb['parameters']) + 1) throw new OwnedInvalidNative('Wrong native callback arity');
            $output = array_pop($arguments); $values = []; $borrow = new OwnedBorrowFrame($state);
            foreach ($cb['parameters'] as $index => $type)
                $values[] = $this->decode($type, $arguments[$index], $frame->scope, fn(int $type, \FFI\CData $handle) => $this->wrap($type, $handle, $borrow->lease));
            $result = $callback(...$values); $state->requireOpen();
            $reply = OwnedConversions::write($cb['result'], $result, $frame->scope);
            $node = $schema->nodes[$cb['result']];
            $destination = $schema->pointer($schema->ffi->cast('lb_php_owned_bytes', $output), 1, $node['size'], $node['alignment']);
            \FFI::memcpy($destination, $reply, $node['size']);
            // The C trampoline snapshots this view before its native argument
            // owner expires. Reply scratch and any strong leases stay in frame.
            return 0;
        } catch (OwnedInvalidNative $error) {
            try { $this->runtime->ffi->lean_bridge_native_runtime_retire(); } catch (\Throwable) {}
            if ($frame !== null) $frame->failure ??= new @NAMESPACE@\LeanBridgeError($error->getMessage(), 9, $error);
            return 10;
        } catch (\Throwable $error) { if ($frame !== null) $frame->failure ??= $error; return 10; }
        finally { $borrow?->close(); }
    }
    private function host(int $type, array $prepared, OwnedCallFrame $frame): \FFI\CData {
        $cb = OwnedCallTypes::CALLBACKS[$type]; $scope = $frame->scope; $ffi = $this->schema->ffi;
        $scope->checkpoint(); $descriptor = $ffi->new($cb['ctype']); $frame->descriptors[] = $descriptor;
        if (isset($prepared['closure'])) {
            $input = OwnedConversions::write($type, $prepared['closure'], $scope);
            $descriptor->closure = $ffi->cast($this->schema->nodes[$type]['pointerType'], $input)[0];
            return \FFI::addr($descriptor);
        }
        if (!isset($this->stubs[$type])) {
            $scope->checkpoint(); $stub = $ffi->new($cb['ctype']);
            $stub->call = function($context, $session, ...$arguments) use ($type): int {
                try { return $this->invokeCallback($type, $context, $session, $arguments); }
                catch (\Throwable) { return 10; }
            };
            $this->stubs[$type] = $stub;
        }
        if ($prepared['hasRecovery']) {
            $recovery = OwnedConversions::write($cb['result'], $prepared['recovery'], $scope);
            $descriptor->recovery = $ffi->cast($this->schema->nodes[$cb['result']]['pointerType'], $recovery);
        }
        if ($this->nextContext === PHP_INT_MAX) throw new \OverflowException('PHP callback context identities exhausted');
        $id = ++$this->nextContext;
        $scope->checkpoint(); $frame->ids[] = $id;
        $this->contexts[$id] = [$type, $prepared['call'], $frame];
        $descriptor->call = $this->stubs[$type]->call; $descriptor->context = $ffi->cast('void*', $id);
        return \FFI::addr($descriptor);
    }
    public function call(string $name, array $arguments): mixed {
        $index = OwnedCallTypes::FUNCTIONS[$name] ?? throw new \TypeError('Unknown owned PHP export');
        return $this->execute($index, $arguments);
    }
    private function execute(int $index, array $arguments): mixed {
        $this->context(); $fn = OwnedCallTypes::CALLS[$index]; $prepared = self::validate($fn, $arguments);
        if ($this->depth >= 64) throw new \OverflowException('Lean callback reentry exceeds 64 levels');
        $this->depth++; $scope = null; $frame = null; $owner = null;
        try {
            $runtime = $this->load(); $state = $runtime->current(); $schema = $this->schema; $ffi = $runtime->ffi;
            $scope = new OwnedConversionScope($schema, $state); $frame = new OwnedCallFrame($scope); $inputs = [];
            foreach ($fn['parameters'] as $index => $parameter) {
                if ($parameter['host']) { $inputs[] = $this->host($parameter['type'], $prepared[$index], $frame); continue; }
                $node = $schema->nodes[$parameter['type']];
                $input = OwnedConversions::write($parameter['type'], $arguments[$index], $scope);
                $view = $ffi->cast($node['pointerType'], $input); $inputs[] = $node['leaf'] ? $view[0] : $view;
            }
            $node = $schema->nodes[$fn['result']]; $output = $scope->allocate($node['size']); $owner = new OwnedOwner($state);
            $status = $ffi->{$fn['symbol']}($state->requireOpen(), ...[...$inputs, $ffi->cast($node['pointerType'], $output), \FFI::addr($owner->value())]);
            if ($frame->failure !== null) throw $frame->failure;
            // The public C API labels nonzero host replies as callback failure.
            // Preserve native snapshot failures recorded by our typed shim.
            foreach ($frame->descriptors as $descriptor) OwnedRuntime::checked($descriptor->native_status);
            OwnedRuntime::checked($status);
            // Inputs, every callback and the result consume the same budgets.
            $value = $this->decode($fn['result'], $output, $scope,
                fn(int $type, \FFI\CData $handle) => $this->wrap($type, $handle, $owner->lease ?? $state->adopt($owner)));
            $owner->publish(); return $value;
        } catch (OwnedInvalidNative $error) {
            $this->runtime->ffi->lean_bridge_native_runtime_retire();
            throw new @NAMESPACE@\LeanBridgeError($error->getMessage(), 9, $error);
        } finally {
            if ($frame !== null) {
                $frame->active = false;
                foreach ($frame->ids as $id) unset($this->contexts[$id]);
                $frame->ids = []; $frame->descriptors = [];
            }
            try { $owner?->close(); }
            finally { try { $scope?->close(); } finally { $this->depth--; } }
        }
    }
}

final class Native
{
    private static ?OwnedCalls $engine = null;
    public static function configure(\Closure $loader): void {
        if (self::$engine !== null) throw new \LogicException('Owned PHP loader is already configured');
        self::$engine = new OwnedCalls($loader);
    }
    public static function call(string $name, array $arguments): mixed {
        return (self::$engine ?? throw new \LogicException('Owned PHP package loader is not installed'))->call($name, $arguments);
    }
    public static function close(): void { self::$engine?->close(); }
}
`;
