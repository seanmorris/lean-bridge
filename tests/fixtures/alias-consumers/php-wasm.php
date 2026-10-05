<?php
declare(strict_types=0);
// Independent installed wasm32 consumer. Calls use only the public package API.
use Brick\Math\BigInteger;
use LeanAliases\{Some, Ok, Err, Bytes, Packet, Scalars, LeanBridgeError};
const PARAMETER_PREFIX = 'arg';
$checks = 0;
function check(bool $value, string $message = ''): void {
    global $checks; ++$checks;
    if (!$value) throw new RuntimeException("Alias assertion $checks: $message");
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
        check(LeanAliases\increment(BigInteger::of(41))->isEqualTo(42), 'recovery');
        return $error;
    }
    throw new RuntimeException('Expected ' . $kind);
}
function definition(string $id): array {
    global $request;
    foreach ($request['types'] as $type) if ($type['id'] === $id) return $type;
    throw new RuntimeException('Missing independent type ' . $id);
}
function contractName(array $ref): string {
    return match ($ref['kind']) {
        'primitive' => $ref['name'], 'named' => definition($ref['id'])['name'],
        default => $ref['constructor'] . '<' . implode(', ', array_map(contractName(...), $ref['arguments'])) . '>'
    };
}
function publicTypes(array $ref): array {
    if ($ref['kind'] === 'named') {
        $type = definition($ref['id']);
        return $type['kind'] === 'alias' ? publicTypes($type['target']) : ['LeanAliases\\' . $type['name']];
    }
    if ($ref['kind'] === 'apply') return match ($ref['constructor']) {
        'option' => [Some::class, 'null'], 'result' => [Ok::class, Err::class], default => ['array']
    };
    return [match ($ref['name']) {
        'unit' => 'null', 'bool' => 'bool', 'float32', 'float64' => 'float', 'string', 'char' => 'string',
        'nat', 'int', 'uint32', 'uint64', 'int64', 'usize' => BigInteger::class, 'bytes' => Bytes::class, default => 'int'
    }];
}
function reflectedTypes(ReflectionType $type): array {
    if ($type instanceof ReflectionUnionType) return array_merge(...array_map(reflectedTypes(...), $type->getTypes()));
    return $type->allowsNull() && $type->getName() !== 'null' ? [$type->getName(), 'null'] : [$type->getName()];
}
$request = json_decode(file_get_contents('request.json'), true, 512, JSON_THROW_ON_ERROR);
$api = realpath((new ReflectionFunction(LeanAliases\increment(...)))->getFileName()); $root = dirname($api, 2);
check(PHP_INT_SIZE === 4 && !PHP_ZTS);
check($root === '/vendor/lean-bridge-aliases/wasm');
$manifest = json_decode(file_get_contents($root . '/lean-bridge/aliases.json'), true, 512, JSON_THROW_ON_ERROR);
$actualAliases = $manifest['aliases']; $expectedAliases = $request['aliases'];
usort($actualAliases, fn($a, $b) => strcmp($a['id'], $b['id']));
usort($expectedAliases, fn($a, $b) => strcmp($a['id'], $b['id']));
check($actualAliases == $expectedAliases, 'independent alias catalog');
foreach ($request['aliases'] as $alias) check(!class_exists('LeanAliases\\' . $alias['name'], false), 'no alias wrapper');
foreach ($request['signatures'] as $signature) {
    $name = substr($signature['name'], strlen('Aliases.'));
    $function = new ReflectionFunction('LeanAliases\\' . $name);
    check($function->getNumberOfParameters() === count($signature['parameters']));
    check($function->getNumberOfRequiredParameters() === count($signature['parameters']));
    foreach ($function->getParameters() as $i => $parameter) {
        check((string) $parameter->getType() === 'mixed' && $parameter->getName() === PARAMETER_PREFIX . $i);
        check(str_contains($function->getDocComment(), '@lean-bridge-param ' . contractName($signature['parameters'][$i]) . ' $' . $parameter->getName()));
    }
    $actual = reflectedTypes($function->getReturnType()); $expected = publicTypes($signature['result']);
    sort($actual); sort($expected); check($actual === $expected, 'public return ' . $name);
    check(str_contains($function->getDocComment(), '@lean-bridge-return ' . contractName($signature['result'])));
}
foreach ($request['types'] as $type) if ($type['kind'] === 'record') {
    $class = new ReflectionClass('LeanAliases\\' . $type['name']); check($class->isFinal() && $class->isReadOnly());
    foreach ($type['fields'] as $field) {
        $property = $class->getProperty($field['name']);
        check(str_contains($property->getDocComment(), '@lean-bridge-contract ' . contractName($field['type'])));
        $actual = reflectedTypes($property->getType()); $expected = publicTypes($field['type']);
        sort($actual); sort($expected); check($actual === $expected, 'record field type');
    }
}
$big = fn($value) => BigInteger::of((string) $value);
$huge = $big(2)->power(5120)->plus(19); $negative = $big(2)->power(5120)->plus(31)->negated();
$floats32 = array_map(fn($hex) => unpack('G', hex2bin($hex))[1], ['00000000', '80000000', '00000001', '007fffff', '00800000', '3f800000', '7f7fffff', '7f800000', 'ff800000', '7fc00000']);
$floats64 = array_map(fn($hex) => unpack('E', hex2bin($hex))[1], ['0000000000000000', '8000000000000000', '0000000000000001', '000fffffffffffff', '0010000000000000', '3ff0000000000000', '7fefffffffffffff', '7ff0000000000000', 'fff0000000000000', '7ff8000000000000']);
$cases = [
    'unit' => [null], 'bool' => [false, true], 'uint8' => [0, 1, 255], 'uint16' => [0, 1, 65535],
    'uint32' => array_map($big, ['0', '1', '2147483648', '4294967295']),
    'uint64' => array_map($big, ['0', '1', '4294967296', '9007199254740993', '18446744073709551615']),
    'int8' => [-128, -1, 0, 127], 'int16' => [-32768, -1, 0, 32767],
    'int32' => [PHP_INT_MIN, -1, 0, PHP_INT_MAX],
    'int64' => array_map($big, ['-9223372036854775808', '-9007199254740993', '-1', '0', '9223372036854775807']),
    'nat' => [$big(0), $big(1), $huge], 'int' => [$negative, $big(0), $huge],
    'float32' => [...$floats32, 1.0000000596046448, 1e300], 'float64' => $floats64,
    'string' => ['', "\0", "A\0🌱", "e\u{0301}", "\u{10ffff}"],
    'bytes' => [Bytes::fromString(''), Bytes::fromString("\0\xff"), Bytes::fromString(implode('', array_map(chr(...), range(0, 255))))],
    'char' => ["\0", 'A', "\u{0301}", "\u{d7ff}", "\u{e000}", "\u{ffff}", '🌱', "\u{10ffff}"]
];
$cases['usize'] = $cases['uint32']; $cases['isize'] = $cases['int32'];
$primitives = [];
foreach ($cases as $kind => $values) {
    $before = $checks; $echo = 'LeanAliases\\echo_' . $kind;
    for ($i = 0; $i < 128; ++$i) {
        $input = $values[$i % count($values)];
        same($echo($input), $kind === 'float32' ? unpack('g', pack('g', $input))[1] : $input);
    }
    $primitives[] = ['name' => $kind, 'checks' => $checks - $before];
}
$values = [null, true, 255, 65535, $big('4294967295'), $big('18446744073709551615'), -128, -32768, PHP_INT_MIN,
    $big('-9223372036854775808'), $huge, $negative, 1.5, -2.25, "A\0🌱", Bytes::fromString("\0\xff\1"), '🌱', $big('4294967295'), PHP_INT_MIN];
$input = new Scalars(...$values); check(LeanAliases\inspect($input), 'Lean independently checks all nineteen fields');
same(LeanAliases\echo_scalars($input), $input);
for ($i = 1; $i < count($values); ++$i) {
    $changed = $values;
    $changed[$i] = match (true) {
        $values[$i] instanceof BigInteger => $big(0), $values[$i] instanceof Bytes => Bytes::fromString(''),
        is_bool($values[$i]) => false, is_float($values[$i]) => 0.0, is_string($values[$i]) => 'X', default => 0
    };
    check(!LeanAliases\inspect(new Scalars(...$changed)), 'Lean rejects changed field ' . $i);
}
same(LeanAliases\make(), $big(41)); same(LeanAliases\increment(LeanAliases\make()), $big(42));
same(LeanAliases\increment($big('4294967295')), $big(0)); same(LeanAliases\label(), 'alias🌱');
foreach ([null, new Some(null), new Some(new Some(null))] as $maybe) same(LeanAliases\echo_maybe($maybe), $maybe);
foreach ([new Ok([$big(7), Bytes::fromString("\0\xff")]), new Err("bad\0🌱")] as $outcome) same(LeanAliases\echo_outcome($outcome), $outcome);
for ($i = 0; $i < 32; ++$i) {
    $packet = new Packet($big($i), "text\0🌱", [array_map($big, [1, 2, 3]), [], [$big($i)]], new Some(new Some(null)), new Ok([$big(7), Bytes::fromString("\0\xff")]));
    $out = LeanAliases\change_packet($packet);
    same($out, new Packet($big($i + 1), $packet->text, $packet->rows, $packet->maybe, $packet->outcome));
    check($out !== $packet && $out->maybe !== $packet->maybe && $out->outcome !== $packet->outcome);
    check($out->outcome->value[1] !== $packet->outcome->value[1], 'independent byte storage');
    same(LeanAliases\reverse_packets([$packet, $out, $packet]), [$packet, $out, $packet]);
    same(LeanAliases\reverse_packets([$packet, $out]), [$out, $packet]);
    $weak = WeakReference::create($packet); unset($packet); gc_collect_cycles(); check($weak->get() === null);
}
same(LeanAliases\reverse_packets([]), []); same(LeanAliases\reverse_rows([]), []);
same(LeanAliases\reverse_rows([array_map($big, [1, 2, 3]), [], [$big(4)]]), [array_map($big, [3, 2, 1]), [], [$big(4)]]);
$row = array_map($big, [1, 2]); $rows = [&$row, &$row]; $out = LeanAliases\reverse_rows($rows);
$row[0] = $big(99); same($out, [array_map($big, [2, 1]), array_map($big, [2, 1])]); $out[0][0] = $big(7); same($out[1], array_map($big, [2, 1]));
same(LeanAliases\duplicate(Bytes::fromString("\0\xff")), new Ok([$big(7), Bytes::fromString("\0\xff\0\xff")]));

$invalid = [
    ['unit', false, TypeError::class], ['bool', 1, TypeError::class], ['uint8', -1, ValueError::class], ['uint8', 256, ValueError::class],
    ['uint16', 65536, ValueError::class], ['uint32', $big('4294967296'), ValueError::class], ['uint32', $big(-1), ValueError::class], ['uint32', 1, TypeError::class], ['uint32', true, TypeError::class],
    ['uint64', $big(-1), ValueError::class], ['uint64', $big('18446744073709551616'), ValueError::class],
    ['int8', -129, ValueError::class], ['int16', 32768, ValueError::class], ['int32', -2147483649.0, TypeError::class],
    ['int64', '1', TypeError::class], ['int64', $big('9223372036854775808'), ValueError::class], ['int64', $big('-9223372036854775809'), ValueError::class], ['int64', 1e30, TypeError::class], ['isize', true, TypeError::class], ['isize', 2147483648.0, TypeError::class], ['usize', $big('4294967296'), ValueError::class], ['usize', 1, TypeError::class],
    ['nat', $big(-1), ValueError::class], ['int', 1, TypeError::class], ['nat', $big(str_repeat('9', 16385)), ValueError::class],
    ['float32', 1, TypeError::class], ['float64', '1', TypeError::class],
    ['string', "\xed\xa0\x80", ValueError::class], ['string', "\xc0\x80", ValueError::class], ['string', 1, TypeError::class],
    ['bytes', '', TypeError::class], ['char', 'ab', ValueError::class], ['char', '', ValueError::class], ['char', "\xf4\x90\x80\x80", ValueError::class]
];
foreach ($invalid as [$kind, $value, $error]) { $echo = 'LeanAliases\\echo_' . $kind; rejected($error, fn() => $echo($value)); }
foreach ([null, false, 42, '1', (object) [], new ArrayObject([1, 2]), [1 => []], ['x' => []], [0 => [], 2 => []], [[$big(1)], ['2']]] as $bad)
    rejected(TypeError::class, fn() => LeanAliases\reverse_rows($bad));
$cycle = []; $cycle[] = &$cycle;
rejected(TypeError::class, fn() => LeanAliases\reverse_rows($cycle)); unset($cycle); gc_collect_cycles();
foreach ([Some::class, Ok::class, Err::class] as $class) {
    $reflection = new ReflectionClass($class); check($reflection->isFinal() && $reflection->isReadOnly());
    rejected(ArgumentCountError::class, fn() => new $class()); rejected(ArgumentCountError::class, fn() => new $class(null, 1));
    $object = new $class(null); rejected(Error::class, function() use ($object) { $object->value = 1; });
}
rejected(TypeError::class, fn() => LeanAliases\echo_maybe(new Some(false)));
rejected(TypeError::class, fn() => LeanAliases\echo_maybe(new Some(new Some(1))));
rejected(TypeError::class, fn() => LeanAliases\echo_maybe((new ReflectionClass(Some::class))->newInstanceWithoutConstructor()));
rejected(TypeError::class, fn() => LeanAliases\echo_outcome(new Err(false)));
foreach ([[], [7], [7, Bytes::fromString(''), 1], ['a' => 7, 'b' => Bytes::fromString('')]] as $bad)
    rejected(TypeError::class, fn() => LeanAliases\echo_outcome(new Ok($bad)));
$coercion = new class implements Stringable { public function __toString(): string { throw new RuntimeException('coercion called'); } };
rejected(TypeError::class, fn() => LeanAliases\echo_string($coercion));
rejected(TypeError::class, fn() => LeanAliases\echo_float64($coercion));
rejected(ValueError::class, fn() => LeanAliases\echo_bytes(Bytes::fromString(str_repeat('x', 16 * 1024 * 1024))));
rejected(ValueError::class, fn() => LeanAliases\reverse_rows([array_fill(0, 400000, $big(0))]));
rejected(LeanBridgeError::class, fn() => LeanAliases\duplicate(Bytes::fromString(str_repeat('x', 6 * 1024 * 1024))));
rejected(LeanBridgeError::class, fn() => LeanAliases\produce($big(16 * 1024 * 1024)));
same(LeanAliases\produce($big(0)), Bytes::fromString('')); same(LeanAliases\produce($big(30000)), Bytes::fromString(str_repeat("\7", 30000)));
echo json_encode(['checks' => $checks, 'primitives' => $primitives, 'php' => PHP_VERSION, 'word_bits' => PHP_INT_SIZE * 8,
    'aliases' => count($manifest['aliases']), 'api' => $api], JSON_THROW_ON_ERROR) . "\n";
