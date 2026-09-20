<?php
declare(strict_types=0);
// Independent installed consumer. Only public package APIs execute Lean.
use Brick\Math\BigInteger;
use LeanCompounds\{Some, Ok, Err, Bytes, Packet, LeanBridgeError};
require 'vendor/autoload.php';
const PARAMETER_PREFIX = 'arg';
$checks = 0;
function check(bool $value, string $message = ''): void {
    global $checks; ++$checks;
    if (!$value) throw new RuntimeException("Compound assertion $checks: $message");
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
        check(LeanCompounds\classify(new Some(new Some(null))) === 2, 'recovery');
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
check(count($request['signatures']) === 64);
foreach ($request['signatures'] as $signature) {
    $name = 'LeanCompounds\\' . substr($signature['name'], strlen('Compounds.'));
    $function = new ReflectionFunction($name);
    check($function->getNumberOfParameters() === count($signature['parameters']));
    check($function->getNumberOfRequiredParameters() === count($signature['parameters']));
    foreach ($function->getParameters() as $i => $parameter)
        check((string) $parameter->getType() === 'mixed' && $parameter->getName() === PARAMETER_PREFIX . $i);
    $actual = reflectedTypes($function->getReturnType()); $expected = publicTypes($signature['result']);
    sort($actual); sort($expected); check($actual === $expected, 'public return ' . $name);
}
$big = fn($value) => BigInteger::of((string) $value);
$huge = $big(str_repeat('9', 1234)); $negative = $huge->negated();
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
    $before = $checks;
    $option = 'LeanCompounds\\option_' . $kind; $result = 'LeanCompounds\\result_' . $kind; $tuple = 'LeanCompounds\\tuple_' . $kind;
    $normalize = $kind === 'float32' ? fn($value) => unpack('g', pack('g', $value))[1] : fn($value) => $value;
    same($option(null), null);
    for ($i = 0; $i < 128; ++$i) {
        $a = $values[$i % count($values)]; $b = $values[($i + 1) % count($values)];
        same($option(new Some($a)), new Some($normalize($a)));
        same($result(new Ok($a)), new Err($normalize($a)));
        same($result(new Err($a)), new Ok($normalize($a)));
        same($tuple([$a, $b]), [$normalize($b), $normalize($a)]);
    }
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
    $option = 'LeanCompounds\\option_' . $kind; $result = 'LeanCompounds\\result_' . $kind; $tuple = 'LeanCompounds\\tuple_' . $kind;
    rejected($error, fn() => $option(new Some($value)));
    rejected($error, fn() => $result(new Ok($value))); rejected($error, fn() => $result(new Err($value)));
    rejected($error, fn() => $tuple([$cases[$kind][0], $value]));
}
$states = [null, new Some(null), new Some(new Some(null))]; $state = null;
for ($i = 0; $i < 30; ++$i) {
    same($state, $states[$i % 3]); check(LeanCompounds\classify($state) === $i % 3);
    $state = LeanCompounds\next($state);
}
same(LeanCompounds\make(), new Some(new Ok([$big('18446744073709551615'), null])));
same(LeanCompounds\flip(new Ok([42, new Some(null)])), new Err([42, new Some(null)]));
same(LeanCompounds\flip(new Ok([0, null])), new Err([0, null]));
same(LeanCompounds\flip(new Err(new Some("a\0λ"))), new Ok(new Some("a\0λ")));
same(LeanCompounds\flip(new Err(null)), new Ok(null));
same(LeanCompounds\duplicate(null), new Err('empty'));
foreach ([null, new Some(new Ok([$huge, null])), new Some(new Err("oops\0"))] as $choice) {
    foreach ([new Ok(null), new Ok(new Some(new Ok([42, null]))), new Ok(new Some(new Err('bad'))), new Err(null), new Err(new Some($huge))] as $inside) {
        $rows = [null, new Some(new Ok(["row\0🌿", $big('18446744073709551615')])), new Some(new Err([Bytes::fromString("\0\xff"), $negative]))];
        $input = new Packet($choice, [[4, "a\0"], [true, '🌿']], $rows, $inside);
        $output = LeanCompounds\transform($input);
        $expected = $choice === null ? null : ($choice->value instanceof Ok ? new Some(new Ok([$huge->plus(1), null])) : new Some(new Err("oops\0!")));
        same($output, new Packet($expected, [[5, "a\0!"], [false, '🌿']], array_reverse($rows), $inside));
        check($output !== $input && $output->rows[0] !== $rows[2], 'independent records and wrappers');
        check($output->rows[0]->value->value[0] !== $rows[2]->value->value[0], 'independent Bytes');
        $products = $output->products; $products[0][1] = 'changed'; check($input->products[0][1] === "a\0");
    }
}
for ($depth = 0; $depth <= 24; ++$depth) {
    $value = $depth === 24 ? new Ok([42, null]) : null;
    for ($i = 0; $i < $depth; ++$i) $value = new Some($value);
    same(LeanCompounds\deep($value), $value);
}
$deep = new Err("deep\0λ"); for ($i = 0; $i < 24; ++$i) $deep = new Some($deep);
same(LeanCompounds\deep($deep), $deep);
$bytes = Bytes::fromString("\0\xff"); $copies = LeanCompounds\duplicate(new Some($bytes))->value->value;
check($copies[0] !== $copies[1] && $copies[0] !== $bytes);
$copies[0] = Bytes::fromString('changed'); same($copies[1], $bytes);
$text = 'borrowed'; $input = [&$text, &$text]; $pair = LeanCompounds\tuple_string($input);
$text = 'changed'; same($pair, ['borrowed', 'borrowed']); $pair[0] = 'output'; check($pair[1] === 'borrowed');
foreach ([Some::class, Ok::class, Err::class] as $class) {
    $reflection = new ReflectionClass($class); check($reflection->isFinal() && $reflection->isReadOnly());
    rejected(ArgumentCountError::class, fn() => new $class()); rejected(ArgumentCountError::class, fn() => new $class(null, 1));
    $object = new $class(null); same($object->value, null);
    rejected(Error::class, function() use ($object) { $object->value = 1; });
    $call = $class === Some::class ? LeanCompounds\option_unit(...) : LeanCompounds\result_unit(...);
    rejected(TypeError::class, fn() => $call($reflection->newInstanceWithoutConstructor()));
}
foreach ([0, false, [], (object) ['value' => 1], new Ok(1)] as $bad)
    rejected(TypeError::class, fn() => LeanCompounds\option_uint32($bad));
foreach ([null, 42, new Some(42), [42], ['ok' => 42]] as $bad)
    rejected(TypeError::class, fn() => LeanCompounds\result_uint32($bad));
foreach ([null, 'ab', new ArrayObject([1, 2]), [], [1], [1, 2, 3], [1 => 1, 2 => 2], ['a' => 1, 'b' => 2]] as $bad)
    rejected(TypeError::class, fn() => LeanCompounds\tuple_uint32($bad));
$cycle = []; $cycle[] = &$cycle; $cycle[] = &$cycle;
rejected(TypeError::class, fn() => LeanCompounds\tuple_uint32($cycle)); unset($cycle); gc_collect_cycles();
$cycle = (new ReflectionClass(Some::class))->newInstanceWithoutConstructor();
(new ReflectionProperty(Some::class, 'value'))->setValue($cycle, $cycle);
rejected(TypeError::class, fn() => LeanCompounds\deep($cycle)); unset($cycle); gc_collect_cycles();
rejected(ValueError::class, fn() => LeanCompounds\option_bytes(new Some(Bytes::fromString(str_repeat('x', 16 * 1024 * 1024)))));
rejected(LeanBridgeError::class, fn() => LeanCompounds\duplicate(new Some(Bytes::fromString(str_repeat('x', 6 * 1024 * 1024)))));
same(LeanCompounds\duplicate(new Some($bytes)), new Ok(new Some([$bytes, $bytes])));
$api = realpath((new ReflectionFunction(LeanCompounds\classify(...)))->getFileName()); $root = dirname($api, 2);
check($root === realpath(__DIR__ . '/vendor/lean-bridge-compounds/api'));
$libraries = [];
foreach (file('/proc/self/maps') as $line) if (preg_match('~\s(/\S+\.so)$~', trim($line), $match) && str_starts_with($match[1], $root . '/'))
    $libraries[substr($match[1], strlen($root) + 1)] = hash_file('sha256', $match[1]);
ksort($libraries); check(count($libraries) >= 3);
echo json_encode(['checks' => $checks, 'primitives' => $primitives, 'php' => PHP_VERSION, 'word_bits' => PHP_INT_SIZE * 8,
    'api' => $api, 'native_libraries' => $libraries], JSON_THROW_ON_ERROR) . "\n";
