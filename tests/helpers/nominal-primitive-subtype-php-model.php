<?php
declare(strict_types=1);
// Synthetic caller controls using genuine generated public classes. No installed package runs here.
require $argv[1];
require $argv[2];
require $argv[3];

use Brick\Math\BigInteger;
use LeanNominalprimitivesubtypes\{Bytes, Some, Ok, Err, Packet, Pair, EventEmpty, EventBox, EventChoices, LeanBridgeError};
use LeanNominalprimitivesubtypes\Internal\{Budget, Checks};

function nominal_primitive_php_model(string $prefix, bool $resultOnly, array $checks): array {
    $n = fn($value) => BigInteger::of($value);
    $names = ['unitValue', 'boolValue', 'uint8Value', 'uint16Value', 'uint32Value', 'uint64Value',
        'int8Value', 'int16Value', 'int32Value', 'int64Value', 'natValue', 'intValue',
        'float32Value', 'float64Value', 'textValue', 'bytesValue', 'charValue', 'usizeValue', 'isizeValue', 'digit'];
    $values = fn($item) => array_map(fn($name) => $item->$name, $names);
    $packet = fn($item) => new Packet(...$values($item));
    $even = fn($value) => $value instanceof BigInteger ? $value->mod(2)->isZero() : $value % 2 === 0;
    $valid = fn($item) => $item->boolValue === true
        && $even($item->uint8Value) && $even($item->uint16Value) && $even($item->uint32Value) && $even($item->uint64Value)
        && $even($item->int8Value) && $even($item->int16Value) && $even($item->int32Value) && $even($item->int64Value)
        && $even($item->natValue) && $even($item->intValue) && $even($item->usizeValue) && $even($item->isizeValue)
        && is_finite($item->float32Value) && is_finite($item->float64Value)
        && $item->textValue !== '' && $item->bytesValue->toString() !== '' && $item->charValue !== "\0"
        && $item->digit->isLessThan(3);
    $fin = function ($value, string $path) use (&$fin): void {
        if ($value instanceof Packet && !$value->digit->isLessThan(3)) throw new LeanBridgeError("$path.digit is not below its Fin 3 bound", 1);
        if ($value instanceof Pair) { $fin($value->left, $path . '.left'); $fin($value->right, $path . '.right'); }
        elseif ($value instanceof EventBox) $fin($value->value, $path . '.box.value');
        elseif ($value instanceof EventChoices) $fin($value->values, $path . '.choices.values');
        elseif ($value instanceof Some) $fin($value->value, $path . '?');
        elseif ($value instanceof Ok) $fin($value->value, $path . '.ok');
        elseif ($value instanceof Err) $fin($value->value, $path . '.error');
        elseif (is_array($value)) foreach ($value as $index => $item) $fin($item, "{$path}[$index]");
    };
    $wrapSigned = function (int $value, int $bits): int {
        if ($bits === 64) return $value > PHP_INT_MAX - 2 ? PHP_INT_MIN + ($value - (PHP_INT_MAX - 1)) : $value + 2;
        $modulus = 2 ** $bits; $adjusted = ($value + 2) % $modulus;
        return $adjusted >= 2 ** ($bits - 1) ? $adjusted - $modulus : $adjusted;
    };
    $convert = function ($item, string $choice, string $path) use ($n, $names, $packet, $wrapSigned): Packet {
        $values = array_combine($names, array_map(fn($name) => $item->$name, $names));
        $numbers = ['uint8Value', 'uint16Value', 'uint32Value', 'uint64Value', 'int8Value', 'int16Value', 'int32Value', 'int64Value', 'natValue', 'intValue', 'usizeValue', 'isizeValue'];
        if ($choice === 'B') {
            $values['boolValue'] = !$values['boolValue'];
            foreach ([['uint8Value', 8], ['uint16Value', 16], ['uint32Value', 32]] as [$name, $bits]) $values[$name] = ($values[$name] + 2) % (2 ** $bits);
            foreach ([['int8Value', 8], ['int16Value', 16], ['int32Value', 32], ['int64Value', 64], ['isizeValue', 64]] as [$name, $bits]) $values[$name] = $wrapSigned($values[$name], $bits);
            $modulus = $n(2)->power(64);
            foreach (['uint64Value', 'usizeValue'] as $name) $values[$name] = $values[$name]->plus(2)->mod($modulus);
            foreach (['natValue', 'intValue'] as $name) $values[$name] = $values[$name]->plus(2);
            $values['float32Value'] = unpack('g', pack('g', -$values['float32Value']))[1];
            $values['float64Value'] = -$values['float64Value'];
            $values['textValue'] .= '!';
            $values['bytesValue'] = Bytes::fromString($values['bytesValue']->toString() . "\xff");
            if ($values['charValue'] === 'a') $values['charValue'] = 'b';
        }
        $accepted = [
            'unitValue' => $values['unitValue'] === null,
            'boolValue' => $values['boolValue'] === true,
            'float32Value' => is_finite($values['float32Value']), 'float64Value' => is_finite($values['float64Value']),
            'textValue' => $values['textValue'] !== '', 'bytesValue' => $values['bytesValue']->toString() !== '',
            'charValue' => $values['charValue'] !== "\0"
        ];
        foreach ($numbers as $name) $accepted[$name] = $values[$name] instanceof BigInteger ? $values[$name]->mod(2)->isZero() : $values[$name] % 2 === 0;
        if ($choice === 'A') {
            foreach ($numbers as $name) $accepted[$name] = $accepted[$name] && ($values[$name] instanceof BigInteger ? $values[$name]->isLessThan(100) : $values[$name] < 100);
            $accepted['float32Value'] = $accepted['float32Value'] && $values['float32Value'] < 10;
            $accepted['float64Value'] = $accepted['float64Value'] && $values['float64Value'] < 10;
            $accepted['textValue'] = $accepted['textValue'] && strlen($values['textValue']) < 8;
            $accepted['bytesValue'] = $accepted['bytesValue'] && strlen($values['bytesValue']->toString()) < 8;
            $accepted['charValue'] = $accepted['charValue'] && strlen($values['charValue']) === 1 && ord($values['charValue']) < 128;
        }
        foreach ($accepted as $name => $ok) if (!$ok) {
            $constructor = $name === 'unitValue' ? 'unit' : preg_replace('/Value$/', '', $name);
            throw new LeanBridgeError("$path.$name was rejected by NominalPrimitiveSubtypes.$constructor$choice", 1);
        }
        return new Packet(...array_values($values));
    };
    $group = function (array $items, string $choice, string $path) use ($convert): array {
        $result = [];
        foreach ($items as $index => $item) $result[] = $item === null ? null : new Some($convert($item->value, $choice, "{$path}[$index]?"));
        return $result;
    };
    $event = function ($value, string $first, string $second, string $path) use ($convert): mixed {
        if ($value instanceof EventEmpty) return new EventEmpty();
        if ($value instanceof EventBox) return new EventBox($convert($value->value, $first, $path . '.box.value'));
        $items = [];
        foreach ($value->values as $index => $item) {
            if ($item === null) { $items[] = null; continue; }
            $branch = $item->value;
            $items[] = new Some($branch instanceof Ok
                ? new Ok($convert($branch->value, $first, "$path.choices.values[$index]?.ok"))
                : new Err($convert($branch->value, $second, "$path.choices.values[$index]?.error")));
        }
        return new EventChoices($items);
    };
    $produce = fn($item) => $valid($item) ? new Some($packet($item)) : null;
    $produceGroup = fn($item) => $valid($item) ? [null, $produce($item)] : [null];
    $api = [
        'word_bits' => fn() => 64,
        'produce' => $produce,
        'produce_group' => $produceGroup,
        'produce_pair' => fn($item) => new Pair($produceGroup($item), $produceGroup($item)),
        'produce_event' => fn($item) => $valid($item) ? new EventBox($packet($item)) : new EventEmpty(),
        'produce_choices' => fn($item) => new EventChoices($valid($item) ? [null, new Some(new Ok($packet($item))), new Some(new Err($packet($item)))] : [null])
    ];
    if (!$resultOnly) $api += [
		'echo_a' => fn($item) => $convert($item, 'A', $prefix . '0'),
		'echo_b' => fn($item) => $convert($item, 'B', $prefix . '0'),
		'refuse_unit' => fn($_item) => throw new LeanBridgeError($prefix . '0.unitValue was rejected by NominalPrimitiveSubtypes.unitReject', 1),
		'combine' => fn($left, $right) => [$convert($left, 'A', $prefix . '0'), $convert($right, 'B', $prefix . '1')],
		'echo_pair' => fn($item) => new Pair($group($item->left, 'A', $prefix . '0.left'), $group($item->right, 'B', $prefix . '0.right')),
		'aliases' => fn($left, $right) => array_merge($group($left, 'A', $prefix . '0'), $group($right, 'B', $prefix . '1')),
		'echo_event_a' => fn($item) => $event($item, 'A', 'B', $prefix . '0'),
		'echo_event_b' => fn($item) => $event($item, 'B', 'A', $prefix . '0')
    ];
    foreach ($api as $name => $call) $api[$name] = function (...$args) use ($call, $name, $checks, $fin, $prefix): mixed {
        $budget = new Budget();
        foreach ($args as $index => $value) (Checks::class . '::check' . $checks[$name][$index])($value, $budget);
		foreach ($args as $index => $value) $fin($value, $prefix . $index);
        return $call(...$args);
    };
    return $api;
}

$prefix = $argv[4]; $mode = $argv[5];
$resultOnly = $mode === 'result-only';
$checks = json_decode(file_get_contents($argv[6]), true, flags: JSON_THROW_ON_ERROR);
$counts = check_nominal_primitive_subtypes_php(nominal_primitive_php_model($prefix, $resultOnly, $checks), $resultOnly);
echo json_encode($counts, JSON_THROW_ON_ERROR) . "\n";
