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
        $this->value = Internal\Checks::check2($value, $__lbBudget);
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
        $this->values = Internal\Checks::check8($values, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}
final readonly class GenericNat
{
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract nat
    */
    public \Brick\Math\BigInteger $value;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract nat
    */
    public \Brick\Math\BigInteger $marker;
    public function __construct(mixed $value, mixed $marker) {
        if (func_num_args() !== 2) throw new \ArgumentCountError('GenericNat requires exactly 2 fields');
        $__lbBudget = new Internal\Budget();
        $this->value = Internal\Checks::check0($value, $__lbBudget);
        $this->marker = Internal\Checks::check0($marker, $__lbBudget);
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
        $this->left = Internal\Checks::check4($left, $__lbBudget);
        $this->right = Internal\Checks::check4($right, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class Pair
{
    /** @var Envelope
     * @lean-bridge-contract Envelope
    */
    public Envelope $left;
    /** @var Envelope
     * @lean-bridge-contract Envelope
    */
    public Envelope $right;
    public function __construct(mixed $left, mixed $right) {
        if (func_num_args() !== 2) throw new \ArgumentCountError('Pair requires exactly 2 fields');
        $__lbBudget = new Internal\Budget();
        $this->left = Internal\Checks::check2($left, $__lbBudget);
        $this->right = Internal\Checks::check2($right, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

require_once __DIR__ . '/Internal/Native.php';

/**
 * Checked Lean Fin bounds: $arg0.value checked by NominalSubtypes.plusOne; result.value projects the Subtype base value.
 *
 * @param GenericNat $arg0
 * @lean-bridge-param GenericNat $arg0
 * @return GenericNat
 * @lean-bridge-return GenericNat
 */
function echo_generic_first(mixed $arg0): GenericNat {
    return Internal\Native::call0($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.value checked by NominalSubtypes.plusTwo; result.value projects the Subtype base value.
 *
 * @param GenericNat $arg0
 * @lean-bridge-param GenericNat $arg0
 * @return GenericNat
 * @lean-bridge-return GenericNat
 */
function echo_generic_second(mixed $arg0): GenericNat {
    return Internal\Native::call1($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.value checked by NominalSubtypes.plusOne.
 *
 * @param GenericNat $arg0
 * @lean-bridge-param GenericNat $arg0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function generic_use(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call2($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0[*]?.payload checked by NominalSubtypes.plusOne; $arg0[*]?.digit < 3; $arg1[*]?.payload checked by NominalSubtypes.plusTwo; $arg1[*]?.digit < 3.
 *
 * @param list<Some<Envelope>|null> $arg0
 * @lean-bridge-param array<option<EnvelopeAlias>> $arg0
 * @param list<Some<Envelope>|null> $arg1
 * @lean-bridge-param array<option<EnvelopeAlias>> $arg1
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function aliases(mixed $arg0, mixed $arg1): \Brick\Math\BigInteger {
    return Internal\Native::call3($arg0, $arg1);
}

/**
 * Checked Lean Fin bounds: result[*] projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return list<\Brick\Math\BigInteger>
 * @lean-bridge-return array<nat>
 */
function array_values(mixed $arg0): array {
    return Internal\Native::call4($arg0);
}

/**
 * Checked Lean Fin bounds: result.ok projects the Subtype base value; result.error projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return Ok<\Brick\Math\BigInteger>|Err<\Brick\Math\BigInteger>
 * @lean-bridge-return result<nat, nat>
 */
function branch(mixed $arg0): Ok|Err {
    return Internal\Native::call5($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.payload checked by NominalSubtypes.plusOne; $arg0.digit < 3; $arg1.payload checked by NominalSubtypes.plusTwo; $arg1.digit < 3.
 *
 * @param Envelope $arg0
 * @lean-bridge-param Envelope $arg0
 * @param Envelope $arg1
 * @lean-bridge-param Envelope $arg1
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function combine(mixed $arg0, mixed $arg1): \Brick\Math\BigInteger {
    return Internal\Native::call6($arg0, $arg1);
}

/**
 * Checked Lean Fin bounds: $arg0.payload checked by NominalSubtypes.plusOne; $arg0.digit < 3; result.payload projects the Subtype base value; result.digit < 3.
 *
 * @param Envelope $arg0
 * @lean-bridge-param Envelope $arg0
 * @return Envelope
 * @lean-bridge-return Envelope
 */
function echo_envelope(mixed $arg0): Envelope {
    return Internal\Native::call7($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.box.value.payload checked by NominalSubtypes.plusOne; $arg0.box.value.digit < 3; $arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; $arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo; result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param Event $arg0
 * @lean-bridge-param Event $arg0
 * @return Event
 * @lean-bridge-return Event
 */
function echo_event(mixed $arg0): Event {
    return Internal\Native::call8($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0[*]?.payload checked by NominalSubtypes.plusOne; $arg0[*]?.digit < 3; result[*]?.payload projects the Subtype base value; result[*]?.digit < 3.
 *
 * @param list<Some<Envelope>|null> $arg0
 * @lean-bridge-param array<option<EnvelopeAlias>> $arg0
 * @return list<Some<Envelope>|null>
 * @lean-bridge-return array<option<EnvelopeAlias>>
 */
function echo_groups(mixed $arg0): array {
    return Internal\Native::call9($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.left[*]?.payload checked by NominalSubtypes.plusOne; $arg0.left[*]?.digit < 3; $arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; $arg0.right[*]?.digit < 3; result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3.
 *
 * @param AliasPair $arg0
 * @lean-bridge-param AliasPair $arg0
 * @return AliasPair
 * @lean-bridge-return AliasPair
 */
function echo_pair(mixed $arg0): AliasPair {
    return Internal\Native::call10($arg0);
}

/**
 * Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return Event
 * @lean-bridge-return Event
 */
function event_choices(mixed $arg0): Event {
    return Internal\Native::call11($arg0);
}

/**
 * Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return Event
 * @lean-bridge-return Event
 */
function event_empty(mixed $arg0): Event {
    return Internal\Native::call12($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.box.value.payload checked by NominalSubtypes.plusOne; $arg0.box.value.digit < 3; $arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; $arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo.
 *
 * @param Event $arg0
 * @lean-bridge-param Event $arg0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function event_first(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call13($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.box.value.payload checked by NominalSubtypes.plusTwo; $arg0.box.value.digit < 3; $arg0.choices.values[*]?.ok checked by NominalSubtypes.plusTwo; $arg0.choices.values[*]?.error checked by NominalSubtypes.plusOne.
 *
 * @param Event $arg0
 * @lean-bridge-param Event $arg0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function event_second(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call14($arg0);
}

/**
 * Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return Event
 * @lean-bridge-return Event
 */
function event_value(mixed $arg0): Event {
    return Internal\Native::call15($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.payload checked by NominalSubtypes.plusOne; $arg0.digit < 3.
 *
 * @param Envelope $arg0
 * @lean-bridge-param Envelope $arg0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function first(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call16($arg0);
}

/**
 * Checked Lean Fin bounds: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return list<Some<Envelope>|null>
 * @lean-bridge-return array<option<EnvelopeAlias>>
 */
function group_values(mixed $arg0): array {
    return Internal\Native::call17($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.left[*]?.payload checked by NominalSubtypes.plusOne; $arg0.left[*]?.digit < 3; $arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; $arg0.right[*]?.digit < 3.
 *
 * @param AliasPair $arg0
 * @lean-bridge-param AliasPair $arg0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function inspect_alias_pair(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call18($arg0);
}

/**
 * Checked Lean Fin bounds: result[*] projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return list<\Brick\Math\BigInteger>
 * @lean-bridge-return list<nat>
 */
function list_values(mixed $arg0): array {
    return Internal\Native::call19($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.left.payload checked by NominalSubtypes.plusOne; $arg0.left.digit < 3; $arg0.right.payload checked by NominalSubtypes.plusTwo; $arg0.right.digit < 3.
 *
 * @param Pair $arg0
 * @lean-bridge-param Pair $arg0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function nested(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call20($arg0);
}

/**
 * Checked Lean Fin bounds: result[*] projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return list<\Brick\Math\BigInteger>
 * @lean-bridge-return array<nat>
 */
function no_items(mixed $arg0): array {
    return Internal\Native::call21($arg0);
}

/**
 * Checked Lean Fin bounds: result? projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return Some<\Brick\Math\BigInteger>|null
 * @lean-bridge-return option<nat>
 */
function optional(mixed $arg0): Some|null {
    return Internal\Native::call22($arg0);
}

/**
 * Checked Lean Fin bounds: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return AliasPair
 * @lean-bridge-return AliasPair
 */
function pair_values(mixed $arg0): AliasPair {
    return Internal\Native::call23($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0 < 3.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function plain_fin(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call24($arg0);
}

/**
 * Checked Lean Fin bounds: result.payload projects the Subtype base value; result.digit < 3.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return Envelope
 * @lean-bridge-return Envelope
 */
function produce_envelope(mixed $arg0): Envelope {
    return Internal\Native::call25($arg0);
}

/**
 * Checked Lean Fin bounds: result.0 projects the Subtype base value; result.1 projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return array{\Brick\Math\BigInteger, \Brick\Math\BigInteger}
 * @lean-bridge-return tuple<nat, nat>
 */
function product(mixed $arg0): array {
    return Internal\Native::call26($arg0);
}

/**
 * Checked Lean Fin bounds: result projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @lean-bridge-param nat $arg0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function scalar(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call27($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.payload checked by NominalSubtypes.plusTwo; $arg0.digit < 3.
 *
 * @param Envelope $arg0
 * @lean-bridge-param Envelope $arg0
 * @return \Brick\Math\BigInteger
 * @lean-bridge-return nat
 */
function second(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call28($arg0);
}
