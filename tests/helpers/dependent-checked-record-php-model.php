<?php
declare(strict_types=1);

namespace {
    if ($argc < 3 || $argc > 4) throw new \InvalidArgumentException('Expected caller, route and optional fault');
    $route = $argv[2];
    if (!in_array($route, ['ordinary-source', 'reviewed-ir', 'result-only-ordinary-source', 'result-only-reviewed-ir'], true)) {
        throw new \InvalidArgumentException('Unknown dependent checked-record route');
    }
    $GLOBALS['dependent_result_only'] = str_starts_with($route, 'result-only-');
    $GLOBALS['dependent_prefix'] = str_ends_with($route, 'reviewed-ir') ? 'value' : 'arg';
    $GLOBALS['dependent_fault'] = $argv[3] ?? null;
}

namespace Brick\Math {
    // Exact decimal big integers: the oracle must carry 2^130 without a native extension.
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
        public static function one(): self { return new self('1'); }
        public function isNegative(): bool { return str_starts_with($this->value, '-'); }
        public function compareTo(self $other): int {
            if ($this->isNegative() || $other->isNegative()) throw new \LogicException('Oracle compares naturals only');
            $left = $this->value; $right = $other->value;
            if (strlen($left) !== strlen($right)) return strlen($left) <=> strlen($right);
            return strcmp($left, $right) <=> 0;
        }
        public function plus(mixed $other): self {
            $other = self::of($other);
            if ($this->isNegative() || $other->isNegative()) throw new \LogicException('Oracle adds naturals only');
            return new self(self::addDecimal($this->value, $other->value));
        }
        public function minus(mixed $other): self {
            $other = self::of($other);
            if ($this->compareTo($other) < 0) throw new \LogicException('Oracle subtracts within naturals only');
            return new self(self::subtractDecimal($this->value, $other->value));
        }
        public function shiftedLeft(int $bits): self {
            $value = $this;
            for ($index = 0; $index < $bits; ++$index) $value = $value->plus($value);
            return $value;
        }
        private static function addDecimal(string $left, string $right): string {
            $result = ''; $carry = 0; $i = strlen($left) - 1; $j = strlen($right) - 1;
            while ($i >= 0 || $j >= 0 || $carry) {
                $sum = $carry + ($i >= 0 ? (int)$left[$i--] : 0) + ($j >= 0 ? (int)$right[$j--] : 0);
                $result = (string)($sum % 10) . $result; $carry = intdiv($sum, 10);
            }
            return $result;
        }
        private static function subtractDecimal(string $left, string $right): string {
            $result = ''; $borrow = 0; $i = strlen($left) - 1; $j = strlen($right) - 1;
            while ($i >= 0) {
                $difference = (int)$left[$i--] - $borrow - ($j >= 0 ? (int)$right[$j--] : 0);
                $borrow = $difference < 0 ? 1 : 0;
                $result = (string)($difference + 10 * $borrow) . $result;
            }
            $result = ltrim($result, '0');
            return $result === '' ? '0' : $result;
        }
        public function __toString(): string { return $this->value; }
    }
}

namespace LeanDependentrecords {
    use Brick\Math\BigInteger;

    final class LeanBridgeError extends \RuntimeException {}
    // The generated readonly class guards its arity and validates both naturals
    // at construction; the oracle mirrors that, but stays mutable so a faulty
    // host can be modelled as changing a rejected input.
    final class Dependent {
        public BigInteger $bound;
        public BigInteger $below;
        public function __construct(mixed $bound, mixed $below) {
            if (func_num_args() !== 2) throw new \ArgumentCountError('Dependent requires exactly 2 fields');
            $this->bound = dependent_nat($bound);
            $this->below = dependent_nat($below);
        }
        public function equals(mixed $other): bool {
            return $other instanceof self && (string)$other->bound === (string)$this->bound
                && (string)$other->below === (string)$this->below;
        }
    }

    function dependent_fault(): ?string { return $GLOBALS['dependent_fault']; }
    function dependent_prefix(): string { return $GLOBALS['dependent_prefix']; }
    function dependent_nat(mixed $value): BigInteger {
        if (!$value instanceof BigInteger) throw new \TypeError('Expected Brick Math BigInteger');
        if ($value->isNegative()) throw new \ValueError('Expected an unsigned integer');
        return $value;
    }
    /** The checked constructor: Lean refuses the payload unless below < bound. */
    function dependent_checked(mixed $value): array {
        if (!$value instanceof Dependent) throw new \TypeError('Expected Dependent');
        $bound = dependent_nat($value->bound); $below = dependent_nat($value->below);
        $fault = dependent_fault();
        if ($below->compareTo($bound) >= 0 && $fault !== 'accept-invalid') {
            if ($fault === 'mutate-input') $value->below = $below->plus(1);
            $prefix = $fault === 'wrong-message' ? 'wrong' : dependent_prefix();
            throw new LeanBridgeError($prefix . '0 was rejected by DependentRecords.mkDependent', $fault === 'wrong-status' ? 2 : 1);
        }
        return [$bound, $below];
    }

    if (!$GLOBALS['dependent_result_only'] || dependent_fault() === 'inputs-exported') {
        function dependent_total(mixed $value): BigInteger {
            [$bound, $below] = dependent_checked($value);
            return $bound->plus($below);
        }
        function dependent_roundtrip(mixed $value): Dependent {
            dependent_checked($value);
            return dependent_fault() === 'wrong-roundtrip' ? new Dependent($value->bound->plus(1), $value->below) : $value;
        }
    }
    if (dependent_fault() !== 'missing-producer') {
        function dependent_result(mixed $seed): Dependent {
            $seed = dependent_nat($seed);
            return new Dependent($seed->plus(dependent_fault() === 'wrong-produced' ? 2 : 1), $seed);
        }
    }
}

namespace {
    require $argv[1];
    $resultOnly = $GLOBALS['dependent_result_only'];
    $prefix = $GLOBALS['dependent_prefix'];
    if ($GLOBALS['dependent_fault'] === null) {
        echo json_encode(check_dependent_records($resultOnly, $prefix), JSON_THROW_ON_ERROR) . "\n";
    } else {
        $rejected = false;
        try { check_dependent_records($resultOnly, $prefix); }
        catch (\RuntimeException|\Error) { $rejected = true; }
        echo json_encode(['fault' => $GLOBALS['dependent_fault'], 'rejected' => $rejected], JSON_THROW_ON_ERROR) . "\n";
    }
}
