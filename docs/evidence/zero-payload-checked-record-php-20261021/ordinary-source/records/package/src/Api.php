<?php
declare(strict_types=1);
namespace LeanZeropayloadcheckedrecords;


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

abstract readonly class Mark {}
final readonly class MarkBlank extends Mark
{

    public function __construct() {
        if (func_num_args() !== 0) throw new \ArgumentCountError('MarkBlank requires exactly 0 payload fields');
        $__lbBudget = new Internal\Budget();

    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class MarkMarked extends Mark
{
    /** @var Witness */
    public Witness $witness;
    public function __construct(mixed $witness) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('MarkMarked requires exactly 1 payload fields');
        $__lbBudget = new Internal\Budget();
        $this->witness = Internal\Checks::check0($witness, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}
final readonly class Witness
{

    public function __construct() {
        if (func_num_args() !== 0) throw new \ArgumentCountError('Witness requires exactly 0 fields');
        $__lbBudget = new Internal\Budget();

    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class Marker
{

    public function __construct() {
        if (func_num_args() !== 0) throw new \ArgumentCountError('Marker requires exactly 0 fields');
        $__lbBudget = new Internal\Budget();

    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

final readonly class Token
{
    /** @var null */
    public null $tag;
    public function __construct(mixed $tag) {
        if (func_num_args() !== 1) throw new \ArgumentCountError('Token requires exactly 1 fields');
        $__lbBudget = new Internal\Budget();
        $this->tag = Internal\Checks::check6($tag, $__lbBudget);
    }

    public function equals(mixed $other): bool {
        return $other instanceof self && Internal\Values::equal($this, $other);
    }
    public function hashCode(): string { return Internal\Values::hash($this); }

}

require_once __DIR__ . '/Internal/Native.php';

/**
 * Checked Lean Fin bounds: $arg0 checked by ZeroPayloadCheckedRecords.mkAbsent.
 *
 * @param Witness $arg0
 * @return \Brick\Math\BigInteger
 */
function absent_count(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call0($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0.marked.witness checked by ZeroPayloadCheckedRecords.mkWitness.
 *
 * @param Mark $arg0
 * @return \Brick\Math\BigInteger
 */
function mark_count(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call1($arg0);
}

/**
 * @param Marker $arg0
 * @return \Brick\Math\BigInteger
 */
function marker_count(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call2($arg0);
}

/**
 * Checked Lean Fin bounds: result? projects proof-backed record payload fields.
 *
 * @param bool $arg0
 * @return Some<Witness>|null
 */
function maybe_witness(mixed $arg0): Some|null {
    return Internal\Native::call3($arg0);
}

/**
 * Checked Lean Fin bounds: result.marked.witness projects proof-backed record payload fields.
 *
 * @param bool $arg0
 * @return Mark
 */
function produce_mark(mixed $arg0): Mark {
    return Internal\Native::call4($arg0);
}

/**

 * @return Marker
 */
function produce_marker(): Marker {
    return Internal\Native::call5();
}

/**
 * Checked Lean Fin bounds: result projects proof-backed record payload fields.
 *

 * @return Token
 */
function produce_token(): Token {
    return Internal\Native::call6();
}

/**
 * Checked Lean Fin bounds: result projects proof-backed record payload fields.
 *

 * @return Witness
 */
function produce_witness(): Witness {
    return Internal\Native::call7();
}

/**
 * Checked Lean Fin bounds: $arg0 checked by ZeroPayloadCheckedRecords.mkToken.
 *
 * @param Token $arg0
 * @return null
 */
function token_tag(mixed $arg0): null {
    return Internal\Native::call8($arg0);
}

/**
 * Checked Lean Fin bounds: $arg0 checked by ZeroPayloadCheckedRecords.mkWitness.
 *
 * @param Witness $arg0
 * @return \Brick\Math\BigInteger
 */
function witness_count(mixed $arg0): \Brick\Math\BigInteger {
    return Internal\Native::call9($arg0);
}

/**
 * Checked Lean Fin bounds: result[*] projects proof-backed record payload fields.
 *
 * @param \Brick\Math\BigInteger $arg0
 * @return list<Witness>
 */
function witnesses(mixed $arg0): array {
    return Internal\Native::call10($arg0);
}
