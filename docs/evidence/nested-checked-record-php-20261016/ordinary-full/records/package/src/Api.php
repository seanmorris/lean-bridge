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
 * Checked Lean Fin bounds: $arg0[*] checked by NestedCheckedRecords.mkPacket; $arg0[*].digit < 10; $arg0[*].word checked by NestedCheckedRecords.mkWord; result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value.
 *
 * @param list<Packet> $arg0
 * @return list<Packet>
 */
function echo_array(mixed $arg0): array {
    return Internal\Native::call0($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0 checked by NestedCheckedRecords.mkPacket; $arg0.digit < 10; $arg0.word checked by NestedCheckedRecords.mkWord.
 *
 * @param Packet $arg0
 * @return \Brick\Math\BigInteger
 */
function first(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call1($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0[*] checked by NestedCheckedRecords.mkPacket; $arg0[*].digit < 10; $arg0[*].word checked by NestedCheckedRecords.mkWord.
 *
 * @param list<Packet> $arg0
 * @return \Brick\Math\BigInteger
 */
function in_array(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call2($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.packet.value checked by NestedCheckedRecords.mkPacket; $arg0.packet.value.digit < 10; $arg0.packet.value.word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param Choice $arg0
 * @return \Brick\Math\BigInteger
 */
function in_choice(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call3($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.ok checked by NestedCheckedRecords.normalizePacket; $arg0.ok.digit < 10; $arg0.ok.word checked by NestedCheckedRecords.mkWord; $arg0.error checked by NestedCheckedRecords.mkPacket; $arg0.error.digit < 10; $arg0.error.word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param Ok<Packet>|Err<Packet> $arg0
 * @return \Brick\Math\BigInteger
 */
function in_except(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call4($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.packet checked by NestedCheckedRecords.normalizePacket; $arg0.packet.digit < 10; $arg0.packet.word checked by NestedCheckedRecords.mkWord.
 *
 * @param Holder $arg0
 * @return \Brick\Math\BigInteger
 */
function in_holder(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call5($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0[*] checked by NestedCheckedRecords.normalizePacket; $arg0[*].digit < 10; $arg0[*].word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param list<Packet> $arg0
 * @return \Brick\Math\BigInteger
 */
function in_list(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call6($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0? checked by NestedCheckedRecords.mkPacket; $arg0?.digit < 10; $arg0?.word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param Some<Packet>|null $arg0
 * @return \Brick\Math\BigInteger
 */
function in_option(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call7($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.0 checked by NestedCheckedRecords.mkPacket; $arg0.0.digit < 10; $arg0.0.word checked by NestedCheckedRecords.mkWord; $arg0.1 checked by NestedCheckedRecords.normalizePacket; $arg0.1.digit < 10; $arg0.1.word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param array{Packet, Packet} $arg0
 * @return \Brick\Math\BigInteger
 */
function in_product(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call8($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0 checked by NestedCheckedRecords.mkPacket; $arg0.digit < 10; $arg0.word checked by NestedCheckedRecords.mkWord; $arg1 checked by NestedCheckedRecords.normalizePacket; $arg1.digit < 10; $arg1.word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param Packet $arg0
 * @param Packet $arg1
 * @return \Brick\Math\BigInteger
 */
function pair(mixed $arg0, mixed $arg1): \Brick\Math\BigInteger {
    return Internal\Native::call9($arg0, $arg1);
}

/**
 * Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @return list<Packet>
 */
function produce_array(mixed $arg0): array {
    return Internal\Native::call10($arg0);
}

/**
 * Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit < 10; result?.word projects the Subtype base value.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @return Some<Packet>|null
 */
function produce_option(mixed $arg0): Some|null {
    return Internal\Native::call11($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0 checked by NestedCheckedRecords.normalizePacket; $arg0.digit < 10; $arg0.word checked by NestedCheckedRecords.normalizeWord.
 *
 * @param Packet $arg0
 * @return \Brick\Math\BigInteger
 */
function second(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call12($arg0);
}
