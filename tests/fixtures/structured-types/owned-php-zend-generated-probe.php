<?php
declare(strict_types=1);

require __DIR__ . '/dependencies/brick-math/autoload.php';
require __DIR__ . '/src/Api.php';

use LeanOwnedAggregates\Internal\Resource;

$checks = 0;
$model = json_decode(file_get_contents(__DIR__ . '/probe-model.json'), true, 512, JSON_THROW_ON_ERROR);
function owned_call(string $name, array $arguments): mixed {
    global $model;
    $fn = 'LeanOwnedAggregates\\' . $model['functions'][$name];
    return $fn(...$arguments);
}
function check(bool $value, string $message = ''): void {
    global $checks; $checks++;
    if (!$value) throw new RuntimeException('Generated PHP-Wasm ownership: ' . $message);
}
function reject(callable $call, ?int $code = null, ?string $class = null): Throwable {
    try { $call(); } catch (Throwable $error) {
        check($code === null || $error->getCode() === $code, get_class($error) . ': ' . $error->getMessage());
        check($class === null || $error instanceof $class, get_class($error) . ': ' . $error->getMessage());
        return $error;
    }
    throw new RuntimeException('Expected generated PHP-Wasm rejection');
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
    try { check(semantic_value($value) === semantic_value($expected), 'preserved typed result'); }
    finally { dispose($value); }
}
function fault_sweep(callable $call): int {
    $value = $call(); dispose($value); unset($value); gc_collect_cycles();
    $before = owned_generated_stats(); $failures = 0; $succeeded = false;
    for ($point = 1; $point <= 2000; $point++) {
        owned_generated_fault($point); $value = null;
        try { $value = $call(); $succeeded = true; }
        catch (Throwable $error) { check($error->getCode() === 3, 'allocation point ' . $point . ': ' . $error->getMessage()); $failures++; }
        finally { owned_generated_fault(0); dispose($value); unset($value, $error); gc_collect_cycles(); }
        $after = owned_generated_stats();
        check($after['live'] === $before['live'], 'allocation cleanup at ' . $point . ': ' . json_encode([$before, $after]));
        check($after['identities'] === $before['identities'], 'identity cleanup at ' . $point);
        check($after['scopes'] === 0 && $after['depth'] === 0, 'call scope cleanup at ' . $point);
        if ($succeeded) break;
    }
    check($succeeded && $failures > 0, 'every allocation failure point was reached');
    check(owned_generated_stats()['failures'] - $before['failures'] === $failures, 'every rejected call hit its requested allocation failure');
    return $failures;
}
