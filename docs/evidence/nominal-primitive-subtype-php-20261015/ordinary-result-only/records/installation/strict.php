<?php
declare(strict_types=1);

use Brick\Math\BigInteger;
use LeanNominalprimitivesubtypes\{Bytes, Some, Ok, Err, Packet, RawPacket, Pair, EventEmpty, EventBox, EventChoices, LeanBridgeError};

const NOMINAL_PRIMITIVE_RESULT_ONLY = true;

/** Preserve exact public values, including BigInteger, bytes, class identity and float bits. */
function nominal_primitive_snapshot(mixed $value): array {
    if ($value instanceof BigInteger) return ['bigint', (string) $value];
    if ($value instanceof Bytes) return ['bytes', bin2hex($value->toString())];
    if (is_array($value)) {
        $items = [];
        foreach ($value as $key => $item) $items[] = [gettype($key), $key, nominal_primitive_snapshot($item)];
        return ['array', $items];
    }
    if (is_object($value)) {
        $items = [];
        foreach (get_object_vars($value) as $key => $item) $items[] = [$key, nominal_primitive_snapshot($item)];
        return [get_class($value), $items];
    }
    if (is_float($value)) return ['float', bin2hex(pack('E', $value))];
    if (is_string($value)) return ['string', bin2hex($value)];
    if (is_int($value) || is_bool($value) || $value === null) return [gettype($value), $value];
    throw new RuntimeException('Unsupported primitive snapshot input: ' . get_debug_type($value));
}

/** Exercise every primitive-base nominal site without consulting generated metadata. */
function check_nominal_primitive_subtypes_php(array $api, bool $resultOnly, int $rounds = 256): array {
    if ($rounds < 1 || $rounds > 1000) throw new InvalidArgumentException('Invalid recovery rounds');
    $checks = $rejections = $hostRejections = $snapshotControls = 0;
    $check = function (bool $condition, string $label) use (&$checks): void {
        if (!$condition) throw new RuntimeException('failed: ' . $label);
        ++$checks;
    };
    $equal = fn($actual, $expected): bool => nominal_primitive_snapshot($actual) === nominal_primitive_snapshot($expected);
    $inputNames = ['echo_a', 'echo_b', 'refuse_unit', 'combine', 'echo_pair', 'echo_event_a', 'echo_event_b', 'aliases'];
    $resultNames = ['produce', 'produce_group', 'produce_pair', 'produce_event', 'produce_choices', 'word_bits'];
    foreach ($inputNames as $name) $check(array_key_exists($name, $api) !== $resultOnly, 'input export selection: ' . $name);
    foreach ($resultNames as $name) $check(array_key_exists($name, $api), 'result export selection: ' . $name);
    $call = function (string $name, array $args, mixed $expected) use ($api, $check, $equal): mixed {
        $before = nominal_primitive_snapshot($args);
        $result = $api[$name](...$args);
        $check($equal($result, $expected), $name . ' exact copied result');
        $check(nominal_primitive_snapshot($args) === $before, $name . ' complete inputs unchanged');
        return $result;
    };
    $refused = function (string $name, array $args, string $path, ?string $constructor = null) use ($api, $check, &$rejections): void {
        $before = nominal_primitive_snapshot($args);
        try { $api[$name](...$args); }
        catch (LeanBridgeError $error) {
            $check(get_class($error) === LeanBridgeError::class && $error->getCode() === 1, $name . ' exact Lean refusal class');
            $check(str_contains($error->getMessage(), $path), $name . ' refusal path: ' . $error->getMessage());
            if ($constructor !== null) $check(str_contains($error->getMessage(), 'NominalPrimitiveSubtypes.' . $constructor), $name . ' refusal constructor');
            $check(nominal_primitive_snapshot($args) === $before, $name . ' refused inputs unchanged');
            ++$rejections;
            return;
        }
        throw new RuntimeException('accepted: ' . $name . ' ' . $path);
    };
    $hostRefused = function (callable $invoke, array $args, string $kind) use ($check, &$hostRejections): void {
        $before = nominal_primitive_snapshot($args);
        try { $invoke(...$args); }
        catch (Throwable $error) {
            $check(get_class($error) === $kind, 'exact host refusal: ' . get_class($error) . ' ' . $error->getMessage());
            $check(nominal_primitive_snapshot($args) === $before, 'host refusal preserves input');
            ++$hostRejections;
            return;
        }
        throw new RuntimeException('accepted: invalid host value');
    };

    $n = fn($value) => BigInteger::of($value);
    $fields = function (array $changes = []) use ($n): array {
        return array_replace([
            'unitValue' => null, 'boolValue' => true,
            'uint8Value' => 42, 'uint16Value' => 42, 'uint32Value' => 42, 'uint64Value' => $n(42),
            'int8Value' => -42, 'int16Value' => -42, 'int32Value' => -42, 'int64Value' => -42,
            'natValue' => $n(42), 'intValue' => $n(-42), 'float32Value' => 1.5, 'float64Value' => 1.5,
            'textValue' => 'a', 'bytesValue' => Bytes::fromString("\x00\x80\xff"), 'charValue' => 'a',
            'usizeValue' => $n(42), 'isizeValue' => -42, 'digit' => $n(2)
        ], $changes);
    };
    $packet = fn(array $changes = []) => new Packet(...array_values($fields($changes)));
    $raw = fn(array $changes = []) => new RawPacket(...array_values($fields($changes)));
    $normalized = fn(array $changes = []) => $packet(array_replace([
        'boolValue' => true,
        'uint8Value' => 44, 'uint16Value' => 44, 'uint32Value' => 44, 'uint64Value' => $n(44),
        'int8Value' => -40, 'int16Value' => -40, 'int32Value' => -40, 'int64Value' => -40,
        'natValue' => $n(44), 'intValue' => $n(-40), 'float32Value' => -1.5, 'float64Value' => -1.5,
        'textValue' => 'a!', 'bytesValue' => Bytes::fromString("\x00\x80\xff\xff"), 'charValue' => 'b',
        'usizeValue' => $n(44), 'isizeValue' => -40
    ], $changes));
    $producedFields = [
        'uint8Value' => 200, 'uint16Value' => 200, 'uint32Value' => 200, 'uint64Value' => $n(200),
        'int8Value' => 120, 'int16Value' => 120, 'int32Value' => 120, 'int64Value' => 120,
        'natValue' => $n(2)->power(100), 'intValue' => $n(2)->power(100)->negated(),
        'float32Value' => 12.5, 'float64Value' => 12.5, 'textValue' => 'long λ text',
        'bytesValue' => Bytes::fromString("\x00\x01\x02\x03\x04\x05\x80\xfe\xff"),
        'charValue' => 'λ', 'usizeValue' => $n(200), 'isizeValue' => 200
    ];
    $producedRaw = fn(array $changes = []) => $raw(array_replace($producedFields, $changes));
    $producedPacket = fn(array $changes = []) => $packet(array_replace($producedFields, $changes));
    $none = null;
    $some = fn($value) => new Some($value);

    $snapshot = $packet();
    $mutations = [
        $packet(['boolValue' => false]), $packet(['uint8Value' => 44]), $packet(['uint64Value' => $n(44)]),
        $packet(['int64Value' => -40]), $packet(['natValue' => $n(44)]), $packet(['float32Value' => -1.5]),
        $packet(['textValue' => 'b']), $packet(['bytesValue' => Bytes::fromString("\x01")]),
        $packet(['charValue' => 'b']), $packet(['usizeValue' => $n(44)]), $packet(['isizeValue' => -40]),
        $packet(['digit' => $n(1)])
    ];
    foreach ($mutations as $changed) {
        $check(!$equal($snapshot, $changed), 'primitive snapshot mutation control');
        ++$snapshotControls;
    }

    $hostRefused(fn($value) => new Packet(...array_values($fields(['unitValue' => $value]))), ['not unit'], TypeError::class);
    $hostRefused(fn($value) => new Packet(...array_values($fields(['boolValue' => $value]))), [1], TypeError::class);
    $hostRefused(fn($value) => new Packet(...array_values($fields(['uint8Value' => $value]))), [256], ValueError::class);
    $hostRefused(fn($value) => new Packet(...array_values($fields(['uint64Value' => $value]))), [1], TypeError::class);
    $hostRefused(fn($value) => new Packet(...array_values($fields(['textValue' => $value]))), [1], TypeError::class);
    $hostRefused(fn($value) => new Packet(...array_values($fields(['bytesValue' => $value]))), ['bytes'], TypeError::class);
    $hostRefused(fn($value) => new Packet(...array_values($fields(['charValue' => $value]))), ['',], ValueError::class);
    $hostRefused(fn($value) => new Packet(...array_values($fields(['digit' => $value]))), [3], TypeError::class);

    $output = $producedPacket();
    $group = [null, $some($output)];
    $call('word_bits', [], 64);
    $call('produce', [$producedRaw()], $some($output));
    $call('produce_group', [$producedRaw()], $group);
    $call('produce_pair', [$producedRaw()], new Pair($group, $group));
    $call('produce_event', [$producedRaw()], new EventBox($output));
    $call('produce_choices', [$producedRaw()], new EventChoices([null, $some(new Ok($output)), $some(new Err($output))]));
    $invalid = [
        'boolValue' => false, 'uint8Value' => 43, 'uint16Value' => 43, 'uint32Value' => 43, 'uint64Value' => $n(43),
        'int8Value' => -43, 'int16Value' => -43, 'int32Value' => -43, 'int64Value' => -43,
        'natValue' => $n(43), 'intValue' => $n(-43), 'float32Value' => INF, 'float64Value' => INF,
        'textValue' => '', 'bytesValue' => Bytes::fromString(''), 'charValue' => "\0",
        'usizeValue' => $n(43), 'isizeValue' => -43, 'digit' => $n(3)
    ];
    foreach ($invalid as $name => $value) {
        $call('produce', [$raw([$name => $value])], null);
        if (!$resultOnly) $refused('echo_a', [$packet([$name => $value])], 'arg0.' . $name, $name === 'digit' ? null : preg_replace('/Value$/', '', $name) . 'A');
    }
    $absent = $producedRaw(['natValue' => $n(43)]);
    $call('produce_group', [$absent], [null]);
    $call('produce_pair', [$absent], new Pair([null], [null]));
    $call('produce_event', [$absent], new EventEmpty());
    $call('produce_choices', [$absent], new EventChoices([null]));
    if ($resultOnly) {
        for ($round = 0; $round < $rounds; ++$round) {
            $value = $n(2)->power(100)->plus(2 * $round);
            $call('produce', [$producedRaw(['natValue' => $value])], $some($producedPacket(['natValue' => $value])));
        }
        return compact('checks', 'rejections', 'hostRejections', 'snapshotControls', 'rounds') + ['wordBits' => 64];
    }

    $a = $packet(); $b = $packet(['boolValue' => false]); $normal = $normalized();
    $call('echo_a', [$a], $a); $call('echo_b', [$b], $normal);
    $refused('refuse_unit', [$a], 'arg0.unitValue', 'unitReject');
    $call('combine', [$a, $b], [$a, $normal]);
    $call('echo_pair', [new Pair([null, $some($a)], [$some($b)])], new Pair([null, $some($a)], [$some($normal)]));
    $call('aliases', [[null, $some($a)], [$some($b), null]], [null, $some($a), $some($normal), null]);
    foreach (['echo_event_a', 'echo_event_b'] as $name) $call($name, [new EventEmpty()], new EventEmpty());
    $call('echo_event_a', [new EventBox($a)], new EventBox($a));
    $call('echo_event_b', [new EventBox($b)], new EventBox($normal));
    $call('echo_event_a', [new EventChoices([null, $some(new Ok($a)), $some(new Err($b))])], new EventChoices([null, $some(new Ok($a)), $some(new Err($normal))]));
    $call('echo_event_b', [new EventChoices([null, $some(new Ok($b)), $some(new Err($a))])], new EventChoices([null, $some(new Ok($normal)), $some(new Err($a))]));

    $boundaryCases = [
        ['uint8Value', 254, 0], ['uint16Value', 65534, 0], ['uint32Value', 4294967294, 0],
        ['uint64Value', $n('18446744073709551614'), $n(0)], ['int8Value', 126, -128],
        ['int16Value', 32766, -32768], ['int32Value', 2147483646, -2147483648],
        ['int64Value', PHP_INT_MAX - 1, PHP_INT_MIN], ['usizeValue', $n('18446744073709551614'), $n(0)],
        ['isizeValue', PHP_INT_MAX - 1, PHP_INT_MIN], ['natValue', $n(2)->power(100), $n(2)->power(100)->plus(2)],
        ['intValue', $n(2)->power(100)->negated(), $n(2)->power(100)->negated()->plus(2)],
        ['float32Value', 0.0, -0.0], ['float64Value', 0.0, -0.0],
        ['float32Value', -0.0, 0.0], ['float64Value', -0.0, 0.0],
        ['textValue', "a\0λ😀", "a\0λ😀!"], ['bytesValue', Bytes::fromString(''), Bytes::fromString("\xff")],
        ['charValue', '😀', '😀']
    ];
    foreach ($boundaryCases as [$name, $value, $expected])
        $call('echo_b', [$packet(['boolValue' => false, $name => $value])], $normalized([$name => $expected]));
    foreach (['float32Value', 'float64Value'] as $name) foreach ([NAN, INF, -INF] as $value) {
        $refused('echo_b', [$packet(['boolValue' => false, $name => $value])], 'arg0.' . $name, preg_replace('/Value$/', '', $name) . 'B');
        $call('produce', [$raw([$name => $value])], null);
    }
    $copy = $call('echo_a', [$a], $a);
    $bytes = $copy->bytesValue->toString(); $bytes[0] = "\x11";
    $check($a->bytesValue->toString()[0] === "\x00", 'output bytes do not alias caller bytes');
    $call('echo_a', [$a], $a);
    $refused('combine', [$packet(['natValue' => $n(43)]), $packet(['boolValue' => false, 'digit' => $n(3)])], 'arg1.digit');
    $call('echo_a', [$a], $a);
    for ($round = 0; $round < $rounds; ++$round) {
        $choices = [$some($b), null, $some($b)];
        $choices[$round % 3] = $some($packet(['boolValue' => false, 'natValue' => $n(43)]));
        $refused('echo_pair', [new Pair([$some($a)], $choices)], 'arg0.right[' . ($round % 3) . ']?.natValue', 'natB');
        $call('echo_b', [$b], $normal);
    }
    return compact('checks', 'rejections', 'hostRejections', 'snapshotControls', 'rounds') + ['wordBits' => 64];
}

if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    require 'vendor/autoload.php';
    $api = [];
    foreach (['produce', 'produce_group', 'produce_pair', 'produce_event', 'produce_choices', 'word_bits',
        'echo_a', 'echo_b', 'refuse_unit', 'combine', 'echo_pair', 'echo_event_a', 'echo_event_b', 'aliases'] as $name) {
        $qualified = 'LeanNominalprimitivesubtypes\\' . $name;
        if (function_exists($qualified)) $api[$name] = $qualified;
    }
    echo json_encode(check_nominal_primitive_subtypes_php($api, NOMINAL_PRIMITIVE_RESULT_ONLY), JSON_THROW_ON_ERROR) . "\n";
}
