<?php
declare(strict_types=1);

use Brick\Math\BigInteger;
use LeanNestedcheckedrecords\{Some, Ok, Err, Packet, Holder, ChoiceEmpty, ChoicePacket, LeanBridgeError};

const NESTED_CHECKED_RECORD_RESULT_ONLY = false;
const NESTED_PARAMETER_PREFIX = 'arg';
const NESTED_LEAN_DIAGNOSTIC = '/ (?:is not below its Fin [0-9]+ bound|was rejected by NestedCheckedRecords\.[A-Za-z]+)$/D';

/** Preserve exact public values, including BigInteger text, keys and class identity. */
function nested_checked_record_snapshot(mixed $value): array {
    if ($value instanceof BigInteger) return ['bigint', (string) $value];
    if (is_array($value)) {
        $items = [];
        foreach ($value as $key => $item) $items[] = [gettype($key), $key, nested_checked_record_snapshot($item)];
        return ['array', $items];
    }
    if (is_object($value)) {
        $items = [];
        foreach (get_object_vars($value) as $key => $item) $items[] = [$key, nested_checked_record_snapshot($item)];
        return [get_class($value), $items];
    }
    if (is_int($value) || is_bool($value) || is_float($value) || is_string($value) || $value === null) return [gettype($value), $value];
    throw new RuntimeException('Unsupported nested snapshot input: ' . get_debug_type($value));
}

/** Exercise every nested checked-record site without consulting generated metadata. */
function check_nested_checked_records_php(array $api, bool $resultOnly, string $prefix, int $rounds = 256): array {
    if ($rounds < 1 || $rounds > 1000) throw new InvalidArgumentException('Invalid recovery rounds');
    if (!in_array($prefix, ['arg', 'value'], true)) throw new InvalidArgumentException('Invalid parameter prefix');
    $checks = $rejections = $hostRejections = $recoveries = $snapshots = $snapshotControls = 0;
    $check = function (bool $condition, string $label) use (&$checks): void {
        if (!$condition) throw new RuntimeException('failed: ' . $label);
        ++$checks;
    };
    $unchanged = function (array $args, array $before, string $label) use ($check, &$snapshots): void {
        ++$snapshots;
        $check(nested_checked_record_snapshot($args) === $before, $label . ' complete inputs unchanged');
    };
    $outcome = function (callable $invoke, array $args): array {
        try { return [$invoke(...$args), null]; }
        catch (Throwable $error) { return [null, $error]; }
    };
    $inputNames = ['first', 'second', 'pair', 'in_array', 'in_list', 'in_option', 'in_product', 'in_except', 'in_holder', 'in_choice', 'echo_array'];
    $resultNames = ['produce_option', 'produce_array'];
    foreach ($inputNames as $name) $check(array_key_exists($name, $api) !== $resultOnly, 'input export selection: ' . $name);
    foreach ($resultNames as $name) $check(array_key_exists($name, $api), 'result export selection: ' . $name);
    $call = function (string $name, array $args, mixed $expected) use ($api, $check, $unchanged, $outcome): mixed {
        $before = nested_checked_record_snapshot($args);
        [$result, $error] = $outcome($api[$name], $args);
        if ($error !== null) throw new RuntimeException('failed: ' . $name . ' unexpectedly threw ' . get_class($error) . ': ' . $error->getMessage());
        $check(nested_checked_record_snapshot($result) === nested_checked_record_snapshot($expected), $name . ' exact copied result');
        $unchanged($args, $before, $name);
        return $result;
    };
    $refused = function (string $name, array $args, string $message) use ($api, $check, $unchanged, $outcome, &$rejections): void {
        $before = nested_checked_record_snapshot($args);
        [, $error] = $outcome($api[$name], $args);
        if ($error === null) throw new RuntimeException('failed: accepted invalid input: ' . $message);
        $check(get_class($error) === LeanBridgeError::class && $error->getCode() === 1 && $error->getMessage() === $message,
            'exact refusal: ' . $message . '; got ' . get_class($error) . ' ' . $error->getCode() . ' ' . $error->getMessage());
        $unchanged($args, $before, $name);
        ++$rejections;
    };
    // PHP conversion refusals precede Lean and never carry a Lean diagnostic.
    $hostRefused = function (callable $invoke, array $args, array $kinds, string $label) use ($check, $unchanged, $outcome, &$hostRejections): void {
        $before = nested_checked_record_snapshot($args);
        [, $error] = $outcome($invoke, $args);
        if ($error === null) throw new RuntimeException('failed: accepted malformed input: ' . $label);
        $check(in_array(get_class($error), $kinds, true) && preg_match(NESTED_LEAN_DIAGNOSTIC, $error->getMessage()) !== 1,
            'host refusal: ' . $label . '; got ' . get_class($error) . ': ' . $error->getMessage());
        $unchanged($args, $before, $label);
        ++$hostRejections;
    };

    $n = fn($value) => BigInteger::of($value);
    $huge = $n(2)->power(100);
    $p = fn($digit, $word) => new Packet($n($digit), $word instanceof BigInteger ? $word : $n($word));
    $controls = [[$p(0, 1), $p(0, 2)], [$p(0, 1), $p(1, 1)], [[$p(0, 1)], [1 => $p(0, 1)]],
        [new Some($p(0, 1)), $p(0, 1)], [null, new Some(null)], [$n(0), 0], [[], null]];
    // Result-only packages declare only the classes their results use.
    if (!$resultOnly) $controls = array_merge($controls, [[new Some($p(0, 1)), new Ok($p(0, 1))],
        [new Ok($p(0, 1)), new Err($p(0, 1))], [new Holder($p(0, 1), $n(1)), [$p(0, 1), $n(1)]],
        [new ChoiceEmpty(), null], [new ChoicePacket($p(0, 1)), new Some($p(0, 1))]]);
    foreach ($controls as [$left, $right]) {
        $check(nested_checked_record_snapshot($left) !== nested_checked_record_snapshot($right), 'independent snapshot mutation');
        ++$snapshotControls;
    }

    // Constructor-free results: 2^100 + round, with words one and two above it.
    $call('produce_option', [$n(0)], new Some($p(0, 1)));
    $call('produce_array', [$n(0)], [$p(0, 1), $p(0, 2)]);
    for ($round = 0; $round < $rounds; ++$round) {
        $value = $huge->plus($round);
        $call('produce_option', [$value], new Some($p(0, $value->plus(1))));
        $call('produce_array', [$value], [$p(0, $value->plus(1)), $p(0, $value->plus(2))]);
    }
    $hostRefused($api['produce_option'], [1], [TypeError::class], 'int Nat');
    $hostRefused($api['produce_option'], [$n(-1)], [ValueError::class], 'negative Nat');
    $hostRefused($api['produce_array'], ['1'], [TypeError::class], 'string Nat');
    $hostRefused($api['produce_array'], [null], [TypeError::class], 'null Nat');
    $hostRefused(fn($digit, $word) => new Packet($digit, $word), [2, $n(3)], [TypeError::class], 'int digit');
    $hostRefused(fn($digit, $word) => new Packet($digit, $word), [$n(2), $n(-3)], [ValueError::class], 'negative word');
    if ($resultOnly) return compact('checks', 'rejections', 'hostRejections', 'recoveries', 'snapshots', 'snapshotControls', 'rounds');

    $p0 = $prefix . '0'; $p1 = $prefix . '1';
    $rejected = fn(string $path, string $constructor) => "$path was rejected by NestedCheckedRecords.$constructor";
    $fin = fn(string $path) => "$path.digit is not below its Fin 10 bound";
    $call('first', [$p(2, 3)], $n(3));
    $call('second', [$p(7, 0)], $n(8));
    $call('pair', [$p(2, 3), $p(7, 0)], $n(11));
    $call('in_array', [[$p(1, 2), $p(3, 5)]], $n(7));
    $call('in_array', [[]], $n(0));
    $call('in_list', [[$p(1, 0), $p(3, 100)]], $n(6));
    $call('in_list', [[]], $n(0));
    $call('in_option', [null], $n(0));
    $call('in_option', [new Some($p(1, 2))], $n(3));
    $call('in_product', [[$p(1, 2), $p(3, 0)]], $n(6));
    $call('in_except', [new Ok($p(2, 9))], $n(3));
    $call('in_except', [new Err($p(1, 2))], $n(3));
    $call('in_holder', [new Holder($p(3, 1), $n(9))], $n(13));
    $call('in_choice', [new ChoiceEmpty()], $n(0));
    $call('in_choice', [new ChoicePacket($p(2, 4))], $n(5));
    $call('echo_array', [[$p(2, 3), $p(1, $huge)]], [$p(2, 3), $p(1, $huge)]);
    $call('echo_array', [[]], []);

    // Exact late-field and constructor paths through every carrier.
    $refused('first', [$p(0, 0)], $rejected("$p0.word", 'mkWord'));
    $refused('first', [$p(4, 2)], $rejected($p0, 'mkPacket'));
    $refused('first', [$p(10, 12)], $fin($p0));
    $refused('pair', [$p(2, 3), $p(10, 0)], $fin($p1));
    $refused('in_array', [[$p(2, 3), $p(1, 0)]], $rejected("{$p0}[1].word", 'mkWord'));
    $refused('in_array', [[$p(2, 3), $p(5, 2)]], $rejected("{$p0}[1]", 'mkPacket'));
    $refused('in_array', [[$p(2, 3), $p(10, 12)]], $fin("{$p0}[1]"));
    $refused('in_option', [new Some($p(5, 2))], $rejected("$p0?", 'mkPacket'));
    $refused('in_product', [[$p(1, 2), $p(10, 0)]], $fin("$p0.1"));
    $refused('in_except', [new Ok($p(10, 0))], $fin("$p0.ok"));
    $refused('in_except', [new Err($p(3, 1))], $rejected("$p0.error", 'mkPacket'));
    $refused('in_holder', [new Holder($p(10, 0), $n(9))], $fin("$p0.packet"));
    $refused('in_choice', [new ChoicePacket($p(3, 1))], $rejected("$p0.packet.value", 'mkPacket'));

    // Malformed PHP values are host refusals, distinct from Lean rejections.
    $hostRefused($api['first'], [new Holder($p(2, 3), $n(1))], [TypeError::class], 'Holder as Packet');
    $hostRefused($api['in_array'], [$p(2, 3)], [TypeError::class], 'Packet as list');
    $hostRefused($api['in_array'], [[1 => $p(2, 3)]], [TypeError::class], 'non-list array');
    $hostRefused($api['in_array'], [[$p(2, 3), [$n(2), $n(3)]]], [TypeError::class], 'array as Packet element');
    $hostRefused($api['in_product'], [[$p(1, 2)]], [TypeError::class], 'one-element product');
    $hostRefused($api['in_option'], [$p(2, 3)], [TypeError::class], 'bare Packet as option');
    $hostRefused($api['in_option'], [new Some($n(1))], [TypeError::class], 'Some without Packet');
    $hostRefused($api['in_except'], [$p(2, 3)], [TypeError::class], 'bare Packet as result');
    $hostRefused(fn($packet, $tag) => new Holder($packet, $tag), [$p(2, 3), $n(-1)], [ValueError::class], 'negative tag');
    $hostRefused($api['in_choice'], [$p(2, 4)], [TypeError::class], 'Packet as Choice');

    // Rejection never poisons later calls: each refusal is followed by a success.
    for ($round = 0; $round < $rounds; ++$round) {
        $call('first', [$p($round % 10, $round + 10)], $n($round + 10));
        $refused('first', [$p(2, 1)], $rejected($p0, 'mkPacket'));
        $call('second', [$p($round % 10, 0)], $n($round % 10 + 1));
        $refused('in_array', [[$p($round % 10, $round + 10), $p(1, 0)]], $rejected("{$p0}[1].word", 'mkWord'));
        $call('in_array', [[$p($round % 10, $round + 10), $p(2, 3)]], $n($round + 13));
        ++$recoveries;
    }
    return compact('checks', 'rejections', 'hostRejections', 'recoveries', 'snapshots', 'snapshotControls', 'rounds');
}

if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    require 'vendor/autoload.php';
    $api = [];
    foreach (['first', 'second', 'pair', 'in_array', 'in_list', 'in_option', 'in_product', 'in_except',
        'in_holder', 'in_choice', 'echo_array', 'produce_option', 'produce_array'] as $name) {
        $qualified = 'LeanNestedcheckedrecords\\' . $name;
        if (function_exists($qualified)) $api[$name] = $qualified;
    }
    echo json_encode(check_nested_checked_records_php($api, NESTED_CHECKED_RECORD_RESULT_ONLY, NESTED_PARAMETER_PREFIX), JSON_THROW_ON_ERROR) . "\n";
}
