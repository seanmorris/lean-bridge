<?php
declare(strict_types=1);
namespace LeanNestedcheckedrecords\Internal;

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
            \LeanNestedcheckedrecords\Some::class => ['value'],
            \LeanNestedcheckedrecords\Packet::class => ['digit', 'word'],
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
        elseif ($left instanceof \LeanNestedcheckedrecords\Bytes) { $left = $left->toString(); $right = $right->toString(); }
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
        elseif ($value instanceof \LeanNestedcheckedrecords\Bytes) self::text($hash, 'y', $value->toString(), $budget);
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
        if (!$value instanceof \Brick\Math\BigInteger) throw new \TypeError('Expected Brick Math BigInteger');
        $decimal = (string) $value;
        if (strlen($decimal) > 16385 || strlen(ltrim($decimal, '-')) > 16384 || preg_match('/^(?:0|-?[1-9][0-9]*)$/D', $decimal) !== 1) throw new \ValueError('BigInteger requires canonical decimal text of at most 16384 digits');
        $budget->charge(strlen($decimal));
        if ($decimal[0] === '-') throw new \ValueError('Expected an unsigned integer');
        return $value;
    }
    public static function check1(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanNestedcheckedrecords\Packet) throw new \TypeError('Expected Packet');
        if (array_keys(get_object_vars($value)) !== ['digit', 'word']) throw new \TypeError('Packet requires exactly its initialized fields');
        self::check0($value->digit, $budget);
        self::check0($value->word, $budget);
        return $value;
    }
    public static function check2(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_array($value) || !array_is_list($value)) throw new \TypeError('Expected a list with consecutive integer keys');
        $budget->charge(count($value), 32);
        $result = [];
        foreach ($value as $item) $result[] = self::check1($item, $budget);
        return $result;
    }
    public static function check3(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if ($value === null) return null;
        if ($value instanceof \LeanNestedcheckedrecords\Some) {
            if (array_keys(get_object_vars($value)) !== ['value']) throw new \TypeError('Some requires one initialized value field');
            return new \LeanNestedcheckedrecords\Some(self::check1($value->value, $budget));
        }
        throw new \TypeError('Expected Some');
    }
}

final class Native
{
    private const DEFINITIONS = <<<'CDEFS'
typedef struct { int code; void *message; size_t message_length; } BridgeError;
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } nestedcheckedrecords_nat;
void nestedcheckedrecords_nat_clear(nestedcheckedrecords_nat *);
typedef struct { nestedcheckedrecords_nat digit; nestedcheckedrecords_nat word; } nestedcheckedrecords_packet;
void nestedcheckedrecords_packet_clear(nestedcheckedrecords_packet *);
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } nestedcheckedrecords_array_lean_nested_checked_records_packet_span;
void nestedcheckedrecords_array_lean_nested_checked_records_packet_span_clear(nestedcheckedrecords_array_lean_nested_checked_records_packet_span *);
typedef struct { uint8_t has_value; nestedcheckedrecords_packet value; } nestedcheckedrecords_option_lean_nested_checked_records_packet_value;
void nestedcheckedrecords_option_lean_nested_checked_records_packet_value_clear(nestedcheckedrecords_option_lean_nested_checked_records_packet_value *);
int nestedcheckedrecords_produce_array(nestedcheckedrecords_nat *, nestedcheckedrecords_array_lean_nested_checked_records_packet_span *, BridgeError *);
int nestedcheckedrecords_produce_option(nestedcheckedrecords_nat *, nestedcheckedrecords_option_lean_nested_checked_records_packet_value *, BridgeError *);
CDEFS;
    private static ?\FFI $ffi = null;
    private static function load(): \FFI {
        return \LeanBridge\CopiedNativeV1\Runtime::load(__DIR__ . '/../../native/linux-x64', json_decode(<<<'EVIDENCE'
{
  "componentId": "nestedcheckedrecords@1.0.0",
  "componentReceiptSha256": "a0530e4889f88f64d2bb798cdd1ffb7108b610879a54109c90233b3f82d78e02",
  "identity": "89d35dc13eac49b1b215264f6232464f3f4f4a6348c031757a52ee96e04ca117",
  "libraries": {
    "libcomponent_a63244d529ededa079e7.so": "960bf714f5e9633c5e75df7692c33af63e6d467f8e1f9d63d0d1fef300596de8",
    "liblean_bridge_native.so": "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7",
    "libleanshared.so": "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4",
    "libnestedcheckedrecords.so": "b47fe7b884ba06a3dbe90916139625b89bb3edda9389205d080e92e7de06d903"
  },
  "library": "libnestedcheckedrecords.so",
  "loadOrder": [
    "libleanshared.so",
    "liblean_bridge_native.so",
    "libcomponent_a63244d529ededa079e7.so",
    "libnestedcheckedrecords.so"
  ],
  "runtimeIdentity": "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
}
EVIDENCE, true, 512, JSON_THROW_ON_ERROR), self::DEFINITIONS);
    }
    private static function to0(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nestedcheckedrecords_nat');
        $decimal = (string) $value;
        $words = IntegerCodec::limbs($decimal);
        $scope->budget->charge(count($words), 32);
        $bytes = $words ? pack('V*', ...$words) : '';
        $out->length = count($words);
        $out->data = $scope->buffer($bytes);
        return $out;
    }
    private static function from0(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value->length < 0 || $value->length > 1701) throw new \ValueError('BigInteger decimal conversion limit exceeded');
        $bytes = $scope->read($value->data, $value->length * 4, 8, 4);
        $words = $bytes === '' ? [] : array_values(unpack('V*', $bytes));
        if ($words && $words[count($words) - 1] === 0) throw new \RuntimeException('Invalid native integer magnitude');
        return \Brick\Math\BigInteger::of(IntegerCodec::decimal($words, false));
    }
    private static function to1(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nestedcheckedrecords_packet');
        $field0_digit = self::to0($value->digit, $scope);
        $out->digit = $field0_digit;
        $field0_word = self::to0($value->word, $scope);
        $out->word = $field0_word;
        return $out;
    }
    private static function from1(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanNestedcheckedrecords\Packet(self::from0($value->digit, $scope), self::from0($value->word, $scope));
    }
    private static function to2(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nestedcheckedrecords_array_lean_nested_checked_records_packet_span');
        $scope->budget->charge(count($value), 32);
        $memory = $scope->allocate('nestedcheckedrecords_packet', count($value), true);
        foreach ($value as $i => $item) { $entry = self::to1($item, $scope); $memory[$i] = $entry; }
        $out->data = count($value) ? \FFI::addr($memory[0]) : null;
        $out->length = count($value);
        return $out;
    }
    private static function from2(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        $scope->budget->charge($value->length, max(32, \FFI::sizeof($scope->ffi->type('nestedcheckedrecords_packet'))));
        if (!$value->length) return [];
        if ($value->data === null || \FFI::isNull($value->data)) throw new \RuntimeException('Native array has a missing buffer');
        if ($scope->ffi->cast('uintptr_t *', \FFI::addr($value->data))[0] % \FFI::alignof($scope->ffi->type('nestedcheckedrecords_packet')) !== 0) throw new \RuntimeException('Native array has a misaligned buffer');
        $memory = $scope->ffi->cast('nestedcheckedrecords_packet *', $value->data);
        $items = [];
        for ($i = 0; $i < $value->length; $i++) $items[] = self::from1($memory[$i], $scope);
        return $items;
    }
    private static function to3(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nestedcheckedrecords_option_lean_nested_checked_records_packet_value');
        if ($value !== null) {
            $out->has_value = 1;
            $item = self::to1($value->value, $scope);
            $out->value = $item;
        }
        return $out;
    }
    private static function from3(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value->has_value !== 0 && $value->has_value !== 1) throw new \RuntimeException('Invalid native Option flag');
        return $value->has_value === 0 ? null : new \LeanNestedcheckedrecords\Some(self::from1($value->value, $scope));
    }


    public static function call0(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nestedcheckedrecords_array_lean_nested_checked_records_packet_span');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nestedcheckedrecords_produce_array(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNestedcheckedrecords\LeanBridgeError($message, $status);
            }
            return self::from2($out, $scope);
        } finally {
            try { $ffi->nestedcheckedrecords_array_lean_nested_checked_records_packet_span_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nestedcheckedrecords_option_lean_nested_checked_records_packet_value');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nestedcheckedrecords_produce_option(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNestedcheckedrecords\LeanBridgeError($message, $status);
            }
            return self::from3($out, $scope);
        } finally {
            try { $ffi->nestedcheckedrecords_option_lean_nested_checked_records_packet_value_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }
}
