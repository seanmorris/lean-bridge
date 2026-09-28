<?php
declare(strict_types=1);

require __DIR__ . '/dependencies/brick-math/autoload.php';
require __DIR__ . '/src/Api.php';
require __DIR__ . '/loader.php';

use LeanOwnedAggregates\Internal\{Native, OwnedRuntime, Resource};

$checks = 0; $remaining = -1; $checkpoints = 0; $loads = 0; $ffi = null;
$injected = new RuntimeException('Injected owned PHP call checkpoint');
$model = json_decode(file_get_contents(__DIR__ . '/probe-model.json'), true, 512, JSON_THROW_ON_ERROR);
Native::configure(static function() use (&$ffi, &$loads, &$remaining, &$checkpoints, $injected): OwnedRuntime {
    $loads++;
    $definitions = LeanOwnedAggregates\Internal\OwnedCallTypes::DEFINITIONS . "\nsize_t owned_test_live(void);\nsize_t owned_test_identities(void);\nvoid owned_test_fail_after(ptrdiff_t);\n";
    $ffi = LeanBridge\CopiedNativeV1\Runtime::load(__DIR__ . '/runtime/lib',
        json_decode(file_get_contents(__DIR__ . '/native-evidence.json'), true, 512, JSON_THROW_ON_ERROR), $definitions);
    return new OwnedRuntime($ffi, LeanBridge\CopiedNativeV1\Runtime::ensureProcess(...), static function() use (&$remaining, &$checkpoints, $injected): void {
        $checkpoints++;
        if ($remaining === 0) throw $injected;
        if ($remaining > 0) $remaining--;
    });
});
function owned_call(string $name, array $arguments): mixed {
    global $model;
    $fn = 'LeanOwnedAggregates\\' . $model['functions'][$name];
    return $fn(...$arguments);
}
function check(bool $value, string $message = ''): void {
    global $checks; $checks++;
    if (!$value) throw new RuntimeException('Owned PHP calls: ' . $message);
}
function reject(callable $call, ?int $code = null, ?string $class = null): Throwable {
    try { $call(); } catch (Throwable $error) {
        check($code === null || $error->getCode() === $code, $error->getMessage());
        check($class === null || $error instanceof $class, get_class($error) . ': ' . $error->getMessage());
        return $error;
    }
    throw new RuntimeException('Expected owned PHP call rejection');
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
    if ($value instanceof LeanOwnedAggregates\Ticket) return ['ticket', (string) owned_call('serial', [$value]), owned_call('label', [$value])];
    if ($value instanceof Brick\Math\BigInteger) return ['integer', (string) $value];
    if ($value instanceof LeanOwnedAggregates\Bytes) return ['bytes', $value->toString()];
    if (is_float($value)) return ['float', is_nan($value) ? 'nan' : pack('e', $value)];
    if (is_object($value)) return [$value::class, array_map(semantic_value(...), get_object_vars($value))];
    if (is_array($value)) return array_map(semantic_value(...), $value);
    return $value;
}
function same_result(mixed $expected, callable $call): void {
    $value = $call();
    try { check(semantic_value($value) === semantic_value($expected), 'preserved callback result'); }
    finally { dispose($value); }
}
function fault_sweep(callable $call): array {
    global $remaining, $checkpoints, $injected, $ffi;
    $live = $ffi->owned_test_live(); $identities = $ffi->owned_test_identities();
    $checkpoints = 0; $value = $call(); $total = $checkpoints; dispose($value); unset($value);
    $phpFailures = 0;
    for ($index = 0; $index < $total; $index++) {
        $remaining = $index; $value = null;
        try { $value = $call(); }
        catch (Throwable $error) { check($error === $injected, $error->getMessage()); $phpFailures++; }
        finally { $remaining = -1; dispose($value); unset($value); }
        check($ffi->owned_test_live() === $live, 'PHP call fault cleanup ' . $index);
        check($ffi->owned_test_identities() === $identities, 'PHP callback identity cleanup ' . $index);
    }
    check($phpFailures === $total, 'all PHP checkpoint failures');
    $nativeFailures = 0;
    for ($index = 0; $index < 2000; $index++) {
        $ffi->owned_test_fail_after($index); $value = null; $succeeded = false;
        try { $value = $call(); $succeeded = true; }
        catch (Throwable $error) { check($error->getCode() === 3, $error->getMessage()); $nativeFailures++; }
        finally { $ffi->owned_test_fail_after(-1); dispose($value); unset($value); }
        check($ffi->owned_test_live() === $live, 'native callback allocation cleanup ' . $index);
        check($ffi->owned_test_identities() === $identities, 'native callback identity cleanup ' . $index);
        if ($succeeded) break;
    }
    check($succeeded && $nativeFailures > 0, 'all native callback failures');
    return [$phpFailures, $nativeFailures];
}
