<?php
declare(strict_types=1);

use Brick\Math\BigInteger;
use LeanInheritedcheckedrecords\{Span, Ticket, Stamped, LeanBridgeError};

const INHERITED_CHECKED_RECORD_RESULT_ONLY = true;
const INHERITED_PARAMETER_PREFIX = 'arg';

/** Preserve class identity, field names, array keys and arbitrary-size integers. */
function inherited_checked_record_snapshot(mixed $value): array {
    if ($value instanceof BigInteger) return ['bigint', (string) $value];
    if (is_array($value)) {
        $items = [];
        foreach ($value as $key => $item) {
            $items[] = [gettype($key), $key, inherited_checked_record_snapshot($item)];
        }
        return ['array', $items];
    }
    if (is_object($value)) {
        $items = [];
        foreach (get_object_vars($value) as $key => $item) {
            $items[] = [$key, inherited_checked_record_snapshot($item)];
        }
        return [get_class($value), $items];
    }
    if (is_int($value) || is_bool($value) || is_float($value)
        || is_string($value) || $value === null) {
        return [gettype($value), $value];
    }
    throw new RuntimeException('Unsupported inherited checked-record snapshot input: ' . get_debug_type($value));
}

/** Exercise every inherited constructor site without consulting generated metadata. */
function check_inherited_checked_records_php(
    array $api,
    bool $resultOnly,
    string $prefix,
    int $rounds = 256
): array {
    if ($rounds < 1 || $rounds > 1000) throw new InvalidArgumentException('Invalid recovery rounds');
    if (!in_array($prefix, ['arg', 'value'], true)) throw new InvalidArgumentException('Invalid parameter prefix');
    $checks = $rejections = $calls = $snapshots = $recoveries = 0;
    $check = function (bool $condition, string $label) use (&$checks): void {
        if (!$condition) throw new RuntimeException('failed: ' . $label);
        ++$checks;
    };
    $equal = function (mixed $actual, mixed $expected, string $label) use ($check): void {
        $check(inherited_checked_record_snapshot($actual)
            === inherited_checked_record_snapshot($expected), $label);
    };
    $outcome = function (callable $invoke, array $arguments): array {
        try { return [$invoke(...$arguments), null]; }
        catch (Throwable $error) { return [null, $error]; }
    };
    $invoke = function (string $name, array $arguments, mixed $expected, ?string $label = null)
        use ($api, $check, $equal, $outcome, &$calls, &$snapshots): mixed {
        $before = inherited_checked_record_snapshot($arguments);
        ++$calls;
        [$result, $error] = $outcome($api[$name], $arguments);
        if ($error !== null) {
            throw new RuntimeException('failed: ' . $name . ' unexpectedly threw '
                . get_class($error) . ': ' . $error->getMessage());
        }
        $equal($result, $expected, $label ?? $name);
        $check(inherited_checked_record_snapshot($arguments) === $before,
            ($label ?? $name) . ' preserved every input');
        ++$snapshots;
        return $result;
    };
    $refused = function (string $name, array $arguments, string $message)
        use ($api, $check, $outcome, &$calls, &$rejections, &$snapshots): void {
        $before = inherited_checked_record_snapshot($arguments);
        ++$calls;
        [, $error] = $outcome($api[$name], $arguments);
        if ($error === null) throw new RuntimeException('failed: accepted invalid input: ' . $message);
        $check(get_class($error) === LeanBridgeError::class
            && $error->getCode() === 1 && $error->getMessage() === $message,
            'exact refusal: ' . $message . '; got ' . get_class($error)
                . ' ' . $error->getCode() . ' ' . $error->getMessage());
        $check(inherited_checked_record_snapshot($arguments) === $before,
            $name . ' rejection preserved every input');
        ++$snapshots;
        ++$rejections;
    };
    // PHP type conversion rejects malformed public values before calling Lean.
    $hostRefused = function (string $name, array $arguments, string $label)
        use ($api, $check, $outcome, &$calls, &$rejections, &$snapshots): void {
        $before = inherited_checked_record_snapshot($arguments);
        ++$calls;
        [, $error] = $outcome($api[$name], $arguments);
        if ($error === null) throw new RuntimeException('failed: accepted malformed input: ' . $label);
        $check(get_class($error) === TypeError::class
            && !str_contains($error->getMessage(), 'was rejected by InheritedCheckedRecords.'),
            'host refusal: ' . $label . '; got ' . get_class($error) . ': ' . $error->getMessage());
        $check(inherited_checked_record_snapshot($arguments) === $before,
            $label . ' rejection preserved every input');
        ++$snapshots;
        ++$rejections;
    };

    $n = fn($value) => BigInteger::of($value);
    $span = fn($lo, $hi) => new Span($lo instanceof BigInteger ? $lo : $n($lo),
        $hi instanceof BigInteger ? $hi : $n($hi));
    $ticket = fn($lo, $hi, $word) => new Ticket($span($lo, $hi),
        $word instanceof BigInteger ? $word : $n($word));
    $stamped = fn($lo, $hi, $word, $mark) => new Stamped($ticket($lo, $hi, $word),
        $mark instanceof BigInteger ? $mark : $n($mark));
    $produced = fn(BigInteger $value) => $ticket($value, $value, $value->plus(1));
    $producedStamped = fn(BigInteger $value) => $stamped($value, $value, $value->plus(1), 0);
    $huge = $n(2)->power(100);

    foreach ([$n(0), $n(4), $huge] as $value) {
        $invoke('produce', [$value], $produced($value));
        $invoke('produce_stamped', [$value], $producedStamped($value));
    }
    if ($resultOnly) {
        foreach (['first', 'normalized', 'pair', 'aliased', 'nested', 'echo'] as $name) {
            $check(!array_key_exists($name, $api), 'result-only package omitted ' . $name);
        }
        for ($round = 0; $round < $rounds; ++$round) {
            $value = $huge->plus($round);
            $invoke('produce', [$value], $produced($value));
            $invoke('produce_stamped', [$value], $producedStamped($value));
        }
        return compact('checks', 'rejections', 'calls', 'snapshots', 'recoveries', 'rounds');
    }

    $p0 = $prefix . '0';
    $rejected = fn(string $path, string $constructor) =>
        "$path was rejected by InheritedCheckedRecords.$constructor";
    $first = $ticket(2, 3, 4);
    $rawRight = $ticket(4, 1, 999);
    $invoke('first', [$first], $n(9));
    $invoke('normalized', [$ticket(4, 1, 0)], $n(11));
    $invoke('pair', [$first, $rawRight], $n(10));
    $invoke('aliased', [$ticket(4, 1, 4)], $n(5));
    $invoke('nested', [$stamped(1, 2, 4, 3)], $n(7));
    $invoke('echo', [$ticket(1, 2, 0)], $ticket(1, 2, 3));
    $refused('first', [$ticket(4, 1, 5)], $rejected("$p0.toSpan", 'mkSpan'));
    $refused('first', [$ticket(1, 2, 0)], $rejected("$p0.word", 'mkWord'));
    $refused('first', [$ticket(1, 5, 3)], $rejected($p0, 'mkTicket'));
    $refused('nested', [$stamped(1, 2, 9, 8)], "$p0.mark is not below its Fin 8 bound");
    $refused('nested', [$stamped(1, 2, 4, 5)], $rejected($p0, 'mkStamped'));
    $refused('aliased', [$ticket(1, 5, 3)], $rejected($p0, 'mkTicket'));
    $refused('pair', [$ticket(4, 1, 5), $rawRight], $rejected("$p0.toSpan", 'mkSpan'));
    $refused('pair', [$ticket(1, 5, 3), $rawRight], $rejected($p0, 'mkTicket'));
    $hostRefused('first', [new stdClass()], 'unrelated object as Ticket');
    $hostRefused('first', [$span(1, 2)], 'Span as Ticket');
    $hostRefused('nested', [$ticket(1, 2, 4)], 'Ticket as Stamped');
    $equal($rawRight, $ticket(4, 1, 999), 'normalization never mutated reused input');

    for ($round = 0; $round < $rounds; ++$round) {
        $value = $n($round + 10);
        $valid = $ticket($value, $value->plus(1), $value->plus(2));
        $invoke('first', [$valid], $value->multipliedBy(3)->plus(3), 'round accepted');
        $invoke('normalized', [$ticket($value->plus(2), $value, 0)],
            $value->multipliedBy(4)->plus(5), 'round normalized');
        $invoke('pair', [$valid, $ticket($value->plus(2), $value, 0)],
            $value->multipliedBy(3)->plus(5), 'round repeated position');
        $invoke('aliased', [$ticket($value->plus(2), $value,
            $value->multipliedBy(2)->plus(1))],
            $value->multipliedBy(2)->plus(2), 'round alias');
        $mark = $n($round % 8);
        $invoke('nested', [$stamped($mark, $mark, $mark->plus(1), $mark)],
            $mark->multipliedBy(2)->plus(1), 'round nested');
        $refused('first', [$ticket($value->plus(1), $value, $value->plus(2))],
            $rejected("$p0.toSpan", 'mkSpan'));
        $refused('first', [$ticket(0, 1, 0)], $rejected("$p0.word", 'mkWord'));
        $refused('first', [$ticket(0, $value->plus(2), $value->plus(1))],
            $rejected($p0, 'mkTicket'));
        $refused('nested', [$stamped(0, 9, 9, 8)], "$p0.mark is not below its Fin 8 bound");
        $refused('nested', [$stamped(0, 6, 6, 7)], $rejected($p0, 'mkStamped'));
        $invoke('first', [$valid], $value->multipliedBy(3)->plus(3),
            'recovery after nested rejection');
        ++$recoveries;
    }
    $equal($rawRight, $ticket(4, 1, 999), 'all rounds preserved reused input');
    return compact('checks', 'rejections', 'calls', 'snapshots', 'recoveries', 'rounds');
}

if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    require 'vendor/autoload.php';
    // PHP reserves echo, so the generated function carries one trailing underscore.
    $api = [];
    foreach (['first', 'normalized', 'pair', 'aliased', 'nested', 'echo',
        'produce', 'produce_stamped'] as $name) {
        $qualified = 'LeanInheritedcheckedrecords\\' . ($name === 'echo' ? 'echo_' : $name);
        if (function_exists($qualified)) $api[$name] = $qualified;
    }
    echo json_encode(check_inherited_checked_records_php(
        $api,
        INHERITED_CHECKED_RECORD_RESULT_ONLY,
        INHERITED_PARAMETER_PREFIX
    ), JSON_THROW_ON_ERROR) . "\n";
}
