<?php
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanZeropayloadcheckedrecords\{LeanBridgeError, Mark, MarkBlank, MarkMarked, Marker, Some, Token, Witness};

function zero_payload_snapshot(mixed $value): mixed {
    if ($value instanceof BigInteger) return ['bigint', (string)$value];
    if (is_array($value)) return ['array', array_map(zero_payload_snapshot(...), $value)];
    if (is_object($value)) {
        $fields = get_object_vars($value);
        ksort($fields);
        return [get_class($value), array_map(zero_payload_snapshot(...), $fields)];
    }
    return [gettype($value), $value];
}

function check_zero_payload_records(bool $resultOnly = false, string $parameterPrefix = 'arg'): array {
    if (!in_array($parameterPrefix, ['arg', 'value'], true)) {
        throw new InvalidArgumentException('Invalid zero-payload caller options');
    }
    $checks = 0; $calls = 0; $rejections = 0; $recoveries = 0; $snapshots = 0;
    $check = static function (bool $condition, string $label) use (&$checks): void {
        if (!$condition) throw new RuntimeException('zero-payload assertion failed: ' . $label);
        ++$checks;
    };
    $n = static fn(mixed $value): BigInteger => BigInteger::of($value);
    $function = static fn(string $name): string => 'LeanZeropayloadcheckedrecords\\' . $name;
    $inputs = ['witness_count', 'absent_count', 'token_tag', 'marker_count', 'mark_count'];
    $results = ['produce_witness', 'produce_token', 'witnesses', 'maybe_witness', 'produce_marker', 'produce_mark'];
    foreach ($inputs as $name) $check(function_exists($function($name)) !== $resultOnly, 'input export selection: ' . $name);
    foreach ($results as $name) $check(function_exists($function($name)), 'result export selection: ' . $name);
    $invoke = static function (string $name, array $args, mixed $expected) use (&$calls, &$snapshots, $check, $function): mixed {
        $before = zero_payload_snapshot($args); ++$calls;
        $actual = $function($name)(...$args);
        $check(zero_payload_snapshot($actual) === zero_payload_snapshot($expected), $name . ' exact result');
        $check(zero_payload_snapshot($args) === $before, $name . ' preserves caller input');
        ++$snapshots;
        return $actual;
    };
    $refuse = static function (string $name, array $args, string $constructor, string $label) use (&$calls, &$rejections, &$snapshots, $check, $function, $parameterPrefix): void {
        $before = zero_payload_snapshot($args); ++$calls;
        $refused = false;
        try { $function($name)(...$args); }
        catch (LeanBridgeError $error) {
            $check($error->getCode() === 1 && str_starts_with($error->getMessage(), $parameterPrefix . '0 was rejected by ZeroPayloadCheckedRecords.' . $constructor), $label . ' checked-record refusal');
            $refused = true;
        }
        if (!$refused) throw new RuntimeException('Accepted refused zero-payload input: ' . $label);
        $check(zero_payload_snapshot($args) === $before, $label . ' preserves rejected input');
        ++$rejections; ++$snapshots;
    };
    // Malformed values are built inside the probe: the generated readonly classes
    // refuse some of them at construction, which is a host refusal as well.
    $hostRefuse = static function (string $name, callable $arguments, mixed $input, string $label) use (&$calls, &$rejections, &$snapshots, $check, $function): void {
        $before = zero_payload_snapshot($input); ++$calls;
        $refused = false;
        try { $function($name)(...$arguments()); }
        catch (TypeError|ValueError) { $check(true, $label . ' host refusal'); $refused = true; }
        if (!$refused) throw new RuntimeException('Accepted malformed zero-payload input: ' . $label);
        $check(zero_payload_snapshot($input) === $before, $label . ' preserves rejected input');
        ++$rejections; ++$snapshots;
    };
    $recover = static function () use ($invoke, &$recoveries, $n): void {
        $invoke('witness_count', [new Witness()], $n(1));
        ++$recoveries;
    };

    $check((new Witness())->equals(new Witness()) && !(new Witness())->equals(new Marker())
        && !(new Witness())->equals(new MarkBlank()) && !(new Witness())->equals(null),
        'empty carriers stay nominally distinct from each other and from null');
    $check(get_object_vars(new Witness()) === [] && get_object_vars(new Marker()) === []
        && array_keys(get_object_vars(new Token(null))) === ['tag'],
        'proof-only Witness and plain Marker carry no field, Token keeps its Unit field');
    $guarded = false;
    try { new Witness(1); } catch (ArgumentCountError) { $guarded = true; }
    $check($guarded, 'the nullary readonly carrier refuses a payload');

    $witness = $invoke('produce_witness', [], new Witness());
    $check($witness instanceof Witness && $witness->equals(new Witness()), 'proof-only Witness is a real empty value');
    $token = $invoke('produce_token', [], new Token(null));
    $check($token instanceof Token && $token->tag === null, 'Token retains its Unit payload');
    $values = $invoke('witnesses', [$n(3)], [new Witness(), new Witness(), new Witness()]);
    $check(is_array($values) && array_is_list($values) && count($values) === 3 && $values[0]->equals($values[2]),
        'Witness array retains its length');
    $invoke('witnesses', [$n(0)], []);
    $invoke('maybe_witness', [false], null);
    $some = $invoke('maybe_witness', [true], new Some(new Witness()));
    $check($some instanceof Some && $some->value->equals(new Witness()), 'present empty Witness remains Some');
    $marker = $invoke('produce_marker', [], new Marker());
    $check($marker instanceof Marker && get_class($marker) !== get_class($witness), 'plain Marker stays distinct from checked Witness');
    $blank = $invoke('produce_mark', [false], new MarkBlank());
    $marked = $invoke('produce_mark', [true], new MarkMarked(new Witness()));
    $check($blank instanceof MarkBlank && $blank instanceof Mark && $marked instanceof MarkMarked
        && $marked->witness->equals(new Witness()), 'both variant branches survive proof erasure');

    if (!$resultOnly) {
        $invoke('witness_count', [new Witness()], $n(1));
        $refuse('absent_count', [new Witness()], 'mkAbsent', 'refusing nullary constructor');
        $recover();
        $invoke('token_tag', [new Token(null)], null);
        $invoke('marker_count', [new Marker()], $n(0));
        $invoke('mark_count', [new MarkBlank()], $n(0));
        $invoke('mark_count', [new MarkMarked(new Witness())], $n(1));
        $hostRefuse('witness_count', static fn(): array => [null], null, 'null is not an empty carrier');
        $recover();
        $plainMarker = new Marker();
        $hostRefuse('witness_count', static fn(): array => [$plainMarker], $plainMarker, 'plain Marker is not a checked Witness');
        $recover();
        $checkedWitness = new Witness();
        $hostRefuse('marker_count', static fn(): array => [$checkedWitness], $checkedWitness, 'checked Witness is not a plain Marker');
        $recover();
        $hostRefuse('token_tag', static fn(): array => [new Token(0)], 0, 'Unit payload must be null');
        $recover();
        $hostRefuse('mark_count', static fn(): array => [new MarkMarked(null)], null, 'null nested Witness is not an empty carrier');
        $recover();
        $hostRefuse('mark_count', static fn(): array => [$checkedWitness], $checkedWitness, 'bare Witness is not a Mark constructor');
        $recover();
        $negative = $n(-1);
        $hostRefuse('witnesses', static fn(): array => [$negative], $negative, 'negative Witness count');
        $recover();
    }

    $actual = [$calls, $checks, $recoveries, $rejections, $snapshots];
    $expected = $resultOnly ? [9, 38, 0, 0, 9] : [30, 80, 8, 8, 30];
    $check($actual === $expected, 'exact caller totals ' . json_encode($actual) . ' != ' . json_encode($expected));
    return ['calls' => $calls, 'checks' => $checks, 'recoveries' => $recoveries
        , 'rejections' => $rejections, 'snapshots' => $snapshots];
}

    $observed = check_zero_payload_records(false, 'value');
    echo json_encode([...$observed, 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
