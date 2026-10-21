<?php
declare(strict_types=1);

namespace {
    if ($argc < 3 || $argc > 4) throw new \InvalidArgumentException('Expected caller, route and optional fault');
    $route = $argv[2];
    if (!in_array($route, ['ordinary-source', 'reviewed-ir', 'result-only-ordinary-source', 'result-only-reviewed-ir'], true)) {
        throw new \InvalidArgumentException('Unknown zero-payload route');
    }
    $GLOBALS['zero_payload_result_only'] = str_starts_with($route, 'result-only-');
    $GLOBALS['zero_payload_prefix'] = str_ends_with($route, 'reviewed-ir') ? 'value' : 'arg';
    $GLOBALS['zero_payload_fault'] = $argv[3] ?? null;
}

namespace Brick\Math {
    final class BigInteger implements \Stringable {
        private function __construct(public string $value) {}
        public static function of(mixed $value): self {
            if ($value instanceof self) return new self($value->value);
            if (is_int($value) || is_string($value)) {
                $text = (string)$value;
                if (preg_match('/^-?(?:0|[1-9][0-9]*)$/', $text) === 1) return new self($text);
            }
            throw new \TypeError('Expected exact integer');
        }
        public function __toString(): string { return $this->value; }
    }
}

namespace LeanZeropayloadcheckedrecords {
    use Brick\Math\BigInteger;

    final class LeanBridgeError extends \RuntimeException {}
    trait ZeroPayloadValue {
        public function equals(mixed $other): bool {
            return $other instanceof self && get_object_vars($other) == get_object_vars($this);
        }
    }
    // The generated readonly classes guard their arity and validate payloads at
    // construction; the double mirrors exactly that so probes built in argument
    // lists refuse the same way.
    final readonly class Witness { use ZeroPayloadValue;
        public function __construct() { if (func_num_args() !== 0) throw new \ArgumentCountError('Witness requires exactly 0 fields'); }
    }
    final readonly class Token { use ZeroPayloadValue;
        public null $tag;
        public function __construct(mixed $tag) {
            if (func_num_args() !== 1) throw new \ArgumentCountError('Token requires exactly 1 fields');
            $this->tag = zero_payload_unit($tag);
        }
    }
    final readonly class Marker { use ZeroPayloadValue;
        public function __construct() { if (func_num_args() !== 0) throw new \ArgumentCountError('Marker requires exactly 0 fields'); }
    }
    abstract readonly class Mark {}
    final readonly class MarkBlank extends Mark { use ZeroPayloadValue;
        public function __construct() { if (func_num_args() !== 0) throw new \ArgumentCountError('MarkBlank requires exactly 0 payload fields'); }
    }
    final readonly class MarkMarked extends Mark { use ZeroPayloadValue;
        public Witness $witness;
        public function __construct(mixed $witness) {
            if (func_num_args() !== 1) throw new \ArgumentCountError('MarkMarked requires exactly 1 payload fields');
            $this->witness = zero_payload_witness($witness);
        }
    }
    final readonly class Some { use ZeroPayloadValue;
        public mixed $value;
        public function __construct(mixed $value) {
            if (func_num_args() !== 1) throw new \ArgumentCountError('Some requires one payload');
            $this->value = $value;
        }
    }

    function zero_payload_fault(): ?string { return $GLOBALS['zero_payload_fault']; }
    function zero_payload_prefix(): string { return $GLOBALS['zero_payload_prefix']; }
    function zero_payload_witness(mixed $value): Witness {
        if (zero_payload_fault() === 'host-accepts-null' && $value === null) return new Witness();
        if (!$value instanceof Witness) throw new \TypeError('Expected Witness');
        return $value;
    }
    function zero_payload_unit(mixed $value): null {
        if ($value !== null) throw new \TypeError('Unit requires null');
        return null;
    }
    function zero_payload_nat(mixed $value): BigInteger {
        if (!$value instanceof BigInteger) throw new \TypeError('Expected Brick Math BigInteger');
        if (str_starts_with((string)$value, '-')) throw new \ValueError('Expected an unsigned integer');
        return $value;
    }
    function zero_payload_bool(mixed $value): bool {
        if (!is_bool($value)) throw new \TypeError('Bool requires bool');
        return $value;
    }

    if (!$GLOBALS['zero_payload_result_only'] || zero_payload_fault() === 'inputs-exported') {
        function witness_count(mixed $value): BigInteger { zero_payload_witness($value); return BigInteger::of(1); }
        function absent_count(mixed $value): BigInteger {
            zero_payload_witness($value);
            $fault = zero_payload_fault();
            if ($fault === 'accept-invalid') return BigInteger::of(0);
            $prefix = $fault === 'wrong-message' ? 'wrong' : zero_payload_prefix();
            throw new LeanBridgeError($prefix . '0 was rejected by ZeroPayloadCheckedRecords.mkAbsent', $fault === 'wrong-status' ? 2 : 1);
        }
        function token_tag(mixed $value): null {
            if (!$value instanceof Token) throw new \TypeError('Expected Token');
            return zero_payload_unit($value->tag);
        }
        function marker_count(mixed $value): BigInteger {
            if (!$value instanceof Marker) throw new \TypeError('Expected Marker');
            return BigInteger::of(0);
        }
        function mark_count(mixed $value): BigInteger {
            if ($value instanceof MarkBlank) return BigInteger::of(0);
            if ($value instanceof MarkMarked) { zero_payload_witness($value->witness); return BigInteger::of(1); }
            throw new \TypeError('Expected an exact Mark constructor');
        }
    }
    function produce_witness(): Witness|Marker { return zero_payload_fault() === 'wrong-produced' ? new Marker() : new Witness(); }
    function produce_token(): Token { return new Token(null); }
    function witnesses(mixed $count): array {
        $length = (int)(string)zero_payload_nat($count);
        if (zero_payload_fault() === 'array-length' && $length > 0) --$length;
        return array_map(static fn(): Witness => new Witness(), $length ? range(1, $length) : []);
    }
    function maybe_witness(mixed $present): Some|Witness|null {
        if (!zero_payload_bool($present)) return null;
        return zero_payload_fault() === 'option-collapsed' ? new Witness() : new Some(new Witness());
    }
    function produce_marker(): Marker { return new Marker(); }
    if (zero_payload_fault() !== 'missing-producer') {
        function produce_mark(mixed $active): Mark { return zero_payload_bool($active) ? new MarkMarked(new Witness()) : new MarkBlank(); }
    }
}

namespace {
    require $argv[1];
    $fault = $GLOBALS['zero_payload_fault'];
    try {
        $result = check_zero_payload_records($GLOBALS['zero_payload_result_only'], $GLOBALS['zero_payload_prefix']);
        echo json_encode($fault === null ? $result : ['fault' => $fault, 'accepted' => true], JSON_THROW_ON_ERROR) . "\n";
    } catch (\Throwable $error) {
        if ($fault === null) throw $error;
        echo json_encode(['fault' => $fault, 'rejected' => true], JSON_THROW_ON_ERROR) . "\n";
    }
}
