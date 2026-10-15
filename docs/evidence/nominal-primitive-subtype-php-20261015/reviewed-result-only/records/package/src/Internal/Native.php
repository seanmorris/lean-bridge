<?php
declare(strict_types=1);
namespace LeanNominalprimitivesubtypes\Internal;

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
            \LeanNominalprimitivesubtypes\Some::class => ['value'],
            \LeanNominalprimitivesubtypes\Ok::class => ['value'],
            \LeanNominalprimitivesubtypes\Err::class => ['value'],
            \LeanNominalprimitivesubtypes\RawPacket::class => ['unitValue', 'boolValue', 'uint8Value', 'uint16Value', 'uint32Value', 'uint64Value', 'int8Value', 'int16Value', 'int32Value', 'int64Value', 'natValue', 'intValue', 'float32Value', 'float64Value', 'textValue', 'bytesValue', 'charValue', 'usizeValue', 'isizeValue', 'digit'],
            \LeanNominalprimitivesubtypes\Packet::class => ['unitValue', 'boolValue', 'uint8Value', 'uint16Value', 'uint32Value', 'uint64Value', 'int8Value', 'int16Value', 'int32Value', 'int64Value', 'natValue', 'intValue', 'float32Value', 'float64Value', 'textValue', 'bytesValue', 'charValue', 'usizeValue', 'isizeValue', 'digit'],
            \LeanNominalprimitivesubtypes\Pair::class => ['left', 'right'],
            \LeanNominalprimitivesubtypes\EventEmpty::class => [],
            \LeanNominalprimitivesubtypes\EventBox::class => ['value'],
            \LeanNominalprimitivesubtypes\EventChoices::class => ['values'],
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
        elseif ($left instanceof \LeanNominalprimitivesubtypes\Bytes) { $left = $left->toString(); $right = $right->toString(); }
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
        elseif ($value instanceof \LeanNominalprimitivesubtypes\Bytes) self::text($hash, 'y', $value->toString(), $budget);
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
        if ($value !== null) throw new \TypeError('Unit requires null');
        return $value;
    }
    public static function check1(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_bool($value)) throw new \TypeError('Bool requires bool');
        return $value;
    }
    public static function check2(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_int($value)) throw new \TypeError('Expected an int without numeric coercion');
        if ($value < 0 || $value > 255) throw new \ValueError('Integer is outside the declared Lean range');
        return $value;
    }
    public static function check3(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_int($value)) throw new \TypeError('Expected an int without numeric coercion');
        if ($value < 0 || $value > 65535) throw new \ValueError('Integer is outside the declared Lean range');
        return $value;
    }
    public static function check4(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_int($value)) throw new \TypeError('Expected an int without numeric coercion');
        if ($value < 0 || $value > 4294967295) throw new \ValueError('Integer is outside the declared Lean range');
        return $value;
    }
    public static function check5(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \Brick\Math\BigInteger) throw new \TypeError('Expected Brick Math BigInteger');
        $decimal = (string) $value;
        if (strlen($decimal) > 16385 || strlen(ltrim($decimal, '-')) > 16384 || preg_match('/^(?:0|-?[1-9][0-9]*)$/D', $decimal) !== 1) throw new \ValueError('BigInteger requires canonical decimal text of at most 16384 digits');
        $budget->charge(strlen($decimal));
        if ($decimal[0] === '-') throw new \ValueError('Expected an unsigned integer');
        if (strlen($decimal) > 20 || (strlen($decimal) === 20 && strcmp($decimal, '18446744073709551615') > 0)) throw new \ValueError('Integer is outside the UInt64 range');
        return $value;
    }
    public static function check6(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_int($value)) throw new \TypeError('Expected an int without numeric coercion');
        if ($value < -128 || $value > 127) throw new \ValueError('Integer is outside the declared Lean range');
        return $value;
    }
    public static function check7(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_int($value)) throw new \TypeError('Expected an int without numeric coercion');
        if ($value < -32768 || $value > 32767) throw new \ValueError('Integer is outside the declared Lean range');
        return $value;
    }
    public static function check8(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_int($value)) throw new \TypeError('Expected an int without numeric coercion');
        if ($value < -2147483648 || $value > 2147483647) throw new \ValueError('Integer is outside the declared Lean range');
        return $value;
    }
    public static function check9(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_int($value)) throw new \TypeError('Expected an int without numeric coercion');
        return $value;
    }
    public static function check10(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \Brick\Math\BigInteger) throw new \TypeError('Expected Brick Math BigInteger');
        $decimal = (string) $value;
        if (strlen($decimal) > 16385 || strlen(ltrim($decimal, '-')) > 16384 || preg_match('/^(?:0|-?[1-9][0-9]*)$/D', $decimal) !== 1) throw new \ValueError('BigInteger requires canonical decimal text of at most 16384 digits');
        $budget->charge(strlen($decimal));
        if ($decimal[0] === '-') throw new \ValueError('Expected an unsigned integer');
        return $value;
    }
    public static function check11(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \Brick\Math\BigInteger) throw new \TypeError('Expected Brick Math BigInteger');
        $decimal = (string) $value;
        if (strlen($decimal) > 16385 || strlen(ltrim($decimal, '-')) > 16384 || preg_match('/^(?:0|-?[1-9][0-9]*)$/D', $decimal) !== 1) throw new \ValueError('BigInteger requires canonical decimal text of at most 16384 digits');
        $budget->charge(strlen($decimal));
        return $value;
    }
    public static function check12(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_float($value)) throw new \TypeError('Expected a float without numeric coercion');
        return $value;
    }
    public static function check13(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_float($value)) throw new \TypeError('Expected a float without numeric coercion');
        return $value;
    }
    public static function check14(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_string($value)) throw new \TypeError('Expected a UTF-8 string');
        $budget->charge(strlen($value));
        if (preg_match('//u', $value) !== 1) throw new \ValueError('String requires valid UTF-8');
        return $value;
    }
    public static function check15(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanNominalprimitivesubtypes\Bytes) throw new \TypeError('Expected Bytes');
        $budget->charge(strlen($value->toString()));
        return $value;
    }
    public static function check16(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_string($value)) throw new \TypeError('Char requires a string');
        if (strlen($value) < 1 || strlen($value) > 4 || preg_match('/\\A.\\z/us', $value) !== 1) throw new \ValueError('Char requires one Unicode scalar');
        return $value;
    }
    public static function check17(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \Brick\Math\BigInteger) throw new \TypeError('Expected Brick Math BigInteger');
        $decimal = (string) $value;
        if (strlen($decimal) > 16385 || strlen(ltrim($decimal, '-')) > 16384 || preg_match('/^(?:0|-?[1-9][0-9]*)$/D', $decimal) !== 1) throw new \ValueError('BigInteger requires canonical decimal text of at most 16384 digits');
        $budget->charge(strlen($decimal));
        if ($decimal[0] === '-') throw new \ValueError('Expected an unsigned integer');
        if (strlen($decimal) > 20 || (strlen($decimal) === 20 && strcmp($decimal, '18446744073709551615') > 0)) throw new \ValueError('Integer is outside the UInt64 range');
        return $value;
    }
    public static function check18(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_int($value)) throw new \TypeError('Expected an int without numeric coercion');
        return $value;
    }
    public static function check19(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanNominalprimitivesubtypes\RawPacket) throw new \TypeError('Expected RawPacket');
        if (array_keys(get_object_vars($value)) !== ['unitValue', 'boolValue', 'uint8Value', 'uint16Value', 'uint32Value', 'uint64Value', 'int8Value', 'int16Value', 'int32Value', 'int64Value', 'natValue', 'intValue', 'float32Value', 'float64Value', 'textValue', 'bytesValue', 'charValue', 'usizeValue', 'isizeValue', 'digit']) throw new \TypeError('RawPacket requires exactly its initialized fields');
        self::check0($value->unitValue, $budget);
        self::check1($value->boolValue, $budget);
        self::check2($value->uint8Value, $budget);
        self::check3($value->uint16Value, $budget);
        self::check4($value->uint32Value, $budget);
        self::check5($value->uint64Value, $budget);
        self::check6($value->int8Value, $budget);
        self::check7($value->int16Value, $budget);
        self::check8($value->int32Value, $budget);
        self::check9($value->int64Value, $budget);
        self::check10($value->natValue, $budget);
        self::check11($value->intValue, $budget);
        self::check12($value->float32Value, $budget);
        self::check13($value->float64Value, $budget);
        self::check14($value->textValue, $budget);
        self::check15($value->bytesValue, $budget);
        self::check16($value->charValue, $budget);
        self::check17($value->usizeValue, $budget);
        self::check18($value->isizeValue, $budget);
        self::check10($value->digit, $budget);
        return $value;
    }
    public static function check20(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanNominalprimitivesubtypes\Packet) throw new \TypeError('Expected Packet');
        if (array_keys(get_object_vars($value)) !== ['unitValue', 'boolValue', 'uint8Value', 'uint16Value', 'uint32Value', 'uint64Value', 'int8Value', 'int16Value', 'int32Value', 'int64Value', 'natValue', 'intValue', 'float32Value', 'float64Value', 'textValue', 'bytesValue', 'charValue', 'usizeValue', 'isizeValue', 'digit']) throw new \TypeError('Packet requires exactly its initialized fields');
        self::check0($value->unitValue, $budget);
        self::check1($value->boolValue, $budget);
        self::check2($value->uint8Value, $budget);
        self::check3($value->uint16Value, $budget);
        self::check4($value->uint32Value, $budget);
        self::check5($value->uint64Value, $budget);
        self::check6($value->int8Value, $budget);
        self::check7($value->int16Value, $budget);
        self::check8($value->int32Value, $budget);
        self::check9($value->int64Value, $budget);
        self::check10($value->natValue, $budget);
        self::check11($value->intValue, $budget);
        self::check12($value->float32Value, $budget);
        self::check13($value->float64Value, $budget);
        self::check14($value->textValue, $budget);
        self::check15($value->bytesValue, $budget);
        self::check16($value->charValue, $budget);
        self::check17($value->usizeValue, $budget);
        self::check18($value->isizeValue, $budget);
        self::check10($value->digit, $budget);
        return $value;
    }
    public static function check21(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if ($value === null) return null;
        if ($value instanceof \LeanNominalprimitivesubtypes\Some) {
            if (array_keys(get_object_vars($value)) !== ['value']) throw new \TypeError('Some requires one initialized value field');
            return new \LeanNominalprimitivesubtypes\Some(self::check20($value->value, $budget));
        }
        throw new \TypeError('Expected Some');
    }
    public static function check22(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if ($value instanceof \LeanNominalprimitivesubtypes\Ok) {
            if (array_keys(get_object_vars($value)) !== ['value']) throw new \TypeError('Ok requires one initialized value field');
            return new \LeanNominalprimitivesubtypes\Ok(self::check20($value->value, $budget));
        }
        if ($value instanceof \LeanNominalprimitivesubtypes\Err) {
            if (array_keys(get_object_vars($value)) !== ['value']) throw new \TypeError('Err requires one initialized value field');
            return new \LeanNominalprimitivesubtypes\Err(self::check20($value->value, $budget));
        }
        throw new \TypeError('Expected Ok or Err');
    }
    public static function check23(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if ($value === null) return null;
        if ($value instanceof \LeanNominalprimitivesubtypes\Some) {
            if (array_keys(get_object_vars($value)) !== ['value']) throw new \TypeError('Some requires one initialized value field');
            return new \LeanNominalprimitivesubtypes\Some(self::check22($value->value, $budget));
        }
        throw new \TypeError('Expected Some');
    }
    public static function check24(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_array($value) || !array_is_list($value)) throw new \TypeError('Expected a list with consecutive integer keys');
        $budget->charge(count($value), 32);
        $result = [];
        foreach ($value as $item) $result[] = self::check23($item, $budget);
        return $result;
    }
    public static function check25(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if ($value instanceof \LeanNominalprimitivesubtypes\EventEmpty) {
            if (array_keys(get_object_vars($value)) !== []) throw new \TypeError('EventEmpty requires exactly its initialized payload fields');
            return $value;
        }
        if ($value instanceof \LeanNominalprimitivesubtypes\EventBox) {
            if (array_keys(get_object_vars($value)) !== ['value']) throw new \TypeError('EventBox requires exactly its initialized payload fields');
            self::check20($value->value, $budget);
            return $value;
        }
        if ($value instanceof \LeanNominalprimitivesubtypes\EventChoices) {
            if (array_keys(get_object_vars($value)) !== ['values']) throw new \TypeError('EventChoices requires exactly its initialized payload fields');
            self::check24($value->values, $budget);
            return $value;
        }
        throw new \TypeError('Expected an exact Event constructor');
    }
    public static function check26(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_array($value) || !array_is_list($value)) throw new \TypeError('Expected a list with consecutive integer keys');
        $budget->charge(count($value), 32);
        $result = [];
        foreach ($value as $item) $result[] = self::check21($item, $budget);
        return $result;
    }
    public static function check27(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanNominalprimitivesubtypes\Pair) throw new \TypeError('Expected Pair');
        if (array_keys(get_object_vars($value)) !== ['left', 'right']) throw new \TypeError('Pair requires exactly its initialized fields');
        self::check26($value->left, $budget);
        self::check26($value->right, $budget);
        return $value;
    }
}

final class Native
{
    private const DEFINITIONS = <<<'CDEFS'
typedef struct { int code; void *message; size_t message_length; } BridgeError;
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } nominalprimitivesubtypes_nat;
void nominalprimitivesubtypes_nat_clear(nominalprimitivesubtypes_nat *);
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); uint8_t negative; } nominalprimitivesubtypes_int;
void nominalprimitivesubtypes_int_clear(nominalprimitivesubtypes_int *);
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } nominalprimitivesubtypes_string;
void nominalprimitivesubtypes_string_clear(nominalprimitivesubtypes_string *);
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } nominalprimitivesubtypes_bytes;
void nominalprimitivesubtypes_bytes_clear(nominalprimitivesubtypes_bytes *);
typedef struct { uint8_t unit_value; uint8_t bool_value; uint8_t uint8_value; uint16_t uint16_value; uint32_t uint32_value; uint64_t uint64_value; int8_t int8_value; int16_t int16_value; int32_t int32_value; int64_t int64_value; nominalprimitivesubtypes_nat nat_value; nominalprimitivesubtypes_int int_value; float float32_value; double float64_value; nominalprimitivesubtypes_string text_value; nominalprimitivesubtypes_bytes bytes_value; uint32_t char_value; uint64_t usize_value; int64_t isize_value; nominalprimitivesubtypes_nat digit; } nominalprimitivesubtypes_raw_packet;
void nominalprimitivesubtypes_raw_packet_clear(nominalprimitivesubtypes_raw_packet *);
typedef struct { uint8_t unit_value; uint8_t bool_value; uint8_t uint8_value; uint16_t uint16_value; uint32_t uint32_value; uint64_t uint64_value; int8_t int8_value; int16_t int16_value; int32_t int32_value; int64_t int64_value; nominalprimitivesubtypes_nat nat_value; nominalprimitivesubtypes_int int_value; float float32_value; double float64_value; nominalprimitivesubtypes_string text_value; nominalprimitivesubtypes_bytes bytes_value; uint32_t char_value; uint64_t usize_value; int64_t isize_value; nominalprimitivesubtypes_nat digit; } nominalprimitivesubtypes_packet;
void nominalprimitivesubtypes_packet_clear(nominalprimitivesubtypes_packet *);
typedef struct { uint8_t has_value; nominalprimitivesubtypes_packet value; } nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value;
void nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *);
typedef struct { uint8_t is_ok; nominalprimitivesubtypes_packet ok; nominalprimitivesubtypes_packet error; } nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value;
void nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *);
typedef struct { uint8_t has_value; nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value value; } nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value;
void nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *);
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span;
void nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span_clear(nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span *);
typedef struct { uint32_t kind; union { struct { uint8_t empty; } empty; struct { nominalprimitivesubtypes_packet value; } box; struct { nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span values; } choices; } cases; } nominalprimitivesubtypes_event;
void nominalprimitivesubtypes_event_clear(nominalprimitivesubtypes_event *);
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span;
void nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear(nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *);
typedef struct { nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span left; nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span right; } nominalprimitivesubtypes_pair;
void nominalprimitivesubtypes_pair_clear(nominalprimitivesubtypes_pair *);
int nominalprimitivesubtypes_produce(nominalprimitivesubtypes_raw_packet *, nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *, BridgeError *);
int nominalprimitivesubtypes_produce_choices(nominalprimitivesubtypes_raw_packet *, nominalprimitivesubtypes_event *, BridgeError *);
int nominalprimitivesubtypes_produce_event(nominalprimitivesubtypes_raw_packet *, nominalprimitivesubtypes_event *, BridgeError *);
int nominalprimitivesubtypes_produce_group(nominalprimitivesubtypes_raw_packet *, nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *, BridgeError *);
int nominalprimitivesubtypes_produce_pair(nominalprimitivesubtypes_raw_packet *, nominalprimitivesubtypes_pair *, BridgeError *);
int nominalprimitivesubtypes_word_bits(uint32_t *, BridgeError *);
CDEFS;
    private static ?\FFI $ffi = null;
    private static function load(): \FFI {
        return \LeanBridge\CopiedNativeV1\Runtime::load(__DIR__ . '/../../native/linux-x64', json_decode(<<<'EVIDENCE'
{
  "componentId": "nominalprimitivesubtypes@1.0.0",
  "componentReceiptSha256": "1ec6a4931e737f9c0125e6296ce54097a90f8ed14f7eadf49553e7ba6d16339e",
  "identity": "163039540ff9ff1a258659723daef36279c6327ae5ed26f3dd5d758339bf4c06",
  "libraries": {
    "libcomponent_19ad06f04a0c2d39db76.so": "b7b85b630534423c7c72abcecdcdec481bb8b9892a9b67459b7b3edc40718194",
    "liblean_bridge_native.so": "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7",
    "libleanshared.so": "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4",
    "libnominalprimitivesubtypes.so": "22590db65569cbcf1997a7fb44ad5883eab228b89bc487d8cda0004875396488"
  },
  "library": "libnominalprimitivesubtypes.so",
  "loadOrder": [
    "libleanshared.so",
    "liblean_bridge_native.so",
    "libcomponent_19ad06f04a0c2d39db76.so",
    "libnominalprimitivesubtypes.so"
  ],
  "runtimeIdentity": "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
}
EVIDENCE, true, 512, JSON_THROW_ON_ERROR), self::DEFINITIONS);
    }
    private static function to0(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('uint8_t');
        $out->cdata = 0;
        return $out;
    }
    private static function from0(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value !== 0) throw new \RuntimeException('Invalid native Unit marker');
        return null;
    }
    private static function to1(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('uint8_t');
        $out->cdata = $value ? 1 : 0;
        return $out;
    }
    private static function from1(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value !== 0 && $value !== 1) throw new \RuntimeException('Invalid native Bool marker');
        return $value === 1;
    }
    private static function to2(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('uint8_t');
        $out->cdata = $value;
        return $out;
    }
    private static function from2(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return $value;
    }
    private static function to3(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('uint16_t');
        $out->cdata = $value;
        return $out;
    }
    private static function from3(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return $value;
    }
    private static function to4(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('uint32_t');
        $out->cdata = $value;
        return $out;
    }
    private static function from4(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return $value;
    }
    private static function to5(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('uint64_t');
        $words = IntegerCodec::limbs((string) $value);
        \FFI::memcpy(\FFI::addr($out), pack('V2', $words[0] ?? 0, $words[1] ?? 0), 8);
        return $out;
    }
    private static function from5(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return \Brick\Math\BigInteger::of(IntegerCodec::decimal(array_values(unpack('V2', pack('q', $value))), false));
    }
    private static function to6(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('int8_t');
        $out->cdata = $value;
        return $out;
    }
    private static function from6(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return $value;
    }
    private static function to7(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('int16_t');
        $out->cdata = $value;
        return $out;
    }
    private static function from7(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return $value;
    }
    private static function to8(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('int32_t');
        $out->cdata = $value;
        return $out;
    }
    private static function from8(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return $value;
    }
    private static function to9(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('int64_t');
        $out->cdata = $value;
        return $out;
    }
    private static function from9(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return $value;
    }
    private static function to10(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalprimitivesubtypes_nat');
        $decimal = (string) $value;
        $words = IntegerCodec::limbs($decimal);
        $scope->budget->charge(count($words), 32);
        $bytes = $words ? pack('V*', ...$words) : '';
        $out->length = count($words);
        $out->data = $scope->buffer($bytes);
        return $out;
    }
    private static function from10(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value->length < 0 || $value->length > 1701) throw new \ValueError('BigInteger decimal conversion limit exceeded');
        $bytes = $scope->read($value->data, $value->length * 4, 8, 4);
        $words = $bytes === '' ? [] : array_values(unpack('V*', $bytes));
        if ($words && $words[count($words) - 1] === 0) throw new \RuntimeException('Invalid native integer magnitude');
        return \Brick\Math\BigInteger::of(IntegerCodec::decimal($words, false));
    }
    private static function to11(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalprimitivesubtypes_int');
        $decimal = (string) $value;
        $words = IntegerCodec::limbs($decimal);
        $scope->budget->charge(count($words), 32);
        $bytes = $words ? pack('V*', ...$words) : '';
        $out->length = count($words);
        $out->negative = $decimal[0] === '-';
        $out->data = $scope->buffer($bytes);
        return $out;
    }
    private static function from11(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value->length < 0 || $value->length > 1701) throw new \ValueError('BigInteger decimal conversion limit exceeded');
        if (($value->negative !== 0 && $value->negative !== 1) || ($value->negative === 1 && $value->length === 0)) throw new \RuntimeException('Invalid native integer sign');
        $bytes = $scope->read($value->data, $value->length * 4, 8, 4);
        $words = $bytes === '' ? [] : array_values(unpack('V*', $bytes));
        if ($words && $words[count($words) - 1] === 0) throw new \RuntimeException('Invalid native integer magnitude');
        return \Brick\Math\BigInteger::of(IntegerCodec::decimal($words, $value->negative === 1));
    }
    private static function to12(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('float');
        $out->cdata = $value;
        return $out;
    }
    private static function from12(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return $value;
    }
    private static function to13(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('double');
        $out->cdata = $value;
        return $out;
    }
    private static function from13(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return $value;
    }
    private static function to14(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalprimitivesubtypes_string');
        $bytes = $value;
        $out->length = strlen($bytes);
        $out->data = $scope->buffer($bytes);
        return $out;
    }
    private static function from14(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        $bytes = $scope->read($value->data, $value->length);
        if (preg_match('//u', $bytes) !== 1) throw new \RuntimeException('Native string is not valid UTF-8');
        return $bytes;
    }
    private static function to15(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalprimitivesubtypes_bytes');
        $bytes = $value->toString();
        $out->length = strlen($bytes);
        $out->data = $scope->buffer($bytes);
        return $out;
    }
    private static function from15(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        $bytes = $scope->read($value->data, $value->length);
        return \LeanNominalprimitivesubtypes\Bytes::fromString($bytes);
    }
    private static function to16(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('uint32_t');
        $out->cdata = ScalarCodec::point($value);
        return $out;
    }
    private static function from16(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return ScalarCodec::text($value);
    }
    private static function to17(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('uint64_t');
        $words = IntegerCodec::limbs((string) $value);
        \FFI::memcpy(\FFI::addr($out), pack('V2', $words[0] ?? 0, $words[1] ?? 0), 8);
        return $out;
    }
    private static function from17(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return \Brick\Math\BigInteger::of(IntegerCodec::decimal(array_values(unpack('V2', pack('q', $value))), false));
    }
    private static function to18(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('int64_t');
        $out->cdata = $value;
        return $out;
    }
    private static function from18(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return $value;
    }
    private static function to19(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalprimitivesubtypes_raw_packet');
        $field0_unit_value = self::to0($value->unitValue, $scope);
        $out->unit_value = $field0_unit_value->cdata;
        $field1_bool_value = self::to1($value->boolValue, $scope);
        $out->bool_value = $field1_bool_value->cdata;
        $field2_uint8_value = self::to2($value->uint8Value, $scope);
        $out->uint8_value = $field2_uint8_value->cdata;
        $field3_uint16_value = self::to3($value->uint16Value, $scope);
        $out->uint16_value = $field3_uint16_value->cdata;
        $field4_uint32_value = self::to4($value->uint32Value, $scope);
        $out->uint32_value = $field4_uint32_value->cdata;
        $field5_uint64_value = self::to5($value->uint64Value, $scope);
        $out->uint64_value = $field5_uint64_value->cdata;
        $field6_int8_value = self::to6($value->int8Value, $scope);
        $out->int8_value = $field6_int8_value->cdata;
        $field7_int16_value = self::to7($value->int16Value, $scope);
        $out->int16_value = $field7_int16_value->cdata;
        $field8_int32_value = self::to8($value->int32Value, $scope);
        $out->int32_value = $field8_int32_value->cdata;
        $field9_int64_value = self::to9($value->int64Value, $scope);
        $out->int64_value = $field9_int64_value->cdata;
        $field10_nat_value = self::to10($value->natValue, $scope);
        $out->nat_value = $field10_nat_value;
        $field11_int_value = self::to11($value->intValue, $scope);
        $out->int_value = $field11_int_value;
        $field12_float32_value = self::to12($value->float32Value, $scope);
        $out->float32_value = $field12_float32_value->cdata;
        $field13_float64_value = self::to13($value->float64Value, $scope);
        $out->float64_value = $field13_float64_value->cdata;
        $field14_text_value = self::to14($value->textValue, $scope);
        $out->text_value = $field14_text_value;
        $field15_bytes_value = self::to15($value->bytesValue, $scope);
        $out->bytes_value = $field15_bytes_value;
        $field16_char_value = self::to16($value->charValue, $scope);
        $out->char_value = $field16_char_value->cdata;
        $field17_usize_value = self::to17($value->usizeValue, $scope);
        $out->usize_value = $field17_usize_value->cdata;
        $field18_isize_value = self::to18($value->isizeValue, $scope);
        $out->isize_value = $field18_isize_value->cdata;
        $field10_digit = self::to10($value->digit, $scope);
        $out->digit = $field10_digit;
        return $out;
    }
    private static function from19(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanNominalprimitivesubtypes\RawPacket(self::from0($value->unit_value, $scope), self::from1($value->bool_value, $scope), self::from2($value->uint8_value, $scope), self::from3($value->uint16_value, $scope), self::from4($value->uint32_value, $scope), self::from5($value->uint64_value, $scope), self::from6($value->int8_value, $scope), self::from7($value->int16_value, $scope), self::from8($value->int32_value, $scope), self::from9($value->int64_value, $scope), self::from10($value->nat_value, $scope), self::from11($value->int_value, $scope), self::from12($value->float32_value, $scope), self::from13($value->float64_value, $scope), self::from14($value->text_value, $scope), self::from15($value->bytes_value, $scope), self::from16($value->char_value, $scope), self::from17($value->usize_value, $scope), self::from18($value->isize_value, $scope), self::from10($value->digit, $scope));
    }
    private static function to20(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalprimitivesubtypes_packet');
        $field0_unit_value = self::to0($value->unitValue, $scope);
        $out->unit_value = $field0_unit_value->cdata;
        $field1_bool_value = self::to1($value->boolValue, $scope);
        $out->bool_value = $field1_bool_value->cdata;
        $field2_uint8_value = self::to2($value->uint8Value, $scope);
        $out->uint8_value = $field2_uint8_value->cdata;
        $field3_uint16_value = self::to3($value->uint16Value, $scope);
        $out->uint16_value = $field3_uint16_value->cdata;
        $field4_uint32_value = self::to4($value->uint32Value, $scope);
        $out->uint32_value = $field4_uint32_value->cdata;
        $field5_uint64_value = self::to5($value->uint64Value, $scope);
        $out->uint64_value = $field5_uint64_value->cdata;
        $field6_int8_value = self::to6($value->int8Value, $scope);
        $out->int8_value = $field6_int8_value->cdata;
        $field7_int16_value = self::to7($value->int16Value, $scope);
        $out->int16_value = $field7_int16_value->cdata;
        $field8_int32_value = self::to8($value->int32Value, $scope);
        $out->int32_value = $field8_int32_value->cdata;
        $field9_int64_value = self::to9($value->int64Value, $scope);
        $out->int64_value = $field9_int64_value->cdata;
        $field10_nat_value = self::to10($value->natValue, $scope);
        $out->nat_value = $field10_nat_value;
        $field11_int_value = self::to11($value->intValue, $scope);
        $out->int_value = $field11_int_value;
        $field12_float32_value = self::to12($value->float32Value, $scope);
        $out->float32_value = $field12_float32_value->cdata;
        $field13_float64_value = self::to13($value->float64Value, $scope);
        $out->float64_value = $field13_float64_value->cdata;
        $field14_text_value = self::to14($value->textValue, $scope);
        $out->text_value = $field14_text_value;
        $field15_bytes_value = self::to15($value->bytesValue, $scope);
        $out->bytes_value = $field15_bytes_value;
        $field16_char_value = self::to16($value->charValue, $scope);
        $out->char_value = $field16_char_value->cdata;
        $field17_usize_value = self::to17($value->usizeValue, $scope);
        $out->usize_value = $field17_usize_value->cdata;
        $field18_isize_value = self::to18($value->isizeValue, $scope);
        $out->isize_value = $field18_isize_value->cdata;
        $field10_digit = self::to10($value->digit, $scope);
        $out->digit = $field10_digit;
        return $out;
    }
    private static function from20(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanNominalprimitivesubtypes\Packet(self::from0($value->unit_value, $scope), self::from1($value->bool_value, $scope), self::from2($value->uint8_value, $scope), self::from3($value->uint16_value, $scope), self::from4($value->uint32_value, $scope), self::from5($value->uint64_value, $scope), self::from6($value->int8_value, $scope), self::from7($value->int16_value, $scope), self::from8($value->int32_value, $scope), self::from9($value->int64_value, $scope), self::from10($value->nat_value, $scope), self::from11($value->int_value, $scope), self::from12($value->float32_value, $scope), self::from13($value->float64_value, $scope), self::from14($value->text_value, $scope), self::from15($value->bytes_value, $scope), self::from16($value->char_value, $scope), self::from17($value->usize_value, $scope), self::from18($value->isize_value, $scope), self::from10($value->digit, $scope));
    }
    private static function to21(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value');
        if ($value !== null) {
            $out->has_value = 1;
            $item = self::to20($value->value, $scope);
            $out->value = $item;
        }
        return $out;
    }
    private static function from21(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value->has_value !== 0 && $value->has_value !== 1) throw new \RuntimeException('Invalid native Option flag');
        return $value->has_value === 0 ? null : new \LeanNominalprimitivesubtypes\Some(self::from20($value->value, $scope));
    }
    private static function to22(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value');
        if ($value instanceof \LeanNominalprimitivesubtypes\Ok) {
            $out->is_ok = 1;
            $item = self::to20($value->value, $scope);
            $out->ok = $item;
        } else {
            $item = self::to20($value->value, $scope);
            $out->error = $item;
        }
        return $out;
    }
    private static function from22(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value->is_ok !== 0 && $value->is_ok !== 1) throw new \RuntimeException('Invalid native Except flag');
        return $value->is_ok === 1 ? new \LeanNominalprimitivesubtypes\Ok(self::from20($value->ok, $scope)) : new \LeanNominalprimitivesubtypes\Err(self::from20($value->error, $scope));
    }
    private static function to23(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value');
        if ($value !== null) {
            $out->has_value = 1;
            $item = self::to22($value->value, $scope);
            $out->value = $item;
        }
        return $out;
    }
    private static function from23(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value->has_value !== 0 && $value->has_value !== 1) throw new \RuntimeException('Invalid native Option flag');
        return $value->has_value === 0 ? null : new \LeanNominalprimitivesubtypes\Some(self::from22($value->value, $scope));
    }
    private static function to24(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span');
        $scope->budget->charge(count($value), 32);
        $memory = $scope->allocate('nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value', count($value), true);
        foreach ($value as $i => $item) { $entry = self::to23($item, $scope); $memory[$i] = $entry; }
        $out->data = count($value) ? \FFI::addr($memory[0]) : null;
        $out->length = count($value);
        return $out;
    }
    private static function from24(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        $scope->budget->charge($value->length, max(32, \FFI::sizeof($scope->ffi->type('nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value'))));
        if (!$value->length) return [];
        if ($value->data === null || \FFI::isNull($value->data)) throw new \RuntimeException('Native array has a missing buffer');
        if ($scope->ffi->cast('uintptr_t *', \FFI::addr($value->data))[0] % \FFI::alignof($scope->ffi->type('nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value')) !== 0) throw new \RuntimeException('Native array has a misaligned buffer');
        $memory = $scope->ffi->cast('nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *', $value->data);
        $items = [];
        for ($i = 0; $i < $value->length; $i++) $items[] = self::from23($memory[$i], $scope);
        return $items;
    }
    private static function to25(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalprimitivesubtypes_event');
        if ($value instanceof \LeanNominalprimitivesubtypes\EventEmpty) {
            $out->kind = 0;
        }
        else if ($value instanceof \LeanNominalprimitivesubtypes\EventBox) {
            $out->kind = 1;
            $item = self::to20($value->value, $scope);
            $out->cases->box->value = $item;
        }
        else if ($value instanceof \LeanNominalprimitivesubtypes\EventChoices) {
            $out->kind = 2;
            $item = self::to24($value->values, $scope);
            $out->cases->choices->values = $item;
        }
        else throw new \TypeError('Expected an exact Event constructor');
        return $out;
    }
    private static function from25(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        switch ($value->kind) {
        case 0: return new \LeanNominalprimitivesubtypes\EventEmpty();
        case 1: return new \LeanNominalprimitivesubtypes\EventBox(self::from20($value->cases->box->value, $scope));
        case 2: return new \LeanNominalprimitivesubtypes\EventChoices(self::from24($value->cases->choices->values, $scope));
        default: throw new \RuntimeException('Invalid native Event constructor');
        }
    }
    private static function to26(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span');
        $scope->budget->charge(count($value), 32);
        $memory = $scope->allocate('nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value', count($value), true);
        foreach ($value as $i => $item) { $entry = self::to21($item, $scope); $memory[$i] = $entry; }
        $out->data = count($value) ? \FFI::addr($memory[0]) : null;
        $out->length = count($value);
        return $out;
    }
    private static function from26(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        $scope->budget->charge($value->length, max(32, \FFI::sizeof($scope->ffi->type('nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value'))));
        if (!$value->length) return [];
        if ($value->data === null || \FFI::isNull($value->data)) throw new \RuntimeException('Native array has a missing buffer');
        if ($scope->ffi->cast('uintptr_t *', \FFI::addr($value->data))[0] % \FFI::alignof($scope->ffi->type('nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value')) !== 0) throw new \RuntimeException('Native array has a misaligned buffer');
        $memory = $scope->ffi->cast('nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *', $value->data);
        $items = [];
        for ($i = 0; $i < $value->length; $i++) $items[] = self::from21($memory[$i], $scope);
        return $items;
    }
    private static function to27(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalprimitivesubtypes_pair');
        $field26_left = self::to26($value->left, $scope);
        $out->left = $field26_left;
        $field26_right = self::to26($value->right, $scope);
        $out->right = $field26_right;
        return $out;
    }
    private static function from27(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanNominalprimitivesubtypes\Pair(self::from26($value->left, $scope), self::from26($value->right, $scope));
    }


    public static function call0(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to19(Checks::check19($arg0, $validation), $scope);
            $status = $ffi->nominalprimitivesubtypes_produce(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalprimitivesubtypes\LeanBridgeError($message, $status);
            }
            return self::from21($out, $scope);
        } finally {
            try { $ffi->nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalprimitivesubtypes_event');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to19(Checks::check19($arg0, $validation), $scope);
            $status = $ffi->nominalprimitivesubtypes_produce_choices(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalprimitivesubtypes\LeanBridgeError($message, $status);
            }
            return self::from25($out, $scope);
        } finally {
            try { $ffi->nominalprimitivesubtypes_event_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalprimitivesubtypes_event');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to19(Checks::check19($arg0, $validation), $scope);
            $status = $ffi->nominalprimitivesubtypes_produce_event(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalprimitivesubtypes\LeanBridgeError($message, $status);
            }
            return self::from25($out, $scope);
        } finally {
            try { $ffi->nominalprimitivesubtypes_event_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to19(Checks::check19($arg0, $validation), $scope);
            $status = $ffi->nominalprimitivesubtypes_produce_group(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalprimitivesubtypes\LeanBridgeError($message, $status);
            }
            return self::from26($out, $scope);
        } finally {
            try { $ffi->nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call4(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalprimitivesubtypes_pair');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to19(Checks::check19($arg0, $validation), $scope);
            $status = $ffi->nominalprimitivesubtypes_produce_pair(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalprimitivesubtypes\LeanBridgeError($message, $status);
            }
            return self::from27($out, $scope);
        } finally {
            try { $ffi->nominalprimitivesubtypes_pair_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('uint32_t');
        $error = $ffi->new('BridgeError');
        try {

            $status = $ffi->nominalprimitivesubtypes_word_bits(\FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalprimitivesubtypes\LeanBridgeError($message, $status);
            }
            return self::from4($out->cdata, $scope);
        } finally {
            try { /* No native output owner. */ }
            finally {
                
                $scope->close();
            }
        }
    }
}
