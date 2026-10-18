<?php
declare(strict_types=1);
namespace LeanInheritedcheckedrecords;

/**
 * Copied Lean aliases use the PHP target values, without wrapper classes.
 * TicketAlias = Ticket; PHP: Ticket
 */

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




final readonly class Span
{
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract nat
    */
    public \Brick\Math\BigInteger $lo;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract nat
    */
    public \Brick\Math\BigInteger $hi;
    public function __construct(mixed $lo, mixed $hi) {
        if (func_num_args() !== 2) throw new \ArgumentCountError('Span requires exactly 2 fields');
        $__lbBudget = new Internal\Budget();
        $this->lo = Internal\Checks::check0($lo, $__lbBudget);
        $this->hi = Internal\Checks::check0($hi, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class Ticket
{
    /** @var Span
     * @lean-bridge-contract Span
    */
    public Span $toSpan;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract nat
    */
    public \Brick\Math\BigInteger $word;
    public function __construct(mixed $toSpan, mixed $word) {
        if (func_num_args() !== 2) throw new \ArgumentCountError('Ticket requires exactly 2 fields');
        $__lbBudget = new Internal\Budget();
        $this->toSpan = Internal\Checks::check1($toSpan, $__lbBudget);
        $this->word = Internal\Checks::check0($word, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class Stamped
{
    /** @var Ticket
     * @lean-bridge-contract Ticket
    */
    public Ticket $toTicket;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract nat
    */
    public \Brick\Math\BigInteger $mark;
    public function __construct(mixed $toTicket, mixed $mark) {
        if (func_num_args() !== 2) throw new \ArgumentCountError('Stamped requires exactly 2 fields');
        $__lbBudget = new Internal\Budget();
        $this->toTicket = Internal\Checks::check2($toTicket, $__lbBudget);
        $this->mark = Internal\Checks::check0($mark, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

require_once __DIR__ . '/Internal/Native.php';

/**
 * Checked Lean Fin bounds: $value0 checked by InheritedCheckedRecords.mkTicket; $value0.toSpan checked by InheritedCheckedRecords.normalizeSpan; $value0.word checked by InheritedCheckedRecords.normalizeWord.
 *
 * @param Ticket $value0
 * @lean-bridge-param TicketAlias $value0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function aliased(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call0($value0);
}

/**
 * Checked Lean Fin bounds: $value0 checked by InheritedCheckedRecords.normalizeTicket; $value0.toSpan checked by InheritedCheckedRecords.mkSpan; $value0.word checked by InheritedCheckedRecords.normalizeWord; result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value.
 *
 * @param Ticket $value0
 * @lean-bridge-param Ticket $value0
 * @return Ticket
 * @lean-bridge-return Ticket
 */
function echo_(mixed $value0): Ticket {
    return Internal\Native::call1($value0);
}

/**
 * Checked Lean Fin bounds: $value0 checked by InheritedCheckedRecords.mkTicket; $value0.toSpan checked by InheritedCheckedRecords.mkSpan; $value0.word checked by InheritedCheckedRecords.mkWord.
 *
 * @param Ticket $value0
 * @lean-bridge-param Ticket $value0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function first(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call2($value0);
}

/**
 * Checked Lean Fin bounds: $value0 checked by InheritedCheckedRecords.mkStamped; $value0.toTicket checked by InheritedCheckedRecords.mkTicket; $value0.toTicket.toSpan checked by InheritedCheckedRecords.mkSpan; $value0.toTicket.word checked by InheritedCheckedRecords.mkWord; $value0.mark < 8.
 *
 * @param Stamped $value0
 * @lean-bridge-param Stamped $value0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function nested(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call3($value0);
}

/**
 * Checked Lean Fin bounds: $value0 checked by InheritedCheckedRecords.normalizeTicket; $value0.toSpan checked by InheritedCheckedRecords.normalizeSpan; $value0.word checked by InheritedCheckedRecords.normalizeWord.
 *
 * @param Ticket $value0
 * @lean-bridge-param Ticket $value0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function normalized(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call4($value0);
}

/**
 * Checked Lean Fin bounds: $value0 checked by InheritedCheckedRecords.mkTicket; $value0.toSpan checked by InheritedCheckedRecords.mkSpan; $value0.word checked by InheritedCheckedRecords.mkWord; $value1 checked by InheritedCheckedRecords.normalizeTicket; $value1.toSpan checked by InheritedCheckedRecords.normalizeSpan; $value1.word checked by InheritedCheckedRecords.normalizeWord.
 *
 * @param Ticket $value0
 * @lean-bridge-param Ticket $value0
 * @param Ticket $value1
 * @lean-bridge-param Ticket $value1
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function pair(mixed $value0, mixed $value1): \Brick\Math\BigInteger {
    return Internal\Native::call5($value0, $value1);
}

/**
 * Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return Ticket
 * @lean-bridge-return Ticket
 */
function produce(mixed $value0): Ticket {
    return Internal\Native::call6($value0);
}

/**
 * Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toTicket projects proof-backed record payload fields; result.toTicket.toSpan projects proof-backed record payload fields; result.toTicket.word projects the Subtype base value; result.mark < 8.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return Stamped
 * @lean-bridge-return Stamped
 */
function produce_stamped(mixed $value0): Stamped {
    return Internal\Native::call7($value0);
}
