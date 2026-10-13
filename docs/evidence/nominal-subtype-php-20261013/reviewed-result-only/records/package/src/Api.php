<?php
declare(strict_types=1);
namespace LeanNominalsubtypes;

/**
 * Copied Lean aliases use the PHP target values, without wrapper classes.
 * EnvelopeAlias = Envelope; PHP: Envelope
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

/** @template T */
final readonly class Ok
{
    /** @var T */
    public mixed $value;
    /** @param T $value */
    public function __construct(mixed $value) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('Ok requires one payload');
        $this->value = $value;
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

/** @template T */
final readonly class Err
{
    /** @var T */
    public mixed $value;
    /** @param T $value */
    public function __construct(mixed $value) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('Err requires one payload');
        $this->value = $value;
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

abstract readonly class Event {}
final readonly class EventEmpty extends Event
{

    public function __construct() {
        if (func_num_args() !== 0) throw new \ArgumentCountError('EventEmpty requires exactly 0 payload fields');
        $__lbBudget = new Internal\Budget();

    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class EventBox extends Event
{
    /** @var Envelope */
    public Envelope $value;
    public function __construct(mixed $value) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('EventBox requires exactly 1 payload fields');
        $__lbBudget = new Internal\Budget();
        $this->value = Internal\Checks::check3($value, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class EventChoices extends Event
{
    /** @var list<Some<Ok<\Brick\Math\BigInteger>|Err<\Brick\Math\BigInteger>>|null> */
    public array $values;
    public function __construct(mixed $values) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('EventChoices requires exactly 1 payload fields');
        $__lbBudget = new Internal\Budget();
        $this->values = Internal\Checks::check5($values, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}
final readonly class Envelope
{
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract nat
    */
    public \Brick\Math\BigInteger $payload;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract nat
    */
    public \Brick\Math\BigInteger $digit;
    public function __construct(mixed $payload, mixed $digit) {
        if (func_num_args() !== 2) throw new \ArgumentCountError('Envelope requires exactly 2 fields');
        $__lbBudget = new Internal\Budget();
        $this->payload = Internal\Checks::check0($payload, $__lbBudget);
        $this->digit = Internal\Checks::check0($digit, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class AliasPair
{
    /** @var list<Some<Envelope>|null>
     * @lean-bridge-contract array<option<EnvelopeAlias>>
    */
    public array $left;
    /** @var list<Some<Envelope>|null>
     * @lean-bridge-contract array<option<EnvelopeAlias>>
    */
    public array $right;
    public function __construct(mixed $left, mixed $right) {
        if (func_num_args() !== 2) throw new \ArgumentCountError('AliasPair requires exactly 2 fields');
        $__lbBudget = new Internal\Budget();
        $this->left = Internal\Checks::check8($left, $__lbBudget);
        $this->right = Internal\Checks::check8($right, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

require_once __DIR__ . '/Internal/Native.php';

/**
 * Checked Lean Fin bounds: result[*] projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return list<\Brick\Math\BigInteger>
 * @lean-bridge-return array<nat>
 */
function array_values(mixed $value0): array {
    return Internal\Native::call0($value0);
}

/**
 * Checked Lean Fin bounds: result.ok projects the Subtype base value; result.error projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return Ok<\Brick\Math\BigInteger>|Err<\Brick\Math\BigInteger>
 * @lean-bridge-return result<nat, nat>
 */
function branch(mixed $value0): Ok|Err {
    return Internal\Native::call1($value0);
}

/**
 * Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return Event
 * @lean-bridge-return Event
 */
function event_choices(mixed $value0): Event {
    return Internal\Native::call2($value0);
}

/**
 * Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return Event
 * @lean-bridge-return Event
 */
function event_empty(mixed $value0): Event {
    return Internal\Native::call3($value0);
}

/**
 * Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return Event
 * @lean-bridge-return Event
 */
function event_value(mixed $value0): Event {
    return Internal\Native::call4($value0);
}

/**
 * Checked Lean Fin bounds: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return list<Some<Envelope>|null>
 * @lean-bridge-return array<option<EnvelopeAlias>>
 */
function group_values(mixed $value0): array {
    return Internal\Native::call5($value0);
}

/**
 * Checked Lean Fin bounds: result[*] projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return list<\Brick\Math\BigInteger>
 * @lean-bridge-return list<nat>
 */
function list_values(mixed $value0): array {
    return Internal\Native::call6($value0);
}

/**
 * Checked Lean Fin bounds: result[*] projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return list<\Brick\Math\BigInteger>
 * @lean-bridge-return array<nat>
 */
function no_items(mixed $value0): array {
    return Internal\Native::call7($value0);
}

/**
 * Checked Lean Fin bounds: result? projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return Some<\Brick\Math\BigInteger>|null
 * @lean-bridge-return option<nat>
 */
function optional(mixed $value0): Some|null {
    return Internal\Native::call8($value0);
}

/**
 * Checked Lean Fin bounds: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return AliasPair
 * @lean-bridge-return AliasPair
 */
function pair_values(mixed $value0): AliasPair {
    return Internal\Native::call9($value0);
}

/**
 * Checked Lean Fin bounds: result.payload projects the Subtype base value; result.digit < 3.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return Envelope
 * @lean-bridge-return Envelope
 */
function produce_envelope(mixed $value0): Envelope {
    return Internal\Native::call10($value0);
}

/**
 * Checked Lean Fin bounds: result.0 projects the Subtype base value; result.1 projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return array{\Brick\Math\BigInteger, \Brick\Math\BigInteger}
 * @lean-bridge-return tuple<nat, nat>
 */
function product(mixed $value0): array {
    return Internal\Native::call11($value0);
}

/**
 * Checked Lean Fin bounds: result projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @lean-bridge-param nat $value0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function scalar(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call12($value0);
}
