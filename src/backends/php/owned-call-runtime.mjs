/**
 * Transactional PHP calls, typed callback recovery and original-error capture.
 *
 * @file
 */

/**
 * Keep PHP exceptions inside the host callback frame.
 *
 * @param options - Explicit transport capabilities.
 * @param options.transferredInputs - Prepare and finish consuming input groups.
 * @param options.anchoredResults - Carry whole roots and original native slots.
 */
export const ownedPhpCallRuntime = ({ transferredInputs: requestedTransfers = false, anchoredResults = false } = {}) => {
	const transferredInputs = requestedTransfers && !anchoredResults;
	return String.raw`
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
                ? fn(NativeBinding $binding, array $arguments) => $this->execute(OwnedCallTypes::CLOSURES[$type], [ResourceAccess::wrap($class, $binding), ...$arguments]) : null${anchoredResults ? ", fn(NativeBinding $left, NativeBinding $right) => $this->equal($type, $left, $right)" : ""}));
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
${anchoredResults ? String.raw`    private function equal(int $type, NativeBinding $left, NativeBinding $right): bool {
        $state = $this->load()->current(); $pins = [];
        try {
            $pins[] = new OwnedPin($left->pin($state)); $pins[] = new OwnedPin($right->pin($state));
            $ffi = $state->runtime->ffi; $result = $ffi->new('bool');
            OwnedRuntime::checked($ffi->{OwnedCallTypes::EQUALITY[$type]}($state->requireOpen(), $left->raw($state), $right->raw($state), \FFI::addr($result)));
            return $result->cdata;
        } finally { OwnedPin::closeAll($pins); }
    }
    private function copyTyped(int $type, mixed $value): @NAMESPACE@\Value {
        return $this->execute(OwnedCallTypes::COPIES[$type], [$value], true);
    }
    public function copyValue(mixed $value, ?string $resultOf, ?array $parameterOf): @NAMESPACE@\Value {
        $this->context();
        if ($resultOf !== null && $parameterOf !== null) throw new \TypeError('Choose resultOf or parameterOf');
        $type = null;
        if ($resultOf !== null) $type = OwnedCallTypes::RESULTS[$resultOf] ?? null;
        elseif ($parameterOf !== null) {
            if (!array_is_list($parameterOf) || count($parameterOf) !== 2 || !is_string($parameterOf[0])
                || (!is_string($parameterOf[1]) && !is_int($parameterOf[1]))) throw new \TypeError('parameterOf requires [function, parameter]');
            $type = OwnedCallTypes::PARAMETERS[$parameterOf[0] . '/' . $parameterOf[1]] ?? null;
        } elseif ($value instanceof @NAMESPACE@\Value) return $value->retain();
        elseif (is_object($value)) $type = OwnedCallTypes::NOMINALS[$value::class] ?? null;
        if ($type === null) throw new \TypeError('Select an owned resultOf or parameterOf for this value');
        if ($value instanceof @NAMESPACE@\Value) { ValueAccess::snapshot($value, $type); return $value->retain(); }
        return $this->copyTyped($type, $value);
    }
` : ""}    private function execute(int $index, array $arguments${anchoredResults ? ", bool $wholeCopy = false" : ""}): mixed {
        $this->context(); $fn = OwnedCallTypes::CALLS[$index];${anchoredResults ? String.raw`
        $wholeInputs = []; $inputLeases = []; $pins = []; $moves = [];
        foreach ($fn['parameters'] as $position => $parameter) {
            if (isset($parameter['transfer']) || isset($parameter['anchor'])) {
                $wholeInputs[$position] = $arguments[$position] ?? null;
                [$inputLeases[$position], , $arguments[$position]] = ValueAccess::snapshot($wholeInputs[$position], $parameter['type']);
            }
        }
        ` : " "}$prepared = self::validate($fn, $arguments);
        if ($this->depth >= 64) throw new \OverflowException('Lean callback reentry exceeds 64 levels');
        $this->depth++; $scope = null; $frame = null; $owner = null;${transferredInputs ? " $moves = [];" : ""}
        try {
            $runtime = $this->load(); $state = $runtime->current(); $schema = $this->schema; $ffi = $runtime->ffi;
${anchoredResults ? String.raw`            foreach ($inputLeases as $position => $lease) {
                if ($lease->state !== $state) OwnedRuntime::checked(1);
                $pins[] = new OwnedPin($lease);
                if (isset($fn['parameters'][$position]['transfer'])) $moves[$position] = new OwnedInputGroup($lease);
            }
` : ""}            $scope = new OwnedConversionScope($schema, $state); $frame = new OwnedCallFrame($scope); $inputs = [];
            foreach ($fn['parameters'] as $index => $parameter) {${transferredInputs ? "\n                $scope->inputGroup = isset($parameter['transfer']) ? ($moves[$index] = new OwnedInputGroup($state)) : null;" : ""}
                if ($parameter['host']) { $inputs[] = $this->host($parameter['type'], $prepared[$index], $frame); continue; }
                $node = $schema->nodes[$parameter['type']];
                $input = OwnedConversions::write($parameter['type'], $arguments[$index], $scope);
                $view = $ffi->cast($node['pointerType'], $input); $inputs[] = $node['leaf'] ? $view[0] : $view;
            }
${transferredInputs ? String.raw`            $scope->inputGroup = null;
            foreach ($moves as $index => $move) $inputs[$index] = $move->prepare($fn['parameters'][$index], $schema, $inputs[$index]);
            $arguments = [];
            foreach ($inputs as $index => $input) {
                $arguments[] = $input;
                if (isset($moves[$index])) $arguments[] = $moves[$index]->owner();
            }
            $inputs = $arguments;
` : anchoredResults ? String.raw`            $actual = [];
            foreach ($inputs as $position => $input) {
                $actual[] = $input;
                if (isset($moves[$position])) $actual[] = $moves[$position]->owner();
                if (isset($fn['parameters'][$position]['anchor'])) {
                    $inputLeases[$position]->requireOpen(); $actual[] = $inputLeases[$position]->slot->value;
                }
            }
            $inputs = $actual;
` : ""}            $node = $schema->nodes[$fn['result']]; $output = $scope->allocate($node['size']); $owner = new OwnedOwner($state);
${transferredInputs || anchoredResults ? "            OwnedInputGroup::armAll($moves);\n" : ""}            $status = $ffi->{$fn['symbol']}($state->requireOpen(), ...[...$inputs, $ffi->cast($node['pointerType'], $output), \FFI::addr($owner->value())]);
${transferredInputs || anchoredResults ? "            OwnedInputGroup::finishAll($moves); $moves = [];\n" : ""}            if ($frame->failure !== null) throw $frame->failure;
            // The public C API labels nonzero host replies as callback failure.
            // Preserve native snapshot failures recorded by our typed shim.
            foreach ($frame->descriptors as $descriptor) OwnedRuntime::checked($descriptor->native_status);
${anchoredResults ? String.raw`            // Reentry can remove the original native owner before C reports its
            // failed result commit. Report the expired host lifetime first.
            if ($fn['anchor'] !== null) $inputLeases[$fn['anchor']]->requireOpen();
` : ""}            OwnedRuntime::checked($status);
${anchoredResults ? String.raw`            if ($fn['anchor'] !== null) {
                $anchor = $inputLeases[$fn['anchor']];
                $lease = $owner->lease ?? $state->adopt($owner); $lease->anchor = $anchor;
            }
` : ""}            // Inputs, every callback and the result consume the same budgets.
            $value = $this->decode($fn['result'], $output, $scope,
                fn(int $type, \FFI\CData $handle) => $this->wrap($type, $handle, $owner->lease ?? $state->adopt($owner)));
${anchoredResults ? String.raw`            if ($wholeCopy || $fn['whole']) {
                $value = ValueAccess::wrap($owner->lease ?? $state->adopt($owner), $fn['result'], $value,
                    fn(mixed $payload) => $this->copyTyped($fn['result'], $payload));
            }
` : ""}            $owner->publish(); return $value;
        } catch (OwnedInvalidNative $error) {
            $this->runtime->ffi->lean_bridge_native_runtime_retire();
            throw new @NAMESPACE@\LeanBridgeError($error->getMessage(), 9, $error);
        } finally {
            if ($frame !== null) {
                $frame->active = false;
                foreach ($frame->ids as $id) unset($this->contexts[$id]);
                $frame->ids = []; $frame->descriptors = [];
            }
${anchoredResults ? "            try {\n" : ""}${transferredInputs || anchoredResults ? "            try { OwnedInputGroup::finishAll($moves); } finally {\n" : ""}            try { $owner?->close(); }
            finally { try { $scope?->close(); } finally { $this->depth--; } }
${transferredInputs || anchoredResults ? "            }\n" : ""}${anchoredResults ? String.raw`            } finally {
                try { OwnedPin::closeAll($pins); }
                finally { $pins = []; $inputLeases = []; $wholeInputs = []; }
            }
` : ""}        }
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
${anchoredResults ? String.raw`    public static function copyValue(mixed $value, ?string $resultOf, ?array $parameterOf): @NAMESPACE@\Value {
        return (self::$engine ?? throw new \LogicException('Owned PHP package loader is not installed'))->copyValue($value, $resultOf, $parameterOf);
    }
` : ""}}
`;
};
