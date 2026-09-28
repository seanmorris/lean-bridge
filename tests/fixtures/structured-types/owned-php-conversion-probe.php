<?php
declare(strict_types=1);

require __DIR__ . '/dependencies/brick-math/autoload.php';
require __DIR__ . '/src/Api.php';
require __DIR__ . '/src/Internal/OwnedRuntime.php';
require __DIR__ . '/src/Internal/OwnedConversions.php';
require __DIR__ . '/loader.php';

use LeanOwnedAggregates\Internal\{OwnedRuntime, OwnedOwner, OwnedSchema, OwnedConversionScope, OwnedConversions, NativeBinding, ResourceAccess, Resource};

$checks = 0; $remaining = -1; $checkpoints = 0; $beforeRead = null;
$injected = new RuntimeException('Injected owned PHP conversion checkpoint');
$model = json_decode(file_get_contents(__DIR__ . '/probe-model.json'), true, 512, JSON_THROW_ON_ERROR);
$definitions = LeanOwnedAggregates\Internal\OwnedNativeTypes::DEFINITIONS . "\nsize_t owned_test_live(void);\nsize_t owned_test_identities(void);\nvoid owned_test_fail_after(ptrdiff_t);\n";
$ffi = LeanBridge\CopiedNativeV1\Runtime::load(__DIR__ . '/runtime/lib',
    json_decode(file_get_contents(__DIR__ . '/native-evidence.json'), true, 512, JSON_THROW_ON_ERROR), $definitions);
$runtime = new OwnedRuntime($ffi, LeanBridge\CopiedNativeV1\Runtime::ensureProcess(...), static function() use (&$remaining, &$checkpoints, $injected): void {
    $checkpoints++;
    if ($remaining === 0) throw $injected;
    if ($remaining > 0) $remaining--;
});
$schema = new OwnedSchema($ffi);

function check(bool $value, string $message = ''): void {
    global $checks; $checks++;
    if (!$value) throw new RuntimeException('Owned PHP converter: ' . $message);
}
function reject(callable $call, ?int $code = null): void {
    try { $call(); } catch (Throwable $error) {
        check($code === null || $error->getCode() === $code, $error->getMessage()); return;
    }
    throw new RuntimeException('Expected owned PHP rejection');
}
function dispose(mixed $value): void {
    $stack = [$value]; $seen = new SplObjectStorage();
    while ($stack) {
        $item = array_pop($stack);
        if (is_object($item)) {
            if ($seen->contains($item)) continue;
            $seen->attach($item);
            if ($item instanceof Resource) { $item->close(); continue; }
            $item = get_object_vars($item);
        }
        if (is_array($item)) foreach ($item as $child) $stack[] = $child;
    }
}
function replace_value(object $value, array $changes): object {
    return new ($value::class)(...array_values(array_replace(get_object_vars($value), $changes)));
}
function semantic_value(mixed $value): mixed {
    if ($value instanceof LeanOwnedAggregates\Ticket) return ['ticket', (string) native_call('serial', [$value]), native_call('label', [$value])];
    if ($value instanceof Brick\Math\BigInteger) return ['integer', (string) $value];
    if ($value instanceof LeanOwnedAggregates\Bytes) return ['bytes', $value->toString()];
    if (is_float($value)) return ['float', pack('e', $value)];
    if (is_object($value)) return [$value::class, array_map(semantic_value(...), get_object_vars($value))];
    if (is_array($value)) return array_map(semantic_value(...), $value);
    return $value;
}
function field_pointer(int $type, FFI\CData $at, string $key, int $branch = 0): array {
    global $schema;
    foreach ($schema->nodes[$type]['branches'][$branch]['fields'] as $field) if ($field['key'] === $key) {
        $pointer = $at + $field['offset'];
        return [$field['type'], $field['pointer'] ? $schema->readPointer($pointer) : $pointer];
    }
    throw new LogicException('Missing probe field ' . $key);
}
function output_fault(string $name, mixed $input, Closure $mutate, ?int $code = null): void {
    global $beforeRead, $ffi;
    $live = $ffi->owned_test_live(); $identities = $ffi->owned_test_identities();
    $beforeRead = $mutate;
    try { reject(fn() => native_call($name, [$input]), $code); }
    finally { $beforeRead = null; }
    check($ffi->owned_test_live() === $live, 'malformed result allocation cleanup');
    check($ffi->owned_test_identities() === $identities, 'malformed result identity cleanup');
}

// A probe-only private call harness. Package admission and PHP callback
// trampolines are separate work; every value conversion here uses production code.
function native_call(string $name, array $arguments): mixed {
    global $model, $schema, $runtime, $beforeRead;
    $fn = $model['calls'][$name] ?? throw new LogicException('Unknown probe function: ' . $name);
    check(count($arguments) === count($fn['parameters']), 'probe arity');
    $state = $runtime->current(); $ffi = $runtime->ffi;
    $scope = new OwnedConversionScope($schema, $state); $reading = null; $owner = null;
    try {
        $inputs = []; $hosts = [];
        foreach ($fn['parameters'] as $index => $parameter) {
            $type = $parameter['type']; $node = $schema->nodes[$type];
            $input = OwnedConversions::write($type, $arguments[$index], $scope);
            $view = $ffi->cast($node['pointerType'], $input);
            if ($parameter['host']) {
                $host = $ffi->new($node['ctype'] . '_host'); $host->closure = $view[0]; $hosts[] = $host;
                $inputs[] = FFI::addr($host);
            } else $inputs[] = $node['leaf'] ? $view[0] : $view;
        }
        $node = $schema->nodes[$fn['result']]; $out = $scope->allocate($node['size']); $owner = new OwnedOwner($state);
        OwnedRuntime::checked($ffi->{$fn['symbol']}($state->requireOpen(), ...[...$inputs, $ffi->cast($node['pointerType'], $out), FFI::addr($owner->value())]));
        if ($beforeRead !== null) $beforeRead($fn['result'], $out, $scope);
        $reading = new OwnedConversionScope($schema, $state);
        $value = OwnedConversions::read($fn['result'], $out, $reading, static function(int $type, FFI\CData $handle) use ($owner, $state, $schema): Resource {
            $class = $schema->nodes[$type]['class'];
            $lease = $owner->lease ?? $state->adopt($owner);
            return ResourceAccess::wrap($class, new NativeBinding($lease, $handle,
                static fn(NativeBinding $binding) => ResourceAccess::binding(native_call('retain:' . $type, [ResourceAccess::wrap($class, $binding)])),
                $schema->nodes[$type]['kind'] === 'callback'
                    ? static fn(NativeBinding $binding, array $arguments) => native_call('closure:' . $type, [ResourceAccess::wrap($class, $binding), ...$arguments]) : null));
        });
        $owner->publish(); return $value;
    } finally {
        try { $owner?->close(); } finally { try { $reading?->close(); } finally { $scope->close(); } }
    }
}

function fault_sweep(string $name, mixed $input): array {
    global $remaining, $checkpoints, $injected, $ffi;
    $live = $ffi->owned_test_live(); $identities = $ffi->owned_test_identities();
    $checkpoints = 0; $value = native_call($name, [$input]); $total = $checkpoints; dispose($value); unset($value);
    $phpFailures = 0;
    for ($index = 0; $index < $total; $index++) {
        $remaining = $index; $value = null;
        try { $value = native_call($name, [$input]); }
        catch (Throwable $error) { check($error === $injected, $error->getMessage()); $phpFailures++; }
        finally { $remaining = -1; dispose($value); unset($value); }
        check($ffi->owned_test_live() === $live, 'PHP fault allocation cleanup ' . $index);
        check($ffi->owned_test_identities() === $identities, 'PHP fault identity cleanup ' . $index);
    }
    check($phpFailures === $total, 'every PHP checkpoint');
    $nativeFailures = 0;
    for ($index = 0; $index < 1000; $index++) {
        $ffi->owned_test_fail_after($index); $value = null; $succeeded = false;
        try { $value = native_call($name, [$input]); $succeeded = true; }
        catch (Throwable $error) { check($error->getCode() === 3, $error->getMessage()); $nativeFailures++; }
        finally { $ffi->owned_test_fail_after(-1); dispose($value); unset($value); }
        check($ffi->owned_test_live() === $live, 'native fault allocation cleanup ' . $index);
        check($ffi->owned_test_identities() === $identities, 'native fault identity cleanup ' . $index);
        if ($succeeded) break;
    }
    check($succeeded && $nativeFailures > 0, 'all native failure points');
    return [$phpFailures, $nativeFailures];
}
