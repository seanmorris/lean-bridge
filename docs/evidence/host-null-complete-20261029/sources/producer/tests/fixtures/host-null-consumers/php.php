<?php
declare(strict_types=0);
// Independent installed consumer. Only public generated functions invoke Lean.
use Brick\Math\BigInteger;
use LeanHostNullDemo\{None, Some, Packet, LeanClosure};
// LEAN_BRIDGE_AUTOLOAD
const PARAMETER_PREFIX = 'arg';
const SOURCE_PATH = 'ordinary-source';
const CALLER_MODE = 'weak';
const HOST_PROFILE = 'php-native';
$checks = 0; $rejections = 0;
function check(bool $value, string $message = ''): void {
    global $checks; ++$checks;
    if (!$value) throw new RuntimeException('HostNull check ' . $checks . ': ' . $message);
}
function same(mixed $actual, mixed $expected): void {
    check(get_debug_type($actual) === get_debug_type($expected), 'host type');
    if ($expected instanceof BigInteger) check($actual->isEqualTo($expected), 'exact integer');
    elseif (is_object($expected)) {
        $actual = get_object_vars($actual); $expected = get_object_vars($expected);
        check(array_keys($actual) === array_keys($expected), 'object fields');
        foreach ($expected as $key => $value) same($actual[$key], $value);
    } elseif (is_array($expected)) {
        check(array_keys($actual) === array_keys($expected), 'array keys');
        foreach ($expected as $key => $value) same($actual[$key], $value);
    } else check($actual === $expected, 'value');
}
function rejected(string $kind, callable $call): Throwable {
    global $rejections;
    try { $call(); } catch (Throwable $error) {
        check($error instanceof $kind, get_class($error) . ': ' . $error->getMessage());
        same(LeanHostNullDemo\echo_(null), null);
        ++$rejections; return $error;
    }
    throw new RuntimeException('Expected ' . $kind);
}
function uint32(string $value): mixed { return LEAN_BRIDGE_UINT32_FACTORY; }
function increment(mixed $value): mixed { return LEAN_BRIDGE_UINT32_INCREMENT; }
function reflectedTypes(ReflectionType $type): array {
    if ($type instanceof ReflectionUnionType) return array_merge(...array_map(reflectedTypes(...), $type->getTypes()));
    return $type->allowsNull() && $type->getName() !== 'null' ? [$type->getName(), 'null'] : [$type->getName()];
}
function assertTypes(ReflectionType $type, array $expected, string $site): void {
    $actual = reflectedTypes($type); sort($actual); sort($expected);
    check($actual === $expected, $site . ': ' . json_encode($actual));
}

$request = json_decode(file_get_contents('request.json'), true, 512, JSON_THROW_ON_ERROR);
check($request['schemaVersion'] === 1 && $request['profile'] === HOST_PROFILE);
check($request['path'] === SOURCE_PATH && $request['namespace'] === 'LeanHostNullDemo');
check(PHP_INT_SIZE * 8 === LEAN_BRIDGE_WORD_BITS);
$uint32Type = HOST_PROFILE === 'php-wasm' ? BigInteger::class : 'int';
$functions = [
    'echo_' => [$uint32Type, 'null'],
    'nullable_option' => [None::class, Some::class, 'null'],
    'optional_nullable' => [None::class, Some::class],
    'echo_packet' => [Packet::class],
    'call_host' => [None::class, Some::class, 'null'],
    'make_closure' => [LeanClosure::class]
];
foreach ($functions as $name => $resultTypes) {
    $reflection = new ReflectionFunction('LeanHostNullDemo\\' . $name);
    foreach ($reflection->getParameters() as $index => $parameter) {
        check((string) $parameter->getType() === 'mixed', $name . ' parameter type');
        check($parameter->getName() === PARAMETER_PREFIX . $index, $name . ' parameter name');
    }
    assertTypes($reflection->getReturnType(), $resultTypes, $name . ' result');
}
$packet = new ReflectionClass(Packet::class);
assertTypes($packet->getProperty('direct')->getType(), [$uint32Type, 'null'], 'packet direct');
assertTypes($packet->getProperty('nullableOption')->getType(), [None::class, Some::class, 'null'], 'packet nullable option');
assertTypes($packet->getProperty('optionalNullable')->getType(), [None::class, Some::class], 'packet optional nullable');

$zero = uint32('0'); $fortyTwo = uint32('42'); $fortyThree = uint32('43');
same(LeanHostNullDemo\echo_(null), null);
same(LeanHostNullDemo\echo_($fortyTwo), $fortyTwo);
same(LeanHostNullDemo\nullable_option(null), null);
same(LeanHostNullDemo\nullable_option(new None()), new None());
same(LeanHostNullDemo\nullable_option(new Some($fortyTwo)), new Some($fortyTwo));
same(LeanHostNullDemo\optional_nullable(new None()), new None());
same(LeanHostNullDemo\optional_nullable(new Some(null)), new Some(null));
same(LeanHostNullDemo\optional_nullable(new Some($fortyTwo)), new Some($fortyTwo));
$outerNull = LeanHostNullDemo\nullable_option(null);
$valueNone = LeanHostNullDemo\nullable_option(new None());
$optionNone = LeanHostNullDemo\optional_nullable(new None());
$optionSomeNull = LeanHostNullDemo\optional_nullable(new Some(null));
check($outerNull === null && $valueNone instanceof None, 'HostNull null versus value Option.none');
check($optionNone instanceof None && $optionSomeNull instanceof Some && $optionSomeNull->value === null, 'Option none versus some HostNull.null');

$packets = [
    new Packet(null, null, new None()),
    new Packet($fortyTwo, new None(), new Some(null)),
    new Packet($zero, new Some($fortyThree), new Some($fortyTwo))
];
foreach ($packets as $input) {
    $output = LeanHostNullDemo\echo_packet($input);
    same($output, $input); check($output !== $input, 'record result is independently copied');
}

$seen = 0;
same(LeanHostNullDemo\call_host(null, function ($value) use (&$seen) {
    ++$seen; same($value, null); return new None();
}), new None());
same(LeanHostNullDemo\call_host($fortyTwo, function ($value) use (&$seen) {
    ++$seen; same($value, uint32('42')); return new Some(increment($value));
}), new Some($fortyThree));
same(LeanHostNullDemo\call_host($zero, function ($value) use (&$seen) {
    ++$seen; same($value, uint32('0')); return null;
}), null);
check($seen === 3, 'callback parameter count');
$marker = new RuntimeException('host callback marker');
check(rejected(RuntimeException::class, fn() => LeanHostNullDemo\call_host(null, fn($value) => throw $marker)) === $marker, 'callback exception identity');

foreach ([null, new None(), new Some($fortyTwo)] as $captured) {
    $closure = LeanHostNullDemo\make_closure($captured); $alias = $closure(...);
    try {
        check($closure instanceof LeanClosure && !$closure->isClosed(), 'open Lean closure');
        same($closure(null), $captured); same($alias($fortyThree), $captured);
        $closure->close(); $closure->close(); check($closure->isClosed(), 'closed Lean closure');
        rejected(LogicException::class, fn() => $alias(null));
    } finally { $closure->close(); }
}

foreach ([false, '', [], new None(), new Some($fortyTwo)] as $bad)
    rejected(TypeError::class, fn() => LeanHostNullDemo\echo_($bad));
foreach ([false, $fortyTwo, new Some(null), new Some(false)] as $bad)
    rejected(TypeError::class, fn() => LeanHostNullDemo\nullable_option($bad));
foreach ([null, false, $fortyTwo, new Some(false)] as $bad)
    rejected(TypeError::class, fn() => LeanHostNullDemo\optional_nullable($bad));
rejected(TypeError::class, fn() => new Packet(false, new None(), new None()));
rejected(TypeError::class, fn() => new Packet(null, new Some(null), new None()));
rejected(TypeError::class, fn() => new Packet(null, new None(), null));
rejected(TypeError::class, fn() => LeanHostNullDemo\call_host(null, null));
rejected(TypeError::class, fn() => LeanHostNullDemo\call_host(null, function ($value) { yield $value; }));
rejected(TypeError::class, fn() => LeanHostNullDemo\call_host(null, fn($value) => false));
rejected(TypeError::class, fn() => LeanHostNullDemo\call_host(null, fn($value) => new Some(null)));
$closure = LeanHostNullDemo\make_closure(new Some($fortyTwo));
try { rejected(TypeError::class, fn() => $closure(false)); }
finally { $closure->close(); }
rejected(TypeError::class, fn() => LeanHostNullDemo\make_closure(new Some(null)));

foreach ([None::class, Some::class, Packet::class] as $class) {
    $reflection = new ReflectionClass($class);
    check($reflection->isFinal() && $reflection->isReadOnly(), $class . ' value class');
}
rejected(ArgumentCountError::class, fn() => new None(1));
rejected(ArgumentCountError::class, fn() => new Some());
rejected(ArgumentCountError::class, fn() => new Packet(null, new None()));
$some = new Some(null); rejected(Error::class, function () use ($some, $fortyTwo) { $some->value = $fortyTwo; });

$api = (new ReflectionFunction(LeanHostNullDemo\echo_(...)))->getFileName();
$libraries = [];
if (HOST_PROFILE === 'php-native') {
    $root = dirname($api, 2);
    foreach (file('/proc/self/maps') as $line)
        if (preg_match('~\s(/\S+\.so)$~', trim($line), $match) && str_starts_with($match[1], $root . '/'))
            $libraries[$match[1]] = hash_file('sha256', $match[1]);
    ksort($libraries); check(count($libraries) === 4, 'native library count');
}
echo json_encode([
    'checks' => $checks, 'rejections' => $rejections,
    'positions' => ['parameter', 'result', 'field', 'callback-parameter', 'callback-result'],
    'nestedOptionDistinct' => true, 'profile' => HOST_PROFILE, 'path' => SOURCE_PATH,
    'callerMode' => CALLER_MODE, 'hostVersion' => PHP_VERSION,
    'wordBits' => PHP_INT_SIZE * 8, 'api' => $api, 'libraries' => $libraries
], JSON_THROW_ON_ERROR) . "\n";
