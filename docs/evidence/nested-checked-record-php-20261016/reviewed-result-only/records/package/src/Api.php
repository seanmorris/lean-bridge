<?php
declare(strict_types=1);
namespace LeanNestedcheckedrecords;


final class LeanBridgeError extends \RuntimeException {}

final readonly class Bytes implements \Stringable, \Countable
{
    private function __construct(private string $value) {}
    public static function fromString(mixed $value): self {
        if (!is_string($value)) throw new \TypeError('Bytes requires a string');
        return new self($value);
    }
    public function toString(): string { return $this->value; }
    public function __toString(): string { return $this->value; }
    public function count(): int { return strlen($this->value); }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}


/** @template T */
final readonly class Some
{
    /** @var T */
    public mixed $value;
    /** @param T $value */
    public function __construct(mixed $value) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('Some requires one payload');
        $this->value = $value;
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class Packet
{
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $digit;
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $word;
    public function __construct(mixed $digit, mixed $word) {
        if (func_num_args() !== 2) throw new \ArgumentCountError('Packet requires exactly 2 fields');
        $__lbBudget = new Internal\Budget();
        $this->digit = Internal\Checks::check0($digit, $__lbBudget);
        $this->word = Internal\Checks::check0($word, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

require_once __DIR__ . '/Internal/Native.php';

/**
 * Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @return list<Packet>
 */
function produce_array(mixed $value0): array {
    return Internal\Native::call0($value0);
}

/**
 * Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit < 10; result?.word projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @return Some<Packet>|null
 */
function produce_option(mixed $value0): Some|null {
    return Internal\Native::call1($value0);
}
