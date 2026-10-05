<?php
declare(strict_types=0);
// Independent installed consumer. Only public generated functions invoke Lean.
use Brick\Math\BigInteger;
use LeanStructured\{Bytes, Some, Ok, Err, Payload, PacketEmpty, PacketPayload, PacketCounts, LeanClosure, LeanBridgeError};
require 'vendor/autoload.php';
const PARAMETER_PREFIX = 'arg';
$checks = 0; $calls = 0; $rejected = 0;
function check(bool $value): void {
    global $checks; ++$checks;
    if (!$value) throw new RuntimeException('Check ' . $checks . ' failed');
}
function same(mixed $actual, mixed $expected): void {
    check(get_debug_type($actual) === get_debug_type($expected));
    if ($expected instanceof BigInteger) { check($actual->isEqualTo($expected)); return; }
    if ($expected instanceof Bytes) { check($actual->toString() === $expected->toString()); return; }
    if (is_object($expected)) { $actual = get_object_vars($actual); $expected = get_object_vars($expected); }
    if (is_array($expected)) {
        check(array_keys($actual) === array_keys($expected));
        foreach ($expected as $key => $value) same($actual[$key], $value);
    } else check($actual === $expected);
}
function independent(mixed $actual, mixed $expected): void {
    same($actual, $expected);
    if ($expected instanceof BigInteger) return; // Immutable, potentially interned integers.
    if (is_object($expected)) {
        check($actual !== $expected);
        $actual = get_object_vars($actual); $expected = get_object_vars($expected);
    }
    if (is_array($expected)) foreach ($expected as $key => $value) independent($actual[$key], $value);
}
function invoke(callable $call, mixed ...$arguments): mixed {
    global $calls; ++$calls; return $call(...$arguments);
}
function rejects(string $kind, callable $call): Throwable {
    global $rejected;
    try { $call(); } catch (Throwable $error) {
        if (!$error instanceof $kind) throw new RuntimeException('Wrong rejection: ' . $error, 0, $error);
        ++$rejected; return $error;
    }
    throw new RuntimeException('Missing ' . $kind . ' rejection');
}
function reenter(int $depth, Payload $value): Payload {
    return invoke('LeanStructured\\call_record', $value, fn($item) => $depth ? reenter($depth - 1, $item) : $item);
}
$big = fn($value) => BigInteger::of((string) $value);
$rows = [null, new Some(''), new Some("copied\0λ😀")];
$record = new Payload("payload\0λ", $rows, $big(str_repeat('9', 100)), new Some(new Ok([$big('18446744073709551615'), null])));
$otherRecord = new Payload('', [], $big(0), new Some(new Err("failed\0λ")));
$cases = [
    'array' => [[], $rows, [new Some(str_repeat('λ', 128))]],
    'list' => [[], [new Ok([4294967295, "ok\0λ"]), new Err("error\0λ"), new Ok([0, ''])]],
    'option' => [null, new Some(null), new Some(new Some(null))],
    'result' => [new Ok(null), new Ok(new Some(0)), new Ok(new Some(4294967295)), new Err([]), new Err(["failed\0λ", ''])],
    'tuple' => [['', [Bytes::fromString(''), $big(0)]], ["tuple\0λ", [Bytes::fromString("\0\xff\x80"), $big(str_repeat('8', 256))]]],
    'record' => [$record, $otherRecord, new Payload('none', [null], $big(42), null)],
    'variant' => [new PacketEmpty(), new PacketPayload("packet\0λ", $rows), new PacketCounts($big(str_repeat('9', 100)), $big('-' . str_repeat('8', 100)))],
    'alias' => [$record, $otherRecord]
];
foreach ($cases as $shape => $values) {
    $call = 'LeanStructured\\call_' . $shape; $twice = 'LeanStructured\\twice_' . $shape; $make = 'LeanStructured\\make_' . $shape;
    foreach ([$call, $twice, $make] as $function) {
        $reflection = new ReflectionFunction($function);
        foreach ($reflection->getParameters() as $i => $parameter)
            check((string) $parameter->getType() === 'mixed' && $parameter->getName() === PARAMETER_PREFIX . $i);
        if ($function === $make) check((string) $reflection->getReturnType() === LeanClosure::class);
    }
    for ($iteration = 0; $iteration < 64; ++$iteration) {
        $value = $values[$iteration % count($values)]; $other = $values[($iteration + 1) % count($values)]; $seen = 0;
        $result = invoke($call, $value, function ($argument) use ($value, $other, &$seen) {
            ++$seen; independent($argument, $value); gc_collect_cycles(); return $other;
        });
        independent($result, $other); check($seen === 1); $seen = 0;
        independent(invoke($twice, $value, function ($argument) use ($value, $other, &$seen) {
            independent($argument, $seen ? $other : $value); ++$seen; return $other;
        }), $other); check($seen === 2);
        $closure = invoke($make, $value);
        try {
            check($closure instanceof LeanClosure && !$closure->isClosed());
            independent(invoke($closure, true, $other), $value);
            independent(invoke($closure, false, $other), $other);
            $closure->close(); $closure->close(); check($closure->isClosed());
            rejects(LogicException::class, fn() => $closure(true, $other));
        } finally { $closure->close(); }
    }
    foreach ([new RuntimeException("callback\0λ", 7), new Error('callback error'), new TypeError('callback type')] as $marker) {
        $seen = 0;
        $caught = rejects(get_class($marker), function () use ($twice, $values, &$seen, $marker) {
            return invoke($twice, $values[0], function ($value) use (&$seen, $marker) { ++$seen; throw $marker; });
        });
        check($caught === $marker && $seen === 1);
        independent(invoke($call, $values[0], fn($value) => $value), $values[0]);
    }
    foreach ([null, function ($value) { yield $value; }, function (&$value) { return $value; }] as $callback)
        rejects(TypeError::class, fn() => invoke($call, $values[0], $callback));
}
$array = $rows; $closure = LeanStructured\make_array($array); $array[] = new Some('changed');
independent($closure(true, []), $rows); $closure->close();
$seen = null;
$copied = LeanStructured\call_array($rows, function ($value) use (&$seen) { $seen = $value; $value[] = new Some('new'); return $value; });
same($seen, $rows); check(count($rows) === 3 && count($copied) === 4);
$invalid = [
    ['array', ['bad'], TypeError::class], ['array', [1 => null], TypeError::class],
    ['array', [new Some("\xed\xa0\x80")], ValueError::class],
    ['list', [new Ok([4294967296, 'x'])], ValueError::class], ['list', [new Err(false)], TypeError::class],
    ['option', false, TypeError::class], ['option', new Some(new Some(false)), TypeError::class],
    ['result', new Ok(new Some('42')), TypeError::class], ['result', new Err([false]), TypeError::class],
    ['tuple', ['', [Bytes::fromString(''), $big(-1)]], ValueError::class],
    ['tuple', ['', ['', $big(0)]], TypeError::class], ['tuple', [], TypeError::class],
    ['record', new stdClass(), TypeError::class], ['alias', new stdClass(), TypeError::class],
    ['variant', new stdClass(), TypeError::class],
    ['record', (new ReflectionClass(Payload::class))->newInstanceWithoutConstructor(), TypeError::class],
    ['variant', (new ReflectionClass(PacketPayload::class))->newInstanceWithoutConstructor(), TypeError::class],
    ['array', [new Some(str_repeat('x', 17 * 1024 * 1024))], ValueError::class]
];
foreach ($invalid as [$shape, $bad, $kind]) {
    $call = 'LeanStructured\\call_' . $shape; $make = 'LeanStructured\\make_' . $shape;
    $value = $cases[$shape][0];
    rejects($kind, fn() => invoke($call, $bad, fn($value) => $value));
    rejects($kind, fn() => invoke($call, $value, fn($value) => $bad));
    $closure = invoke($make, $value);
    try { rejects($kind, fn() => invoke($closure, false, $bad)); }
    finally { $closure->close(); }
    independent(invoke($call, $value, fn($value) => $value), $value);
}
unset($invalid, $bad, $closure);
$marker = new Error('preserved after Lean reads a default record');
check(rejects(Error::class, fn() => LeanStructured\after_failure($record, fn($value) => throw $marker)) === $marker);
same(reenter(12, $record), $record);
check(str_contains(rejects(LeanBridgeError::class, fn() => reenter(80, $record))->getMessage(), 'reentry limit (64)'));
same(reenter(2, $record), $record);
$expired = LeanStructured\retain_record(fn($value) => $value);
rejects(LeanBridgeError::class, fn() => $expired($record)); $expired->close();
$closure = LeanStructured\make_record($record); $alias = $closure(...); $weak = WeakReference::create($closure);
unset($closure); gc_collect_cycles(); check($weak->get() !== null); same($alias(true, $otherRecord), $record);
$weak->get()->close(); rejects(LogicException::class, fn() => $alias(true, $record));
unset($alias); gc_collect_cycles(); check($weak->get() === null);
class CallbackOwner { public function __invoke($value) { return $value; } }
$owner = new CallbackOwner(); $weak = WeakReference::create($owner);
same(LeanStructured\call_record($record, $owner), $record); unset($owner); gc_collect_cycles(); check($weak->get() === null);
$closure = LeanStructured\make_record($record);
rejects(Error::class, fn() => clone $closure); rejects(LogicException::class, fn() => serialize($closure));
rejects(ArgumentCountError::class, fn() => $closure(true));
rejects(ArgumentCountError::class, fn() => $closure(true, $record, $record));
rejects(ArgumentCountError::class, fn() => $closure(pick: true, value: $record));
$fiber = new Fiber(function () use ($closure, $record) {
    rejects(LogicException::class, fn() => $closure(true, $record));
    rejects(LogicException::class, fn() => LeanStructured\call_record($record, fn($value) => $value));
}); $fiber->start(); check($fiber->isTerminated()); $closure->close();
$libraries = [];
foreach (file('/proc/self/maps') as $line)
    if (preg_match('~(/[^\n]*lib(?:structured|component_[a-f0-9]{20}|leanshared|lean_bridge_native)\.so)\s*$~', $line, $match))
        $libraries[$match[1]] = hash_file('sha256', $match[1]);
check(count($libraries) === 4);
echo json_encode(['checks' => $checks, 'calls' => $calls, 'rejected' => $rejected, 'shapes' => array_keys($cases), 'hostVersion' => PHP_VERSION, 'libraries' => $libraries], JSON_THROW_ON_ERROR), "\n";
