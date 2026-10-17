<?php
declare(strict_types=1);
// Source-only caller controls with genuine generated public classes. No installed extension runs here.
require $argv[1];
require $argv[2];
require $argv[3];

use Brick\Math\BigInteger;
use LeanInheritedcheckedrecords\{Span, Ticket, Stamped, LeanBridgeError};

const INHERITED_CHECKED_RECORD_PHP_FAULTS = [
    'produce-offset', 'produce-stamped-mark', 'inputs-exported', 'accept-invalid',
    'wrong-diagnostic', 'normalize-bypass', 'echo-alias', 'wrong-host-exception',
];

/** Build an independent executable model of the documented inherited-record API. */
function inherited_checked_record_php_model(
    string $prefix,
    bool $resultOnly,
    ?string $fault = null
): array {
    if (!in_array($prefix, ['arg', 'value'], true)) {
        throw new InvalidArgumentException('Invalid model parameter prefix');
    }
    if ($fault !== null && !in_array($fault, INHERITED_CHECKED_RECORD_PHP_FAULTS, true)) {
        throw new InvalidArgumentException('Invalid model fault');
    }
    $n = fn(int|string|BigInteger $value): BigInteger => $value instanceof BigInteger
        ? $value : BigInteger::of($value);
    $reject = function (string $path, string $constructor) use ($fault): never {
        $message = "$path was rejected by InheritedCheckedRecords.$constructor";
        if ($fault === 'wrong-diagnostic') $message = 'wrong inherited-record diagnostic';
        throw new LeanBridgeError($message, 1);
    };
    $expect = function (mixed $value, string $class) use ($fault): object {
        if ($value instanceof $class) return $value;
        if ($fault === 'wrong-host-exception') {
            throw new RuntimeException('wrong host exception');
        }
        throw new TypeError('Expected ' . $class . ', got ' . get_debug_type($value));
    };
    $span = function (mixed $value, string $path, bool $normalize = false)
        use ($expect, $n, $reject): Span {
        /** @var Span $value */
        $value = $expect($value, Span::class);
        $lo = $n($value->lo); $hi = $n($value->hi);
        if ($normalize) return new Span($n(0), $lo->plus($hi));
        if ($lo->isGreaterThan($hi)) $reject($path, 'mkSpan');
        return new Span($lo, $hi);
    };
    $word = function (mixed $value, string $path, bool $normalize = false)
        use ($n, $reject): BigInteger {
        if (!$value instanceof BigInteger) throw new TypeError('Expected BigInteger');
        $value = $n($value);
        if ($normalize) return $value->plus(1);
        if ($value->isZero()) $reject($path, 'mkWord');
        return $value;
    };
    $ticket = function (
        mixed $value,
        string $path,
        bool $normalizeTicket = false,
        bool $normalizeSpan = false,
        bool $normalizeWord = false
    ) use ($expect, $span, $word, $reject): Ticket {
        /** @var Ticket $value */
        $value = $expect($value, Ticket::class);
        $parent = $span($value->toSpan, "$path.toSpan", $normalizeSpan);
        $payload = $word($value->word, "$path.word", $normalizeWord);
        if ($normalizeTicket) $payload = $parent->hi->plus(1);
        elseif ($parent->hi->isGreaterThan($payload)) $reject($path, 'mkTicket');
        return new Ticket($parent, $payload);
    };
    $produce = function (mixed $value) use ($expect, $fault, $n): Ticket {
        if (!$value instanceof BigInteger) {
            $expect($value, BigInteger::class);
        }
        /** @var BigInteger $value */
        $offset = $fault === 'produce-offset' ? 2 : 1;
        return new Ticket(new Span($value, $value), $value->plus($offset));
    };
    $produceStamped = function (mixed $value) use ($produce, $fault, $n): Stamped {
        $mark = $fault === 'produce-stamped-mark' ? $n(1) : $n(0);
        return new Stamped($produce($value), $mark);
    };
    $api = ['produce' => $produce, 'produce_stamped' => $produceStamped];
    if ($resultOnly) {
        if ($fault === 'inputs-exported') $api['first'] = fn(mixed $_value) => $n(0);
        return $api;
    }
    $api += [
        'first' => function (mixed $value) use ($ticket, $fault, $n): BigInteger {
            try { $value = $ticket($value, 'MODEL_PREFIX0'); }
            catch (LeanBridgeError $error) {
                if ($fault === 'accept-invalid') return $n(0);
                throw $error;
            }
            return $value->toSpan->lo->plus($value->toSpan->hi)->plus($value->word);
        },
        'normalized' => function (mixed $value) use ($ticket, $fault): BigInteger {
            $value = $fault === 'normalize-bypass'
                ? $ticket($value, 'MODEL_PREFIX0')
                : $ticket($value, 'MODEL_PREFIX0', true, true, true);
            return $value->toSpan->lo->plus($value->toSpan->hi)->plus($value->word);
        },
        'pair' => function (mixed $left, mixed $right) use ($ticket): BigInteger {
            $left = $ticket($left, 'MODEL_PREFIX0');
            $right = $ticket($right, 'MODEL_PREFIX1', true, true, true);
            return $left->word->plus($right->word);
        },
        'aliased' => function (mixed $value) use ($ticket): BigInteger {
            return $ticket($value, 'MODEL_PREFIX0', false, true, true)->word;
        },
        'nested' => function (mixed $value) use ($expect, $ticket, $reject, $n): BigInteger {
            /** @var Stamped $value */
            $value = $expect($value, Stamped::class);
            $child = $ticket($value->toTicket, 'MODEL_PREFIX0');
            $mark = $n($value->mark);
            if (!$mark->isLessThan(8)) {
                throw new LeanBridgeError('MODEL_PREFIX0.mark is not below its Fin 8 bound', 1);
            }
            if ($mark->isGreaterThan($child->word)) $reject('MODEL_PREFIX0', 'mkStamped');
            return $child->word->plus($mark);
        },
        'echo' => function (mixed $value) use ($ticket, $fault): Ticket {
            if ($fault === 'echo-alias') return $value;
            return $ticket($value, 'MODEL_PREFIX0', true, false, true);
        },
    ];
    return $api;
}

$prefix = $argv[4];
$mode = $argv[5];
$fault = $argv[6] ?? null;
if (!in_array($mode, ['full', 'result-only'], true)) {
    throw new InvalidArgumentException('Invalid model mode');
}
$replacePrefix = function (array $api) use ($prefix): array {
    $wrapped = [];
    foreach ($api as $name => $function) {
        $wrapped[$name] = function (...$arguments) use ($function, $prefix) {
            try { return $function(...$arguments); }
            catch (LeanBridgeError $error) {
                throw new LeanBridgeError(str_replace('MODEL_PREFIX', $prefix, $error->getMessage()), $error->getCode());
            }
        };
    }
    return $wrapped;
};
$result = check_inherited_checked_records_php(
    $replacePrefix(inherited_checked_record_php_model($prefix, $mode === 'result-only', $fault)),
    $mode === 'result-only',
    $prefix
);
echo json_encode($result, JSON_THROW_ON_ERROR) . "\n";
