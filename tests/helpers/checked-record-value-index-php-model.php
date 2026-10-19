<?php
declare(strict_types=1);

namespace {
    if ($argc < 3 || $argc > 4) throw new \InvalidArgumentException('Expected caller, route and optional fault');
    $route = $argv[2];
    if (!in_array($route, ['ordinary-source', 'reviewed-ir', 'result-only-ordinary-source', 'result-only-reviewed-ir'], true)) {
        throw new \InvalidArgumentException('Unknown value-index route');
    }
    $GLOBALS['value_index_result_only'] = str_starts_with($route, 'result-only-');
    $GLOBALS['value_index_prefix'] = str_ends_with($route, 'reviewed-ir') ? 'value' : 'arg';
    $GLOBALS['value_index_fault'] = $argv[3] ?? null;
}

namespace Brick\Math {
    final class BigInteger implements \Stringable {
        private function __construct(public string $value) {}
        public static function of(mixed $value): self {
            if ($value instanceof self) return new self($value->value);
            if (is_int($value) || is_string($value)) {
                $text = (string)$value;
                if (preg_match('/^-?(?:0|[1-9][0-9]*)$/', $text) === 1) return new self($text);
            }
            throw new \TypeError('Expected exact integer');
        }
        public function __toString(): string { return $this->value; }
    }
}

namespace LeanCheckedrecordvalueindices {
    use Brick\Math\BigInteger;

    final class LeanBridgeError extends \RuntimeException {}
    final class On { public function __construct(public BigInteger $count) {} }
    final class Off { public function __construct(public BigInteger $count) {} }
    final class Ab { public function __construct(public BigInteger $size) {} }
    final class EmptyToken { public function __construct(public BigInteger $count) {} }
    final class UnicodeToken { public function __construct(public BigInteger $count) {} }
    final class EmptySized { public function __construct(public array $data) {} }
    final class ZeroToken { public function __construct(public BigInteger $count) {} }
    final class WideToken { public function __construct(public BigInteger $count) {} }

    function value_index_fault(): ?string { return $GLOBALS['value_index_fault']; }
    function value_index_prefix(): string { return $GLOBALS['value_index_prefix']; }
    function value_index_nat(mixed $value): BigInteger {
        if (!$value instanceof BigInteger) throw new \TypeError('Expected BigInteger Nat');
        if (str_starts_with((string)$value, '-')) throw new \ValueError('Negative Nat');
        return $value;
    }
    function value_index_error(string $constructor): void {
        $fault = value_index_fault();
        if ($fault === 'accept-invalid') return;
        $prefix = $fault === 'wrong-message' ? 'wrong' : value_index_prefix();
        throw new LeanBridgeError($prefix . '0 was rejected by CheckedRecordValueIndices.' . $constructor
            , $fault === 'wrong-status' ? 2 : 1);
    }
    function value_index_checked(mixed $value, string $class, string $field, callable $predicate, string $constructor): mixed {
        if (!$value instanceof $class) throw new \TypeError('Expected ' . $class);
        $candidate = $value->$field;
        if ($field === 'data') {
            if (!is_array($candidate)) throw new \TypeError('Expected Nat list');
            foreach ($candidate as $item) value_index_nat($item);
        } else $candidate = value_index_nat($candidate);
        if (!$predicate($candidate)) value_index_error($constructor);
        if (value_index_fault() === 'mutate-input' && $field !== 'data') $value->$field = BigInteger::of(999);
        return $candidate;
    }
    function value_index_produced(string $class, string $field, mixed $value): object {
        return new $class($value);
    }

    if (!$GLOBALS['value_index_result_only'] || value_index_fault() === 'inputs-exported') {
        function true_bool_index(mixed $value): BigInteger { return value_index_checked($value, On::class, 'count', static fn(BigInteger $n): bool => (string)$n === '0', 'mkOn'); }
        function false_bool_index(mixed $value): BigInteger { return value_index_checked($value, Off::class, 'count', static fn(BigInteger $n): bool => (string)$n === '1', 'mkOff'); }
        function ab_string_index(mixed $value): BigInteger { return value_index_checked($value, Ab::class, 'size', static fn(BigInteger $n): bool => (string)$n === '2', 'mkAb'); }
        function empty_string_index(mixed $value): BigInteger { return value_index_checked($value, EmptyToken::class, 'count', static fn(BigInteger $n): bool => true, 'mkEmptyToken'); }
        function unicode_string_index(mixed $value): BigInteger { return value_index_checked($value, UnicodeToken::class, 'count', static fn(BigInteger $n): bool => true, 'mkUnicodeToken'); }
        function empty_sized_index(mixed $value): BigInteger { return BigInteger::of(count(value_index_checked($value, EmptySized::class, 'data', static fn(array $data): bool => count($data) === 0, 'mkEmptySized'))); }
        function zero_nat_index(mixed $value): BigInteger { return value_index_checked($value, ZeroToken::class, 'count', static fn(BigInteger $n): bool => true, 'mkZeroToken'); }
        function wide_nat_index(mixed $value): BigInteger { return value_index_checked($value, WideToken::class, 'count', static fn(BigInteger $n): bool => true, 'mkWideToken'); }
    }
    function produce_true_bool(): On { return value_index_fault() === 'missing-producer' ? throw new \BadMethodCallException('missing producer') : new On(BigInteger::of(value_index_fault() === 'wrong-produced' ? 1 : 0)); }
    function produce_false_bool(): Off { return new Off(BigInteger::of(1)); }
    function produce_ab(): Ab { return new Ab(BigInteger::of(2)); }
    function produce_empty_string(mixed $value): EmptyToken { return new EmptyToken(value_index_nat($value)); }
    function produce_unicode_string(mixed $value): UnicodeToken { return new UnicodeToken(value_index_nat($value)); }
    function produce_empty_sized(): EmptySized { return new EmptySized([]); }
    function produce_zero_nat(mixed $value): ZeroToken { return new ZeroToken(value_index_nat($value)); }
    function produce_wide_nat(mixed $value): WideToken { return new WideToken(value_index_nat($value)); }
}

namespace {
    require $argv[1];
    $fault = $GLOBALS['value_index_fault'];
    try {
        $result = check_value_index_records($GLOBALS['value_index_result_only'], $GLOBALS['value_index_prefix']);
        echo json_encode($fault === null ? $result : ['fault' => $fault, 'accepted' => true], JSON_THROW_ON_ERROR) . "\n";
    } catch (\Throwable $error) {
		if ($fault === null) throw $error;
        echo json_encode(['fault' => $fault, 'rejected' => true], JSON_THROW_ON_ERROR) . "\n";
    }
}
