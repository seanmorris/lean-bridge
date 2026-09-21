<?php
declare(strict_types=1);
namespace LeanAliases\Probe;
use LeanAliases\{Some, Ok, Err, Bytes, Packet, Scalars, LeanBridgeError};
use Brick\Math\BigInteger;
require 'vendor/autoload.php';

// This isolated process instruments an in-memory copy. Installed files do not change.
final class Faults {
    public static bool $active = false;
    public static int $count = 0, $target = 0, $clears = 0, $closed = 0;
    public static array $owners = [], $scopes = [];
    public static \Throwable $exception;
    public static function arm(int $target): void {
        self::$active = true; self::$target = $target;
        self::$count = self::$clears = self::$closed = 0;
        self::$owners = self::$scopes = [];
        self::$exception = new \RuntimeException('injected alias conversion failure');
    }
    public static function tick(): void {
        if (self::$active && ++self::$count === self::$target) throw self::$exception;
    }
    public static function owner(\FFI\CData $value): void {
        if (self::$active) self::$owners[] = \WeakReference::create($value);
        self::tick();
    }
    public static function scope(object $scope): void {
        if (self::$active) self::$scopes[] = \WeakReference::create($scope);
    }
    public static function close(object $scope): void {
        if (self::$active) { ensure($scope->owners === []); ++self::$closed; }
    }
    public static function clear(): void { if (self::$active) ++self::$clears; }
}
$checks = 0; $failures = 0;
function ensure(bool $value): void {
    global $checks; ++$checks;
    if (!$value) throw new \RuntimeException('Alias fault-probe assertion ' . $checks);
}
function released(): void {
    Faults::$active = false; gc_collect_cycles();
    ensure(Faults::$clears === 1 && Faults::$closed === 1);
    ensure(count(Faults::$scopes) === 1);
    foreach ([...Faults::$owners, ...Faults::$scopes] as $owner) ensure($owner->get() === null);
    ensure(\LeanAliases\increment(41) === 42);
}
$request = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
$root = realpath('vendor/lean-bridge-aliases/api/src/Internal');
$native = file_get_contents($root . '/Native.php');
ensure(str_starts_with($native, '<?php')); $native = substr($native, 5);
$native = str_replace('namespace LeanAliases\\Internal;', 'namespace LeanAliases\\Probe;', $native, $count); ensure($count === 1);
$native = str_replace('__DIR__', var_export($root, true), $native, $count); ensure($count === 2);
$native = str_replace('$this->remaining -= $count * $width;', '$this->remaining -= $count * $width; Faults::tick();', $native, $count); ensure($count === 1);
$native = str_replace('$this->owners[] = $memory;', '$this->owners[] = $memory; Faults::owner($memory);', $native, $count); ensure($count === 1);
$native = str_replace('$this->budget = new Budget();', '$this->budget = new Budget(); Faults::scope($this);', $native, $count); ensure($count === 1);
$native = str_replace('$this->owners = [];', '$this->owners = []; Faults::close($this);', $native, $count); ensure($count === 1);
$native = preg_replace('~(\$ffi->[a-zA-Z0-9_]+_clear\(\\\\FFI::addr\(\$out\)\);)~', '$1 Faults::clear();', $native, -1, $count);
ensure($count === $request['clearSites']); eval($native); unset($native);
$calls = $request['functions'];
$big = fn($value) => BigInteger::of((string) $value);
$huge = $big(2)->power(5120)->plus(19);
$scalars = new Scalars(null, true, 255, 65535, 4294967295, $big('18446744073709551615'), -128, -32768, -2147483648,
    PHP_INT_MIN, $huge, $huge->negated(), 1.5, -2.25, "A\0🌱", Bytes::fromString("\0\xff\1"), '🌱', $big('4294967295'), -2147483648);
$packet = new Packet(7, "text\0🌱", [[1, 2, 3], [], [4]], new Some(new Some(null)), new Ok([7, Bytes::fromString("\0\xff")]));
$cases = [
    ['echo_scalars', $scalars], ['change_packet', $packet], ['reverse_packets', [$packet, $packet]],
    ['reverse_rows', [[1, 2, 3], [], [4]]], ['duplicate', Bytes::fromString("\0\xff")],
    ['echo_nat', $huge], ['echo_int', $huge->negated()], ['echo_string', "copied\0🌱"],
    ['echo_maybe', null], ['echo_maybe', new Some(null)], ['echo_maybe', new Some(new Some(null))],
    ['echo_outcome', new Ok([7, Bytes::fromString("\0\xff")])], ['echo_outcome', new Err("bad\0")]
];
$checkpoints = [];
foreach ($cases as [$name, $input]) {
    $method = $calls[$name]['call'];
    Faults::arm(0); $output = Native::$method($input); unset($output);
    $limit = Faults::$count; released(); ensure($limit > 0); $checkpoints[] = ['name' => $name, 'count' => $limit];
    for ($target = 1; $target <= $limit; ++$target) {
        Faults::arm($target); $caught = false;
        try { Native::$method($input); }
        catch (\Throwable $error) { ensure($error === Faults::$exception); $caught = true; }
        unset($error); ensure($caught); released(); ++$failures;
    }
}

$realFailures = 0;
$invalid = [
    ['echo_nat', $big(-1), \ValueError::class],
    ['duplicate', Bytes::fromString(str_repeat('x', 6 * 1024 * 1024)), LeanBridgeError::class],
    ['produce', $big(16 * 1024 * 1024), LeanBridgeError::class]
];
for ($i = 0; $i < 32; ++$i) {
    $reflection = new \ReflectionClass(Packet::class); $partial = $reflection->newInstanceWithoutConstructor();
    foreach (['count' => 7, 'text' => 'valid first', 'rows' => [[1, 2, 3]],
        'maybe' => new Some(null), 'outcome' => new Ok([7, 'not Bytes'])] as $field => $value)
        $reflection->getProperty($field)->setValue($partial, $value);
    $invalid[] = ['change_packet', $partial, \TypeError::class];
    $invalid[] = ['reverse_rows', [[1, 2, 3], [4, 'not int']], \TypeError::class];
}
foreach ($invalid as [$name, $input, $kind]) {
    Faults::arm(0); $method = $calls[$name]['call']; $caught = false;
    try { Native::$method($input); }
    catch (\Throwable $error) { ensure($error instanceof $kind); $caught = true; }
    unset($error); ensure($caught); released(); ++$realFailures;
}

// Synthetic headers only reach private decoders in this separate process.
// They are never passed to native release functions or public consumers.
Faults::$active = false;
$ffi = (new \ReflectionMethod(Native::class, 'load'))->invoke(null);
function decode(array $calls, string $name, mixed $value, Scope $scope): mixed {
    return (new \ReflectionMethod(Native::class, $calls[$name]['from']))->invoke(null, $value, $scope);
}
function bad(callable $call, string $kind = \RuntimeException::class): void {
    try { $call(); } catch (\Throwable $error) { ensure($error instanceof $kind); return; }
    throw new \RuntimeException('Missing native-output rejection');
}
$malformed = 0; $empty = 0;
foreach (['reverse_rows', 'reverse_packets'] as $name) {
    $value = $ffi->new($calls[$name]['ctype']); $value->length = 1;
    bad(fn() => decode($calls, $name, $value, new Scope($ffi))); ++$malformed;
    $value->data = $ffi->cast('void *', 1);
    bad(fn() => decode($calls, $name, $value, new Scope($ffi))); ++$malformed;
    $value->length = PHP_INT_MAX;
    bad(fn() => decode($calls, $name, $value, new Scope($ffi)), \ValueError::class); ++$malformed;
    $value->length = -1;
    bad(fn() => decode($calls, $name, $value, new Scope($ffi)), \ValueError::class); ++$malformed;
    $value->length = 0; ensure(decode($calls, $name, $value, new Scope($ffi)) === []); ++$empty;
}
foreach (['echo_maybe' => 'has_value', 'echo_outcome' => 'is_ok'] as $name => $flag) {
    $value = $ffi->new($calls[$name]['ctype']); $value->$flag = 2;
    bad(fn() => decode($calls, $name, $value, new Scope($ffi))); ++$malformed;
}
$value = $ffi->new($calls['echo_string']['ctype']); $value->length = 1;
bad(fn() => decode($calls, 'echo_string', $value, new Scope($ffi))); ++$malformed;
foreach ([-1, 0xd800, 0xdfff, 0x110000] as $point) {
    bad(fn() => decode($calls, 'echo_char', $point, new Scope($ffi))); ++$malformed;
}
echo json_encode(['checks' => $checks, 'failures' => $failures, 'checkpoints' => $checkpoints,
    'realFailureCases' => $realFailures, 'partialInputCases' => 64, 'malformedOutputCases' => $malformed,
    'emptyBufferCases' => $empty], JSON_THROW_ON_ERROR) . "\n";
