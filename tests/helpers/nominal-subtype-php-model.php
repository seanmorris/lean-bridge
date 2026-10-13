<?php
declare(strict_types=1);
// Synthetic caller controls using genuine public classes, never installed evidence.
require $argv[1];
require $argv[2];
require $argv[3];

use Brick\Math\BigInteger;
use LeanNominalsubtypes\{Some, Ok, Err, Envelope, Pair, AliasPair, EventEmpty, EventBox, EventChoices, LeanBridgeError};
use LeanNominalsubtypes\Internal\{Budget, Checks};

function nominal_model(string $prefix, bool $resultOnly, array $checks): array {
    $n = fn($value) => BigInteger::of($value);
    $wrap = fn($value, $digit = 2) => new Envelope($n($value), $n($digit));
    $values = fn($value) => [null, new Some($wrap($value->plus(1)))];
    $bound = function (BigInteger $value, string $path): void {
        if ($value->isGreaterThanOrEqualTo(3)) throw new LeanBridgeError("$path is not below its Fin 3 bound", 1);
    };
    $fin = function ($value, string $path) use (&$fin, $bound): void {
        if ($value instanceof Envelope) $bound($value->digit, $path . '.digit');
        elseif ($value instanceof Pair || $value instanceof AliasPair) { $fin($value->left, $path . '.left'); $fin($value->right, $path . '.right'); }
        elseif ($value instanceof EventBox) $fin($value->value, $path . '.box.value');
        elseif ($value instanceof Some) $fin($value->value, $path . '?');
        elseif (is_array($value)) foreach ($value as $i => $item) $fin($item, "{$path}[$i]");
    };
    $positive = function (BigInteger $value, int $amount, string $path): BigInteger {
        $constructor = $amount === 1 ? 'plusOne' : 'plusTwo';
        if ($value->isGreaterThanOrEqualTo($amount === 1 ? 100 : 90)) throw new LeanBridgeError("$path was rejected by NominalSubtypes.$constructor", 1);
        return $value->plus($amount);
    };
    $envelope = fn($value, $amount, $path) => new Envelope($positive($value->payload, $amount, $path . '.payload'), $value->digit);
    $group = function ($items, $amount, $path) use ($envelope): array {
        $result = [];
        foreach ($items as $i => $item) $result[] = $item === null ? null : new Some($envelope($item->value, $amount, "{$path}[$i]?"));
        return $result;
    };
    $pair = fn($value, $path) => new AliasPair($group($value->left, 1, $path . '.left'), $group($value->right, 2, $path . '.right'));
    $sum = function ($items) use ($n): BigInteger {
        $result = $n(0);
        foreach ($items as $item) if ($item !== null) $result = $result->plus($item->value->payload);
        return $result;
    };
    $event = function ($value, $one, $two, $path) use ($envelope, $positive): mixed {
        if ($value instanceof EventEmpty) return new EventEmpty();
        if ($value instanceof EventBox) return new EventBox($envelope($value->value, $one, $path . '.box.value'));
        $items = [];
        foreach ($value->values as $i => $item) {
            if ($item === null) { $items[] = null; continue; }
            $branch = $item->value;
            $items[] = new Some($branch instanceof Ok
                ? new Ok($positive($branch->value, $one, "{$path}.choices.values[$i]?.ok"))
                : new Err($positive($branch->value, $two, "{$path}.choices.values[$i]?.error")));
        }
        return new EventChoices($items);
    };
    $eventSum = function ($value) use ($n): BigInteger {
        if ($value instanceof EventEmpty) return $n(0);
        if ($value instanceof EventBox) return $value->value->payload;
        $sum = $n(0);
        foreach ($value->values as $item) if ($item !== null) $sum = $sum->plus($item->value->value);
        return $sum;
    };
    $api = [
        'scalar' => fn($value) => $value->plus(1),
        'produce_envelope' => fn($value) => $wrap($value->plus(1)),
        'array_values' => fn($value) => [$value->plus(1), $value->plus(2)],
        'list_values' => fn($value) => [$value->plus(1), $value->plus(2)],
        'optional' => fn($value) => $value->isZero() ? null : new Some($value->plus(1)),
        'product' => fn($value) => [$value->plus(1), $value->plus(2)],
        'branch' => fn($value) => $value->isZero() ? new Err($value->plus(1)) : new Ok($value->plus(1)),
        'group_values' => $values,
        'pair_values' => fn($value) => new AliasPair($values($value), $values($value->plus(1))),
        'event_value' => fn($value) => new EventBox($wrap($value->plus(1))),
        'event_empty' => fn($value) => new EventEmpty(),
        'event_choices' => fn($value) => new EventChoices([null, new Some(new Ok($value->plus(1))), new Some(new Err($value->plus(2)))]),
        'no_items' => fn($value) => []
    ];
    $arg = $prefix . '0';
    if (!$resultOnly) $api += [
        'first' => fn($value) => $envelope($value, 1, $arg)->payload,
        'second' => fn($value) => $envelope($value, 2, $arg)->payload,
        'combine' => fn($left, $right) => $envelope($left, 1, $arg)->payload->multipliedBy(100)->plus($envelope($right, 2, $prefix . '1')->payload),
        'nested' => fn($value) => $envelope($value->left, 1, $arg . '.left')->payload->multipliedBy(100)->plus($envelope($value->right, 2, $arg . '.right')->payload),
        'event_first' => fn($value) => $eventSum($event($value, 1, 2, $arg)),
        'event_second' => fn($value) => $eventSum($event($value, 2, 1, $arg)),
        'echo_envelope' => fn($value) => $envelope($value, 1, $arg),
        'aliases' => fn($left, $right) => $sum(array_merge($group($left, 1, $arg), $group($right, 2, $prefix . '1'))),
        'inspect_alias_pair' => function ($value) use ($pair, $arg, $sum) { $value = $pair($value, $arg); return $sum(array_merge($value->left, $value->right)); },
        'echo_groups' => fn($value) => $group($value, 1, $arg),
        'echo_pair' => fn($value) => $pair($value, $arg),
        'echo_event' => fn($value) => $event($value, 1, 2, $arg),
        'plain_fin' => function ($value) use ($bound, $arg) { $bound($value, $arg); return $value; }
    ];
    foreach ($api as $name => $call) {
        $api[$name] = function (...$args) use ($call, $name, $checks, $fin, $prefix) {
            $budget = new Budget();
            foreach ($args as $i => $value) (Checks::class . '::check' . $checks[$name][$i])($value, $budget);
            foreach ($args as $i => $value) $fin($value, $prefix . $i);
            return $call(...$args);
        };
    }
    return $api;
}

$prefix = $argv[4]; $resultOnly = $argv[5] === 'result-only';
$checks = json_decode(file_get_contents($argv[6]), true, flags: JSON_THROW_ON_ERROR);
$make = fn() => nominal_model($prefix, $resultOnly, $checks);
$expected = check_nominal_subtypes($make(), $resultOnly);
$controls = 0;
$detect = function ($api, $label) use ($resultOnly, &$controls): void {
    try { check_nominal_subtypes($api, $resultOnly); }
    catch (RuntimeException $error) {
        if (!str_starts_with($error->getMessage(), 'failed: ') && !str_starts_with($error->getMessage(), 'accepted: ')) throw $error;
        ++$controls; return;
    }
    throw new RuntimeException('undetected mutant: ' . $label);
};
$alter = function ($name, $transform) use ($make, $detect): void {
    $api = $make(); $original = $api[$name];
    $api[$name] = fn(...$args) => $transform($original(...$args));
    $detect($api, $name);
};
$alter('scalar', fn($value) => $value->plus(1));
$alter('produce_envelope', fn($value) => new Envelope($value->payload, BigInteger::of(1)));
$alter('array_values', fn($value) => array_reverse($value));
$alter('optional', fn($value) => null);
$alter('branch', fn($value) => new Ok($value->value));
$alter('pair_values', fn($value) => new AliasPair($value->left, $value->left));
$alter('event_choices', fn($value) => new EventChoices(array_slice($value->values, 0, 2)));
$alter('no_items', fn($value) => [BigInteger::of(1)]);
if (!$resultOnly) {
    foreach ([['second', 'first'], ['event_second', 'event_first']] as [$target, $source]) {
        $api = $make(); $api[$target] = $api[$source]; $detect($api, $target);
    }
    $alter('combine', fn($value) => $value->plus(99));
    $alter('nested', fn($value) => $value->minus(1));
    $alter('aliases', fn($value) => $value->plus(1));
    $alter('echo_pair', fn($value) => new AliasPair($value->left, $value->left));
    $api = $make(); $original = $api['echo_pair'];
    $api['echo_pair'] = function (&$value) use ($original) {
        try { return $original($value); }
        catch (LeanBridgeError $error) { $value = new AliasPair([], []); throw $error; }
    };
    $detect($api, 'rejected input mutation');
    $api = $make(); $original = $api['combine'];
    $api['combine'] = function ($left, $right) use ($original, $prefix) {
        if ($left->payload->isGreaterThanOrEqualTo(100)) throw new LeanBridgeError("{$prefix}0.payload was rejected by NominalSubtypes.plusOne", 1);
        return $original($left, $right);
    };
    $detect($api, 'Subtype before complete Fin validation');
}
echo json_encode($expected + ['callerMutationControls' => $controls], JSON_THROW_ON_ERROR) . "\n";
