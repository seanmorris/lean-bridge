<?php
declare(strict_types=1);
namespace LeanDependentrecords;


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




final readonly class Dependent
{
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $bound;
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $below;
    public function __construct(mixed $bound, mixed $below) {
        if (func_num_args() !== 2) throw new \ArgumentCountError('Dependent requires exactly 2 fields');
        $__lbBudget = new Internal\Budget();
        $this->bound = Internal\Checks::check0($bound, $__lbBudget);
        $this->below = Internal\Checks::check0($below, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

require_once __DIR__ . '/Internal/Native.php';

/**
 * Checked Lean Fin bounds: result projects proof-backed record payload fields; result.below < result.bound.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @return Dependent
 */
function dependent_result(mixed $arg0): Dependent {
    return Internal\Native::call0($arg0);
}
