<?php
declare(strict_types=0);
// Independent installed consumer. Only public package APIs execute Lean.
use Brick\Math\BigInteger;
use LeanLists\{Some, Ok, Err, Bytes, Packet, LeanBridgeError};
require 'vendor/autoload.php';
const PARAMETER_PREFIX = 'arg';
$checks = 0;
function check(bool $value, string $message = ''): void {
    global $checks; ++$checks;
    if (!$value) throw new RuntimeException("List assertion $checks: $message");
}
function same(mixed $actual, mixed $expected): void {
    check(get_debug_type($actual) === get_debug_type($expected), 'host type');
    if ($expected instanceof BigInteger) check($actual->isEqualTo($expected), 'exact integer');
    elseif ($expected instanceof Bytes) check($actual->toString() === $expected->toString(), 'bytes');
    elseif (is_float($expected)) check(is_nan($expected) ? is_nan($actual) : pack('e', $actual) === pack('e', $expected), 'IEEE value');
    elseif (is_array($expected)) {
        check(array_keys($actual) === array_keys($expected), 'array keys');
        foreach ($expected as $key => $value) same($actual[$key], $value);
    } elseif (is_object($expected)) {
        check(array_keys(get_object_vars($actual)) === array_keys(get_object_vars($expected)), 'fields');
        foreach (get_object_vars($expected) as $key => $value) same($actual->$key, $value);
    } else check($actual === $expected, 'value');
}
function rejected(string $kind, callable $call): Throwable {
    try { $call(); } catch (Throwable $error) {
        check($error instanceof $kind, get_class($error) . ': ' . $error->getMessage());
        check(LeanLists\reverse_uint32([1, 2, 3]) === [3, 2, 1], 'recovery');
        return $error;
    }
    throw new RuntimeException('Expected ' . $kind);
}
function publicTypes(mixed $type): array {
    if (is_string($type)) return [match ($type) {
        'unit' => 'null', 'bool' => 'bool', 'float32', 'float64' => 'float', 'string', 'char' => 'string',
        'nat', 'int', 'uint64', 'usize' => BigInteger::class, 'bytes' => Bytes::class, default => 'int'
    }];
    if (isset($type['option'])) return [Some::class, 'null'];
    if (isset($type['result'])) return [Ok::class, Err::class];
    if (isset($type['record'])) return [Packet::class];
    return ['array'];
}
function reflectedTypes(ReflectionType $type): array {
    if ($type instanceof ReflectionUnionType) return array_merge(...array_map(reflectedTypes(...), $type->getTypes()));
    return $type->allowsNull() && $type->getName() !== 'null' ? [$type->getName(), 'null'] : [$type->getName()];
}
$request = json_decode(file_get_contents('request.json'), true, 512, JSON_THROW_ON_ERROR);
check(PHP_INT_SIZE === 8 && !PHP_ZTS && PHP_SAPI === 'cli');
check(count($request['signatures']) === 27);
foreach ($request['signatures'] as $signature) {
    $name = 'LeanLists\\' . substr($signature['name'], strlen('Lists.'));
    $function = new ReflectionFunction($name);
    check($function->getNumberOfParameters() === count($signature['parameters']));
    check($function->getNumberOfRequiredParameters() === count($signature['parameters']));
    foreach ($function->getParameters() as $i => $parameter)
        check((string) $parameter->getType() === 'mixed' && $parameter->getName() === PARAMETER_PREFIX . $i);
    $actual = reflectedTypes($function->getReturnType()); $expected = publicTypes($signature['result']);
    sort($actual); sort($expected); check($actual === $expected, 'public return ' . $name);
}
$big = fn($value) => BigInteger::of((string) $value);
$huge = $big(2)->power(5120)->plus($big(2)->power(255))->plus(17); $negative = $huge->negated();
$floats32 = array_map(fn($bits) => unpack('g', pack('V', $bits))[1], [0, 0x80000000, 1, 0x7fffff, 0x800000, 0x3f800000, 0x7f7fffff, 0x7f800000, 0xff800000, 0x7fc00000]);
$floats64 = array_map(fn($hex) => unpack('E', hex2bin($hex))[1], ['0000000000000000', '8000000000000000', '0000000000000001', '000fffffffffffff', '0010000000000000', '3ff0000000000000', '7fefffffffffffff', '7ff0000000000000', 'fff0000000000000', '7ff8000000000000']);
$cases = [
    'unit' => [null], 'bool' => [false, true], 'uint8' => [0, 1, 255], 'uint16' => [0, 1, 65535],
    'uint32' => [0, 1, 2147483648, 4294967295],
    'uint64' => array_map($big, ['0', '1', '4294967296', '9007199254740993', '18446744073709551615']),
    'int8' => [-128, -1, 0, 127], 'int16' => [-32768, -1, 0, 32767],
    'int32' => [-2147483648, -1, 0, 2147483647], 'int64' => [PHP_INT_MIN, -9007199254740993, -1, 0, PHP_INT_MAX],
    'nat' => [$big(0), $big(1), $huge], 'int' => [$negative, $big(0), $huge],
    'float32' => [...$floats32, 1.0000000596046448, 1e300], 'float64' => $floats64,
    'string' => ['', "\0", "a\0λ🌿", "e\u{0301}", "\u{10ffff}"],
    'bytes' => [Bytes::fromString(''), Bytes::fromString("\0\xff"), Bytes::fromString(implode('', array_map(chr(...), range(0, 255))))],
    'char' => ["\0", 'A', "\u{0301}", "\u{d7ff}", "\u{e000}", "\u{ffff}", "\u{1f33f}", "\u{10ffff}"]
];
$cases['usize'] = $cases['uint64']; $cases['isize'] = $cases['int64'];
$primitives = [];
foreach ($cases as $kind => $values) {
    $before = $checks; $reverse = 'LeanLists\\reverse_' . $kind;
    $normalize = $kind === 'float32' ? fn($value) => unpack('g', pack('g', $value))[1] : fn($value) => $value;
    same($reverse([]), []);
    for ($i = 0; $i < 128; ++$i) {
        $input = [$values[$i % count($values)], $values[($i + 1) % count($values)], $values[$i % count($values)], $values[($i + 2) % count($values)]];
        same($reverse($input), array_map($normalize, array_reverse($input)));
    }
    same($reverse([$values[0]]), [$normalize($values[0])]);
    rejected(TypeError::class, fn() => $reverse(null));
    $primitives[] = ['name' => $kind, 'checks' => $checks - $before];
}
$invalid = [
    ['unit', false, TypeError::class], ['bool', 1, TypeError::class], ['uint8', -1, ValueError::class], ['uint8', 256, ValueError::class],
    ['uint16', 65536, ValueError::class], ['uint32', 4294967296, ValueError::class],
    ['uint64', $big(-1), ValueError::class], ['uint64', $big('18446744073709551616'), ValueError::class],
    ['int8', -129, ValueError::class], ['int16', 32768, ValueError::class], ['int32', -2147483649, ValueError::class],
    ['int64', '1', TypeError::class], ['int64', 1e30, TypeError::class], ['isize', true, TypeError::class], ['usize', 1, TypeError::class],
    ['nat', $big(-1), ValueError::class], ['int', 1, TypeError::class], ['nat', $big(str_repeat('9', 16385)), ValueError::class],
    ['float32', 1, TypeError::class], ['float64', '1', TypeError::class],
    ['string', "\xed\xa0\x80", ValueError::class], ['string', "\xc0\x80", ValueError::class], ['string', 1, TypeError::class],
    ['bytes', '', TypeError::class], ['char', 'ab', ValueError::class], ['char', '', ValueError::class], ['char', "\xf4\x90\x80\x80", ValueError::class]
];
foreach ($invalid as [$kind, $value, $error]) {
    $reverse = 'LeanLists\\reverse_' . $kind;
    rejected($error, fn() => $reverse([$cases[$kind][0], $value]));
}
same(LeanLists\join(["a\0", '', '🌿']), "a\0🌱🌱🌿"); same(LeanLists\join([]), '');
same(LeanLists\mix([[1, 2, 3], [], [4]]), [[4], [], [3, 2, 1]]);
for ($i = 0; $i < 20; ++$i) {
    $input = new Packet([[1, 2, 3], [], [$i]], [null, new Some(new Ok([$huge, null])), new Some(new Err("oops\0"))],
        [Bytes::fromString("\0\xff"), Bytes::fromString('')], [[[true, '🌿'], [false, "\0"]], []]);
    $output = LeanLists\transform($input);
    same($output, new Packet([[$i], [], [3, 2, 1]], [new Some(new Err("oops\0!")), new Some(new Ok([$huge->plus(1), null])), null],
        [Bytes::fromString(''), Bytes::fromString("\0\xff")], [[], [[false, "\0"], [true, '🌿']]]));
    check($output !== $input && $output->buffers[1] !== $input->buffers[0], 'independent record and Bytes');
    check($output->branches[1] !== $input->branches[1], 'independent branches');
    $sequences = $output->sequences; $sequences[2][0] = 99; same($input->sequences[0], [1, 2, 3]);
    rejected(Error::class, function() use ($output) { $output->sequences = []; });
}
same(LeanLists\nest(null), null); same(LeanLists\nest(new Some([])), new Some([]));
same(LeanLists\nest(new Some([new Ok([null, null]), new Err("bad\0"), new Ok([])])), new Some([new Ok([]), new Err("bad\0!"), new Ok([null, null])]));
same(LeanLists\swap(new Err(['first', 'last'])), new Ok(['last', 'first']));
same(LeanLists\swap(new Ok([[$huge, $big(42)], [1, 2, 3]])), new Err([[$big(42), $huge], [3, 2, 1]]));
for ($depth = 0; $depth <= 24; ++$depth) {
    $value = $depth === 24 ? 42 : []; for ($i = 0; $i < $depth; ++$i) $value = [$value];
    same(LeanLists\deep($value), $value);
}
$bytes = Bytes::fromString("\0\xff"); $copies = LeanLists\duplicate($bytes);
same($copies, [$bytes, $bytes]); check($copies[0] !== $copies[1] && $copies[0] !== $bytes);
$copies[0] = Bytes::fromString('changed'); same($copies[1], $bytes);
same(LeanLists\duplicate(Bytes::fromString('')), [Bytes::fromString(''), Bytes::fromString('')]);
$text = 'borrowed'; $input = [&$text, &$text]; $copied = LeanLists\reverse_string($input);
$text = 'changed'; same($copied, ['borrowed', 'borrowed']); $copied[0] = 'output'; check($copied[1] === 'borrowed');
$shared = [1, 2]; $input = [&$shared, &$shared]; $copied = LeanLists\mix($input);
$shared[0] = 99; same($copied, [[2, 1], [2, 1]]); $copied[0][0] = 7; same($copied[1], [2, 1]);

foreach ([null, false, 42, '1', (object) [], new ArrayObject([1, 2]), [1 => 1], ['x' => 1], [0 => 1, 2 => 2]] as $bad)
    rejected(TypeError::class, fn() => LeanLists\reverse_uint32($bad));
$cycle = []; $cycle[] = &$cycle;
rejected(TypeError::class, fn() => LeanLists\reverse_uint32($cycle));
rejected(TypeError::class, fn() => LeanLists\deep($cycle)); unset($cycle); gc_collect_cycles();
$deep = 42; for ($i = 0; $i < 25; ++$i) $deep = [$deep];
rejected(TypeError::class, fn() => LeanLists\deep($deep));
foreach ([Some::class, Ok::class, Err::class] as $class) {
    $reflection = new ReflectionClass($class); check($reflection->isFinal() && $reflection->isReadOnly());
    rejected(ArgumentCountError::class, fn() => new $class()); rejected(ArgumentCountError::class, fn() => new $class(null, 1));
    $object = new $class(null); same($object->value, null);
    rejected(Error::class, function() use ($object) { $object->value = 1; });
}
rejected(TypeError::class, fn() => LeanLists\nest((new ReflectionClass(Some::class))->newInstanceWithoutConstructor()));
rejected(TypeError::class, fn() => LeanLists\nest(new Some([new Ok([]), null])));
rejected(TypeError::class, fn() => LeanLists\nest(new Some([new Ok([1])])));
rejected(TypeError::class, fn() => LeanLists\mix([[1], new ArrayObject([2])]));
foreach ([[], [[]], [[], [], []], ['a' => [], 'b' => []]] as $bad)
    rejected(TypeError::class, fn() => LeanLists\swap(new Ok($bad)));
$coercion = new class implements Stringable { public function __toString(): string { throw new RuntimeException('coercion called'); } };
rejected(TypeError::class, fn() => LeanLists\reverse_string(['copied', $coercion]));
rejected(TypeError::class, fn() => LeanLists\reverse_float64([0.0, $coercion]));
rejected(ValueError::class, fn() => LeanLists\reverse_bytes([Bytes::fromString(str_repeat('x', 16 * 1024 * 1024))]));
rejected(ValueError::class, fn() => LeanLists\reverse_uint32(array_fill(0, 2097153, 0)));
for ($i = 0; $i < 3; ++$i) rejected(LeanBridgeError::class, fn() => LeanLists\duplicate(Bytes::fromString(str_repeat('x', 6 * 1024 * 1024))));
rejected(LeanBridgeError::class, fn() => LeanLists\generate($big(2097153)));
rejected(ValueError::class, fn() => LeanLists\generate($big(400000)));
same(LeanLists\generate($big(0)), []); same(LeanLists\generate($big(1)), [7]);
same(LeanLists\generate($big(30000)), array_fill(0, 30000, 7));
gc_collect_cycles(); same(LeanLists\reverse_uint32([1, 2, 3]), [3, 2, 1]);
$api = realpath((new ReflectionFunction(LeanLists\reverse_uint32(...)))->getFileName()); $root = dirname($api, 2);
check($root === realpath(__DIR__ . '/vendor/lean-bridge-lists/api'));
$libraries = [];
foreach (file('/proc/self/maps') as $line) if (preg_match('~\s(/\S+\.so)$~', trim($line), $match) && str_starts_with($match[1], $root . '/'))
    $libraries[substr($match[1], strlen($root) + 1)] = hash_file('sha256', $match[1]);
ksort($libraries); check(count($libraries) >= 3);
echo json_encode(['checks' => $checks, 'primitives' => $primitives, 'php' => PHP_VERSION, 'word_bits' => PHP_INT_SIZE * 8,
    'api' => $api, 'native_libraries' => $libraries], JSON_THROW_ON_ERROR) . "\n";
