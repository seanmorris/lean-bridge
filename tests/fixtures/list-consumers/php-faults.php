<?php
declare(strict_types=1);
namespace LeanLists\Probe;
use LeanLists\{Some, Ok, Err, Bytes, Packet, LeanBridgeError};
use Brick\Math\BigInteger;
require 'vendor/autoload.php';

// Only this separate probe evaluates instrumented helpers, in memory. The
// Composer-installed API, native libraries and receipt remain byte-identical.
final class Faults {
    public static bool $active = false;
    public static int $count = 0, $target = 0, $clears = 0, $closed = 0;
    public static array $owners = [], $scopes = [];
    public static \Throwable $exception;
    public static function arm(int $target): void {
        self::$active = true; self::$target = $target;
        self::$count = self::$clears = self::$closed = 0;
        self::$owners = self::$scopes = [];
        self::$exception = new \RuntimeException('injected PHP conversion failure');
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
    if (!$value) throw new \RuntimeException('Fault-probe assertion ' . $checks);
}
function released(): void {
    Faults::$active = false; gc_collect_cycles();
    ensure(Faults::$clears === 1 && Faults::$closed === 1);
    ensure(count(Faults::$scopes) === 1);
    foreach ([...Faults::$owners, ...Faults::$scopes] as $owner) ensure($owner->get() === null);
    ensure(\LeanLists\reverse_uint32([1, 2, 3]) === [3, 2, 1]);
}
$root = realpath('vendor/lean-bridge-lists/api/src/Internal');
$native = file_get_contents($root . '/Native.php');
ensure(str_starts_with($native, '<?php'));
$native = substr($native, 5);
$native = str_replace('namespace LeanLists\\Internal;', 'namespace LeanLists\\Probe;', $native, $count); ensure($count === 1);
$native = str_replace('__DIR__', var_export($root, true), $native, $count); ensure($count === 2);
$native = str_replace('$this->remaining -= $count * $width;', '$this->remaining -= $count * $width; Faults::tick();', $native, $count); ensure($count === 1);
$native = str_replace('$this->owners[] = $memory;', '$this->owners[] = $memory; Faults::owner($memory);', $native, $count); ensure($count === 1);
$native = str_replace('$this->budget = new Budget();', '$this->budget = new Budget(); Faults::scope($this);', $native, $count); ensure($count === 1);
$native = str_replace('$this->owners = [];', '$this->owners = []; Faults::close($this);', $native, $count); ensure($count === 1);
$native = preg_replace('~(\$ffi->[a-zA-Z0-9_]+_clear\(\\\\FFI::addr\(\$out\)\);)~', '$1 Faults::clear();', $native, -1, $count); ensure($count === 27);
eval($native); unset($native);
$request = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
$big = BigInteger::of(2)->power(5120)->plus(17);
$packet = new Packet([[1, 2, 3], [], [4]], [null, new Some(new Ok([$big, null])), new Some(new Err("oops\0"))],
    [Bytes::fromString("\0\xff"), Bytes::fromString('')], [[[true, '🌿'], [false, "\0"]], []]);
$deep = 42; for ($i = 0; $i < 24; ++$i) $deep = [$deep];
$cases = [
    ['transform', $packet], ['duplicate', Bytes::fromString("\0\xff")],
    ['reverse_nat', [$big, $big]], ['nest', new Some([new Ok([null]), new Err('bad'), new Ok([])])],
    ['swap', new Ok([[$big, BigInteger::of(42)], [1, 2]])], ['swap', new Err(['first', 'last'])], ['deep', $deep]
];
$checkpoints = [];
foreach ($cases as [$name, $input]) {
    $method = $request[$name]['call'];
    Faults::arm(0); $output = Native::$method($input); unset($output);
    $limit = Faults::$count; released(); ensure($limit > 0); $checkpoints[] = ['name' => $name, 'count' => $limit];
    for ($target = 1; $target <= $limit; ++$target) {
        Faults::arm($target); $caught = false;
        try { Native::$method($input); }
        catch (\Throwable $error) { ensure($error === Faults::$exception); $caught = true; }
        unset($error); ensure($caught); released(); ++$failures;
    }
}
// Partial validation, native budget and PHP output conversion failures clear once.
$realFailures = 0;
$invalid = [['reverse_nat', [BigInteger::of(0), BigInteger::of(-1)], \ValueError::class],
    ['duplicate', Bytes::fromString(str_repeat('x', 6 * 1024 * 1024)), LeanBridgeError::class],
    ['generate', BigInteger::of(2097153), LeanBridgeError::class],
    ['generate', BigInteger::of(400000), \ValueError::class]];
for ($i = 0; $i < 16; ++$i) $invalid[] = ['reverse_string', ['copied first', null], \TypeError::class];
foreach ($invalid as [$name, $input, $kind]) {
    Faults::arm(0); $method = $request[$name]['call']; $caught = false;
    try { Native::$method($input); }
    catch (\Throwable $error) { ensure($error instanceof $kind); $caught = true; }
    unset($error); ensure($caught); released(); ++$realFailures;
}

// Decode synthetic headers only in the isolated process. No owned native buffer
// is forged or passed to a public consumer or native release function.
Faults::$active = false;
$ffi = (new \ReflectionMethod(Native::class, 'load'))->invoke(null);
function decode(array $request, string $name, mixed $value, Scope $scope): mixed {
    return (new \ReflectionMethod(Native::class, $request[$name]['from']))->invoke(null, $value, $scope);
}
function bad(callable $call, string $kind = \RuntimeException::class): void {
    try { $call(); } catch (\Throwable $error) { ensure($error instanceof $kind); return; }
    throw new \RuntimeException('Missing native-output rejection');
}
$malformed = 0; $empty = 0;
foreach (['reverse_uint32', 'mix'] as $name) {
    $value = $ffi->new($request[$name]['ctype']); $value->length = 1;
    bad(fn() => decode($request, $name, $value, new Scope($ffi))); ++$malformed;
    $value->data = \FFI::cast('void *', 1);
    bad(fn() => decode($request, $name, $value, new Scope($ffi))); ++$malformed;
    $value->length = PHP_INT_MAX;
    bad(fn() => decode($request, $name, $value, new Scope($ffi)), \ValueError::class); ++$malformed;
    $value->length = -1;
    bad(fn() => decode($request, $name, $value, new Scope($ffi)), \ValueError::class); ++$malformed;
    $value->length = 0;
    ensure(decode($request, $name, $value, new Scope($ffi)) === []); ++$empty;
}
$outer = $ffi->new($request['mix']['ctype']);
$inner = $ffi->new($request['reverse_uint32']['ctype']);
$inner->length = 1; $outer->data = \FFI::addr($inner); $outer->length = 1;
bad(fn() => decode($request, 'mix', $outer, new Scope($ffi))); ++$malformed;

// A Bool/Char product aligns to four bytes, not the pointer alignment of eight.
$record = $ffi->new($request['transform']['ctype']);
$elementType = $ffi->type('lists_tuple_bool_char_value');
ensure(\FFI::alignof($elementType) === 4);
$storage = $ffi->new('uint64_t[2]');
$address = \FFI::cast('uint8_t *', \FFI::addr($storage[0]));
$pair = $ffi->cast('lists_tuple_bool_char_value *', \FFI::addr($address[4]));
$pair[0]->fst = 1; $pair[0]->snd = 65;
$row = $ffi->new('lists_list_tuple_bool_char_span');
$row->data = $pair; $row->length = 1;
$record->arrays->data = \FFI::addr($row); $record->arrays->length = 1;
$result = decode($request, 'transform', $record, new Scope($ffi));
ensure($result->arrays === [[[true, 'A']]]);
echo json_encode(['checks' => $checks, 'failures' => $failures, 'checkpoints' => $checkpoints,
    'realFailureCases' => $realFailures, 'partialInputCases' => 16, 'malformedOutputCases' => $malformed,
    'emptyBufferCases' => $empty, 'compoundAlignmentCases' => 1], JSON_THROW_ON_ERROR) . "\n";
