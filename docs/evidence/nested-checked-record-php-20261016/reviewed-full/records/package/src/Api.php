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

abstract readonly class Choice {}
final readonly class ChoiceEmpty extends Choice
{

    public function __construct() {
        if (func_num_args() !== 0) throw new \ArgumentCountError('ChoiceEmpty requires exactly 0 payload fields');
        $__lbBudget = new Internal\Budget();

    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class ChoicePacket extends Choice
{
    /** @var Packet */
    public Packet $value;
    public function __construct(mixed $value) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('ChoicePacket requires exactly 1 payload fields');
        $__lbBudget = new Internal\Budget();
        $this->value = Internal\Checks::check1($value, $__lbBudget);
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

final readonly class Holder
{
    /** @var Packet */
    public Packet $packet;
    /** @var \Brick\Math\BigInteger */
    public \Brick\Math\BigInteger $tag;
    public function __construct(mixed $packet, mixed $tag) {
        if (func_num_args() !== 2) throw new \ArgumentCountError('Holder requires exactly 2 fields');
        $__lbBudget = new Internal\Budget();
        $this->packet = Internal\Checks::check1($packet, $__lbBudget);
        $this->tag = Internal\Checks::check0($tag, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

require_once __DIR__ . '/Internal/Native.php';

/**
 * Checked Lean Fin bounds: $value0[*] checked by NestedCheckedRecords.mkPacket; $value0[*].digit < 10; $value0[*].word checked by NestedCheckedRecords.mkWord; result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value.
 *
 * @param list<Packet> $value0
 * @return list<Packet>
 */
function echo_array(mixed $value0): array {
    return Internal\Native::call0($value0);
}

/**
 * Checked Lean Fin bounds: $value0 checked by NestedCheckedRecords.mkPacket; $value0.digit < 10; $value0.word checked by NestedCheckedRecords.mkWord.
 *
 * @param Packet $value0
 * @return \Brick\Math\BigInteger
 */
function first(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call1($value0);
}

/**
 * Checked Lean Fin bounds: $value0[*] checked by NestedCheckedRecords.mkPacket; $value0[*].digit < 10; $value0[*].word checked by NestedCheckedRecords.mkWord.
 *
 * @param list<Packet> $value0
 * @return \Brick\Math\BigInteger
 */
function in_array(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call2($value0);
}

/**
 * Checked Lean Fin bounds: $value0.packet.value checked by NestedCheckedRecords.mkPacket; $value0.packet.value.digit < 10; $value0.packet.value.word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param Choice $value0
 * @return \Brick\Math\BigInteger
 */
function in_choice(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call3($value0);
}

/**
 * Checked Lean Fin bounds: $value0.ok checked by NestedCheckedRecords.normalizePacket; $value0.ok.digit < 10; $value0.ok.word checked by NestedCheckedRecords.mkWord; $value0.error checked by NestedCheckedRecords.mkPacket; $value0.error.digit < 10; $value0.error.word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param Ok<Packet>|Err<Packet> $value0
 * @return \Brick\Math\BigInteger
 */
function in_except(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call4($value0);
}

/**
 * Checked Lean Fin bounds: $value0.packet checked by NestedCheckedRecords.normalizePacket; $value0.packet.digit < 10; $value0.packet.word checked by NestedCheckedRecords.mkWord.
 *
 * @param Holder $value0
 * @return \Brick\Math\BigInteger
 */
function in_holder(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call5($value0);
}

/**
 * Checked Lean Fin bounds: $value0[*] checked by NestedCheckedRecords.normalizePacket; $value0[*].digit < 10; $value0[*].word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param list<Packet> $value0
 * @return \Brick\Math\BigInteger
 */
function in_list(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call6($value0);
}

/**
 * Checked Lean Fin bounds: $value0? checked by NestedCheckedRecords.mkPacket; $value0?.digit < 10; $value0?.word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param Some<Packet>|null $value0
 * @return \Brick\Math\BigInteger
 */
function in_option(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call7($value0);
}

/**
 * Checked Lean Fin bounds: $value0.0 checked by NestedCheckedRecords.mkPacket; $value0.0.digit < 10; $value0.0.word checked by NestedCheckedRecords.mkWord; $value0.1 checked by NestedCheckedRecords.normalizePacket; $value0.1.digit < 10; $value0.1.word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param array{Packet, Packet} $value0
 * @return \Brick\Math\BigInteger
 */
function in_product(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call8($value0);
}

/**
 * Checked Lean Fin bounds: $value0 checked by NestedCheckedRecords.mkPacket; $value0.digit < 10; $value0.word checked by NestedCheckedRecords.mkWord; $value1 checked by NestedCheckedRecords.normalizePacket; $value1.digit < 10; $value1.word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param Packet $value0
 * @param Packet $value1
 * @return \Brick\Math\BigInteger
 */
function pair(mixed $value0, mixed $value1): \Brick\Math\BigInteger {
    return Internal\Native::call9($value0, $value1);
}

/**
 * Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @return list<Packet>
 */
function produce_array(mixed $value0): array {
    return Internal\Native::call10($value0);
}

/**
 * Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit < 10; result?.word projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $value0
 * @return Some<Packet>|null
 */
function produce_option(mixed $value0): Some|null {
    return Internal\Native::call11($value0);
}

/**
 * Checked Lean Fin bounds: $value0 checked by NestedCheckedRecords.normalizePacket; $value0.digit < 10; $value0.word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param Packet $value0
 * @return \Brick\Math\BigInteger
 */
function second(mixed $value0): \Brick\Math\BigInteger {
    return Internal\Native::call12($value0);
}
