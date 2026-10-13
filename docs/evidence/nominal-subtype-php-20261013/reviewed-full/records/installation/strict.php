<?php
declare(strict_types=1);

use Brick\Math\BigInteger;
use LeanNominalsubtypes\{Some, Ok, Err, Envelope, Pair, AliasPair, EventEmpty, EventBox, EventChoices, LeanBridgeError};

const NOMINAL_RESULT_ONLY = false;

// Snapshot actual classes, keys and payloads without generated equality/serialization.
function nominal_snapshot(mixed $value): array {
    if ($value instanceof BigInteger) return ['nat', (string) $value];
    if (is_array($value) || is_object($value)) {
        $entries = [];
        foreach (is_array($value) ? $value : get_object_vars($value) as $key => $item) {
            $entries[] = [gettype($key), $key, nominal_snapshot($item)];
        }
        return [is_array($value) ? 'array' : get_class($value), $entries];
    }
    if (is_string($value)) return ['string', bin2hex($value)];
    if (is_int($value) || is_float($value) || is_bool($value) || $value === null) return [gettype($value), $value];
    throw new RuntimeException('Unsupported snapshot input: ' . get_debug_type($value));
}

function check_nominal_subtypes(array $api, bool $resultOnly): array {
    $checks = $rejections = $hostRejections = $snapshotControls = 0;
    $inputs = ['first', 'second', 'combine', 'nested', 'event_first', 'event_second',
        'echo_envelope', 'aliases', 'inspect_alias_pair', 'echo_groups', 'echo_pair', 'echo_event', 'plain_fin'];
    foreach ($inputs as $name) {
        if (array_key_exists($name, $api) === $resultOnly) throw new RuntimeException('incorrect input export selection: ' . $name);
    }
    $check = function (bool $condition, string $label) use (&$checks): void {
        if (!$condition) throw new RuntimeException('failed: ' . $label);
        ++$checks;
    };
    $n = fn($value) => BigInteger::of($value);
    $wrap = fn($value, $digit = 2) => new Envelope($n($value), $n($digit));
    $values = fn($value) => [null, new Some($wrap($n($value)->plus(1)))];
    $call = function (string $name, array $args, mixed $expected) use ($api, $check): mixed {
        $before = nominal_snapshot($args);
        $result = $api[$name](...$args);
        $check(nominal_snapshot($result) === nominal_snapshot($expected), "$name exact copied result");
        $check(nominal_snapshot($args) === $before, "$name complete inputs unchanged");
        return $result;
    };
    $refused = function (string $name, array $args, string $path, ?string $constructor = null, ?int $bound = null) use ($api, $check, &$rejections): void {
        $before = nominal_snapshot($args);
        $message = $bound !== null ? "$path is not below its Fin $bound bound" : "$path was rejected by NominalSubtypes.$constructor";
        try { $api[$name](...$args); }
        catch (LeanBridgeError $error) {
            $check(get_class($error) === LeanBridgeError::class && $error->getCode() === 1 && $error->getMessage() === $message, "exact refusal: $message; got " . $error->getMessage());
            $check(nominal_snapshot($args) === $before, "$name rejected inputs unchanged");
            ++$rejections; return;
        }
        throw new RuntimeException('accepted: ' . $message);
    };
    $hostRefused = function (callable $invoke, array $args, string $kind, string $message) use ($check, &$hostRejections): void {
        $before = nominal_snapshot($args);
        try { $invoke(...$args); }
        catch (Throwable $error) {
            $check(get_class($error) === $kind && $error->getMessage() === $message, 'exact host refusal: ' . $error->getMessage());
            $check(nominal_snapshot($args) === $before, 'host refusal preserves input');
            ++$hostRejections; return;
        }
        throw new RuntimeException('accepted: ' . $message);
    };
    $huge = $n(2)->power(100);
    $original = new EventChoices([null, new Some(new Ok($huge))]);
    $mutations = [new EventChoices([null, new Some(new Ok($huge->plus(1)))]),
        new EventChoices([null, new Some(new Err($huge))]),
        new EventChoices([new Some(new Ok($huge)), null]), new EventChoices([null, null]),
        new EventChoices([null, new Some(new Ok($huge)), null]), new EventBox($wrap($huge)), new EventEmpty()];
    foreach ($mutations as $changed) { $check(nominal_snapshot($changed) !== nominal_snapshot($original), 'snapshot mutation control'); ++$snapshotControls; }
    $check(nominal_snapshot($wrap($huge, 1)) !== nominal_snapshot($wrap($huge, 2)), 'record field snapshot control'); ++$snapshotControls;
    foreach ([null, 0, '0', 0.0, false, [], new stdClass()] as $value) $hostRefused($api['scalar'], [$value], TypeError::class, 'Expected Brick Math BigInteger');
    $hostRefused($api['scalar'], [$n(-1)], ValueError::class, 'Expected an unsigned integer');
    $make = fn($payload, $digit) => new Envelope($payload, $digit);
    $hostRefused($make, [null, $n(2)], TypeError::class, 'Expected Brick Math BigInteger');
    $hostRefused($make, [$n(-1), $n(2)], ValueError::class, 'Expected an unsigned integer');
    $hostRefused($make, [$n(1), null], TypeError::class, 'Expected Brick Math BigInteger');
    $hostRefused(fn($items) => new EventChoices($items), [[new Some(new Ok(null))]], TypeError::class, 'Expected Brick Math BigInteger');
    $call('scalar', [$n(40)], $n(41));
    foreach ([$n(0), $n(40), $huge] as $value) {
        $one = $value->plus(1); $two = $value->plus(2);
        $call('scalar', [$value], $one);
        $call('produce_envelope', [$value], $wrap($one));
        $call('array_values', [$value], [$one, $two]);
        $call('list_values', [$value], [$one, $two]);
        $call('optional', [$value], $value->isZero() ? null : new Some($one));
        $call('product', [$value], [$one, $two]);
        $call('branch', [$value], $value->isZero() ? new Err($one) : new Ok($one));
        $call('group_values', [$value], $values($value));
        $call('pair_values', [$value], new AliasPair($values($value), $values($one)));
        $call('event_value', [$value], new EventBox($wrap($one)));
        $call('event_empty', [$value], new EventEmpty());
        $call('event_choices', [$value], new EventChoices([null, new Some(new Ok($one)), new Some(new Err($two))]));
        $call('no_items', [$value], []);
    }
    if ($resultOnly) {
        for ($round = 0; $round < 1000; ++$round) {
            $value = $huge->plus($round);
            $call('pair_values', [$value], new AliasPair($values($value), $values($value->plus(1))));
        }
        return compact('checks', 'rejections', 'hostRejections', 'snapshotControls');
    }
    $item = $wrap(40);
    foreach ([null, []] as $bad) $hostRefused($api['first'], [$bad], TypeError::class, 'Expected Envelope');
    $hostRefused($api['first'], [(new ReflectionClass(Envelope::class))->newInstanceWithoutConstructor()], TypeError::class, 'Envelope requires exactly its initialized fields');
    foreach ([null, new stdClass()] as $bad) $hostRefused($api['event_first'], [$bad], TypeError::class, 'Expected an exact Event constructor');
    $hostRefused($api['event_first'], [(new ReflectionClass(EventBox::class))->newInstanceWithoutConstructor()], TypeError::class, 'EventBox requires exactly its initialized payload fields');
    $hostRefused($api['aliases'], [[1 => new Some($item)], []], TypeError::class, 'Expected a list with consecutive integer keys');
    $hostRefused($api['aliases'], [[new Some(null)], []], TypeError::class, 'Expected Envelope');
    $call('first', [$item], $n(41));
    $call('second', [$item], $n(42));
    $call('combine', [$item, $item], $n(4142));
    $call('nested', [new Pair($item, $item)], $n(4142));
    $call('first', [$wrap(99)], $n(100));
    $call('second', [$wrap(89)], $n(91));
    $call('first', [$wrap(90)], $n(91));
    $refused('first', [$wrap(100)], 'value0.payload', 'plusOne');
    $refused('second', [$wrap(90)], 'value0.payload', 'plusTwo');
    $refused('combine', [$wrap(100), $item], 'value0.payload', 'plusOne');
    $refused('combine', [$item, $wrap(90)], 'value1.payload', 'plusTwo');
    $refused('nested', [new Pair($wrap(100), $item)], 'value0.left.payload', 'plusOne');
    $refused('nested', [new Pair($item, $wrap(90))], 'value0.right.payload', 'plusTwo');
    $call('echo_envelope', [$item], $wrap(41));
    foreach ([['event_first', 1, 2], ['event_second', 2, 1]] as [$name, $one, $two]) {
        $call($name, [new EventEmpty()], $n(0));
        $call($name, [new EventBox($item)], $n(40 + $one));
        $call($name, [new EventChoices([])], $n(0));
        $call($name, [new EventChoices([null])], $n(0));
        $call($name, [new EventChoices([null, new Some(new Ok($n(40)))])], $n(40 + $one));
        $call($name, [new EventChoices([new Some(new Err($n(40))), null])], $n(40 + $two));
        foreach ([['ok', Ok::class, $one], ['error', Err::class, $two]] as [$label, $branch, $amount]) {
            for ($position = 0; $position < 3; ++$position) {
                $items = [new Some(new Ok($n(40))), null, new Some(new Err($n(40)))];
                $items[$position] = new Some(new $branch($n(100)));
                $refused($name, [new EventChoices($items)], "value0.choices.values[$position]?.$label", $amount === 1 ? 'plusOne' : 'plusTwo');
            }
        }
    }
    $left = [null, new Some($item), new Some($wrap(1, 0))]; $right = [new Some($wrap(2, 1)), null];
    $normalizedLeft = [null, new Some($wrap(41)), new Some($wrap(2, 0))]; $normalizedRight = [new Some($wrap(4, 1)), null];
    $call('aliases', [$left, $right], $n(47));
    $call('inspect_alias_pair', [new AliasPair($left, $right)], $n(47));
    $call('echo_groups', [$left], $normalizedLeft);
    $projected = $call('echo_pair', [new AliasPair($left, $right)], new AliasPair($normalizedLeft, $normalizedRight));
    $call('echo_pair', [$projected], new AliasPair([null, new Some($wrap(42)), new Some($wrap(3, 0))], [new Some($wrap(6, 1)), null]));
    $call('echo_event', [new EventChoices([null, new Some(new Ok($n(40))), new Some(new Err($n(40)))])], new EventChoices([null, new Some(new Ok($n(41))), new Some(new Err($n(42)))]));
    $call('echo_event', [new EventEmpty()], new EventEmpty());
    $call('echo_event', [new EventBox($item)], new EventBox($wrap(41)));
    $call('echo_groups', [[]], []);
    $call('echo_pair', [new AliasPair([], [null])], new AliasPair([], [null]));
    for ($position = 0; $position < 3; ++$position) {
        $bad = [new Some($item), null, new Some($item)]; $bad[$position] = new Some($wrap(100));
        $refused('echo_groups', [$bad], "value0[$position]?.payload", 'plusOne');
        $refused('inspect_alias_pair', [new AliasPair($bad, $right)], "value0.left[$position]?.payload", 'plusOne');
        $refused('inspect_alias_pair', [new AliasPair($left, $bad)], "value0.right[$position]?.payload", 'plusTwo');
    }
    $refused('combine', [$wrap(100), $wrap(40, 3)], 'value1.digit', null, 3);
    $refused('nested', [new Pair($wrap(100), $wrap(40, 3))], 'value0.right.digit', null, 3);
    $refused('aliases', [[new Some($wrap(100))], [null, new Some($wrap(40, 3))]], 'value1[1]?.digit', null, 3);
    $refused('echo_event', [new EventBox($wrap(100, 3))], 'value0.box.value.digit', null, 3);
    $call('plain_fin', [$n(2)], $n(2));
    $refused('plain_fin', [$n(3)], 'value0', null, 3);
    for ($round = 0; $round < 1000; ++$round) {
        $position = $round % 3; $bad = [null, new Some($wrap(1)), null]; $bad[$position] = new Some($wrap(90));
        $refused('echo_pair', [new AliasPair($left, $bad)], "value0.right[$position]?.payload", 'plusTwo');
        $call('echo_pair', [new AliasPair($left, $right)], new AliasPair($normalizedLeft, $normalizedRight));
    }
    return compact('checks', 'rejections', 'hostRejections', 'snapshotControls');
}

if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    require 'vendor/autoload.php';
    $api = [];
    $names = ['scalar', 'produce_envelope', 'array_values', 'list_values', 'optional', 'product', 'branch',
        'group_values', 'pair_values', 'event_value', 'event_empty', 'event_choices', 'no_items',
        'first', 'second', 'combine', 'nested', 'event_first', 'event_second', 'echo_envelope', 'aliases',
        'inspect_alias_pair', 'echo_groups', 'echo_pair', 'echo_event', 'plain_fin'];
    foreach ($names as $name) if (function_exists('LeanNominalsubtypes\\' . $name)) $api[$name] = 'LeanNominalsubtypes\\' . $name;
    echo json_encode(check_nominal_subtypes($api, NOMINAL_RESULT_ONLY), JSON_THROW_ON_ERROR) . "\n";
}
