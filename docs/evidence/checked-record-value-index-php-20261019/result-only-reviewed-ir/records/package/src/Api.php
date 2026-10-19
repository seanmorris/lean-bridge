<?php
declare(strict_types=1);
namespace LeanCheckedrecordvalueindices;


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




final readonly class Ab
{
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $size;
    public function __construct(mixed $size) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('Ab requires exactly 1 fields');
        $__lbBudget = new Internal\Budget();
        $this->size = Internal\Checks::check0($size, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class EmptySized
{
    /** @var list<\Brick\Math\BigInteger> */
    public array $data;
    public function __construct(mixed $data) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('EmptySized requires exactly 1 fields');
        $__lbBudget = new Internal\Budget();
        $this->data = Internal\Checks::check2($data, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class EmptyToken
{
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $count;
    public function __construct(mixed $count) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('EmptyToken requires exactly 1 fields');
        $__lbBudget = new Internal\Budget();
        $this->count = Internal\Checks::check0($count, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class Off
{
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $count;
    public function __construct(mixed $count) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('Off requires exactly 1 fields');
        $__lbBudget = new Internal\Budget();
        $this->count = Internal\Checks::check0($count, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class On
{
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $count;
    public function __construct(mixed $count) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('On requires exactly 1 fields');
        $__lbBudget = new Internal\Budget();
        $this->count = Internal\Checks::check0($count, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class UnicodeToken
{
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $count;
    public function __construct(mixed $count) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('UnicodeToken requires exactly 1 fields');
        $__lbBudget = new Internal\Budget();
        $this->count = Internal\Checks::check0($count, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class WideToken
{
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $count;
    public function __construct(mixed $count) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('WideToken requires exactly 1 fields');
        $__lbBudget = new Internal\Budget();
        $this->count = Internal\Checks::check0($count, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class ZeroToken
{
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $count;
    public function __construct(mixed $count) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('ZeroToken requires exactly 1 fields');
        $__lbBudget = new Internal\Budget();
        $this->count = Internal\Checks::check0($count, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

require_once __DIR__ . '/Internal/Native.php';

/**
 * Checked Lean Fin bounds: result projects proof-backed record payload fields.
 *

 * @return Ab
 */
function produce_ab(): Ab {
    return Internal\Native::call0();
}

/**
 * Checked Lean Fin bounds: result projects proof-backed record payload fields.
 *

 * @return EmptySized
 */
function produce_empty_sized(): EmptySized {
    return Internal\Native::call1();
}

/**
 * Checked Lean Fin bounds: result projects proof-backed record payload fields.
 *
 * @param \Brick\Math\BigInteger $value0
 * @return EmptyToken
 */
function produce_empty_string(mixed $value0): EmptyToken {
    return Internal\Native::call2($value0);
}

/**
 * Checked Lean Fin bounds: result projects proof-backed record payload fields.
 *

 * @return Off
 */
function produce_false_bool(): Off {
    return Internal\Native::call3();
}

/**
 * Checked Lean Fin bounds: result projects proof-backed record payload fields.
 *

 * @return On
 */
function produce_true_bool(): On {
    return Internal\Native::call4();
}

/**
 * Checked Lean Fin bounds: result projects proof-backed record payload fields.
 *
 * @param \Brick\Math\BigInteger $value0
 * @return UnicodeToken
 */
function produce_unicode_string(mixed $value0): UnicodeToken {
    return Internal\Native::call5($value0);
}

/**
 * Checked Lean Fin bounds: result projects proof-backed record payload fields.
 *
 * @param \Brick\Math\BigInteger $value0
 * @return WideToken
 */
function produce_wide_nat(mixed $value0): WideToken {
    return Internal\Native::call6($value0);
}

/**
 * Checked Lean Fin bounds: result projects proof-backed record payload fields.
 *
 * @param \Brick\Math\BigInteger $value0
 * @return ZeroToken
 */
function produce_zero_nat(mixed $value0): ZeroToken {
    return Internal\Native::call7($value0);
}
