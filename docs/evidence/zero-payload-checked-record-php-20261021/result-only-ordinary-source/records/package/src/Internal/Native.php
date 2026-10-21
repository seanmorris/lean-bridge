<?php
declare(strict_types=1);
namespace LeanZeropayloadcheckedrecords\Internal;

require_once __DIR__ . '/Runtime.php';


final class Budget
{
    private int $remaining = 16 * 1024 * 1024;
    public function charge(int $count, int $width = 1): void {
        if ($count < 0 || $width < 1 || $count > intdiv($this->remaining, $width)) {
            throw new \ValueError('16 MiB PHP conversion limit exceeded');
        }
        $this->remaining -= $count * $width;
    }
}

final class Scope
{
    public array $owners = [];
    public Budget $budget;
    public function __construct(public \FFI $ffi) { $this->budget = new Budget(); }
    public function allocate(string $type, int $count = 1, bool $array = false): \FFI\CData {
        $this->budget->charge($count, \FFI::sizeof($this->ffi->type($type)));
        $memory = $this->ffi->new($array ? $type . '[' . max(1, $count) . ']' : $type);
        $this->owners[] = $memory;
        return $memory;
    }
    public function buffer(string $bytes): ?\FFI\CData {
        if ($bytes === '') return null;
        $memory = $this->allocate('uint8_t', strlen($bytes), true);
        \FFI::memcpy($memory, $bytes, strlen($bytes));
        return \FFI::addr($memory[0]);
    }
    public function read(?\FFI\CData $data, int $length, int $width = 1, int $alignment = 1): string {
        $this->budget->charge($length, $width);
        if (!$length) return '';
        if ($data === null || \FFI::isNull($data)) throw new \RuntimeException('Native result has a missing buffer');
        if ($alignment < 1 || $this->ffi->cast('uintptr_t *', \FFI::addr($data))[0] % $alignment !== 0) throw new \RuntimeException('Native result has a misaligned buffer');
        return \FFI::string($data, $length);
    }
    public function close(): void { $this->owners = []; }
}

final class ScalarCodec
{
    public static function point(string $text): int {
        $length = strlen($text);
        $value = ord($text[0]) & [1 => 127, 2 => 31, 3 => 15, 4 => 7][$length];
        for ($i = 1; $i < $length; $i++) $value = ($value << 6) | (ord($text[$i]) & 63);
        return $value;
    }
    public static function text(int $value): string {
        if ($value < 0 || $value > 0x10ffff || ($value >= 0xd800 && $value <= 0xdfff)) throw new \RuntimeException('Invalid native Unicode scalar');
        if ($value < 128) return chr($value);
        if ($value < 0x800) return chr(0xc0 | ($value >> 6)) . chr(0x80 | ($value & 63));
        if ($value < 0x10000) return chr(0xe0 | ($value >> 12)) . chr(0x80 | (($value >> 6) & 63)) . chr(0x80 | ($value & 63));
        return chr(0xf0 | ($value >> 18)) . chr(0x80 | (($value >> 12) & 63)) . chr(0x80 | (($value >> 6) & 63)) . chr(0x80 | ($value & 63));
    }
}

final class IntegerCodec
{
    public static function limbs(string $decimal): array {
        $digits = ltrim($decimal, '-');
        $limbs = [];
        foreach (str_split(str_pad($digits, (int) (ceil(strlen($digits) / 9) * 9), '0', STR_PAD_LEFT), 9) as $part) {
            $carry = (int) $part;
            foreach ($limbs as $i => $word) {
                $value = $word * 1000000000 + $carry;
                $limbs[$i] = $value & 0xffffffff;
                $carry = intdiv($value, 4294967296);
            }
            if ($carry) $limbs[] = $carry;
        }
        return $limbs;
    }
    public static function decimal(array $limbs, bool $negative): string {
        // 1700 limbs fit in 16384 decimal digits; check the exact length below too.
        if (count($limbs) > 1701) throw new \ValueError('BigInteger decimal conversion limit exceeded');
        $chunks = [];
        foreach (array_reverse($limbs) as $word) {
            $carry = $word;
            foreach ($chunks as $i => $part) {
                $value = $part * 4294967296 + $carry;
                $chunks[$i] = $value % 1000000000;
                $carry = intdiv($value, 1000000000);
            }
            while ($carry) { $chunks[] = $carry % 1000000000; $carry = intdiv($carry, 1000000000); }
        }
        $text = $chunks ? (string) array_pop($chunks) : '0';
        foreach (array_reverse($chunks) as $part) $text .= str_pad((string) $part, 9, '0', STR_PAD_LEFT);
        if (strlen($text) > 16384) throw new \ValueError('BigInteger decimal conversion limit exceeded');
        return $negative && $text !== '0' ? '-' . $text : $text;
    }
}

final class Values
{
    private static function step(Budget $budget, int $depth): void {
        if ($depth > 32) throw new \ValueError('Value comparison exceeds 32 nesting levels');
        $budget->charge(1, 32);
    }
    private static function fields(object $value, Budget $budget): array {
        $expected = match ($value::class) {
            \LeanZeropayloadcheckedrecords\Some::class => ['value'],
            \LeanZeropayloadcheckedrecords\Witness::class => [],
            \LeanZeropayloadcheckedrecords\Marker::class => [],
            \LeanZeropayloadcheckedrecords\Token::class => ['tag'],
            \LeanZeropayloadcheckedrecords\MarkBlank::class => [],
            \LeanZeropayloadcheckedrecords\MarkMarked::class => ['witness'],
            default => throw new \TypeError('Value comparison requires generated copied values'),
        };
        $budget->charge(count($expected), 32);
        $fields = get_object_vars($value);
        if (array_keys($fields) !== $expected) throw new \TypeError('Value comparison requires initialized fields');
        return $fields;
    }
    public static function equal(mixed $left, mixed $right): bool {
        return self::same($left, $right, new Budget(), 0);
    }
    private static function same(mixed $left, mixed $right, Budget $budget, int $depth): bool {
        self::step($budget, $depth);
        if (get_debug_type($left) !== get_debug_type($right)) return false;
        if (is_float($left)) return is_nan($left) ? is_nan($right) : pack('E', $left) === pack('E', $right);
        if ($left instanceof \Brick\Math\BigInteger) { $left = (string) $left; $right = (string) $right; }
        elseif ($left instanceof \LeanZeropayloadcheckedrecords\Bytes) { $left = $left->toString(); $right = $right->toString(); }
        elseif (is_object($left)) {
            $left = self::fields($left, $budget); $right = self::fields($right, $budget);
            foreach ($left as $name => $value) if (!self::same($value, $right[$name], $budget, $depth + 1)) return false;
            return true;
        }
        if (is_string($left)) { $budget->charge(strlen($left)); $budget->charge(strlen($right)); return $left === $right; }
        if (is_array($left)) {
            $budget->charge(count($left), 32); $budget->charge(count($right), 32);
            if (!array_is_list($left) || !array_is_list($right)) throw new \TypeError('Value comparison requires consecutive-key lists');
            if (count($left) !== count($right)) return false;
            foreach ($left as $index => $value) if (!self::same($value, $right[$index], $budget, $depth + 1)) return false;
            return true;
        }
        if ($left === null || is_bool($left) || is_int($left)) return $left === $right;
        throw new \TypeError('Value comparison requires copied values');
    }
    private static function text(\HashContext $hash, string $tag, string $text, Budget $budget): void {
        $budget->charge(strlen($text));
        hash_update($hash, $tag . pack('N', strlen($text))); hash_update($hash, $text);
    }
    public static function hash(mixed $value): string {
        $hash = hash_init('sha256'); self::append($hash, $value, new Budget(), 0); return hash_final($hash);
    }
    private static function append(\HashContext $hash, mixed $value, Budget $budget, int $depth): void {
        self::step($budget, $depth);
        if ($value === null) hash_update($hash, 'n');
        elseif (is_bool($value)) hash_update($hash, $value ? 't' : 'f');
        elseif (is_int($value)) self::text($hash, 'i', (string) $value, $budget);
        elseif (is_float($value)) hash_update($hash, is_nan($value) ? 'q' : 'd' . pack('E', $value));
        elseif (is_string($value)) self::text($hash, 's', $value, $budget);
        elseif ($value instanceof \Brick\Math\BigInteger) self::text($hash, 'b', (string) $value, $budget);
        elseif ($value instanceof \LeanZeropayloadcheckedrecords\Bytes) self::text($hash, 'y', $value->toString(), $budget);
        elseif (is_array($value)) {
            $budget->charge(count($value), 32);
            if (!array_is_list($value)) throw new \TypeError('Value hashing requires consecutive-key lists');
            hash_update($hash, 'a' . pack('N', count($value)));
            foreach ($value as $item) self::append($hash, $item, $budget, $depth + 1);
        } elseif (is_object($value)) {
            $fields = self::fields($value, $budget);
            self::text($hash, 'o', $value::class, $budget);
            foreach ($fields as $name => $item) { self::text($hash, 'k', $name, $budget); self::append($hash, $item, $budget, $depth + 1); }
        } else throw new \TypeError('Value hashing requires copied values');
    }
}


final class Checks
{
    public static function check0(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_bool($value)) throw new \TypeError('Bool requires bool');
        return $value;
    }
    public static function check1(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanZeropayloadcheckedrecords\Witness) throw new \TypeError('Expected Witness');
        if (array_keys(get_object_vars($value)) !== []) throw new \TypeError('Witness requires exactly its initialized fields');
        return $value;
    }
    public static function check2(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if ($value === null) return null;
        if ($value instanceof \LeanZeropayloadcheckedrecords\Some) {
            if (array_keys(get_object_vars($value)) !== ['value']) throw new \TypeError('Some requires one initialized value field');
            return new \LeanZeropayloadcheckedrecords\Some(self::check1($value->value, $budget));
        }
        throw new \TypeError('Expected Some');
    }
    public static function check3(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if ($value instanceof \LeanZeropayloadcheckedrecords\MarkBlank) {
            if (array_keys(get_object_vars($value)) !== []) throw new \TypeError('MarkBlank requires exactly its initialized payload fields');
            return $value;
        }
        if ($value instanceof \LeanZeropayloadcheckedrecords\MarkMarked) {
            if (array_keys(get_object_vars($value)) !== ['witness']) throw new \TypeError('MarkMarked requires exactly its initialized payload fields');
            self::check1($value->witness, $budget);
            return $value;
        }
        throw new \TypeError('Expected an exact Mark constructor');
    }
    public static function check4(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanZeropayloadcheckedrecords\Marker) throw new \TypeError('Expected Marker');
        if (array_keys(get_object_vars($value)) !== []) throw new \TypeError('Marker requires exactly its initialized fields');
        return $value;
    }
    public static function check5(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if ($value !== null) throw new \TypeError('Unit requires null');
        return $value;
    }
    public static function check6(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanZeropayloadcheckedrecords\Token) throw new \TypeError('Expected Token');
        if (array_keys(get_object_vars($value)) !== ['tag']) throw new \TypeError('Token requires exactly its initialized fields');
        self::check5($value->tag, $budget);
        return $value;
    }
    public static function check7(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \Brick\Math\BigInteger) throw new \TypeError('Expected Brick Math BigInteger');
        $decimal = (string) $value;
        if (strlen($decimal) > 16385 || strlen(ltrim($decimal, '-')) > 16384 || preg_match('/^(?:0|-?[1-9][0-9]*)$/D', $decimal) !== 1) throw new \ValueError('BigInteger requires canonical decimal text of at most 16384 digits');
        $budget->charge(strlen($decimal));
        if ($decimal[0] === '-') throw new \ValueError('Expected an unsigned integer');
        return $value;
    }
    public static function check8(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_array($value) || !array_is_list($value)) throw new \TypeError('Expected a list with consecutive integer keys');
        $budget->charge(count($value), 32);
        $result = [];
        foreach ($value as $item) $result[] = self::check1($item, $budget);
        return $result;
    }
}

final class Native
{
    private const DEFINITIONS = <<<'CDEFS'
typedef struct { int code; void *message; size_t message_length; } BridgeError;
typedef struct { uint8_t empty; } zeropayloadcheckedrecords_witness;
void zeropayloadcheckedrecords_witness_clear(zeropayloadcheckedrecords_witness *);
typedef struct { uint8_t has_value; zeropayloadcheckedrecords_witness value; } zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value;
void zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear(zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *);
typedef struct { uint32_t kind; union { struct { uint8_t empty; } blank; struct { zeropayloadcheckedrecords_witness witness; } marked; } cases; } zeropayloadcheckedrecords_mark;
void zeropayloadcheckedrecords_mark_clear(zeropayloadcheckedrecords_mark *);
typedef struct { uint8_t empty; } zeropayloadcheckedrecords_marker;
void zeropayloadcheckedrecords_marker_clear(zeropayloadcheckedrecords_marker *);
typedef struct { uint8_t tag; } zeropayloadcheckedrecords_token;
void zeropayloadcheckedrecords_token_clear(zeropayloadcheckedrecords_token *);
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } zeropayloadcheckedrecords_nat;
void zeropayloadcheckedrecords_nat_clear(zeropayloadcheckedrecords_nat *);
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span;
void zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span_clear(zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *);
int zeropayloadcheckedrecords_maybe_witness(uint8_t, zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *, BridgeError *);
int zeropayloadcheckedrecords_produce_mark(uint8_t, zeropayloadcheckedrecords_mark *, BridgeError *);
int zeropayloadcheckedrecords_produce_marker(zeropayloadcheckedrecords_marker *, BridgeError *);
int zeropayloadcheckedrecords_produce_token(zeropayloadcheckedrecords_token *, BridgeError *);
int zeropayloadcheckedrecords_produce_witness(zeropayloadcheckedrecords_witness *, BridgeError *);
int zeropayloadcheckedrecords_witnesses(zeropayloadcheckedrecords_nat *, zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *, BridgeError *);
CDEFS;
    private static ?\FFI $ffi = null;
    private static function load(): \FFI {
        return \LeanBridge\CopiedNativeV1\Runtime::load(__DIR__ . '/../../native/linux-x64', json_decode(<<<'EVIDENCE'
{
  "componentId": "zeropayloadcheckedrecords@1.0.0",
  "componentReceiptSha256": "473bf375d4882b63df30e7c495d282d04fd5b43838febe39fdcd794851c44a28",
  "identity": "dcaf93d1661af416f242156ce0ab2a7363ec465893503bea75555f62e49a1a53",
  "libraries": {
    "libcomponent_d43d7c5a9f170f3ce127.so": "5a457d3be3c5d97ca78f9df38fa8517cde29f729d11cd058043d02c1ff1f26c6",
    "liblean_bridge_native.so": "459fcd2098d4b646ab6ae0f4cdccd1f222908cb162562bfc3940a533cd4e4e21",
    "libleanshared.so": "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4",
    "libzeropayloadcheckedrecords.so": "18a2c6795f89bfbf3228fda0fd0b49ea4ecd938d608812e8665d9c63aa2bdcd1"
  },
  "library": "libzeropayloadcheckedrecords.so",
  "loadOrder": [
    "libleanshared.so",
    "liblean_bridge_native.so",
    "libcomponent_d43d7c5a9f170f3ce127.so",
    "libzeropayloadcheckedrecords.so"
  ],
  "runtimeIdentity": "4b5a7fdf0cb11d4bb429181cfd50b330c5622ed8f5f5382a293955a439b595b5"
}
EVIDENCE, true, 512, JSON_THROW_ON_ERROR), self::DEFINITIONS);
    }
    private static function to0(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('uint8_t');
        $out->cdata = $value ? 1 : 0;
        return $out;
    }
    private static function from0(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value !== 0 && $value !== 1) throw new \RuntimeException('Invalid native Bool marker');
        return $value === 1;
    }
    private static function to1(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('zeropayloadcheckedrecords_witness');
        return $out;
    }
    private static function from1(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanZeropayloadcheckedrecords\Witness();
    }
    private static function to2(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value');
        if ($value !== null) {
            $out->has_value = 1;
            $item = self::to1($value->value, $scope);
            $out->value = $item;
        }
        return $out;
    }
    private static function from2(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value->has_value !== 0 && $value->has_value !== 1) throw new \RuntimeException('Invalid native Option flag');
        return $value->has_value === 0 ? null : new \LeanZeropayloadcheckedrecords\Some(self::from1($value->value, $scope));
    }
    private static function to3(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('zeropayloadcheckedrecords_mark');
        if ($value instanceof \LeanZeropayloadcheckedrecords\MarkBlank) {
            $out->kind = 0;
        }
        else if ($value instanceof \LeanZeropayloadcheckedrecords\MarkMarked) {
            $out->kind = 1;
            $item = self::to1($value->witness, $scope);
            $out->cases->marked->witness = $item;
        }
        else throw new \TypeError('Expected an exact Mark constructor');
        return $out;
    }
    private static function from3(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        switch ($value->kind) {
        case 0: return new \LeanZeropayloadcheckedrecords\MarkBlank();
        case 1: return new \LeanZeropayloadcheckedrecords\MarkMarked(self::from1($value->cases->marked->witness, $scope));
        default: throw new \RuntimeException('Invalid native Mark constructor');
        }
    }
    private static function to4(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('zeropayloadcheckedrecords_marker');
        return $out;
    }
    private static function from4(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanZeropayloadcheckedrecords\Marker();
    }
    private static function to5(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('uint8_t');
        $out->cdata = 0;
        return $out;
    }
    private static function from5(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value !== 0) throw new \RuntimeException('Invalid native Unit marker');
        return null;
    }
    private static function to6(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('zeropayloadcheckedrecords_token');
        $field5_tag = self::to5($value->tag, $scope);
        $out->tag = $field5_tag->cdata;
        return $out;
    }
    private static function from6(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanZeropayloadcheckedrecords\Token(self::from5($value->tag, $scope));
    }
    private static function to7(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('zeropayloadcheckedrecords_nat');
        $decimal = (string) $value;
        $words = IntegerCodec::limbs($decimal);
        $scope->budget->charge(count($words), 32);
        $bytes = $words ? pack('V*', ...$words) : '';
        $out->length = count($words);
        $out->data = $scope->buffer($bytes);
        return $out;
    }
    private static function from7(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value->length < 0 || $value->length > 1701) throw new \ValueError('BigInteger decimal conversion limit exceeded');
        $bytes = $scope->read($value->data, $value->length * 4, 8, 4);
        $words = $bytes === '' ? [] : array_values(unpack('V*', $bytes));
        if ($words && $words[count($words) - 1] === 0) throw new \RuntimeException('Invalid native integer magnitude');
        return \Brick\Math\BigInteger::of(IntegerCodec::decimal($words, false));
    }
    private static function to8(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span');
        $scope->budget->charge(count($value), 32);
        $memory = $scope->allocate('zeropayloadcheckedrecords_witness', count($value), true);
        foreach ($value as $i => $item) { $entry = self::to1($item, $scope); $memory[$i] = $entry; }
        $out->data = count($value) ? \FFI::addr($memory[0]) : null;
        $out->length = count($value);
        return $out;
    }
    private static function from8(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        $scope->budget->charge($value->length, max(32, \FFI::sizeof($scope->ffi->type('zeropayloadcheckedrecords_witness'))));
        if (!$value->length) return [];
        if ($value->data === null || \FFI::isNull($value->data)) throw new \RuntimeException('Native array has a missing buffer');
        if ($scope->ffi->cast('uintptr_t *', \FFI::addr($value->data))[0] % \FFI::alignof($scope->ffi->type('zeropayloadcheckedrecords_witness')) !== 0) throw new \RuntimeException('Native array has a misaligned buffer');
        $memory = $scope->ffi->cast('zeropayloadcheckedrecords_witness *', $value->data);
        $items = [];
        for ($i = 0; $i < $value->length; $i++) $items[] = self::from1($memory[$i], $scope);
        return $items;
    }


    public static function call0(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->zeropayloadcheckedrecords_maybe_witness($input0->cdata, \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanZeropayloadcheckedrecords\LeanBridgeError($message, $status);
            }
            return self::from2($out, $scope);
        } finally {
            try { $ffi->zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call1(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('zeropayloadcheckedrecords_mark');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->zeropayloadcheckedrecords_produce_mark($input0->cdata, \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanZeropayloadcheckedrecords\LeanBridgeError($message, $status);
            }
            return self::from3($out, $scope);
        } finally {
            try { $ffi->zeropayloadcheckedrecords_mark_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call2(): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('zeropayloadcheckedrecords_marker');
        $error = $ffi->new('BridgeError');
        try {

            $status = $ffi->zeropayloadcheckedrecords_produce_marker(\FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanZeropayloadcheckedrecords\LeanBridgeError($message, $status);
            }
            return self::from4($out, $scope);
        } finally {
            try { $ffi->zeropayloadcheckedrecords_marker_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call3(): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('zeropayloadcheckedrecords_token');
        $error = $ffi->new('BridgeError');
        try {

            $status = $ffi->zeropayloadcheckedrecords_produce_token(\FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanZeropayloadcheckedrecords\LeanBridgeError($message, $status);
            }
            return self::from6($out, $scope);
        } finally {
            try { $ffi->zeropayloadcheckedrecords_token_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call4(): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('zeropayloadcheckedrecords_witness');
        $error = $ffi->new('BridgeError');
        try {

            $status = $ffi->zeropayloadcheckedrecords_produce_witness(\FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanZeropayloadcheckedrecords\LeanBridgeError($message, $status);
            }
            return self::from1($out, $scope);
        } finally {
            try { $ffi->zeropayloadcheckedrecords_witness_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call5(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to7(Checks::check7($arg0, $validation), $scope);
            $status = $ffi->zeropayloadcheckedrecords_witnesses(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanZeropayloadcheckedrecords\LeanBridgeError($message, $status);
            }
            return self::from8($out, $scope);
        } finally {
            try { $ffi->zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }
}
