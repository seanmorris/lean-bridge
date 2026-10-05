<?php
declare(strict_types=0);
// Independent installed-package acceptance. Only generated public APIs execute Lean.
use Brick\Math\BigInteger;
use LeanCallables\Bytes;
use LeanCallables\LeanClosure;
use LeanCallables\LeanBridgeError;
require 'vendor/autoload.php';
const PARAMETER_PREFIX = 'arg';
$checks = 0;
function check(bool $value): void {
    global $checks; ++$checks;
    if (!$value) throw new RuntimeException('Check ' . $checks . ' failed');
}
function same(mixed $actual, mixed $expected): void {
    check(get_debug_type($actual) === get_debug_type($expected));
    if ($expected instanceof BigInteger) check($actual->isEqualTo($expected));
    elseif ($expected instanceof Bytes) check($actual->toString() === $expected->toString());
    elseif (is_float($expected)) check(is_nan($expected) ? is_nan($actual) : pack('e', $actual) === pack('e', $expected));
    else check($actual === $expected);
}
function rejects(string $kind, callable $call): Throwable {
    try { $call(); } catch (Throwable $error) { if (!$error instanceof $kind) throw new RuntimeException('Wrong rejection: ' . $error, 0, $error); check(true); return $error; }
    throw new RuntimeException('Expected ' . $kind);
}
function reenter(int $depth): int { return $depth === 0 ? 42 : LeanCallables\call_uint32($depth, fn($value) => reenter($value - 1)); }
$big = fn($value) => BigInteger::of((string) $value);
$integers = [$big(0), $big(1)];
foreach ([31, 32, 53, 64, 255, 4096, 16384] as $bits) $integers[] = BigInteger::of(2)->power($bits)->plus(1);
$cases = [
    'unit' => [null], 'bool' => [false, true],
    'uint8' => [0, 1, 127, 128, 255], 'uint16' => [0, 1, 32767, 32768, 65535],
    'uint32' => [0, 1, 2147483647, 2147483648, 4294967295],
    'uint64' => array_map($big, ['0', '1', '4294967296', '9007199254740993', '9223372036854775808', '18446744073709551615']),
    'int8' => [-128, -1, 0, 1, 127], 'int16' => [-32768, -1, 0, 1, 32767],
    'int32' => [-2147483648, -1, 0, 1, 2147483647], 'int64' => [PHP_INT_MIN, -9007199254740993, -1, 0, 1, PHP_INT_MAX],
    'nat' => $integers, 'int' => [...$integers, ...array_map(fn($value) => $value->negated(), $integers)],
    'float32' => [0.0, -0.0, 1.0/3, -1.25, 2.0**-149, -2.0**-149, INF, -INF, NAN, 1e300],
    'float' => [0.0, -0.0, 1.0/3, -1.25, 2.0**-1074, -2.0**-1074, INF, -INF, NAN],
    'string' => ['', "a\0λ🌿", "e\u{0301}", "\u{fdd0}\u{ffff}", "\r\n", str_repeat('x', 2048)],
    'bytes' => [Bytes::fromString(''), Bytes::fromString("\0\xff\x80"), Bytes::fromString(implode('', array_map(chr(...), range(0, 255))))],
    'char' => ["\0", "\u{10ffff}", "\u{d7ff}", "\u{e000}", "\u{0301}", "\u{1f33f}", "\u{fdd0}"]
];
$cases['usize'] = $cases['uint64']; $cases['isize'] = $cases['int64'];
check(count($cases) === 19 && LeanCallables\word_bits() === 64);
$publicTypes = ['unit' => 'null', 'bool' => 'bool', 'nat' => BigInteger::class, 'int' => BigInteger::class, 'uint64' => BigInteger::class, 'usize' => BigInteger::class,
    'string' => 'string', 'char' => 'string', 'bytes' => Bytes::class, 'float32' => 'float', 'float' => 'float'];
foreach ($cases as $kind => $values) {
    $call = 'LeanCallables\\call_' . $kind; $twice = 'LeanCallables\\twice_' . $kind; $make = 'LeanCallables\\make_' . $kind;
    foreach ([$call, $twice, $make] as $function) {
        $reflection = new ReflectionFunction($function);
        check((string) $reflection->getReturnType() === ($function === $make ? LeanClosure::class : ($publicTypes[$kind] ?? 'int')));
        foreach ($reflection->getParameters() as $i => $parameter) check((string) $parameter->getType() === 'mixed' && $parameter->getName() === PARAMETER_PREFIX . $i);
    }
    $normalize = $kind === 'float32' ? fn($value) => unpack('g', pack('g', $value))[1] : fn($value) => $value;
    for ($iteration = 0; $iteration < 64; ++$iteration) {
        $value = $values[$iteration % count($values)]; $other = $values[($iteration + 1) % count($values)];
        $expected = $normalize($value); $replacement = $normalize($other); $seen = [];
        same($call($value, function ($argument) use ($expected, $other, &$seen) { same($argument, $expected); $seen[] = $argument; return $other; }), $replacement);
        check(count($seen) === 1); $seen = [];
        same($twice($value, function ($argument) use ($expected, $replacement, $other, &$seen) { same($argument, $seen ? $replacement : $expected); $seen[] = $argument; return $other; }), $replacement);
        check(count($seen) === 2);
        $closure = $make($value);
        try {
            check($closure instanceof LeanClosure && !$closure->isClosed());
            same($closure(true, $other), $expected); same($closure(false, $other), $replacement);
            $closure->close(); $closure->close(); check($closure->isClosed());
            rejects(LogicException::class, fn() => $closure(true, $other));
        } finally { $closure->close(); }
    }
    $marker = new RuntimeException("callback\0λ", 7, new Exception('previous')); $trace = $marker->getTrace(); $called = 0;
    $callback = function ($value) use ($marker, &$called) { ++$called; throw $marker; };
    $caught = rejects(RuntimeException::class, fn() => $twice($values[0], $callback));
    check($caught === $marker && $caught->getTrace() === $trace && $called === 1 && $caught->getPrevious() === $marker->getPrevious());
    rejects(TypeError::class, fn() => $call($values[0], null));
}
unset($closure, $caught, $marker);
check(LeanCallables\wide(100, function (...$values) { check($values === [100, ...range(1, 15)]); return 42; }) === 42);
$wide = LeanCallables\make_wide(3); check($wide(...range(0, 15)) === 197968); $wide->close();
$adder = LeanCallables\make_adder(2); check(LeanCallables\twice_uint32(40, $adder) === 44); $adder->close();
same(LeanCallables\combine('λ', $big('18446744073709551615'), fn($text, $number) => $text . $number, fn($text) => $text . '!'), 'λ18446744073709551615!');
$later = 0; $first = new Error('first'); $last = function ($text) use (&$later) { ++$later; return $text; };
check(rejects(Error::class, fn() => LeanCallables\combine('x', $big(1), fn($text, $number) => throw $first, $last)) === $first); check($later === 0);
for ($i = 0; $i < 30; ++$i) same(LeanCallables\call_string("rooted\0λ", function ($value) { gc_collect_cycles(); return $value; }), "rooted\0λ");
$input = Bytes::fromString("\0\xff"); $retained = null;
$copied = LeanCallables\call_bytes($input, function ($value) use (&$retained) { $retained = $value; return Bytes::fromString($value->toString() . 'x'); });
check($retained !== $input && $copied !== $retained); same($input, Bytes::fromString("\0\xff")); same($copied, Bytes::fromString("\0\xffx"));
$invalid = [
    ['uint8', 256, ValueError::class], ['uint16', -1, ValueError::class], ['uint32', 4294967296, ValueError::class],
    ['int8', -129, ValueError::class], ['int16', 32768, ValueError::class], ['int32', 2147483648, ValueError::class],
    ['uint64', $big('18446744073709551616'), ValueError::class], ['usize', $big(-1), ValueError::class],
    ['nat', $big(-1), ValueError::class], ['nat', $big(str_repeat('9', 16385)), ValueError::class],
    ['string', "\xed\xa0\x80", ValueError::class], ['char', 'ab', ValueError::class], ['char', "\xed\xa0\x80", ValueError::class],
    ['uint32', '42', TypeError::class], ['uint32', 1.0, TypeError::class], ['bool', 1, TypeError::class],
    ['unit', false, TypeError::class], ['float', 1, TypeError::class], ['nat', 1, TypeError::class],
    ['bytes', '', TypeError::class], ['int', null, TypeError::class], ['int64', '1', TypeError::class], ['isize', true, TypeError::class],
    ['string', str_repeat('x', 17 * 1024 * 1024), ValueError::class], ['bytes', Bytes::fromString(str_repeat('x', 17 * 1024 * 1024)), ValueError::class]
];
foreach ($invalid as [$kind, $bad, $error]) {
    $call = 'LeanCallables\\call_' . $kind; $make = 'LeanCallables\\make_' . $kind;
    rejects($error, fn() => $call($bad, fn($value) => $value)); rejects($error, fn() => $call($cases[$kind][0], fn($value) => $bad));
    $closure = $make($cases[$kind][0]); try { rejects($error, fn() => $closure(false, $bad)); } finally { $closure->close(); }
}
unset($invalid, $bad, $closure);
foreach ([fn($value) => (object) [], function ($value) { yield $value; }, function (&$value) { return $value; }] as $badCallback)
    rejects(TypeError::class, fn() => LeanCallables\call_uint32(1, $badCallback));
check(reenter(12) === 42); check(str_contains(rejects(LeanBridgeError::class, fn() => reenter(80))->getMessage(), 'reentry limit (64)')); check(reenter(2) === 42);
$expired = LeanCallables\retain_callback(fn($value) => $value + 1); rejects(LeanBridgeError::class, fn() => $expired(1)); $expired->close();
$closure = LeanCallables\make_uint32(42); $alias = $closure(...); $weak = WeakReference::create($closure); unset($closure); gc_collect_cycles();
check($weak->get() !== null && $alias(true, 0) === 42); $weak->get()->close(); rejects(LogicException::class, fn() => $alias(true, 0)); unset($alias); gc_collect_cycles(); check($weak->get() === null);
$abandoned = LeanCallables\make_string('abandoned'); $weak = WeakReference::create($abandoned); unset($abandoned); gc_collect_cycles(); check($weak->get() === null);
$closure = LeanCallables\make_uint32(7);
rejects(Error::class, fn() => clone $closure); rejects(LogicException::class, fn() => serialize($closure)); rejects(Error::class, fn() => new LeanClosure());
rejects(ArgumentCountError::class, fn() => $closure(true)); rejects(ArgumentCountError::class, fn() => $closure(true, 1, 2)); rejects(ArgumentCountError::class, fn() => $closure(pick: true, value: 1));
$fiber = new Fiber(function () use ($closure) {
    rejects(LogicException::class, fn() => $closure(true, 0));
    rejects(LogicException::class, fn() => LeanCallables\make_uint32(1));
    rejects(LogicException::class, fn() => LeanCallables\call_uint32(1, fn($value) => $value));
}); $fiber->start(); check($fiber->isTerminated()); $closure->close();
unset($closure, $wide, $adder, $expired, $fiber);
// Callers and their captures must not stay rooted in cached native trampolines.
class CallbackOwner { public function __invoke($value) { return $value; } }
$owner = new CallbackOwner(); $weak = WeakReference::create($owner); check(LeanCallables\call_uint32(1, $owner) === 1); unset($owner); gc_collect_cycles(); check($weak->get() === null);
for ($i = 0; $i < 1000; ++$i) LeanCallables\call_uint32(1, fn($value) => $value);
gc_collect_cycles(); $before = memory_get_usage();
for ($i = 0; $i < 20000; ++$i) check(LeanCallables\call_uint32(1, fn($value) => $value) === 1);
gc_collect_cycles(); check(memory_get_usage() - $before < 1024 * 1024);
$held = [];
try {
    for ($i = 0; $i < 4096; ++$i) $held[] = LeanCallables\make_uint32($i);
    rejects(LeanBridgeError::class, fn() => LeanCallables\make_uint32(1)); check($held[0](true, 0) === 0 && $held[4095](true, 0) === 4095);
} finally { foreach ($held as $entry) $entry->close(); }
unset($held, $entry);
for ($i = 0; $i < 8192; ++$i) { $closure = LeanCallables\make_uint32($i); check($closure(true, 0) === $i); $closure->close(); }
$fork = function_exists('pcntl_fork');
if ($fork) {
    $pid = pcntl_fork(); check($pid >= 0);
    if ($pid === 0) {
        try { rejects(RuntimeException::class, fn() => LeanCallables\call_uint32(1, fn($value) => $value)); rejects(RuntimeException::class, fn() => $closure->close()); exit(0); }
        catch (Throwable $error) { fwrite(STDERR, (string) $error); exit(1); }
    }
    pcntl_waitpid($pid, $status); check(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0); check(LeanCallables\call_uint32(1, fn($value) => $value + 1) === 2);
}
$libraries = [];
foreach (file('/proc/self/maps') as $line) if (preg_match('~(/[^\n]*lib(?:callables|component_[a-f0-9]{20}|leanshared|lean_bridge_native)\.so)\s*$~', $line, $match)) $libraries[$match[1]] = hash_file('sha256', $match[1]);
check(count($libraries) === 4);
echo json_encode(['checks' => $checks, 'hostVersion' => PHP_VERSION, 'fork' => $fork, 'libraries' => $libraries], JSON_THROW_ON_ERROR), "\n";
