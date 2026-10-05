<?php
declare(strict_types=0);
// Independent installed consumer. Only public package APIs execute Lean.
use Brick\Math\BigInteger;
use LeanCollections\{Bytes, Primitives, Empty_, Single, Count, Pair, Reversed, Packet, LeanBridgeError};
require 'vendor/autoload.php';
const PARAMETER_PREFIX = 'arg';
$checks = 0; $calls = 0; $rejections = 0;
function check(bool $value, string $message = ''): void {
    global $checks; ++$checks;
    if (!$value) throw new RuntimeException("Collection assertion $checks: $message");
}
function callPublic(string $name, mixed ...$arguments): mixed { global $calls; ++$calls; return ('LeanCollections\\' . $name)(...$arguments); }
function same(mixed $actual, mixed $expected): void {
    check(get_debug_type($actual) === get_debug_type($expected), 'host type');
    if ($expected instanceof BigInteger) check($actual->isEqualTo($expected), 'exact integer');
    elseif ($expected instanceof Bytes) { check($actual->toString() === $expected->toString(), 'bytes'); check($actual->equals($expected)); check($actual->hashCode() === $expected->hashCode()); }
    elseif (is_float($expected)) check(is_nan($expected) ? is_nan($actual) : pack('E', $actual) === pack('E', $expected), 'IEEE value');
    elseif (is_array($expected)) {
        check(array_keys($actual) === array_keys($expected), 'array keys');
        foreach ($expected as $key => $value) same($actual[$key], $value);
    } elseif (is_object($expected)) {
        check(array_keys(get_object_vars($actual)) === array_keys(get_object_vars($expected)), 'fields');
        foreach (get_object_vars($expected) as $key => $value) same($actual->$key, $value);
        check($actual->equals($expected), 'record equality'); check($actual->hashCode() === $expected->hashCode(), 'record hash');
    } else check($actual === $expected, 'value');
}
function rejected(string $kind, callable $call): Throwable {
    global $rejections;
    try { $call(); } catch (Throwable $error) {
        check($error instanceof $kind, get_class($error) . ': ' . $error->getMessage()); ++$rejections;
        same(callPublic('record_make'), new Pair(42, "\u{feff}🌱\0")); return $error;
    }
    throw new RuntimeException('Expected ' . $kind);
}
function recordClass(string $name): string { return 'LeanCollections\\' . ($name === 'Records.Empty' ? 'Empty_' : substr($name, strlen('Records.'))); }
function publicTypes(mixed $type): array {
    if (is_string($type)) return [match ($type) {
        'unit' => 'null', 'bool' => 'bool', 'float32', 'float64' => 'float', 'string', 'char' => 'string',
        'nat', 'int', 'uint64', 'usize' => BigInteger::class, 'bytes' => Bytes::class, default => 'int'
    }];
    return isset($type['record']) ? [recordClass($type['record'])] : ['array'];
}
function reflectedTypes(ReflectionType $type): array {
    if ($type instanceof ReflectionUnionType) return array_merge(...array_map(reflectedTypes(...), $type->getTypes()));
    return $type->allowsNull() && $type->getName() !== 'null' ? [$type->getName(), 'null'] : [$type->getName()];
}
$request = json_decode(file_get_contents('request.json'), true, 512, JSON_THROW_ON_ERROR);
check(PHP_INT_SIZE === 8 && !PHP_ZTS && PHP_SAPI === 'cli'); check(count($request['signatures']) === 35);
$recordTypes = [];
function verifyType(mixed $type): void {
    global $recordTypes;
    if (!is_array($type)) return;
    if (isset($type['array'])) { verifyType($type['array']); return; }
    if (!isset($type['record']) || isset($recordTypes[$type['record']])) return;
    $recordTypes[$type['record']] = true; $class = new ReflectionClass(recordClass($type['record']));
    check($class->isFinal() && $class->isReadOnly());
    $fields = array_keys($type['fields']);
    check(array_map(fn($field) => $field->getName(), $class->getProperties()) === $fields);
    check(array_map(fn($field) => $field->getName(), $class->getConstructor()->getParameters()) === $fields);
    check($class->getConstructor()->getNumberOfRequiredParameters() === count($fields));
    foreach ($type['fields'] as $name => $fieldType) {
        $property = $class->getProperty($name); check($property->isPublic() && $property->isReadOnly());
        $actual = reflectedTypes($property->getType()); $expected = publicTypes($fieldType);
        sort($actual); sort($expected); check($actual === $expected, 'field type ' . $name); verifyType($fieldType);
    }
}
foreach ($request['signatures'] as $signature) {
    $field = strtolower(preg_replace('/([a-z0-9])([A-Z])/', '$1_$2', substr($signature['name'], strlen('Collections.'))));
    $function = new ReflectionFunction('LeanCollections\\' . $field);
    check($function->getNumberOfParameters() === count($signature['parameters']));
    check($function->getNumberOfRequiredParameters() === count($signature['parameters']));
    foreach ($function->getParameters() as $i => $parameter) check((string) $parameter->getType() === 'mixed' && $parameter->getName() === PARAMETER_PREFIX . $i);
    $actual = reflectedTypes($function->getReturnType()); $expected = publicTypes($signature['result']);
    sort($actual); sort($expected); check($actual === $expected, 'public return ' . $field);
    foreach ([...$signature['parameters'], $signature['result']] as $type) verifyType($type);
}
check(count($recordTypes) === 7);
$big = fn($value) => BigInteger::of((string) $value);
$max = $big('18446744073709551615'); $huge = $big(2)->power(5120)->plus(31);
$arguments = [null, true, 255, 65535, 4294967295, $max, -128, -32768, -2147483648, PHP_INT_MIN,
    $big(2)->power(200), $big(2)->power(200)->negated(), -0.0, 3.25, "🌱\0", Bytes::fromString("\xff\0\1"), '🌱', $max, -2147483648];
$scalar = new Primitives(...$arguments);
check(callPublic('record_inspect', $scalar)); check(callPublic('array_check_elements', ...array_map(fn($value) => [$value], $arguments)));
$changed = [null, false, 0, 0, 0, $big(0), 0, 0, 0, 0, $big(0), $big(0), 0.0, 0.0, '', Bytes::fromString(''), "\0", $big(0), 0];
for ($i = 1; $i < 19; ++$i) { $values = $arguments; $values[$i] = $changed[$i]; check(!callPublic('record_inspect', new Primitives(...$values))); }
$floats32 = array_map(fn($bits) => unpack('g', pack('V', $bits))[1], [0, 0x80000000, 1, 0x7fffff, 0x800000, 0x3f800000, 0x7f7fffff, 0x7f800000, 0xff800000, 0x7fc00000]);
$floats64 = array_map(fn($hex) => unpack('E', hex2bin($hex))[1], ['0000000000000000', '8000000000000000', '0000000000000001', '000fffffffffffff', '0010000000000000', '3ff0000000000000', '7fefffffffffffff', '7ff0000000000000', 'fff0000000000000', '7ff8000000000000']);
$cases = [
    'unit' => [null], 'bool' => [false, true], 'uint8' => [0, 1, 255], 'uint16' => [0, 1, 65535], 'uint32' => [0, 2147483648, 4294967295],
    'uint64' => array_map($big, ['0', '1', '4294967296', '9007199254740993', '18446744073709551615']),
    'int8' => [-128, -1, 0, 127], 'int16' => [-32768, -1, 0, 32767], 'int32' => [-2147483648, -1, 0, 2147483647],
    'int64' => [PHP_INT_MIN, -9007199254740993, -1, 0, PHP_INT_MAX], 'nat' => [$big(0), $big(1), $huge], 'int' => [$huge->negated(), $big(0), $huge],
    'float32' => [...$floats32, 1.0000000596046448, 1e300], 'float64' => $floats64,
    'string' => ['', "\0", "a\0λ🌿", "e\u{0301}", "\u{10ffff}"],
    'bytes' => [Bytes::fromString(''), Bytes::fromString("\0\xff"), Bytes::fromString(implode('', array_map(chr(...), range(0, 255))))],
    'char' => ["\0", 'A', "\u{0301}", "\u{d7ff}", "\u{e000}", "\u{ffff}", "\u{1f33f}", "\u{10ffff}"]
];
$cases['usize'] = $cases['uint64']; $cases['isize'] = $cases['int64']; $primitives = [];
foreach ($cases as $kind => $values) {
    $before = $checks; $reverse = 'array_reverse_' . $kind;
    $normalize = $kind === 'float32' ? fn($value) => unpack('g', pack('g', $value))[1] : fn($value) => $value;
    same(callPublic($reverse, []), []);
    for ($i = 0; $i < 128; ++$i) {
        $row = [$values[$i % count($values)], $values[($i + 1) % count($values)], $values[$i % count($values)]];
        same(callPublic($reverse, [$row, [], [$values[0]]]), [[$normalize($values[0])], [], array_map($normalize, array_reverse($row))]);
    }
    same(callPublic($reverse, [[$values[0]]]), [[$normalize($values[0])]]);
    rejected(TypeError::class, fn() => callPublic($reverse, null));
    $primitives[] = ['name' => $kind, 'checks' => $checks - $before];
}
for ($i = 0; $i < 128; ++$i) {
    $input = new Packet('packet', [[$scalar, $scalar], [], [$scalar]], new Empty_(), new Single($max), new Count($huge), new Pair(4294967295, 'pair'), new Reversed('reverse', 4294967295));
    $expected = new Packet('packet!', [[$scalar], [], [$scalar, $scalar]], new Empty_(), new Single($big(0)), new Count($huge->plus(7)), new Pair(0, 'pairp'), new Reversed('reverser', 1));
    same(callPublic('record_shuffle', $input), $expected);
    $duplicates = callPublic('record_duplicate', $input); same($duplicates, [$input, $input]);
    check($duplicates[0] !== $duplicates[1] && $duplicates[0] !== $input);
    check($duplicates[0]->values[0][0] !== $duplicates[1]->values[0][0]);
    check($duplicates[0]->values[0][0]->bytes !== $duplicates[1]->values[0][0]->bytes);
    $copy = $duplicates[0]->values; $copy[0][0] = new Primitives(...$changed);
    check($duplicates[1]->values[0][0]->equals($scalar) && $input->values[0][0]->equals($scalar));
    $duplicates[0] = $expected; check($duplicates[1]->equals($input));
    same(callPublic('record_reverse', [$scalar, new Primitives(...$changed)]), [new Primitives(...$changed), $scalar]);
    same(callPublic('record_empty', new Empty_()), new Empty_());
    same(callPublic('record_single', new Single($max)), new Single($big(0)));
    same(callPublic('record_count', new Count($huge)), new Count($huge->plus(1)));
    same(callPublic('record_make'), new Pair(42, "\u{feff}🌱\0"));
    same(callPublic('array_add', $huge, [[$huge->negated(), $big(1)], []]), [[$big(0), $huge->plus(1)], []]);
    same(callPublic('array_total', [[$huge, $huge], []]), $huge->multipliedBy(2));
    same(callPublic('array_words'), [["\u{feff}Lean", "🌱\0"], []]);
    $bytes = Bytes::fromString("\0\xff"); $copies = callPublic('array_duplicate', [$bytes]);
    same($copies, [$bytes, $bytes]); check($copies[0] !== $copies[1] && $copies[0] !== $bytes);
    $copies[0] = Bytes::fromString('changed'); same($copies[1], $bytes);
    same(callPublic('array_size', [null, null]), $big(2)); same(callPublic('generate', $big(3)), [null, null, null]);
}
for ($depth = 0; $depth <= 24; ++$depth) {
    $value = $depth === 24 ? 42 : []; for ($i = 0; $i < $depth; ++$i) $value = [$value];
    same(callPublic('deep', $value), $value);
}
$invalid = [
    ['unit', false, TypeError::class], ['bool', 1, TypeError::class], ['uint8', -1, ValueError::class], ['uint8', 256, ValueError::class],
    ['uint16', 65536, ValueError::class], ['uint32', 4294967296, ValueError::class], ['uint64', $big(-1), ValueError::class],
    ['uint64', $big('18446744073709551616'), ValueError::class], ['int8', -129, ValueError::class], ['int16', 32768, ValueError::class],
    ['int32', -2147483649, ValueError::class], ['int64', '1', TypeError::class], ['isize', true, TypeError::class], ['usize', 1, TypeError::class],
    ['nat', $big(-1), ValueError::class], ['int', 1, TypeError::class], ['nat', $big(str_repeat('9', 16385)), ValueError::class],
    ['float32', 1, TypeError::class], ['float64', '1', TypeError::class], ['string', "\xed\xa0\x80", ValueError::class],
    ['string', "\xc0\x80", ValueError::class], ['bytes', '', TypeError::class], ['char', '', ValueError::class], ['char', 'ab', ValueError::class]
];
foreach ($invalid as [$kind, $value, $error]) rejected($error, fn() => callPublic('array_reverse_' . $kind, [[$cases[$kind][0], $value]]));
foreach ([false, 42, '1', (object) [], new ArrayObject([1, 2]), [1 => []], ['x' => []], [0 => [], 2 => []], [[0], null]] as $bad)
    rejected(TypeError::class, fn() => callPublic('array_reverse_uint32', $bad));
foreach ([Primitives::class, Pair::class, Packet::class] as $class)
    rejected(TypeError::class, fn() => callPublic($class === Packet::class ? 'record_shuffle' : ($class === Pair::class ? 'record_shuffle' : 'record_inspect'), (new ReflectionClass($class))->newInstanceWithoutConstructor()));
rejected(TypeError::class, fn() => callPublic('record_empty', (object) []));
rejected(ArgumentCountError::class, fn() => new Empty_(1)); rejected(ArgumentCountError::class, fn() => new Pair(1, '', 3));
rejected(Error::class, fn() => $scalar->flag = false);
$cycle = []; $cycle[] = &$cycle; rejected(TypeError::class, fn() => callPublic('deep', $cycle)); unset($cycle); gc_collect_cycles();
$deep = 42; for ($i = 0; $i < 25; ++$i) $deep = [$deep]; rejected(TypeError::class, fn() => callPublic('deep', $deep));
$text = 'borrowed'; $value = [[&$text, &$text]]; $copied = callPublic('array_reverse_string', $value);
$text = 'changed'; same($copied, [['borrowed', 'borrowed']]); $copied[0][0] = 'output'; check($copied[0][1] === 'borrowed');
$row = [1, 2]; $value = [&$row, &$row]; $copied = callPublic('array_reverse_uint32', $value);
$row[0] = 99; same($copied, [[2, 1], [2, 1]]); $copied[0][0] = 7; same($copied[1], [2, 1]);
rejected(ValueError::class, fn() => callPublic('array_reverse_string', [[str_repeat('x', 17 * 1024 * 1024)]]));
rejected(ValueError::class, fn() => callPublic('array_reverse_uint32', [array_fill(0, 2097153, 0)]));
for ($i = 0; $i < 3; ++$i) rejected(LeanBridgeError::class, fn() => callPublic('array_duplicate', [Bytes::fromString(str_repeat('x', 9 * 1024 * 1024))]));
rejected(LeanBridgeError::class, fn() => callPublic('generate', $big(17 * 1024 * 1024)));
same(callPublic('generate', $big(0)), []); same(callPublic('generate', $big(30000)), array_fill(0, 30000, null));
/* DOCUMENTATION */
gc_collect_cycles(); same(callPublic('record_make'), new Pair(42, "\u{feff}🌱\0"));
$api = realpath((new ReflectionFunction(LeanCollections\record_make(...)))->getFileName()); $root = dirname($api, 2);
check($root === realpath(__DIR__ . '/vendor/lean-bridge-collections/api'));
$libraries = [];
foreach (file('/proc/self/maps') as $line) if (preg_match('~\s(/\S+\.so)$~', trim($line), $match) && str_starts_with($match[1], $root . '/'))
    $libraries[substr($match[1], strlen($root) + 1)] = hash_file('sha256', $match[1]);
ksort($libraries); check(count($libraries) >= 3);
echo json_encode(['checks' => $checks, 'calls' => $calls, 'rejections' => $rejections, 'primitives' => $primitives, 'records' => count($recordTypes),
    'php' => PHP_VERSION, 'word_bits' => PHP_INT_SIZE * 8, 'api' => $api, 'native_libraries' => $libraries,
    'documentation' => $documentationOutput], JSON_THROW_ON_ERROR) . "\n";
