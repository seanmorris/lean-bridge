<?php
declare(strict_types=1);
// Synthetic caller controls using genuine generated public classes. No installed package runs here.
require $argv[1];
require $argv[2];
require $argv[3];

use Brick\Math\BigInteger;
use LeanNestedcheckedrecords\{Some, Ok, Err, Packet, Holder, ChoiceEmpty, ChoicePacket, LeanBridgeError};
use LeanNestedcheckedrecords\Internal\{Budget, Checks};

const NESTED_RESULT_FAULTS = ['produce-offset', 'produce-array-length', 'produce-keyed-array',
    'produce-bare-packet', 'accept-int', 'wrong-host-exception', 'lean-host-message'];
const NESTED_RESULT_ONLY_FAULTS = ['inputs-exported'];
const NESTED_INPUT_FAULTS = ['missing-fin', 'fin-after-constructor', 'missing-normalization',
    'conflated-constructor', 'diagnostic-suffix', 'wrong-status', 'wrong-error-class', 'wrong-path',
    'wrong-choice', 'except-swapped', 'holder-tag', 'echo-normalizes', 'echo-swapped-fields', 'list-as-array'];

function nested_checked_record_php_model(string $prefix, bool $resultOnly, array $checks, ?string $fault = null): array {
    $n = fn($value) => BigInteger::of($value);
    // Host validation is the generated package's own; faults replace or bypass it explicitly.
    $host = function (string $name, array $args) use ($checks, $fault, $prefix): void {
        $budget = new Budget();
        try {
            foreach ($args as $index => $value) {
                if ($fault === 'accept-int' && is_int($value)) continue;
                (Checks::class . '::check' . $checks[$name][$index])($value, $budget);
            }
        } catch (TypeError | ValueError $error) {
            if ($fault === 'wrong-host-exception') throw new RuntimeException($error->getMessage());
            if ($fault === 'lean-host-message') throw new TypeError("{$prefix}0 was rejected by NestedCheckedRecords.mkPacket");
            throw $error;
        }
    };
    $reject = function (string $message) use ($fault): never {
        $message .= $fault === 'diagnostic-suffix' ? '.' : '';
        if ($fault === 'wrong-error-class') throw new RuntimeException($message, 1);
        throw new LeanBridgeError($message, $fault === 'wrong-status' ? 2 : 1);
    };
    // Fin 10 digit, then the word constructor, then the packet constructor.
    $accept = function (Packet $value, string $path, string $packetChoice, string $wordChoice) use ($fault, $reject): BigInteger {
        $digit = $value->digit; $word = $value->word;
        $digitOk = $digit->isLessThan(10);
        if (!in_array($fault, ['missing-fin', 'fin-after-constructor'], true) && !$digitOk) $reject("$path.digit is not below its Fin 10 bound");
        if ($fault === 'missing-normalization') $wordChoice = 'mk';
        if ($wordChoice === 'mk' && $word->isZero()) $reject("$path.word was rejected by NestedCheckedRecords.mkWord");
        if ($wordChoice === 'normalize') $word = $word->plus(1);
        if ($fault === 'fin-after-constructor' && !$digitOk) $reject("$path.digit is not below its Fin 10 bound");
        if ($fault === 'conflated-constructor') $packetChoice = 'mk';
        if ($packetChoice === 'mk' && $digit->isGreaterThan($word)) $reject("$path was rejected by NestedCheckedRecords.mkPacket");
        return $packetChoice === 'normalize' ? $digit->plus(1) : $word;
    };
    $total = function (array $values, string $packetChoice, string $wordChoice) use ($accept, $fault, $prefix, $n): BigInteger {
        $sum = $n(0);
        foreach ($values as $index => $value)
            $sum = $sum->plus($accept($value, $fault === 'wrong-path' ? "{$prefix}0.$index" : "{$prefix}0[$index]", $packetChoice, $wordChoice));
        return $sum;
    };
    $produced = fn(BigInteger $value, int $offset) => new Packet($n(0), $value->plus($offset + ($fault === 'produce-offset' ? 1 : 0)));
    $api = [
        'produce_option' => function ($value) use ($host, $produced, $fault, $n) {
            $host('produce_option', [$value]);
            $item = $produced(is_int($value) ? $n($value) : $value, 1);
            return $fault === 'produce-bare-packet' ? $item : new Some($item);
        },
        'produce_array' => function ($value) use ($host, $produced, $fault, $n) {
            $host('produce_array', [$value]);
            $value = is_int($value) ? $n($value) : $value;
            $items = [$produced($value, 1), $produced($value, 2)];
            if ($fault === 'produce-array-length') array_pop($items);
            return $fault === 'produce-keyed-array' ? [1 => $items[0], 2 => $items[1]] : $items;
        },
    ];
    if ($resultOnly && $fault !== 'inputs-exported') return $api;

    $checked = function (string $name, callable $function) use ($host): callable {
        return function (...$args) use ($name, $function, $host) {
            $host($name, $args);
            return $function(...$args);
        };
    };
    $api += [
        'first' => $checked('first', fn($value) => $accept($value, "{$prefix}0", 'mk', 'mk')),
        'second' => $checked('second', fn($value) => $accept($value, "{$prefix}0", 'normalize', 'normalize')),
        'pair' => $checked('pair', fn($left, $right) => $accept($left, "{$prefix}0", 'mk', 'mk')->plus($accept($right, "{$prefix}1", 'normalize', 'normalize'))),
        'in_array' => $checked('in_array', fn($values) => $total($values, 'mk', 'mk')),
        'in_list' => $checked('in_list', fn($values) => $fault === 'list-as-array' ? $total($values, 'mk', 'mk') : $total($values, 'normalize', 'normalize')),
        'in_option' => $checked('in_option', fn($value) => $value === null ? $n(0) : $accept($value->value, "{$prefix}0?", 'mk', 'normalize')),
        'in_product' => $checked('in_product', fn($value) => $accept($value[0], "{$prefix}0.0", 'mk', 'mk')->plus($accept($value[1], "{$prefix}0.1", 'normalize', 'normalize'))),
        'in_except' => $checked('in_except', function ($value) use ($accept, $fault, $prefix) {
            $success = ($value instanceof Ok) !== ($fault === 'except-swapped');
            return $success ? $accept($value->value, "{$prefix}0.ok", 'normalize', 'mk') : $accept($value->value, "{$prefix}0.error", 'mk', 'normalize');
        }),
        'in_holder' => $checked('in_holder', function ($value) use ($accept, $fault, $prefix) {
            $word = $accept($value->packet, "{$prefix}0.packet", 'normalize', 'mk');
            return $fault === 'holder-tag' ? $word : $word->plus($value->tag);
        }),
        'in_choice' => $checked('in_choice', fn($value) => $value instanceof ChoiceEmpty
            ? $n($fault === 'wrong-choice' ? 1 : 0)
            : $accept($value->value, "{$prefix}0.packet.value", 'mk', 'normalize')),
        'echo_array' => $checked('echo_array', function ($values) use ($total, $fault, $n) {
            $total($values, 'mk', 'mk');
            $items = array_map(fn($item) => $fault === 'echo-swapped-fields' ? new Packet($item->word, $item->digit) : $item, $values);
            if ($fault === 'echo-normalizes' && $items !== []) $items[0] = new Packet($items[0]->digit, $n(1));
            return $items;
        }),
    ];
    return $api;
}

$prefix = $argv[4]; $mode = $argv[5];
if (!in_array($prefix, ['arg', 'value'], true) || !in_array($mode, ['full', 'result-only'], true)) throw new InvalidArgumentException('Invalid model selection');
$checks = json_decode(file_get_contents($argv[6]), true, flags: JSON_THROW_ON_ERROR);
$resultOnly = $mode === 'result-only';
$result = check_nested_checked_records_php(nested_checked_record_php_model($prefix, $resultOnly, $checks), $resultOnly, $prefix);
$rejected = [];
foreach (array_merge(NESTED_RESULT_FAULTS, $resultOnly ? NESTED_RESULT_ONLY_FAULTS : NESTED_INPUT_FAULTS) as $fault) {
    try {
        check_nested_checked_records_php(nested_checked_record_php_model($prefix, $resultOnly, $checks, $fault), $resultOnly, $prefix, 2);
    } catch (RuntimeException $error) {
        if (!str_starts_with($error->getMessage(), 'failed: ')) throw new RuntimeException("Wrong failure for $fault: " . $error->getMessage());
        $rejected[] = $fault;
        continue;
    }
    throw new RuntimeException("Caller accepted $mode fault: $fault");
}
echo json_encode(['counts' => $result, 'rejectedFaults' => $rejected, 'installedAcceptance' => false], JSON_THROW_ON_ERROR) . "\n";
