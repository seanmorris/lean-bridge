<?php
declare(strict_types=1);
namespace LeanNominalprimitivesubtypes;

/**
 * Copied Lean aliases use the PHP target values, without wrapper classes.
 * PacketAlias = Packet; PHP: Packet
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
    /** @var Packet */
    public Packet $value;
    public function __construct(mixed $value) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('EventBox requires exactly 1 payload fields');
        $__lbBudget = new Internal\Budget();
        $this->value = Internal\Checks::check20($value, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class EventChoices extends Event
{
    /** @var list<Some<Ok<Packet>|Err<Packet>>|null> */
    public array $values;
    public function __construct(mixed $values) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('EventChoices requires exactly 1 payload fields');
        $__lbBudget = new Internal\Budget();
        $this->values = Internal\Checks::check24($values, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}
final readonly class RawPacket
{
    /** @var null
     * @lean-bridge-contract unit
    */
    public null $unitValue;
    /** @var bool
     * @lean-bridge-contract bool
    */
    public bool $boolValue;
    /** @var int
     * @lean-bridge-contract uint8
    */
    public int $uint8Value;
    /** @var int
     * @lean-bridge-contract uint16
    */
    public int $uint16Value;
    /** @var int
     * @lean-bridge-contract uint32
    */
    public int $uint32Value;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract uint64
    */
    public \Brick\Math\BigInteger $uint64Value;
    /** @var int
     * @lean-bridge-contract int8
    */
    public int $int8Value;
    /** @var int
     * @lean-bridge-contract int16
    */
    public int $int16Value;
    /** @var int
     * @lean-bridge-contract int32
    */
    public int $int32Value;
    /** @var int
     * @lean-bridge-contract int64
    */
    public int $int64Value;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract nat
    */
    public \Brick\Math\BigInteger $natValue;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract int
    */
    public \Brick\Math\BigInteger $intValue;
    /** @var float
     * @lean-bridge-contract float32
    */
    public float $float32Value;
    /** @var float
     * @lean-bridge-contract float64
    */
    public float $float64Value;
    /** @var string
     * @lean-bridge-contract string
    */
    public string $textValue;
    /** @var Bytes
     * @lean-bridge-contract bytes
    */
    public Bytes $bytesValue;
    /** @var string
     * @lean-bridge-contract char
    */
    public string $charValue;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract usize
    */
    public \Brick\Math\BigInteger $usizeValue;
    /** @var int
     * @lean-bridge-contract isize
    */
    public int $isizeValue;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract nat
    */
    public \Brick\Math\BigInteger $digit;
    public function __construct(mixed $unitValue, mixed $boolValue, mixed $uint8Value, mixed $uint16Value, mixed $uint32Value, mixed $uint64Value, mixed $int8Value, mixed $int16Value, mixed $int32Value, mixed $int64Value, mixed $natValue, mixed $intValue, mixed $float32Value, mixed $float64Value, mixed $textValue, mixed $bytesValue, mixed $charValue, mixed $usizeValue, mixed $isizeValue, mixed $digit) {
        if (func_num_args() !== 20) throw new \ArgumentCountError('RawPacket requires exactly 20 fields');
        $__lbBudget = new Internal\Budget();
        $this->unitValue = Internal\Checks::check0($unitValue, $__lbBudget);
        $this->boolValue = Internal\Checks::check1($boolValue, $__lbBudget);
        $this->uint8Value = Internal\Checks::check2($uint8Value, $__lbBudget);
        $this->uint16Value = Internal\Checks::check3($uint16Value, $__lbBudget);
        $this->uint32Value = Internal\Checks::check4($uint32Value, $__lbBudget);
        $this->uint64Value = Internal\Checks::check5($uint64Value, $__lbBudget);
        $this->int8Value = Internal\Checks::check6($int8Value, $__lbBudget);
        $this->int16Value = Internal\Checks::check7($int16Value, $__lbBudget);
        $this->int32Value = Internal\Checks::check8($int32Value, $__lbBudget);
        $this->int64Value = Internal\Checks::check9($int64Value, $__lbBudget);
        $this->natValue = Internal\Checks::check10($natValue, $__lbBudget);
        $this->intValue = Internal\Checks::check11($intValue, $__lbBudget);
        $this->float32Value = Internal\Checks::check12($float32Value, $__lbBudget);
        $this->float64Value = Internal\Checks::check13($float64Value, $__lbBudget);
        $this->textValue = Internal\Checks::check14($textValue, $__lbBudget);
        $this->bytesValue = Internal\Checks::check15($bytesValue, $__lbBudget);
        $this->charValue = Internal\Checks::check16($charValue, $__lbBudget);
        $this->usizeValue = Internal\Checks::check17($usizeValue, $__lbBudget);
        $this->isizeValue = Internal\Checks::check18($isizeValue, $__lbBudget);
        $this->digit = Internal\Checks::check10($digit, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class Packet
{
    /** @var null
     * @lean-bridge-contract unit
    */
    public null $unitValue;
    /** @var bool
     * @lean-bridge-contract bool
    */
    public bool $boolValue;
    /** @var int
     * @lean-bridge-contract uint8
    */
    public int $uint8Value;
    /** @var int
     * @lean-bridge-contract uint16
    */
    public int $uint16Value;
    /** @var int
     * @lean-bridge-contract uint32
    */
    public int $uint32Value;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract uint64
    */
    public \Brick\Math\BigInteger $uint64Value;
    /** @var int
     * @lean-bridge-contract int8
    */
    public int $int8Value;
    /** @var int
     * @lean-bridge-contract int16
    */
    public int $int16Value;
    /** @var int
     * @lean-bridge-contract int32
    */
    public int $int32Value;
    /** @var int
     * @lean-bridge-contract int64
    */
    public int $int64Value;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract nat
    */
    public \Brick\Math\BigInteger $natValue;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract int
    */
    public \Brick\Math\BigInteger $intValue;
    /** @var float
     * @lean-bridge-contract float32
    */
    public float $float32Value;
    /** @var float
     * @lean-bridge-contract float64
    */
    public float $float64Value;
    /** @var string
     * @lean-bridge-contract string
    */
    public string $textValue;
    /** @var Bytes
     * @lean-bridge-contract bytes
    */
    public Bytes $bytesValue;
    /** @var string
     * @lean-bridge-contract char
    */
    public string $charValue;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract usize
    */
    public \Brick\Math\BigInteger $usizeValue;
    /** @var int
     * @lean-bridge-contract isize
    */
    public int $isizeValue;
    /** @var \Brick\Math\BigInteger
     * @lean-bridge-contract nat
    */
    public \Brick\Math\BigInteger $digit;
    public function __construct(mixed $unitValue, mixed $boolValue, mixed $uint8Value, mixed $uint16Value, mixed $uint32Value, mixed $uint64Value, mixed $int8Value, mixed $int16Value, mixed $int32Value, mixed $int64Value, mixed $natValue, mixed $intValue, mixed $float32Value, mixed $float64Value, mixed $textValue, mixed $bytesValue, mixed $charValue, mixed $usizeValue, mixed $isizeValue, mixed $digit) {
        if (func_num_args() !== 20) throw new \ArgumentCountError('Packet requires exactly 20 fields');
        $__lbBudget = new Internal\Budget();
        $this->unitValue = Internal\Checks::check0($unitValue, $__lbBudget);
        $this->boolValue = Internal\Checks::check1($boolValue, $__lbBudget);
        $this->uint8Value = Internal\Checks::check2($uint8Value, $__lbBudget);
        $this->uint16Value = Internal\Checks::check3($uint16Value, $__lbBudget);
        $this->uint32Value = Internal\Checks::check4($uint32Value, $__lbBudget);
        $this->uint64Value = Internal\Checks::check5($uint64Value, $__lbBudget);
        $this->int8Value = Internal\Checks::check6($int8Value, $__lbBudget);
        $this->int16Value = Internal\Checks::check7($int16Value, $__lbBudget);
        $this->int32Value = Internal\Checks::check8($int32Value, $__lbBudget);
        $this->int64Value = Internal\Checks::check9($int64Value, $__lbBudget);
        $this->natValue = Internal\Checks::check10($natValue, $__lbBudget);
        $this->intValue = Internal\Checks::check11($intValue, $__lbBudget);
        $this->float32Value = Internal\Checks::check12($float32Value, $__lbBudget);
        $this->float64Value = Internal\Checks::check13($float64Value, $__lbBudget);
        $this->textValue = Internal\Checks::check14($textValue, $__lbBudget);
        $this->bytesValue = Internal\Checks::check15($bytesValue, $__lbBudget);
        $this->charValue = Internal\Checks::check16($charValue, $__lbBudget);
        $this->usizeValue = Internal\Checks::check17($usizeValue, $__lbBudget);
        $this->isizeValue = Internal\Checks::check18($isizeValue, $__lbBudget);
        $this->digit = Internal\Checks::check10($digit, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class Pair
{
    /** @var list<Some<Packet>|null>
     * @lean-bridge-contract array<option<PacketAlias>>
    */
    public array $left;
    /** @var list<Some<Packet>|null>
     * @lean-bridge-contract array<option<PacketAlias>>
    */
    public array $right;
    public function __construct(mixed $left, mixed $right) {
        if (func_num_args() !== 2) throw new \ArgumentCountError('Pair requires exactly 2 fields');
        $__lbBudget = new Internal\Budget();
        $this->left = Internal\Checks::check26($left, $__lbBudget);
        $this->right = Internal\Checks::check26($right, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

require_once __DIR__ . '/Internal/Native.php';

/**
 * Checked Lean Fin bounds: result?.unitValue projects the Subtype base value; result?.boolValue projects the Subtype base value; result?.uint8Value projects the Subtype base value; result?.uint16Value projects the Subtype base value; result?.uint32Value projects the Subtype base value; result?.uint64Value projects the Subtype base value; result?.int8Value projects the Subtype base value; result?.int16Value projects the Subtype base value; result?.int32Value projects the Subtype base value; result?.int64Value projects the Subtype base value; result?.natValue projects the Subtype base value; result?.intValue projects the Subtype base value; result?.float32Value projects the Subtype base value; result?.float64Value projects the Subtype base value; result?.textValue projects the Subtype base value; result?.bytesValue projects the Subtype base value; result?.charValue projects the Subtype base value; result?.usizeValue projects the Subtype base value; result?.isizeValue projects the Subtype base value; result?.digit < 3.
 *
 * @param RawPacket $value0
 * @lean-bridge-param RawPacket $value0
 * @return Some<Packet>|null
 * @lean-bridge-return option<Packet>
 */
function produce(mixed $value0): Some|null {
    return Internal\Native::call0($value0);
}

/**
 * Checked Lean Fin bounds: result.box.value.unitValue projects the Subtype base value; result.box.value.boolValue projects the Subtype base value; result.box.value.uint8Value projects the Subtype base value; result.box.value.uint16Value projects the Subtype base value; result.box.value.uint32Value projects the Subtype base value; result.box.value.uint64Value projects the Subtype base value; result.box.value.int8Value projects the Subtype base value; result.box.value.int16Value projects the Subtype base value; result.box.value.int32Value projects the Subtype base value; result.box.value.int64Value projects the Subtype base value; result.box.value.natValue projects the Subtype base value; result.box.value.intValue projects the Subtype base value; result.box.value.float32Value projects the Subtype base value; result.box.value.float64Value projects the Subtype base value; result.box.value.textValue projects the Subtype base value; result.box.value.bytesValue projects the Subtype base value; result.box.value.charValue projects the Subtype base value; result.box.value.usizeValue projects the Subtype base value; result.box.value.isizeValue projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok.unitValue projects the Subtype base value; result.choices.values[*]?.ok.boolValue projects the Subtype base value; result.choices.values[*]?.ok.uint8Value projects the Subtype base value; result.choices.values[*]?.ok.uint16Value projects the Subtype base value; result.choices.values[*]?.ok.uint32Value projects the Subtype base value; result.choices.values[*]?.ok.uint64Value projects the Subtype base value; result.choices.values[*]?.ok.int8Value projects the Subtype base value; result.choices.values[*]?.ok.int16Value projects the Subtype base value; result.choices.values[*]?.ok.int32Value projects the Subtype base value; result.choices.values[*]?.ok.int64Value projects the Subtype base value; result.choices.values[*]?.ok.natValue projects the Subtype base value; result.choices.values[*]?.ok.intValue projects the Subtype base value; result.choices.values[*]?.ok.float32Value projects the Subtype base value; result.choices.values[*]?.ok.float64Value projects the Subtype base value; result.choices.values[*]?.ok.textValue projects the Subtype base value; result.choices.values[*]?.ok.bytesValue projects the Subtype base value; result.choices.values[*]?.ok.charValue projects the Subtype base value; result.choices.values[*]?.ok.usizeValue projects the Subtype base value; result.choices.values[*]?.ok.isizeValue projects the Subtype base value; result.choices.values[*]?.ok.digit < 3; result.choices.values[*]?.error.unitValue projects the Subtype base value; result.choices.values[*]?.error.boolValue projects the Subtype base value; result.choices.values[*]?.error.uint8Value projects the Subtype base value; result.choices.values[*]?.error.uint16Value projects the Subtype base value; result.choices.values[*]?.error.uint32Value projects the Subtype base value; result.choices.values[*]?.error.uint64Value projects the Subtype base value; result.choices.values[*]?.error.int8Value projects the Subtype base value; result.choices.values[*]?.error.int16Value projects the Subtype base value; result.choices.values[*]?.error.int32Value projects the Subtype base value; result.choices.values[*]?.error.int64Value projects the Subtype base value; result.choices.values[*]?.error.natValue projects the Subtype base value; result.choices.values[*]?.error.intValue projects the Subtype base value; result.choices.values[*]?.error.float32Value projects the Subtype base value; result.choices.values[*]?.error.float64Value projects the Subtype base value; result.choices.values[*]?.error.textValue projects the Subtype base value; result.choices.values[*]?.error.bytesValue projects the Subtype base value; result.choices.values[*]?.error.charValue projects the Subtype base value; result.choices.values[*]?.error.usizeValue projects the Subtype base value; result.choices.values[*]?.error.isizeValue projects the Subtype base value; result.choices.values[*]?.error.digit < 3.
 *
 * @param RawPacket $value0
 * @lean-bridge-param RawPacket $value0
 * @return Event
 * @lean-bridge-return Event
 */
function produce_choices(mixed $value0): Event {
    return Internal\Native::call1($value0);
}

/**
 * Checked Lean Fin bounds: result.box.value.unitValue projects the Subtype base value; result.box.value.boolValue projects the Subtype base value; result.box.value.uint8Value projects the Subtype base value; result.box.value.uint16Value projects the Subtype base value; result.box.value.uint32Value projects the Subtype base value; result.box.value.uint64Value projects the Subtype base value; result.box.value.int8Value projects the Subtype base value; result.box.value.int16Value projects the Subtype base value; result.box.value.int32Value projects the Subtype base value; result.box.value.int64Value projects the Subtype base value; result.box.value.natValue projects the Subtype base value; result.box.value.intValue projects the Subtype base value; result.box.value.float32Value projects the Subtype base value; result.box.value.float64Value projects the Subtype base value; result.box.value.textValue projects the Subtype base value; result.box.value.bytesValue projects the Subtype base value; result.box.value.charValue projects the Subtype base value; result.box.value.usizeValue projects the Subtype base value; result.box.value.isizeValue projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok.unitValue projects the Subtype base value; result.choices.values[*]?.ok.boolValue projects the Subtype base value; result.choices.values[*]?.ok.uint8Value projects the Subtype base value; result.choices.values[*]?.ok.uint16Value projects the Subtype base value; result.choices.values[*]?.ok.uint32Value projects the Subtype base value; result.choices.values[*]?.ok.uint64Value projects the Subtype base value; result.choices.values[*]?.ok.int8Value projects the Subtype base value; result.choices.values[*]?.ok.int16Value projects the Subtype base value; result.choices.values[*]?.ok.int32Value projects the Subtype base value; result.choices.values[*]?.ok.int64Value projects the Subtype base value; result.choices.values[*]?.ok.natValue projects the Subtype base value; result.choices.values[*]?.ok.intValue projects the Subtype base value; result.choices.values[*]?.ok.float32Value projects the Subtype base value; result.choices.values[*]?.ok.float64Value projects the Subtype base value; result.choices.values[*]?.ok.textValue projects the Subtype base value; result.choices.values[*]?.ok.bytesValue projects the Subtype base value; result.choices.values[*]?.ok.charValue projects the Subtype base value; result.choices.values[*]?.ok.usizeValue projects the Subtype base value; result.choices.values[*]?.ok.isizeValue projects the Subtype base value; result.choices.values[*]?.ok.digit < 3; result.choices.values[*]?.error.unitValue projects the Subtype base value; result.choices.values[*]?.error.boolValue projects the Subtype base value; result.choices.values[*]?.error.uint8Value projects the Subtype base value; result.choices.values[*]?.error.uint16Value projects the Subtype base value; result.choices.values[*]?.error.uint32Value projects the Subtype base value; result.choices.values[*]?.error.uint64Value projects the Subtype base value; result.choices.values[*]?.error.int8Value projects the Subtype base value; result.choices.values[*]?.error.int16Value projects the Subtype base value; result.choices.values[*]?.error.int32Value projects the Subtype base value; result.choices.values[*]?.error.int64Value projects the Subtype base value; result.choices.values[*]?.error.natValue projects the Subtype base value; result.choices.values[*]?.error.intValue projects the Subtype base value; result.choices.values[*]?.error.float32Value projects the Subtype base value; result.choices.values[*]?.error.float64Value projects the Subtype base value; result.choices.values[*]?.error.textValue projects the Subtype base value; result.choices.values[*]?.error.bytesValue projects the Subtype base value; result.choices.values[*]?.error.charValue projects the Subtype base value; result.choices.values[*]?.error.usizeValue projects the Subtype base value; result.choices.values[*]?.error.isizeValue projects the Subtype base value; result.choices.values[*]?.error.digit < 3.
 *
 * @param RawPacket $value0
 * @lean-bridge-param RawPacket $value0
 * @return Event
 * @lean-bridge-return Event
 */
function produce_event(mixed $value0): Event {
    return Internal\Native::call2($value0);
}

/**
 * Checked Lean Fin bounds: result[*]?.unitValue projects the Subtype base value; result[*]?.boolValue projects the Subtype base value; result[*]?.uint8Value projects the Subtype base value; result[*]?.uint16Value projects the Subtype base value; result[*]?.uint32Value projects the Subtype base value; result[*]?.uint64Value projects the Subtype base value; result[*]?.int8Value projects the Subtype base value; result[*]?.int16Value projects the Subtype base value; result[*]?.int32Value projects the Subtype base value; result[*]?.int64Value projects the Subtype base value; result[*]?.natValue projects the Subtype base value; result[*]?.intValue projects the Subtype base value; result[*]?.float32Value projects the Subtype base value; result[*]?.float64Value projects the Subtype base value; result[*]?.textValue projects the Subtype base value; result[*]?.bytesValue projects the Subtype base value; result[*]?.charValue projects the Subtype base value; result[*]?.usizeValue projects the Subtype base value; result[*]?.isizeValue projects the Subtype base value; result[*]?.digit < 3.
 *
 * @param RawPacket $value0
 * @lean-bridge-param RawPacket $value0
 * @return list<Some<Packet>|null>
 * @lean-bridge-return array<option<PacketAlias>>
 */
function produce_group(mixed $value0): array {
    return Internal\Native::call3($value0);
}

/**
 * Checked Lean Fin bounds: result.left[*]?.unitValue projects the Subtype base value; result.left[*]?.boolValue projects the Subtype base value; result.left[*]?.uint8Value projects the Subtype base value; result.left[*]?.uint16Value projects the Subtype base value; result.left[*]?.uint32Value projects the Subtype base value; result.left[*]?.uint64Value projects the Subtype base value; result.left[*]?.int8Value projects the Subtype base value; result.left[*]?.int16Value projects the Subtype base value; result.left[*]?.int32Value projects the Subtype base value; result.left[*]?.int64Value projects the Subtype base value; result.left[*]?.natValue projects the Subtype base value; result.left[*]?.intValue projects the Subtype base value; result.left[*]?.float32Value projects the Subtype base value; result.left[*]?.float64Value projects the Subtype base value; result.left[*]?.textValue projects the Subtype base value; result.left[*]?.bytesValue projects the Subtype base value; result.left[*]?.charValue projects the Subtype base value; result.left[*]?.usizeValue projects the Subtype base value; result.left[*]?.isizeValue projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.unitValue projects the Subtype base value; result.right[*]?.boolValue projects the Subtype base value; result.right[*]?.uint8Value projects the Subtype base value; result.right[*]?.uint16Value projects the Subtype base value; result.right[*]?.uint32Value projects the Subtype base value; result.right[*]?.uint64Value projects the Subtype base value; result.right[*]?.int8Value projects the Subtype base value; result.right[*]?.int16Value projects the Subtype base value; result.right[*]?.int32Value projects the Subtype base value; result.right[*]?.int64Value projects the Subtype base value; result.right[*]?.natValue projects the Subtype base value; result.right[*]?.intValue projects the Subtype base value; result.right[*]?.float32Value projects the Subtype base value; result.right[*]?.float64Value projects the Subtype base value; result.right[*]?.textValue projects the Subtype base value; result.right[*]?.bytesValue projects the Subtype base value; result.right[*]?.charValue projects the Subtype base value; result.right[*]?.usizeValue projects the Subtype base value; result.right[*]?.isizeValue projects the Subtype base value; result.right[*]?.digit < 3.
 *
 * @param RawPacket $value0
 * @lean-bridge-param RawPacket $value0
 * @return Pair
 * @lean-bridge-return Pair
 */
function produce_pair(mixed $value0): Pair {
    return Internal\Native::call4($value0);
}

/**

 * @return int
 * @lean-bridge-return uint32
 */
function word_bits(): int {
    return Internal\Native::call5();
}
