<?php
declare(strict_types=1);
// Private converter probe. No native function or Lean library is loaded.
require __DIR__ . '/dependencies/brick-math/autoload.php';
require __DIR__ . '/src/Api.php';
use Brick\Math\BigInteger;
use LeanCollections\Bytes;
use LeanCollections\Internal\{Budget, Checks, Native, Scope};
$request = json_decode(file_get_contents(__DIR__ . '/request.json'), true, 512, JSON_THROW_ON_ERROR);
$ffi = FFI::cdef(file_get_contents(__DIR__ . '/definitions.h'));
$checks = 0; $rejected = 0;
function check(bool $value): void { global $checks; ++$checks; if (!$value) throw new RuntimeException("Conversion assertion $checks"); }
function bad(callable $call, string $kind = RuntimeException::class): void {
    global $rejected;
    try { $call(); } catch (Throwable $error) { check($error instanceof $kind); ++$rejected; return; }
    throw new RuntimeException('Expected ' . $kind);
}
function decode(array $type, mixed $value, ?Scope $scope = null): mixed {
    global $ffi;
    return (new ReflectionMethod(Native::class, 'from' . $type['index']))->invoke(null, $value, $scope ?? new Scope($ffi));
}
function roundtrip(array $type, mixed $value): mixed {
    global $ffi;
    $scope = new Scope($ffi);
    try {
        $checked = ('LeanCollections\\Internal\\Checks::check' . $type['index'])($value, new Budget());
        $input = (new ReflectionMethod(Native::class, 'to' . $type['index']))->invoke(null, $checked, $scope);
        return decode($type, $type['aggregate'] ? $input : $input->cdata, $scope);
    } finally { $scope->close(); check($scope->owners === []); }
}
function same(mixed $left, mixed $right): void {
    check(get_debug_type($left) === get_debug_type($right));
    if ($left instanceof BigInteger) check((string) $left === (string) $right);
    elseif ($left instanceof Bytes) check($left->toString() === $right->toString());
    elseif (is_float($left)) check(is_nan($left) ? is_nan($right) : pack('E', $left) === pack('E', $right));
    elseif (is_array($left)) { check(array_keys($left) === array_keys($right)); foreach ($left as $key => $value) same($value, $right[$key]); }
    else check($left === $right);
}
$types = $request['scalars'];
check(decode($types['unit'], 0) === null);
check(decode($types['bool'], 0) === false && decode($types['bool'], 1) === true);
for ($marker = 1; $marker < 256; ++$marker) bad(fn() => decode($types['unit'], $marker));
for ($marker = 2; $marker < 256; ++$marker) bad(fn() => decode($types['bool'], $marker));
$integer = $ffi->new($types['int']['ctype']);
for ($marker = 1; $marker < 256; ++$marker) {
    $integer->negative = $marker;
    bad(fn() => decode($types['int'], $integer));
}
$big = fn($value) => BigInteger::of((string) $value);
$huge = $big(2)->power(5120)->plus(17);
$cases = [
    'unit' => [null], 'bool' => [false, true], 'uint8' => [0, 255], 'uint16' => [0, 65535],
    'uint32' => [0, 4294967295], 'uint64' => [$big(0), $big('18446744073709551615')],
    'int8' => [-128, 127], 'int16' => [-32768, 32767], 'int32' => [-2147483648, 2147483647],
    'int64' => [PHP_INT_MIN, PHP_INT_MAX], 'nat' => [$big(0), $huge], 'int' => [$big(0), $huge, $huge->negated()],
    'float32' => [0.0, -0.0, INF, -INF, NAN, unpack('g', pack('V', 1))[1]],
    'float64' => [0.0, -0.0, INF, -INF, NAN, unpack('E', hex2bin('0000000000000001'))[1]],
    'string' => ['', "\0λ🌿", "e\u{0301}"], 'char' => ["\0", "\u{d7ff}", "\u{e000}", "\u{10ffff}"],
    'bytes' => [Bytes::fromString(''), Bytes::fromString("\0\xff")]
];
$cases['usize'] = $cases['uint64']; $cases['isize'] = $cases['int64'];
foreach ($cases as $name => $values) foreach ($values as $value) same(roundtrip($types[$name], $value), $value);
foreach ([0xd800, 0xdfff, 0x110000, 0xffffffff] as $point) bad(fn() => decode($types['char'], $point));
foreach (["\xc0\x80", "\xed\xa0\x80", "\xf4\x90\x80\x80", "\xff"] as $bytes) {
    bad(fn() => roundtrip($types['string'], $bytes), ValueError::class);
    $scope = new Scope($ffi); $value = $ffi->new($types['string']['ctype']);
    $value->data = $scope->buffer($bytes); $value->length = strlen($bytes);
    bad(fn() => decode($types['string'], $value)); $scope->close();
}
foreach (['string', 'bytes', 'nat', 'int'] as $name) {
    $type = $types[$name]; $value = $ffi->new($type['ctype']);
    $value->data = $ffi->cast('void *', 1); $value->length = 0;
    $empty = decode($type, $value);
    check($empty instanceof BigInteger ? $empty->isZero() : ($empty instanceof Bytes ? count($empty) === 0 : $empty === ''));
    foreach ([PHP_INT_MAX, -1] as $length) { $value->length = $length; bad(fn() => decode($type, $value), ValueError::class); }
    $value->length = 1; $value->data = null; bad(fn() => decode($type, $value));
    if ($name === 'nat' || $name === 'int') {
        $value->data = $ffi->cast('void *', 1); bad(fn() => decode($type, $value));
        $words = $ffi->new('uint32_t[2]'); $words[0] = 1; $words[1] = 0;
        $value->data = FFI::addr($words[0]); $value->length = 2;
        bad(fn() => decode($type, $value));
        $words[1] = 1; same(decode($type, $value), $big('4294967297'));
    }
}
foreach (['unit', 'bool', 'uint32'] as $name) {
    $type = $request['rows'][$name]; $value = $ffi->new($type['ctype']);
    $value->data = $ffi->cast('void *', 1); check(decode($type, $value) === []);
    $value->length = PHP_INT_MAX; bad(fn() => decode($type, $value), ValueError::class);
    $value->length = 1; $value->data = null; bad(fn() => decode($type, $value));
    if ($name === 'uint32') { $value->data = $ffi->cast('void *', 1); bad(fn() => decode($type, $value)); }
    else {
        $bytes = $ffi->new('uint8_t[1]'); $bytes[0] = 2; $value->data = FFI::addr($bytes[0]);
        bad(fn() => decode($type, $value));
    }
}
for ($depth = 0; $depth <= 24; ++$depth) {
    $value = $depth === 24 ? 42 : []; for ($i = 0; $i < $depth; ++$i) $value = [$value];
    same(roundtrip($request['deep'], $value), $value);
}
$cycle = []; $cycle[] = &$cycle;
bad(fn() => roundtrip($request['deep'], $cycle), TypeError::class); unset($cycle); gc_collect_cycles();
$value = 42; for ($i = 0; $i < 25; ++$i) $value = [$value];
bad(fn() => roundtrip($request['deep'], $value), TypeError::class);
$borrowed = [1, 2]; $value = [&$borrowed, &$borrowed];
$copied = roundtrip($request['nested'], $value); $borrowed[0] = 99;
same($copied, [[1, 2], [1, 2]]); $copied[0][0] = 7; same($copied[1], [1, 2]);
echo json_encode(['checks' => $checks, 'rejected' => $rejected, 'primitives' => count($cases), 'nativeCalls' => 0], JSON_THROW_ON_ERROR) . "\n";
