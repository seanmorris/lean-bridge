<?php
declare(strict_types=1);
namespace LeanVariants\Probe;
use LeanVariants\{Some, Ok, Err, Bytes, Packet, SignalIdle, SignalStopped, SignalData, SignalMarker,
    ModeFirst, ModeSecond, ModeThird, NestedEmpty, NestedPacket, NestedOutcome, ScalarsAbsent, ScalarsAll,
    AnonymousNumber, AnonymousPair, AnonymousCollision, OneOnly, BuffersEmpty, BuffersPair, LeanBridgeError};
use Brick\Math\BigInteger;
require 'vendor/autoload.php';

// Only this process instruments an in-memory copy; installed files stay unchanged.
final class Faults {
    public static bool $active = false;
    public static int $count = 0, $target = 0, $clears = 0, $closed = 0, $entries = 0, $branches = 0;
    public static array $owners = [], $scopes = [];
    public static \Throwable $exception;
    public static function arm(int $target): void {
        self::$active = true; self::$target = $target;
        self::$count = self::$clears = self::$closed = self::$entries = 0;
        self::$owners = self::$scopes = [];
        self::$exception = new \RuntimeException('injected variant conversion failure');
    }
    public static function tick(): void { if (self::$active && ++self::$count === self::$target) throw self::$exception; }
    public static function owner(\FFI\CData $value): void {
        if (self::$active) self::$owners[] = \WeakReference::create($value);
        self::tick();
    }
    public static function scope(object $scope): void { if (self::$active) self::$scopes[] = \WeakReference::create($scope); }
    public static function close(object $scope): void { if (self::$active) { ensure($scope->owners === []); ++self::$closed; } }
    public static function clear(): void { if (self::$active) ++self::$clears; }
    public static function entry(): void { if (self::$active) ++self::$entries; }
    public static function branch(int $actual, int $expected): void { ensure($actual === $expected); ++self::$branches; }
}
$checks = $failures = 0;
function ensure(bool $value): void {
    global $checks; ++$checks;
    if (!$value) throw new \RuntimeException('Variant fault-probe assertion ' . $checks);
}
function recovered(): void { ensure(\LeanVariants\next(new SignalIdle()) instanceof SignalStopped); }
function released(?int $entries = null): void {
    Faults::$active = false; gc_collect_cycles();
    ensure(Faults::$clears === 1 && Faults::$closed === 1 && count(Faults::$scopes) === 1);
    ensure($entries === null ? Faults::$entries <= 1 : Faults::$entries === $entries);
    foreach ([...Faults::$owners, ...Faults::$scopes] as $owner) ensure($owner->get() === null);
    recovered();
}
$request = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
$root = realpath('vendor/lean-bridge-variants/api/src/Internal');
$native = file_get_contents($root . '/Native.php'); ensure(str_starts_with($native, '<?php')); $native = substr($native, 5);
$native = str_replace('namespace LeanVariants\\Internal;', 'namespace LeanVariants\\Probe;', $native, $count); ensure($count === 1);
$native = str_replace('__DIR__', var_export($root, true), $native, $count); ensure($count === 2);
$native = str_replace('$this->remaining -= $count * $width;', '$this->remaining -= $count * $width; Faults::tick();', $native, $count); ensure($count === 1);
$native = str_replace('$this->owners[] = $memory;', '$this->owners[] = $memory; Faults::owner($memory);', $native, $count); ensure($count === 1);
$native = str_replace('$this->budget = new Budget();', '$this->budget = new Budget(); Faults::scope($this);', $native, $count); ensure($count === 1);
$native = str_replace('$this->owners = [];', '$this->owners = []; Faults::close($this);', $native, $count); ensure($count === 1);
$native = preg_replace('~(\$ffi->[a-zA-Z0-9_]+_clear\(\\\\FFI::addr\(\$out\)\);)~', '$1 Faults::clear();', $native, -1, $count); ensure($count === $request['clearSites']);
$native = preg_replace('~(\$status = \$ffi->[a-zA-Z0-9_]+\()~', 'Faults::entry(); $1', $native, -1, $count); ensure($count === 14);
$native = preg_replace('~case (\d+): return new~', 'case $1: Faults::branch($value->kind, $1); return new', $native, -1, $count); ensure($count === 18);
eval($native); unset($native);
$calls = $request['functions'];
$big = fn($value) => BigInteger::of((string) $value);
$huge = $big(2)->power(5120)->plus(19);
$scalars = new ScalarsAll(null, true, 255, 65535, 4294967295, $big('18446744073709551615'), -128, -32768, -2147483648,
    PHP_INT_MIN, $huge, $huge->negated(), 1.5, -2.25, "A\0🌱", Bytes::fromString("\0\xff\1"), '🌱', $big('4294967295'), -2147483648);
$data = new SignalData(42, "A\0🌱");
$packet = new Packet($data, [new SignalIdle(), $data], new Some(new SignalMarker(null)), [new ModeFirst(), new ModeThird()]);
$constructors = [
    ['SignalIdle', 'echo_signal', new SignalIdle()], ['SignalStopped', 'echo_signal', new SignalStopped()],
    ['SignalData', 'echo_signal', $data], ['SignalMarker', 'echo_signal', new SignalMarker(null)],
    ['ModeFirst', 'echo_mode', new ModeFirst()], ['ModeSecond', 'echo_mode', new ModeSecond()], ['ModeThird', 'echo_mode', new ModeThird()],
    ['NestedEmpty', 'echo_nested', new NestedEmpty()], ['NestedPacket', 'echo_nested', new NestedPacket($packet)],
    ['NestedOutcome', 'echo_nested', new NestedOutcome(new Ok([new SignalMarker(null), new ModeSecond()]))],
    ['ScalarsAbsent', 'echo_scalars', new ScalarsAbsent()], ['ScalarsAll', 'echo_scalars', $scalars],
    ['AnonymousNumber', 'echo_anonymous', new AnonymousNumber(7)], ['AnonymousPair', 'echo_anonymous', new AnonymousPair(7, "A\0🌱")],
    ['AnonymousCollision', 'echo_anonymous', new AnonymousCollision(7, "A\0🌱")], ['OneOnly', 'echo_one', new OneOnly(7)],
    ['BuffersEmpty', 'echo_buffers', new BuffersEmpty()], ['BuffersPair', 'echo_buffers', new BuffersPair(Bytes::fromString("\0\xff"), Bytes::fromString('abc'))]
];
$cases = [...$constructors, ['NextData', 'next', $data], ['OutcomeError', 'echo_nested', new NestedOutcome(new Err("bad\0🌱"))],
    ['Lists', 'signals', [[new SignalIdle(), $data], [], [$data]]], ['Duplicate', 'duplicate', Bytes::fromString("\0\xff")], ['Produce', 'produce', $big(4)]];
$checkpoints = [];
foreach ($cases as [$label, $name, $input]) {
    $method = $calls[$name]['call']; Faults::arm(0); $out = Native::$method($input); unset($out);
    $limit = Faults::$count; released(1); ensure($limit > 0); $checkpoints[] = ['name' => $label, 'count' => $limit];
    for ($target = 1; $target <= $limit; ++$target) {
        Faults::arm($target); $caught = false;
        try { Native::$method($input); } catch (\Throwable $error) { ensure($error === Faults::$exception); $caught = true; }
        unset($error); ensure($caught); released(); ++$failures;
    }
}
$partial = 0;
for ($i = 0; $i < 32; ++$i) {
    $object = (new \ReflectionClass(NestedOutcome::class))->newInstanceWithoutConstructor();
    (new \ReflectionProperty(NestedOutcome::class, 'value'))->setValue($object, new Ok([new SignalIdle(), null]));
    foreach ([['echo_nested', $object], ['signals', [[$data], [$data, null]]]] as [$name, $input]) {
        Faults::arm(0); $caught = false; $method = $calls[$name]['call'];
        try { Native::$method($input); } catch (\Throwable $error) { ensure($error instanceof \TypeError); $caught = true; }
        unset($error); ensure($caught); released(0); ++$partial;
    }
}
$nativeFailures = 0;
foreach ([['duplicate', Bytes::fromString(str_repeat('x', 6 * 1024 * 1024))], ['produce', $big(16 * 1024 * 1024)]] as [$name, $input]) {
    Faults::arm(0); $caught = false; $method = $calls[$name]['call'];
    try { Native::$method($input); } catch (\Throwable $error) { ensure($error instanceof LeanBridgeError); $caught = true; }
    unset($error); ensure($caught); released(1); ++$nativeFailures;
}

// Synthetic poisoned unions reach only private decoders, never native clear/calls.
Faults::$active = false;
$ffi = (new \ReflectionMethod(Native::class, 'load'))->invoke(null);
function decode(array $calls, string $name, mixed $value, Scope $scope): mixed {
    return (new \ReflectionMethod(Native::class, $calls[$name]['from']))->invoke(null, $value, $scope);
}
function bad(callable $call, string $kind = \RuntimeException::class): void {
    try { $call(); } catch (\Throwable $error) { ensure($error instanceof $kind); return; }
    throw new \RuntimeException('Missing native-output rejection');
}
$malformedTags = 0; $inactive = 0;
foreach (['echo_signal', 'echo_mode', 'echo_nested', 'echo_scalars', 'echo_anonymous', 'echo_one', 'echo_buffers'] as $name) {
    $value = $ffi->new($calls[$name]['ctype']); \FFI::memset(\FFI::addr($value), 255, \FFI::sizeof($value));
    $before = Faults::$branches; bad(fn() => decode($calls, $name, $value, new Scope($ffi)));
    ensure(Faults::$branches === $before); ++$malformedTags;
}
foreach (['echo_signal' => SignalIdle::class, 'echo_mode' => ModeFirst::class, 'echo_nested' => NestedEmpty::class,
    'echo_scalars' => ScalarsAbsent::class, 'echo_buffers' => BuffersEmpty::class, 'echo_anonymous' => AnonymousNumber::class] as $name => $class) {
    $value = $ffi->new($calls[$name]['ctype']); \FFI::memset(\FFI::addr($value), 255, \FFI::sizeof($value)); $value->kind = 0;
    if ($name === 'echo_anonymous') $value->cases->number->arg0 = 7;
    $out = decode($calls, $name, $value, new Scope($ffi)); ensure($out::class === $class); ++$inactive;
}
$malformedPayloads = 0;
$value = $ffi->new($calls['echo_signal']['ctype']); $value->kind = 2; $value->cases->data->label->length = 1;
bad(fn() => decode($calls, 'echo_signal', $value, new Scope($ffi))); ++$malformedPayloads;
$value->cases->data->label->length = PHP_INT_MAX;
bad(fn() => decode($calls, 'echo_signal', $value, new Scope($ffi)), \ValueError::class); ++$malformedPayloads;
$value = $ffi->new($calls['signals']['ctype']); $value->length = 1;
bad(fn() => decode($calls, 'signals', $value, new Scope($ffi))); ++$malformedPayloads;
$value->data = $ffi->cast('void *', 1); bad(fn() => decode($calls, 'signals', $value, new Scope($ffi))); ++$malformedPayloads;
$value->length = PHP_INT_MAX; bad(fn() => decode($calls, 'signals', $value, new Scope($ffi)), \ValueError::class); ++$malformedPayloads;
echo json_encode(['checks' => $checks, 'failures' => $failures, 'checkpoints' => $checkpoints,
    'constructors' => array_column($constructors, 0), 'selectedBranches' => Faults::$branches, 'partialInputs' => $partial,
    'nativeFailureCases' => $nativeFailures, 'malformedTags' => $malformedTags, 'inactivePayloadCases' => $inactive,
    'malformedPayloads' => $malformedPayloads], JSON_THROW_ON_ERROR) . "\n";
