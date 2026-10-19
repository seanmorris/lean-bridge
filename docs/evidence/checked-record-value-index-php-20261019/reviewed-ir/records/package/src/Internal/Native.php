<?php
declare(strict_types=1);
namespace LeanCheckedrecordvalueindices\Internal;

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
            \LeanCheckedrecordvalueindices\Ab::class => ['size'],
            \LeanCheckedrecordvalueindices\EmptySized::class => ['data'],
            \LeanCheckedrecordvalueindices\EmptyToken::class => ['count'],
            \LeanCheckedrecordvalueindices\Off::class => ['count'],
            \LeanCheckedrecordvalueindices\On::class => ['count'],
            \LeanCheckedrecordvalueindices\UnicodeToken::class => ['count'],
            \LeanCheckedrecordvalueindices\WideToken::class => ['count'],
            \LeanCheckedrecordvalueindices\ZeroToken::class => ['count'],
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
        elseif ($left instanceof \LeanCheckedrecordvalueindices\Bytes) { $left = $left->toString(); $right = $right->toString(); }
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
        elseif ($value instanceof \LeanCheckedrecordvalueindices\Bytes) self::text($hash, 'y', $value->toString(), $budget);
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
        if (!$value instanceof \LeanCheckedrecordvalueindices\Ab) throw new \TypeError('Expected Ab');
        if (array_keys(get_object_vars($value)) !== ['size']) throw new \TypeError('Ab requires exactly its initialized fields');
        self::check0($value->size, $budget);
        return $value;
    }
    public static function check2(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_array($value) || !array_is_list($value)) throw new \TypeError('Expected a list with consecutive integer keys');
        $budget->charge(count($value), 32);
        $result = [];
        foreach ($value as $item) $result[] = self::check0($item, $budget);
        return $result;
    }
    public static function check3(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanCheckedrecordvalueindices\EmptySized) throw new \TypeError('Expected EmptySized');
        if (array_keys(get_object_vars($value)) !== ['data']) throw new \TypeError('EmptySized requires exactly its initialized fields');
        self::check2($value->data, $budget);
        return $value;
    }
    public static function check4(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanCheckedrecordvalueindices\EmptyToken) throw new \TypeError('Expected EmptyToken');
        if (array_keys(get_object_vars($value)) !== ['count']) throw new \TypeError('EmptyToken requires exactly its initialized fields');
        self::check0($value->count, $budget);
        return $value;
    }
    public static function check5(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanCheckedrecordvalueindices\Off) throw new \TypeError('Expected Off');
        if (array_keys(get_object_vars($value)) !== ['count']) throw new \TypeError('Off requires exactly its initialized fields');
        self::check0($value->count, $budget);
        return $value;
    }
    public static function check6(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanCheckedrecordvalueindices\On) throw new \TypeError('Expected On');
        if (array_keys(get_object_vars($value)) !== ['count']) throw new \TypeError('On requires exactly its initialized fields');
        self::check0($value->count, $budget);
        return $value;
    }
    public static function check7(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanCheckedrecordvalueindices\UnicodeToken) throw new \TypeError('Expected UnicodeToken');
        if (array_keys(get_object_vars($value)) !== ['count']) throw new \TypeError('UnicodeToken requires exactly its initialized fields');
        self::check0($value->count, $budget);
        return $value;
    }
    public static function check8(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanCheckedrecordvalueindices\WideToken) throw new \TypeError('Expected WideToken');
        if (array_keys(get_object_vars($value)) !== ['count']) throw new \TypeError('WideToken requires exactly its initialized fields');
        self::check0($value->count, $budget);
        return $value;
    }
    public static function check9(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanCheckedrecordvalueindices\ZeroToken) throw new \TypeError('Expected ZeroToken');
        if (array_keys(get_object_vars($value)) !== ['count']) throw new \TypeError('ZeroToken requires exactly its initialized fields');
        self::check0($value->count, $budget);
        return $value;
    }
}

final class Native
{
    private const DEFINITIONS = <<<'CDEFS'
typedef struct { int code; void *message; size_t message_length; } BridgeError;
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } checkedrecordvalueindices_nat;
void checkedrecordvalueindices_nat_clear(checkedrecordvalueindices_nat *);
typedef struct { checkedrecordvalueindices_nat size; } checkedrecordvalueindices_ab;
void checkedrecordvalueindices_ab_clear(checkedrecordvalueindices_ab *);
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } checkedrecordvalueindices_array_nat_span;
void checkedrecordvalueindices_array_nat_span_clear(checkedrecordvalueindices_array_nat_span *);
typedef struct { checkedrecordvalueindices_array_nat_span data; } checkedrecordvalueindices_empty_sized;
void checkedrecordvalueindices_empty_sized_clear(checkedrecordvalueindices_empty_sized *);
typedef struct { checkedrecordvalueindices_nat count; } checkedrecordvalueindices_empty_token;
void checkedrecordvalueindices_empty_token_clear(checkedrecordvalueindices_empty_token *);
typedef struct { checkedrecordvalueindices_nat count; } checkedrecordvalueindices_off;
void checkedrecordvalueindices_off_clear(checkedrecordvalueindices_off *);
typedef struct { checkedrecordvalueindices_nat count; } checkedrecordvalueindices_on;
void checkedrecordvalueindices_on_clear(checkedrecordvalueindices_on *);
typedef struct { checkedrecordvalueindices_nat count; } checkedrecordvalueindices_unicode_token;
void checkedrecordvalueindices_unicode_token_clear(checkedrecordvalueindices_unicode_token *);
typedef struct { checkedrecordvalueindices_nat count; } checkedrecordvalueindices_wide_token;
void checkedrecordvalueindices_wide_token_clear(checkedrecordvalueindices_wide_token *);
typedef struct { checkedrecordvalueindices_nat count; } checkedrecordvalueindices_zero_token;
void checkedrecordvalueindices_zero_token_clear(checkedrecordvalueindices_zero_token *);
int checkedrecordvalueindices_ab_string_index(checkedrecordvalueindices_ab *, checkedrecordvalueindices_nat *, BridgeError *);
int checkedrecordvalueindices_empty_sized_index(checkedrecordvalueindices_empty_sized *, checkedrecordvalueindices_nat *, BridgeError *);
int checkedrecordvalueindices_empty_string_index(checkedrecordvalueindices_empty_token *, checkedrecordvalueindices_nat *, BridgeError *);
int checkedrecordvalueindices_false_bool_index(checkedrecordvalueindices_off *, checkedrecordvalueindices_nat *, BridgeError *);
int checkedrecordvalueindices_produce_ab(checkedrecordvalueindices_ab *, BridgeError *);
int checkedrecordvalueindices_produce_empty_sized(checkedrecordvalueindices_empty_sized *, BridgeError *);
int checkedrecordvalueindices_produce_empty_string(checkedrecordvalueindices_nat *, checkedrecordvalueindices_empty_token *, BridgeError *);
int checkedrecordvalueindices_produce_false_bool(checkedrecordvalueindices_off *, BridgeError *);
int checkedrecordvalueindices_produce_true_bool(checkedrecordvalueindices_on *, BridgeError *);
int checkedrecordvalueindices_produce_unicode_string(checkedrecordvalueindices_nat *, checkedrecordvalueindices_unicode_token *, BridgeError *);
int checkedrecordvalueindices_produce_wide_nat(checkedrecordvalueindices_nat *, checkedrecordvalueindices_wide_token *, BridgeError *);
int checkedrecordvalueindices_produce_zero_nat(checkedrecordvalueindices_nat *, checkedrecordvalueindices_zero_token *, BridgeError *);
int checkedrecordvalueindices_true_bool_index(checkedrecordvalueindices_on *, checkedrecordvalueindices_nat *, BridgeError *);
int checkedrecordvalueindices_unicode_string_index(checkedrecordvalueindices_unicode_token *, checkedrecordvalueindices_nat *, BridgeError *);
int checkedrecordvalueindices_wide_nat_index(checkedrecordvalueindices_wide_token *, checkedrecordvalueindices_nat *, BridgeError *);
int checkedrecordvalueindices_zero_nat_index(checkedrecordvalueindices_zero_token *, checkedrecordvalueindices_nat *, BridgeError *);
CDEFS;
    private static ?\FFI $ffi = null;
    private static function load(): \FFI {
        return \LeanBridge\CopiedNativeV1\Runtime::load(__DIR__ . '/../../native/linux-x64', json_decode(<<<'EVIDENCE'
{
  "componentId": "checkedrecordvalueindices@1.0.0",
  "componentReceiptSha256": "41ee978a686d5790a1b77d7661130d62a7610b5cf819b892d39fe4749501853b",
  "identity": "0a37d94ed4c5f089e4907e79a381fb9fac5be199e60107dc16d4ee5c06805942",
  "libraries": {
    "libcheckedrecordvalueindices.so": "fdcddf87c8fdd6f792ecda1b280d4d23ef8a6c0e6c01aa0eb346c2c33dcf34da",
    "libcomponent_767c615eabad08d77709.so": "39941bbf2ec5f61793b17581a6f4e1e79725ec63f2fd2a6d5a5cbfa7274ae1e6",
    "liblean_bridge_native.so": "459fcd2098d4b646ab6ae0f4cdccd1f222908cb162562bfc3940a533cd4e4e21",
    "libleanshared.so": "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"
  },
  "library": "libcheckedrecordvalueindices.so",
  "loadOrder": [
    "libleanshared.so",
    "liblean_bridge_native.so",
    "libcomponent_767c615eabad08d77709.so",
    "libcheckedrecordvalueindices.so"
  ],
  "runtimeIdentity": "4b5a7fdf0cb11d4bb429181cfd50b330c5622ed8f5f5382a293955a439b595b5"
}
EVIDENCE, true, 512, JSON_THROW_ON_ERROR), self::DEFINITIONS);
    }
    private static function to0(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('checkedrecordvalueindices_nat');
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
        $out = $scope->allocate('checkedrecordvalueindices_ab');
        $field0_size = self::to0($value->size, $scope);
        $out->size = $field0_size;
        return $out;
    }
    private static function from1(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanCheckedrecordvalueindices\Ab(self::from0($value->size, $scope));
    }
    private static function to2(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('checkedrecordvalueindices_array_nat_span');
        $scope->budget->charge(count($value), 32);
        $memory = $scope->allocate('checkedrecordvalueindices_nat', count($value), true);
        foreach ($value as $i => $item) { $entry = self::to0($item, $scope); $memory[$i] = $entry; }
        $out->data = count($value) ? \FFI::addr($memory[0]) : null;
        $out->length = count($value);
        return $out;
    }
    private static function from2(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        $scope->budget->charge($value->length, max(32, \FFI::sizeof($scope->ffi->type('checkedrecordvalueindices_nat'))));
        if (!$value->length) return [];
        if ($value->data === null || \FFI::isNull($value->data)) throw new \RuntimeException('Native array has a missing buffer');
        if ($scope->ffi->cast('uintptr_t *', \FFI::addr($value->data))[0] % \FFI::alignof($scope->ffi->type('checkedrecordvalueindices_nat')) !== 0) throw new \RuntimeException('Native array has a misaligned buffer');
        $memory = $scope->ffi->cast('checkedrecordvalueindices_nat *', $value->data);
        $items = [];
        for ($i = 0; $i < $value->length; $i++) $items[] = self::from0($memory[$i], $scope);
        return $items;
    }
    private static function to3(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('checkedrecordvalueindices_empty_sized');
        $field2_data = self::to2($value->data, $scope);
        $out->data = $field2_data;
        return $out;
    }
    private static function from3(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanCheckedrecordvalueindices\EmptySized(self::from2($value->data, $scope));
    }
    private static function to4(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('checkedrecordvalueindices_empty_token');
        $field0_count = self::to0($value->count, $scope);
        $out->count = $field0_count;
        return $out;
    }
    private static function from4(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanCheckedrecordvalueindices\EmptyToken(self::from0($value->count, $scope));
    }
    private static function to5(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('checkedrecordvalueindices_off');
        $field0_count = self::to0($value->count, $scope);
        $out->count = $field0_count;
        return $out;
    }
    private static function from5(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanCheckedrecordvalueindices\Off(self::from0($value->count, $scope));
    }
    private static function to6(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('checkedrecordvalueindices_on');
        $field0_count = self::to0($value->count, $scope);
        $out->count = $field0_count;
        return $out;
    }
    private static function from6(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanCheckedrecordvalueindices\On(self::from0($value->count, $scope));
    }
    private static function to7(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('checkedrecordvalueindices_unicode_token');
        $field0_count = self::to0($value->count, $scope);
        $out->count = $field0_count;
        return $out;
    }
    private static function from7(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanCheckedrecordvalueindices\UnicodeToken(self::from0($value->count, $scope));
    }
    private static function to8(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('checkedrecordvalueindices_wide_token');
        $field0_count = self::to0($value->count, $scope);
        $out->count = $field0_count;
        return $out;
    }
    private static function from8(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanCheckedrecordvalueindices\WideToken(self::from0($value->count, $scope));
    }
    private static function to9(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('checkedrecordvalueindices_zero_token');
        $field0_count = self::to0($value->count, $scope);
        $out->count = $field0_count;
        return $out;
    }
    private static function from9(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanCheckedrecordvalueindices\ZeroToken(self::from0($value->count, $scope));
    }


    public static function call0(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to1(Checks::check1($arg0, $validation), $scope);
            $status = $ffi->checkedrecordvalueindices_ab_string_index(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_nat_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('checkedrecordvalueindices_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to3(Checks::check3($arg0, $validation), $scope);
            $status = $ffi->checkedrecordvalueindices_empty_sized_index(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_nat_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call2(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to4(Checks::check4($arg0, $validation), $scope);
            $status = $ffi->checkedrecordvalueindices_empty_string_index(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_nat_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call3(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to5(Checks::check5($arg0, $validation), $scope);
            $status = $ffi->checkedrecordvalueindices_false_bool_index(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_nat_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('checkedrecordvalueindices_ab');
        $error = $ffi->new('BridgeError');
        try {

            $status = $ffi->checkedrecordvalueindices_produce_ab(\FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from1($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_ab_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call5(): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_empty_sized');
        $error = $ffi->new('BridgeError');
        try {

            $status = $ffi->checkedrecordvalueindices_produce_empty_sized(\FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from3($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_empty_sized_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call6(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_empty_token');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->checkedrecordvalueindices_produce_empty_string(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from4($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_empty_token_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call7(): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_off');
        $error = $ffi->new('BridgeError');
        try {

            $status = $ffi->checkedrecordvalueindices_produce_false_bool(\FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from5($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_off_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call8(): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_on');
        $error = $ffi->new('BridgeError');
        try {

            $status = $ffi->checkedrecordvalueindices_produce_true_bool(\FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from6($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_on_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call9(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_unicode_token');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->checkedrecordvalueindices_produce_unicode_string(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from7($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_unicode_token_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call10(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_wide_token');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->checkedrecordvalueindices_produce_wide_nat(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from8($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_wide_token_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call11(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_zero_token');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->checkedrecordvalueindices_produce_zero_nat(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from9($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_zero_token_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call12(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to6(Checks::check6($arg0, $validation), $scope);
            $status = $ffi->checkedrecordvalueindices_true_bool_index(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_nat_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call13(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to7(Checks::check7($arg0, $validation), $scope);
            $status = $ffi->checkedrecordvalueindices_unicode_string_index(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_nat_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call14(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to8(Checks::check8($arg0, $validation), $scope);
            $status = $ffi->checkedrecordvalueindices_wide_nat_index(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_nat_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call15(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('checkedrecordvalueindices_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to9(Checks::check9($arg0, $validation), $scope);
            $status = $ffi->checkedrecordvalueindices_zero_nat_index(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanCheckedrecordvalueindices\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->checkedrecordvalueindices_nat_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }
}
