<?php
declare(strict_types=1);
namespace LeanCollections\Probe;
use LeanCollections\{Bytes, Primitives, Empty_, Single, Count, Pair, Reversed, Packet, LeanBridgeError};
use Brick\Math\BigInteger;
require 'vendor/autoload.php';

// Instrumented helpers live only in this process. Installed files stay unchanged.
final class Faults {
    public static bool $active = false;
    public static int $count = 0, $target = 0, $clears = 0, $closed = 0;
    public static array $owners = [], $scopes = [];
    public static \Throwable $exception;
    public static function arm(int $target): void {
        self::$active = true; self::$target = $target;
        self::$count = self::$clears = self::$closed = 0; self::$owners = self::$scopes = [];
        self::$exception = new \RuntimeException('injected PHP collection failure');
    }
    public static function tick(): void { if (self::$active && ++self::$count === self::$target) throw self::$exception; }
    public static function owner(\FFI\CData $value): void {
        if (self::$active) self::$owners[] = \WeakReference::create($value); self::tick();
    }
    public static function scope(object $scope): void { if (self::$active) self::$scopes[] = \WeakReference::create($scope); }
    public static function close(object $scope): void { if (self::$active) { ensure($scope->owners === []); ++self::$closed; } }
    public static function clear(): void { if (self::$active) ++self::$clears; }
}
$checks = 0; $failures = 0;
function ensure(bool $value): void {
    global $checks; ++$checks; if (!$value) throw new \RuntimeException('Collection fault assertion ' . $checks);
}
function released(): void {
    Faults::$active = false; gc_collect_cycles();
    ensure(Faults::$clears === 1 && Faults::$closed === 1); ensure(count(Faults::$scopes) === 1);
    foreach ([...Faults::$owners, ...Faults::$scopes] as $owner) ensure($owner->get() === null);
    ensure(\LeanCollections\array_reverse_uint32([[1, 2, 3]]) === [[3, 2, 1]]);
}
$root = realpath('vendor/lean-bridge-collections/api/src/Internal');
$native = file_get_contents($root . '/Native.php'); ensure(str_starts_with($native, '<?php')); $native = substr($native, 5);
$native = str_replace('namespace LeanCollections\\Internal;', 'namespace LeanCollections\\Probe;', $native, $count); ensure($count === 1);
$native = str_replace('__DIR__', var_export($root, true), $native, $count); ensure($count === 2);
$native = str_replace('$this->remaining -= $count * $width;', '$this->remaining -= $count * $width; Faults::tick();', $native, $count); ensure($count === 1);
$native = str_replace('$this->owners[] = $memory;', '$this->owners[] = $memory; Faults::owner($memory);', $native, $count); ensure($count === 1);
$native = str_replace('$this->budget = new Budget();', '$this->budget = new Budget(); Faults::scope($this);', $native, $count); ensure($count === 1);
$native = str_replace('$this->owners = [];', '$this->owners = []; Faults::close($this);', $native, $count); ensure($count === 1);
$native = preg_replace('~(\$ffi->[a-zA-Z0-9_]+_clear\(\\\\FFI::addr\(\$out\)\);)~', '$1 Faults::clear();', $native, -1, $count); ensure($count === 32);
eval($native); unset($native);
$request = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
$big = fn($value) => BigInteger::of((string) $value);
$huge = $big(2)->power(5120)->plus(17); $max = $big('18446744073709551615');
$scalar = new Primitives(null, true, 255, 65535, 4294967295, $max, -128, -32768, -2147483648, PHP_INT_MIN,
    $huge, $huge->negated(), -0.0, 3.25, "a\0🌿", Bytes::fromString("\0\xff"), '🌿', $max, -2147483648);
$packet = new Packet('packet', [[$scalar], [], [$scalar, $scalar]], new Empty_(), new Single($max), new Count($huge), new Pair(42, 'p'), new Reversed('r', 24));
$deep = 42; for ($i = 0; $i < 24; ++$i) $deep = [$deep];
$cases = [
    ['record_shuffle', [$packet]], ['record_duplicate', [$packet]], ['record_reverse', [[$scalar]]],
    ['array_reverse_nat', [[[$huge], [], [$huge]]]], ['array_reverse_bytes', [[[Bytes::fromString("\0\xff")]]]],
    ['array_reverse_bool', [[[true, false]]]], ['deep', [$deep]], ['record_empty', [new Empty_()]], ['record_make', []]
];
$checkpoints = [];
foreach ($cases as [$name, $arguments]) {
    $method = $request['functions'][$name]['call'];
    Faults::arm(0); $output = Native::$method(...$arguments); unset($output);
    $limit = Faults::$count; released(); ensure($limit > 0); $checkpoints[] = ['name' => $name, 'count' => $limit];
    for ($target = 1; $target <= $limit; ++$target) {
        Faults::arm($target); $caught = false;
        try { Native::$method(...$arguments); } catch (\Throwable $error) { ensure($error === Faults::$exception); $caught = true; }
        unset($error); ensure($caught); released(); ++$failures;
    }
}
$partial = 0;
foreach (['array_reverse_string', 'array_reverse_nat', 'record_reverse', 'record_shuffle'] as $name) for ($i = 0; $i < 16; ++$i) {
    if ($name === 'record_shuffle') {
        $input = (new \ReflectionClass(Packet::class))->newInstanceWithoutConstructor();
        foreach (get_object_vars($packet) as $field => $value) (new \ReflectionProperty(Packet::class, $field))->setValue($input,
            $field === 'pair' ? (new \ReflectionClass(Pair::class))->newInstanceWithoutConstructor() : $value);
    } else $input = match ($name) {
        'array_reverse_string' => [['copied first'], ['second', null]],
        'array_reverse_nat' => [[$big(0)], [$huge, $big(-1)]],
        'record_reverse' => [$scalar, (new \ReflectionClass(Primitives::class))->newInstanceWithoutConstructor()]
    };
    Faults::arm(0); $method = $request['functions'][$name]['call']; $caught = false;
    try { Native::$method($input); } catch (\Throwable $error) { ensure($error instanceof ($name === 'array_reverse_nat' ? \ValueError::class : \TypeError::class)); $caught = true; }
    unset($error); ensure($caught); released(); ++$partial;
}

// Synthetic unowned headers go only to private decoders, never native clear.
Faults::$active = false; $ffi = (new \ReflectionMethod(Native::class, 'load'))->invoke(null);
function decode(array $entry, mixed $value): mixed {
    global $ffi; return (new \ReflectionMethod(Native::class, 'from' . $entry['index']))->invoke(null, $value, new Scope($ffi));
}
function bad(callable $call, string $kind = \RuntimeException::class): void {
    try { $call(); } catch (\Throwable $error) { ensure($error instanceof $kind); return; }
    throw new \RuntimeException('Missing malformed-output rejection');
}
$malformed = 0;
foreach (['unit', 'bool'] as $name) for ($marker = $name === 'unit' ? 1 : 2; $marker < 256; ++$marker) {
    bad(fn() => decode($request['scalars'][$name], $marker)); ++$malformed;
}
foreach (['nat', 'int'] as $name) {
    $entry = $request['scalars'][$name]; $value = $ffi->new($entry['ctype']); $value->length = 1;
    bad(fn() => decode($entry, $value)); ++$malformed;
    $value->data = $ffi->cast('void *', 1); bad(fn() => decode($entry, $value)); ++$malformed;
    $value->length = PHP_INT_MAX; bad(fn() => decode($entry, $value), \ValueError::class); ++$malformed;
    $value->length = 0; if ($name === 'int') { $value->negative = 2; bad(fn() => decode($entry, $value)); ++$malformed; }
}
echo json_encode(['checks' => $checks, 'failures' => $failures, 'checkpoints' => $checkpoints,
    'partialInputCases' => $partial, 'malformedOutputCases' => $malformed], JSON_THROW_ON_ERROR) . "\n";
