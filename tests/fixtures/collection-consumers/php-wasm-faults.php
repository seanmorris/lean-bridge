<?php
declare(strict_types=0);
// Synthetic Zend provider. Real installed Lean execution has a separate caller.
use Brick\Math\BigInteger;
use LeanCollectionProbe\{Bytes, Primitives, Empty_, Single, Count, Pair, Reversed, Packet, LeanBridgeError};
require '/probe/src/Api.php';
$request = json_decode(file_get_contents('/probe.json'), true, 512, JSON_THROW_ON_ERROR);
$checks = $failures = $partial = $malformed = $wireRejections = $emptyBuffers = 0;
function check(bool $value, string $message = ''): void {
    global $checks; ++$checks;
    if (!$value) throw new RuntimeException('Zend collection check ' . $checks . ': ' . $message);
}
function invoke(string $name, mixed ...$args): mixed { return ('LeanCollectionProbe\\' . $name)(...$args); }
function resetFailure(): void {
    try { LeanCollectionProbe\fail_after(-1); } catch (Throwable $error) { LeanCollectionProbe\fail_after(-1); }
}
function clean(): void { check(LeanCollectionProbe\live_allocations() === 0, 'all scratch and native owners released'); }
function rejected(callable $call, string $kind): void {
    try { $call(); } catch (Throwable $error) { check($error instanceof $kind, get_class($error) . ': ' . $error->getMessage()); return; }
    throw new RuntimeException('Expected ' . $kind);
}
function same(mixed $actual, mixed $expected): void {
    check(get_debug_type($actual) === get_debug_type($expected), 'host type');
    if ($expected instanceof BigInteger) check($actual->isEqualTo($expected));
    elseif ($expected instanceof Bytes || is_object($expected)) {
        check($actual->equals($expected)); check($actual->hashCode() === $expected->hashCode());
    } elseif (is_float($expected)) check(is_nan($expected) ? is_nan($actual) : pack('E', $actual) === pack('E', $expected));
    elseif (is_array($expected)) {
        check(array_keys($actual) === array_keys($expected));
        foreach ($expected as $key => $value) same($actual[$key], $value);
    } else check($actual === $expected);
}
function wire(string $name, mixed $value): mixed {
    global $request; return ($request['functions'][$name]['transport'])($value);
}
function counted(callable $call): mixed {
    $before = LeanCollectionProbe\native_calls(); $clears = LeanCollectionProbe\output_clears();
    try { return $call(); }
    finally {
        resetFailure();
        check(LeanCollectionProbe\native_calls() - $before === LeanCollectionProbe\output_clears() - $clears, 'one clear per native entry');
        clean();
    }
}
function recover(): void {
    LeanCollectionProbe\configure(0);
    same(counted(fn() => LeanCollectionProbe\echo_uint32([[BigInteger::of(42)]])), [[BigInteger::of(42)]]);
}
$big = fn($value) => BigInteger::of((string) $value);
$huge = $big(2)->power(5120)->plus(17);
$values = [
    'unit' => null, 'bool' => true, 'uint8' => 255, 'uint16' => 65535,
    'uint32' => $big('4294967295'), 'uint64' => $big('18446744073709551615'),
    'int8' => -128, 'int16' => -32768, 'int32' => PHP_INT_MIN, 'int64' => $big('-9223372036854775808'),
    'nat' => $huge, 'int' => $huge->negated(), 'float32' => -0.0, 'float64' => NAN,
    'string' => "owned\0🌱", 'bytes' => Bytes::fromString("\0\xff"), 'char' => '🌱',
    'usize' => $big('4294967295'), 'isize' => PHP_INT_MIN
];
$scalar = new Primitives(...array_values($values));
$packet = new Packet('packet', [[$scalar, $scalar], [], [$scalar]], new Empty_(), new Single($big(7)), new Count($huge), new Pair($big(17), 'pair'), new Reversed('reverse', $big(19)));
$cases = [];
foreach ($values as $name => $value) $cases['echo_' . $name] = [[$value, $value], [], [$value]];
$cases['echo_primitives'] = $scalar; $cases['echo_packet'] = $packet;
$deep = $big(42); for ($i = 0; $i < 24; ++$i) $deep = [$deep]; $cases['echo_deep'] = $deep;
foreach ($cases as $name => $value) {
    same(counted(fn() => invoke($name, $value)), $value);
    $succeeded = false;
    for ($limit = 0; $limit < 2000; ++$limit) {
        $before = LeanCollectionProbe\native_calls(); $clears = LeanCollectionProbe\output_clears();
        LeanCollectionProbe\fail_after($limit);
        try { $out = invoke($name, $value); $succeeded = true; }
        catch (Throwable $error) { ++$failures; }
        resetFailure(); clean();
        check(LeanCollectionProbe\native_calls() - $before === LeanCollectionProbe\output_clears() - $clears);
        if ($succeeded) same($out, $value);
        recover(); if ($succeeded) break;
    }
    check($succeeded, 'complete allocation sweep for ' . $name);
}
foreach (array_keys($values) as $name) {
    foreach ([null, false, [], [true], ['0'], [-1], [0 => [], 2 => []]] as $bad) {
        if ($bad === []) continue;
        $before = LeanCollectionProbe\native_calls();
        counted(fn() => rejected(fn() => wire('echo_' . $name, $bad), TypeError::class));
        check(LeanCollectionProbe\native_calls() === $before); ++$wireRejections;
    }
}
foreach (['echo_primitives', 'echo_packet'] as $name) {
    $to = new ReflectionMethod(LeanCollectionProbe\Internal\Native::class, $request['functions'][$name]['to']);
    $valid = $to->invoke(null, $cases[$name]);
    foreach ([[], array_slice($valid, 0, -1), [...$valid, null]] as $bad) {
        $before = LeanCollectionProbe\native_calls();
        counted(fn() => rejected(fn() => wire($name, $bad), ValueError::class));
        check(LeanCollectionProbe\native_calls() === $before); ++$wireRejections;
    }
}
for ($i = 0; $i < 32; ++$i) {
    $before = LeanCollectionProbe\native_calls();
    counted(fn() => rejected(fn() => wire('echo_uint32', [['1'], ['2', false]]), TypeError::class));
    check(LeanCollectionProbe\native_calls() === $before); ++$partial;
}
foreach (['echo_unit', 'echo_bool', 'echo_uint32', 'echo_nat', 'echo_int', 'echo_string', 'echo_bytes', 'echo_deep'] as $name) {
    foreach ([1, 2, 3, 4, 5, 6] as $mode) {
        LeanCollectionProbe\configure($mode);
        counted(fn() => rejected(fn() => invoke($name, $cases[$name]), ValueError::class)); ++$malformed; recover();
    }
    LeanCollectionProbe\configure(10); same(counted(fn() => invoke($name, $cases[$name])), []); ++$emptyBuffers; recover();
}
$badModes = [
    'echo_unit' => [20], 'echo_bool' => [20], 'echo_char' => [20],
    'echo_nat' => [21, 22, 23, 24, 25, 26, 27], 'echo_int' => [21, 22, 23, 24, 25, 26, 27, 29, 30],
    'echo_string' => [40, 41, 42, 43, 45], 'echo_bytes' => [40, 41, 42, 43],
    'echo_primitives' => [50, 51, 52, 53, 54]
];
foreach ($badModes as $name => $modes) foreach ($modes as $mode) {
    LeanCollectionProbe\configure($mode);
    counted(fn() => rejected(fn() => invoke($name, $cases[$name]), ValueError::class)); ++$malformed; recover();
}
foreach (['echo_nat', 'echo_int', 'echo_string', 'echo_bytes'] as $name) {
    LeanCollectionProbe\configure(str_contains($name, 'nat') || str_contains($name, 'int') ? 28 : 44);
    $expected = $cases[$name]; $expected[0][0] = str_contains($name, 'nat') || str_contains($name, 'int') ? $big(0) : ($name === 'echo_string' ? '' : Bytes::fromString(''));
    same(counted(fn() => invoke($name, $cases[$name])), $expected); ++$emptyBuffers; recover();
}
foreach ([90 => "owned\0🌱", 91 => 'Native output buffer exceeds Wasm memory'] as $mode => $expected) {
    LeanCollectionProbe\configure($mode);
    counted(function() use ($expected) {
        try { LeanCollectionProbe\echo_string([["owned\0🌱"]]); }
        catch (LeanBridgeError $error) {
            // Exception messages use C's NUL-terminated text boundary.
            check($error->getMessage() === explode("\0", $expected)[0] && $error->getCode() === 7); return;
        }
        throw new RuntimeException('Missing native error');
    });
    recover();
}
$copy = counted(fn() => LeanCollectionProbe\echo_packet($packet));
check($copy !== $packet && $copy->values[0][0] !== $packet->values[0][0]);
check($copy->values[0][0]->bytes !== $copy->values[0][1]->bytes);
echo json_encode(['checks' => $checks, 'allocationFailures' => $failures, 'primitives' => array_keys($values),
    'malformedOutputs' => $malformed, 'emptyPoisonPointers' => $emptyBuffers, 'partialInputs' => $partial,
    'wireRejections' => $wireRejections, 'oneClearPerNativeEntry' => true, 'wordBits' => PHP_INT_SIZE * 8]);
