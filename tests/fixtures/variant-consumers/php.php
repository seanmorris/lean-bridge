<?php
declare(strict_types=0);
// Independent public consumer of an installed Composer archive.
use Brick\Math\BigInteger;
use LeanVariants\{Some, Ok, Err, Bytes, Packet, Signal, SignalIdle, SignalStopped, SignalData, SignalMarker,
    ModeFirst, ModeSecond, ModeThird, NestedEmpty, NestedPacket, NestedOutcome, ScalarsAbsent, ScalarsAll,
    AnonymousNumber, AnonymousPair, AnonymousCollision, OneOnly, BuffersEmpty, BuffersPair, LeanBridgeError};
require 'vendor/autoload.php';
const PARAMETER_PREFIX = 'arg';
$checks = $calls = $rejected = 0;
function check(bool $value, string $message = ''): void {
    global $checks; ++$checks;
    if (!$value) throw new RuntimeException("Variant assertion $checks: $message");
}
function call(string $name, mixed ...$args): mixed {
    global $calls; ++$calls;
    $function = 'LeanVariants\\' . $name; return $function(...$args);
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
        check(array_keys(get_object_vars($actual)) === array_keys(get_object_vars($expected)), 'payload fields');
        foreach (get_object_vars($expected) as $key => $value) same($actual->$key, $expected instanceof ScalarsAll && $key === 'f32' ? unpack('g', pack('g', $value))[1] : $value);
    } else check($actual === $expected, 'value');
}
function recovered(): void { same(call('next', new SignalIdle()), new SignalStopped()); }
function rejected(string $kind, callable $invoke): Throwable {
    global $rejected;
    try { $invoke(); } catch (Throwable $error) {
        check($error instanceof $kind, get_class($error) . ': ' . $error->getMessage());
        ++$rejected; recovered(); return $error;
    }
    throw new RuntimeException('Expected ' . $kind);
}
function definition(string $id): array {
    global $request;
    foreach ($request['types'] as $type) if ($type['id'] === $id) return $type;
    throw new RuntimeException('Missing independent type ' . $id);
}
function publicTypes(array $ref): array {
    if ($ref['kind'] === 'named') return ['LeanVariants\\' . definition($ref['id'])['name']];
    if ($ref['kind'] === 'apply') return match ($ref['constructor']) {
        'option' => [Some::class, 'null'], 'result' => [Ok::class, Err::class], default => ['array']
    };
    return [match ($ref['name']) {
        'unit' => 'null', 'bool' => 'bool', 'float32', 'float64' => 'float', 'string', 'char' => 'string',
        'nat', 'int', 'uint64', 'usize' => BigInteger::class, 'bytes' => Bytes::class, default => 'int'
    }];
}
function reflectedTypes(ReflectionType $type): array {
    if ($type instanceof ReflectionUnionType) return array_merge(...array_map(reflectedTypes(...), $type->getTypes()));
    return $type->allowsNull() && $type->getName() !== 'null' ? [$type->getName(), 'null'] : [$type->getName()];
}
$request = json_decode(file_get_contents('request.json'), true, 512, JSON_THROW_ON_ERROR);
$api = realpath((new ReflectionFunction(LeanVariants\echo_signal(...)))->getFileName()); $root = dirname($api, 2);
check($root === realpath(__DIR__ . '/vendor/lean-bridge-variants/api'));
foreach ($request['signatures'] as $signature) {
    $name = substr($signature['name'], strlen('Variants.'));
    $function = new ReflectionFunction('LeanVariants\\' . $name);
    check($function->getNumberOfParameters() === count($signature['parameters']));
    check($function->getNumberOfRequiredParameters() === count($signature['parameters']));
    foreach ($function->getParameters() as $i => $parameter) check((string) $parameter->getType() === 'mixed' && $parameter->getName() === PARAMETER_PREFIX . $i);
    $actual = reflectedTypes($function->getReturnType()); $expected = publicTypes($signature['result']);
    sort($actual); sort($expected); check($actual === $expected, 'public return ' . $name);
}
$catalog = [
    'Signal' => ['idle' => SignalIdle::class, 'stopped' => SignalStopped::class, 'data' => SignalData::class, 'marker' => SignalMarker::class],
    'Mode' => ['first' => ModeFirst::class, 'second' => ModeSecond::class, 'third' => ModeThird::class],
    'Nested' => ['empty' => NestedEmpty::class, 'packet' => NestedPacket::class, 'outcome' => NestedOutcome::class],
    'Scalars' => ['absent' => ScalarsAbsent::class, 'all' => ScalarsAll::class],
    'Anonymous' => ['number' => AnonymousNumber::class, 'pair' => AnonymousPair::class, 'collision' => AnonymousCollision::class],
    'One' => ['only' => OneOnly::class], 'Buffers' => ['empty' => BuffersEmpty::class, 'pair' => BuffersPair::class]
];
foreach ($request['types'] as $type) if ($type['kind'] === 'variant') {
    $family = new ReflectionClass('LeanVariants\\' . $type['name']); check($family->isAbstract() && $family->isReadOnly());
    foreach ($type['cases'] as $case) {
        $class = new ReflectionClass($catalog[$type['name']][$case['name']]); check($class->isFinal() && $class->isReadOnly());
        check($class->getParentClass()->getName() === $family->getName());
        check($class->getConstructor()->getNumberOfRequiredParameters() === count($case['fields']));
        check($class->getConstructor()->getNumberOfParameters() === count($case['fields']));
        foreach ($case['fields'] as $index => $field) {
            $parameter = $class->getConstructor()->getParameters()[$index]; check($parameter->getName() === $field['name'] && (string) $parameter->getType() === 'mixed');
            $actual = reflectedTypes($class->getProperty($field['name'])->getType()); $expected = publicTypes($field['type']);
            sort($actual); sort($expected); check($actual === $expected, 'typed payload ' . $field['name']);
        }
    }
}
$big = fn($value) => BigInteger::of((string) $value);
$values = ['unit' => null, 'bool' => true, 'u8' => 255, 'u16' => 65535, 'u32' => 4294967295, 'u64' => $big('18446744073709551615'),
    'i8' => -128, 'i16' => -32768, 'i32' => -2147483648, 'i64' => PHP_INT_MIN,
    'natural' => $big(2)->power(5120)->plus(19), 'integer' => $big(2)->power(5120)->plus(31)->negated(),
    'f32' => 1.5, 'f64' => -2.25, 'text' => "A\0🌱", 'bytes' => Bytes::fromString("\0\xff\1"), 'char' => '🌱', 'word' => $big('4294967295'), 'signedWord' => -2147483648];
$scalar = new ScalarsAll(...$values); check(call('inspect', $scalar), 'independent Lean scalar inspector');
foreach ($values as $field => $value) if ($field !== 'unit') {
    $changed = $values;
    $changed[$field] = match (true) { $value instanceof BigInteger => $big(0), $value instanceof Bytes => Bytes::fromString(''),
        is_bool($value) => false, is_float($value) => 0.0, is_string($value) => 'X', default => 0 };
    check(!call('inspect', new ScalarsAll(...$changed)), 'changed field ' . $field);
}
$signals = [new SignalIdle(), new SignalStopped(), new SignalData(count: 42, label: "A\0🌱"), new SignalMarker(value: null)];
for ($round = 0; $round < 128; ++$round) {
    foreach ($signals as $value) { $out = call('echo_signal', $value); same($out, $value); check($out !== $value); }
    same(call('next', $signals[0]), new SignalStopped()); same(call('next', $signals[1]), new SignalMarker(null));
    same(call('next', $signals[2]), new SignalData(43, "A\0🌱!")); same(call('next', $signals[3]), new SignalData(42, 'ready'));
    foreach ([7, 13, 48, 29] as $index => $code) same(call('code', $signals[$index]), $code);
    foreach ([$round % 3, 3, 7] as $code) same(call('make', $code), $code === 0 ? new SignalIdle() : new SignalData($code, 'made'));
    foreach ([new ModeFirst(), new ModeSecond(), new ModeThird()] as $value) same(call('echo_mode', $value), $value);
    $events = $signals; $packet = new Packet($signals[2], $events, new Some($signals[3]), [new ModeFirst(), new ModeThird()]);
    $input = new NestedPacket($packet); $out = call('echo_nested', $input); same($out, $input);
    check($out !== $input && $out->value !== $packet && $out->value->current !== $packet->current);
    $events[0] = new SignalStopped(); same($out->value->events, $signals);
    $copy = $out->value->events; $copy[0] = new SignalStopped(); same($out->value->events, $signals);
    foreach ([new NestedEmpty(), new NestedPacket(new Packet(new SignalIdle(), [], null, [])),
        new NestedOutcome(new Ok([new SignalMarker(null), new ModeSecond()])), new NestedOutcome(new Err("A\0🌱"))] as $value) same(call('echo_nested', $value), $value);
    same(call('signals', [[], $signals, [$signals[2], $signals[2]]]), [[], array_reverse($signals), [$signals[2], $signals[2]]]);
    same(call('echo_scalars', $scalar), $scalar); same(call('echo_scalars', new ScalarsAbsent()), new ScalarsAbsent());
    foreach ([new AnonymousNumber(arg0: 13), new AnonymousPair(arg0: 17, arg1: "A\0🌱"), new AnonymousCollision(arg1: 19, arg1_: "A\0🌱")] as $value) same(call('echo_anonymous', $value), $value);
    same(call('echo_one', new OneOnly($round)), new OneOnly($round + 1));
    foreach ([new BuffersEmpty(), new BuffersPair(Bytes::fromString(''), Bytes::fromString('')), new BuffersPair(Bytes::fromString("\0\xff"), Bytes::fromString('abc'))] as $value) same(call('echo_buffers', $value), $value);
    $bytes = Bytes::fromString("\0\xff\1"); $out = call('duplicate', $bytes); same($out, new BuffersPair($bytes, $bytes));
    check($out->first !== $bytes && $out->first !== $out->second);
}
$primitives = ['unit','bool','uint8','uint16','uint32','uint64','int8','int16','int32','int64','nat','int','float32','float64','string','bytes','char','usize','isize'];
foreach (['0000000000000000', '8000000000000000', '0000000000000001', '000fffffffffffff', '0010000000000000', '3ff0000000000000', '7fefffffffffffff', '7ff0000000000000', 'fff0000000000000', '7ff8000000000000'] as $hex) {
    $special = unpack('E', hex2bin($hex))[1]; $input = new ScalarsAll(...array_replace($values, ['f32' => $special, 'f64' => $special, 'word' => $big('18446744073709551615'), 'signedWord' => PHP_INT_MIN]));
    same(call('echo_scalars', $input), $input);
}
foreach (["\0", 'A', "\u{d7ff}", "\u{e000}", "\u{10ffff}"] as $char) {
    $input = new ScalarsAll(...array_replace($values, ['char' => $char])); same(call('echo_scalars', $input), $input);
}
foreach ([['unit', 1, TypeError::class], ['bool', 1, TypeError::class], ['u8', -1, ValueError::class], ['u8', 256, ValueError::class],
    ['u16', 65536, ValueError::class], ['u32', 4294967296, ValueError::class], ['u32', true, TypeError::class],
    ['u64', $big(-1), ValueError::class], ['u64', $big('18446744073709551616'), ValueError::class],
    ['i8', -129, ValueError::class], ['i16', 32768, ValueError::class], ['i32', -2147483649, ValueError::class],
    ['i64', '1', TypeError::class], ['signedWord', true, TypeError::class], ['word', 1, TypeError::class],
    ['natural', $big(-1), ValueError::class], ['integer', 1, TypeError::class], ['natural', $big(str_repeat('9', 16385)), ValueError::class],
    ['f32', 1, TypeError::class], ['f64', '1', TypeError::class], ['text', "\xed\xa0\x80", ValueError::class], ['text', 1, TypeError::class],
    ['bytes', '', TypeError::class], ['char', 'ab', ValueError::class], ['char', '', ValueError::class], ['char', "\xf4\x90\x80\x80", ValueError::class]] as [$field, $value, $error])
    rejected($error, fn() => new ScalarsAll(...array_replace($values, [$field => $value])));
readonly class ForeignSignal extends Signal {}
foreach ([null, false, [], ['kind' => 'idle'], (object) [], new ForeignSignal(), new ModeFirst(), (new ReflectionClass(SignalData::class))->newInstanceWithoutConstructor()] as $bad)
    rejected(TypeError::class, fn() => call('echo_signal', $bad));
foreach (['count' => -1, 'label' => "\xff"] as $field => $bad) {
    $object = (new ReflectionClass(SignalData::class))->newInstanceWithoutConstructor();
    foreach (array_replace(['count' => 42, 'label' => 'ok'], [$field => $bad]) as $name => $value) (new ReflectionProperty(SignalData::class, $name))->setValue($object, $value);
    rejected(ValueError::class, fn() => call('echo_signal', $object));
}
rejected(Error::class, fn() => new Signal()); rejected(ArgumentCountError::class, fn() => new SignalData(1));
rejected(ArgumentCountError::class, fn() => new SignalIdle(1)); rejected(Error::class, fn() => new SignalData(count: 1, label: 'ok', extra: 2));
rejected(TypeError::class, fn() => new SignalMarker(1)); rejected(TypeError::class, fn() => new SignalData('42', 'ok'));
rejected(Error::class, function() use ($signals) { $signals[2]->count = 7; });
foreach ([[1 => []], ['x' => []], [0 => [], 2 => []], [[new SignalIdle(), null]]] as $bad) rejected(TypeError::class, fn() => call('signals', $bad));
$cycle = []; $cycle[] = &$cycle; rejected(TypeError::class, fn() => call('signals', $cycle)); unset($cycle); gc_collect_cycles();
rejected(TypeError::class, fn() => new NestedOutcome(new Err(false)));
rejected(TypeError::class, fn() => new NestedOutcome(new Ok([new SignalIdle()])));
rejected(ValueError::class, fn() => new SignalData(1, str_repeat('x', 16 * 1024 * 1024)));
rejected(ValueError::class, fn() => call('signals', [array_fill(0, 400000, new SignalIdle())]));
rejected(LeanBridgeError::class, fn() => call('duplicate', Bytes::fromString(str_repeat('x', 6 * 1024 * 1024))));
rejected(LeanBridgeError::class, fn() => call('produce', $big(16 * 1024 * 1024)));
same(call('produce', $big(0)), new BuffersPair(Bytes::fromString(''), Bytes::fromString("\1")));
same(call('produce', $big(30000)), new BuffersPair(Bytes::fromString(str_repeat("\x11", 30000)), Bytes::fromString("\1")));
$libraries = [];
foreach (file('/proc/self/maps') as $line) if (preg_match('~\s(/\S+\.so)$~', trim($line), $match) && str_starts_with($match[1], $root . '/'))
    $libraries[substr($match[1], strlen($root) + 1)] = hash_file('sha256', $match[1]);
ksort($libraries); check(count($libraries) === 4);
echo json_encode(['checks' => $checks, 'calls' => $calls, 'rejected' => $rejected, 'primitives' => $primitives,
    'families' => count($catalog), 'constructors' => array_sum(array_map(count(...), $catalog)), 'php' => PHP_VERSION,
    'word_bits' => PHP_INT_SIZE * 8, 'api' => $api, 'native_libraries' => $libraries], JSON_THROW_ON_ERROR) . "\n";
