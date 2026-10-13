<?php
declare(strict_types=1);
namespace LeanNominalsubtypes\Internal;

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
            \LeanNominalsubtypes\Some::class => ['value'],
            \LeanNominalsubtypes\Ok::class => ['value'],
            \LeanNominalsubtypes\Err::class => ['value'],
            \LeanNominalsubtypes\Envelope::class => ['payload', 'digit'],
            \LeanNominalsubtypes\AliasPair::class => ['left', 'right'],
            \LeanNominalsubtypes\Pair::class => ['left', 'right'],
            \LeanNominalsubtypes\EventEmpty::class => [],
            \LeanNominalsubtypes\EventBox::class => ['value'],
            \LeanNominalsubtypes\EventChoices::class => ['values'],
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
        elseif ($left instanceof \LeanNominalsubtypes\Bytes) { $left = $left->toString(); $right = $right->toString(); }
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
        elseif ($value instanceof \LeanNominalsubtypes\Bytes) self::text($hash, 'y', $value->toString(), $budget);
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
        if (!$value instanceof \LeanNominalsubtypes\Envelope) throw new \TypeError('Expected Envelope');
        if (array_keys(get_object_vars($value)) !== ['payload', 'digit']) throw new \TypeError('Envelope requires exactly its initialized fields');
        self::check0($value->payload, $budget);
        self::check0($value->digit, $budget);
        return $value;
    }
    public static function check2(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if ($value === null) return null;
        if ($value instanceof \LeanNominalsubtypes\Some) {
            if (array_keys(get_object_vars($value)) !== ['value']) throw new \TypeError('Some requires one initialized value field');
            return new \LeanNominalsubtypes\Some(self::check1($value->value, $budget));
        }
        throw new \TypeError('Expected Some');
    }
    public static function check3(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_array($value) || !array_is_list($value)) throw new \TypeError('Expected a list with consecutive integer keys');
        $budget->charge(count($value), 32);
        $result = [];
        foreach ($value as $item) $result[] = self::check2($item, $budget);
        return $result;
    }
    public static function check4(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_array($value) || !array_is_list($value)) throw new \TypeError('Expected a list with consecutive integer keys');
        $budget->charge(count($value), 32);
        $result = [];
        foreach ($value as $item) $result[] = self::check0($item, $budget);
        return $result;
    }
    public static function check5(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if ($value instanceof \LeanNominalsubtypes\Ok) {
            if (array_keys(get_object_vars($value)) !== ['value']) throw new \TypeError('Ok requires one initialized value field');
            return new \LeanNominalsubtypes\Ok(self::check0($value->value, $budget));
        }
        if ($value instanceof \LeanNominalsubtypes\Err) {
            if (array_keys(get_object_vars($value)) !== ['value']) throw new \TypeError('Err requires one initialized value field');
            return new \LeanNominalsubtypes\Err(self::check0($value->value, $budget));
        }
        throw new \TypeError('Expected Ok or Err');
    }
    public static function check6(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if ($value === null) return null;
        if ($value instanceof \LeanNominalsubtypes\Some) {
            if (array_keys(get_object_vars($value)) !== ['value']) throw new \TypeError('Some requires one initialized value field');
            return new \LeanNominalsubtypes\Some(self::check5($value->value, $budget));
        }
        throw new \TypeError('Expected Some');
    }
    public static function check7(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_array($value) || !array_is_list($value)) throw new \TypeError('Expected a list with consecutive integer keys');
        $budget->charge(count($value), 32);
        $result = [];
        foreach ($value as $item) $result[] = self::check6($item, $budget);
        return $result;
    }
    public static function check8(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if ($value instanceof \LeanNominalsubtypes\EventEmpty) {
            if (array_keys(get_object_vars($value)) !== []) throw new \TypeError('EventEmpty requires exactly its initialized payload fields');
            return $value;
        }
        if ($value instanceof \LeanNominalsubtypes\EventBox) {
            if (array_keys(get_object_vars($value)) !== ['value']) throw new \TypeError('EventBox requires exactly its initialized payload fields');
            self::check1($value->value, $budget);
            return $value;
        }
        if ($value instanceof \LeanNominalsubtypes\EventChoices) {
            if (array_keys(get_object_vars($value)) !== ['values']) throw new \TypeError('EventChoices requires exactly its initialized payload fields');
            self::check7($value->values, $budget);
            return $value;
        }
        throw new \TypeError('Expected an exact Event constructor');
    }
    public static function check9(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanNominalsubtypes\AliasPair) throw new \TypeError('Expected AliasPair');
        if (array_keys(get_object_vars($value)) !== ['left', 'right']) throw new \TypeError('AliasPair requires exactly its initialized fields');
        self::check3($value->left, $budget);
        self::check3($value->right, $budget);
        return $value;
    }
    public static function check10(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_array($value) || !array_is_list($value)) throw new \TypeError('Expected a list with consecutive integer keys');
        $budget->charge(count($value), 32);
        $result = [];
        foreach ($value as $item) $result[] = self::check0($item, $budget);
        return $result;
    }
    public static function check11(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanNominalsubtypes\Pair) throw new \TypeError('Expected Pair');
        if (array_keys(get_object_vars($value)) !== ['left', 'right']) throw new \TypeError('Pair requires exactly its initialized fields');
        self::check1($value->left, $budget);
        self::check1($value->right, $budget);
        return $value;
    }
    public static function check12(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if ($value === null) return null;
        if ($value instanceof \LeanNominalsubtypes\Some) {
            if (array_keys(get_object_vars($value)) !== ['value']) throw new \TypeError('Some requires one initialized value field');
            return new \LeanNominalsubtypes\Some(self::check0($value->value, $budget));
        }
        throw new \TypeError('Expected Some');
    }
    public static function check13(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!is_array($value) || !array_is_list($value) || count($value) !== 2) throw new \TypeError('Prod requires a two-element list');
        $budget->charge(2, 32);
        return [self::check0($value[0], $budget), self::check0($value[1], $budget)];
    }
}

final class Native
{
    private const DEFINITIONS = <<<'CDEFS'
typedef struct { int code; void *message; size_t message_length; } BridgeError;
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } nominalsubtypes_nat;
void nominalsubtypes_nat_clear(nominalsubtypes_nat *);
typedef struct { nominalsubtypes_nat payload; nominalsubtypes_nat digit; } nominalsubtypes_envelope;
void nominalsubtypes_envelope_clear(nominalsubtypes_envelope *);
typedef struct { uint8_t has_value; nominalsubtypes_envelope value; } nominalsubtypes_option_lean_nominal_subtypes_envelope_value;
void nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear(nominalsubtypes_option_lean_nominal_subtypes_envelope_value *);
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span;
void nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear(nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *);
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } nominalsubtypes_array_nat_span;
void nominalsubtypes_array_nat_span_clear(nominalsubtypes_array_nat_span *);
typedef struct { uint8_t is_ok; nominalsubtypes_nat ok; nominalsubtypes_nat error; } nominalsubtypes_result_nat_nat_value;
void nominalsubtypes_result_nat_nat_value_clear(nominalsubtypes_result_nat_nat_value *);
typedef struct { uint8_t has_value; nominalsubtypes_result_nat_nat_value value; } nominalsubtypes_option_result_nat_nat_value;
void nominalsubtypes_option_result_nat_nat_value_clear(nominalsubtypes_option_result_nat_nat_value *);
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } nominalsubtypes_array_option_result_nat_nat_span;
void nominalsubtypes_array_option_result_nat_nat_span_clear(nominalsubtypes_array_option_result_nat_nat_span *);
typedef struct { uint32_t kind; union { struct { uint8_t empty; } empty; struct { nominalsubtypes_envelope value; } box; struct { nominalsubtypes_array_option_result_nat_nat_span values; } choices; } cases; } nominalsubtypes_event;
void nominalsubtypes_event_clear(nominalsubtypes_event *);
typedef struct { nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span left; nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span right; } nominalsubtypes_alias_pair;
void nominalsubtypes_alias_pair_clear(nominalsubtypes_alias_pair *);
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } nominalsubtypes_list_nat_span;
void nominalsubtypes_list_nat_span_clear(nominalsubtypes_list_nat_span *);
typedef struct { nominalsubtypes_envelope left; nominalsubtypes_envelope right; } nominalsubtypes_pair;
void nominalsubtypes_pair_clear(nominalsubtypes_pair *);
typedef struct { uint8_t has_value; nominalsubtypes_nat value; } nominalsubtypes_option_nat_value;
void nominalsubtypes_option_nat_value_clear(nominalsubtypes_option_nat_value *);
typedef struct { nominalsubtypes_nat fst; nominalsubtypes_nat snd; } nominalsubtypes_tuple_nat_nat_value;
void nominalsubtypes_tuple_nat_nat_value_clear(nominalsubtypes_tuple_nat_nat_value *);
int nominalsubtypes_aliases(nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *, nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *, nominalsubtypes_nat *, BridgeError *);
int nominalsubtypes_array_values(nominalsubtypes_nat *, nominalsubtypes_array_nat_span *, BridgeError *);
int nominalsubtypes_branch(nominalsubtypes_nat *, nominalsubtypes_result_nat_nat_value *, BridgeError *);
int nominalsubtypes_combine(nominalsubtypes_envelope *, nominalsubtypes_envelope *, nominalsubtypes_nat *, BridgeError *);
int nominalsubtypes_echo_envelope(nominalsubtypes_envelope *, nominalsubtypes_envelope *, BridgeError *);
int nominalsubtypes_echo_event(nominalsubtypes_event *, nominalsubtypes_event *, BridgeError *);
int nominalsubtypes_echo_groups(nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *, nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *, BridgeError *);
int nominalsubtypes_echo_pair(nominalsubtypes_alias_pair *, nominalsubtypes_alias_pair *, BridgeError *);
int nominalsubtypes_event_choices(nominalsubtypes_nat *, nominalsubtypes_event *, BridgeError *);
int nominalsubtypes_event_empty(nominalsubtypes_nat *, nominalsubtypes_event *, BridgeError *);
int nominalsubtypes_event_first(nominalsubtypes_event *, nominalsubtypes_nat *, BridgeError *);
int nominalsubtypes_event_second(nominalsubtypes_event *, nominalsubtypes_nat *, BridgeError *);
int nominalsubtypes_event_value(nominalsubtypes_nat *, nominalsubtypes_event *, BridgeError *);
int nominalsubtypes_first(nominalsubtypes_envelope *, nominalsubtypes_nat *, BridgeError *);
int nominalsubtypes_group_values(nominalsubtypes_nat *, nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span *, BridgeError *);
int nominalsubtypes_inspect_alias_pair(nominalsubtypes_alias_pair *, nominalsubtypes_nat *, BridgeError *);
int nominalsubtypes_list_values(nominalsubtypes_nat *, nominalsubtypes_list_nat_span *, BridgeError *);
int nominalsubtypes_nested(nominalsubtypes_pair *, nominalsubtypes_nat *, BridgeError *);
int nominalsubtypes_no_items(nominalsubtypes_nat *, nominalsubtypes_array_nat_span *, BridgeError *);
int nominalsubtypes_optional(nominalsubtypes_nat *, nominalsubtypes_option_nat_value *, BridgeError *);
int nominalsubtypes_pair_values(nominalsubtypes_nat *, nominalsubtypes_alias_pair *, BridgeError *);
int nominalsubtypes_plain_fin(nominalsubtypes_nat *, nominalsubtypes_nat *, BridgeError *);
int nominalsubtypes_produce_envelope(nominalsubtypes_nat *, nominalsubtypes_envelope *, BridgeError *);
int nominalsubtypes_product(nominalsubtypes_nat *, nominalsubtypes_tuple_nat_nat_value *, BridgeError *);
int nominalsubtypes_scalar(nominalsubtypes_nat *, nominalsubtypes_nat *, BridgeError *);
int nominalsubtypes_second(nominalsubtypes_envelope *, nominalsubtypes_nat *, BridgeError *);
CDEFS;
    private static ?\FFI $ffi = null;
    private static function load(): \FFI {
        return \LeanBridge\CopiedNativeV1\Runtime::load(__DIR__ . '/../../native/linux-x64', json_decode(<<<'EVIDENCE'
{
  "componentId": "nominalsubtypes@1.0.0",
  "componentReceiptSha256": "f274480eec2099806059b46cf4ed4f26e67ef146ae40b2a78d4d276405627a87",
  "identity": "d68418c8ebca9499ef35762d68242b42c13caa764207ad026f1ea56bf32a2452",
  "libraries": {
    "libcomponent_7f8bfe55e5831a9133c5.so": "0b154cc4839a38a3a32574850a4574f7ee62aa79782cdaabd9dacf76f52d6c05",
    "liblean_bridge_native.so": "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7",
    "libleanshared.so": "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4",
    "libnominalsubtypes.so": "52b044c3c6aafa00608731f558b39f5e5602afff598f64232d4101fe40d14d70"
  },
  "library": "libnominalsubtypes.so",
  "loadOrder": [
    "libleanshared.so",
    "liblean_bridge_native.so",
    "libcomponent_7f8bfe55e5831a9133c5.so",
    "libnominalsubtypes.so"
  ],
  "runtimeIdentity": "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
}
EVIDENCE, true, 512, JSON_THROW_ON_ERROR), self::DEFINITIONS);
    }
    private static function to0(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalsubtypes_nat');
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
        $out = $scope->allocate('nominalsubtypes_envelope');
        $field0_payload = self::to0($value->payload, $scope);
        $out->payload = $field0_payload;
        $field0_digit = self::to0($value->digit, $scope);
        $out->digit = $field0_digit;
        return $out;
    }
    private static function from1(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanNominalsubtypes\Envelope(self::from0($value->payload, $scope), self::from0($value->digit, $scope));
    }
    private static function to2(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalsubtypes_option_lean_nominal_subtypes_envelope_value');
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
        return $value->has_value === 0 ? null : new \LeanNominalsubtypes\Some(self::from1($value->value, $scope));
    }
    private static function to3(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span');
        $scope->budget->charge(count($value), 32);
        $memory = $scope->allocate('nominalsubtypes_option_lean_nominal_subtypes_envelope_value', count($value), true);
        foreach ($value as $i => $item) { $entry = self::to2($item, $scope); $memory[$i] = $entry; }
        $out->data = count($value) ? \FFI::addr($memory[0]) : null;
        $out->length = count($value);
        return $out;
    }
    private static function from3(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        $scope->budget->charge($value->length, max(32, \FFI::sizeof($scope->ffi->type('nominalsubtypes_option_lean_nominal_subtypes_envelope_value'))));
        if (!$value->length) return [];
        if ($value->data === null || \FFI::isNull($value->data)) throw new \RuntimeException('Native array has a missing buffer');
        if ($scope->ffi->cast('uintptr_t *', \FFI::addr($value->data))[0] % \FFI::alignof($scope->ffi->type('nominalsubtypes_option_lean_nominal_subtypes_envelope_value')) !== 0) throw new \RuntimeException('Native array has a misaligned buffer');
        $memory = $scope->ffi->cast('nominalsubtypes_option_lean_nominal_subtypes_envelope_value *', $value->data);
        $items = [];
        for ($i = 0; $i < $value->length; $i++) $items[] = self::from2($memory[$i], $scope);
        return $items;
    }
    private static function to4(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalsubtypes_array_nat_span');
        $scope->budget->charge(count($value), 32);
        $memory = $scope->allocate('nominalsubtypes_nat', count($value), true);
        foreach ($value as $i => $item) { $entry = self::to0($item, $scope); $memory[$i] = $entry; }
        $out->data = count($value) ? \FFI::addr($memory[0]) : null;
        $out->length = count($value);
        return $out;
    }
    private static function from4(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        $scope->budget->charge($value->length, max(32, \FFI::sizeof($scope->ffi->type('nominalsubtypes_nat'))));
        if (!$value->length) return [];
        if ($value->data === null || \FFI::isNull($value->data)) throw new \RuntimeException('Native array has a missing buffer');
        if ($scope->ffi->cast('uintptr_t *', \FFI::addr($value->data))[0] % \FFI::alignof($scope->ffi->type('nominalsubtypes_nat')) !== 0) throw new \RuntimeException('Native array has a misaligned buffer');
        $memory = $scope->ffi->cast('nominalsubtypes_nat *', $value->data);
        $items = [];
        for ($i = 0; $i < $value->length; $i++) $items[] = self::from0($memory[$i], $scope);
        return $items;
    }
    private static function to5(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalsubtypes_result_nat_nat_value');
        if ($value instanceof \LeanNominalsubtypes\Ok) {
            $out->is_ok = 1;
            $item = self::to0($value->value, $scope);
            $out->ok = $item;
        } else {
            $item = self::to0($value->value, $scope);
            $out->error = $item;
        }
        return $out;
    }
    private static function from5(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value->is_ok !== 0 && $value->is_ok !== 1) throw new \RuntimeException('Invalid native Except flag');
        return $value->is_ok === 1 ? new \LeanNominalsubtypes\Ok(self::from0($value->ok, $scope)) : new \LeanNominalsubtypes\Err(self::from0($value->error, $scope));
    }
    private static function to6(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalsubtypes_option_result_nat_nat_value');
        if ($value !== null) {
            $out->has_value = 1;
            $item = self::to5($value->value, $scope);
            $out->value = $item;
        }
        return $out;
    }
    private static function from6(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value->has_value !== 0 && $value->has_value !== 1) throw new \RuntimeException('Invalid native Option flag');
        return $value->has_value === 0 ? null : new \LeanNominalsubtypes\Some(self::from5($value->value, $scope));
    }
    private static function to7(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalsubtypes_array_option_result_nat_nat_span');
        $scope->budget->charge(count($value), 32);
        $memory = $scope->allocate('nominalsubtypes_option_result_nat_nat_value', count($value), true);
        foreach ($value as $i => $item) { $entry = self::to6($item, $scope); $memory[$i] = $entry; }
        $out->data = count($value) ? \FFI::addr($memory[0]) : null;
        $out->length = count($value);
        return $out;
    }
    private static function from7(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        $scope->budget->charge($value->length, max(32, \FFI::sizeof($scope->ffi->type('nominalsubtypes_option_result_nat_nat_value'))));
        if (!$value->length) return [];
        if ($value->data === null || \FFI::isNull($value->data)) throw new \RuntimeException('Native array has a missing buffer');
        if ($scope->ffi->cast('uintptr_t *', \FFI::addr($value->data))[0] % \FFI::alignof($scope->ffi->type('nominalsubtypes_option_result_nat_nat_value')) !== 0) throw new \RuntimeException('Native array has a misaligned buffer');
        $memory = $scope->ffi->cast('nominalsubtypes_option_result_nat_nat_value *', $value->data);
        $items = [];
        for ($i = 0; $i < $value->length; $i++) $items[] = self::from6($memory[$i], $scope);
        return $items;
    }
    private static function to8(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalsubtypes_event');
        if ($value instanceof \LeanNominalsubtypes\EventEmpty) {
            $out->kind = 0;
        }
        else if ($value instanceof \LeanNominalsubtypes\EventBox) {
            $out->kind = 1;
            $item = self::to1($value->value, $scope);
            $out->cases->box->value = $item;
        }
        else if ($value instanceof \LeanNominalsubtypes\EventChoices) {
            $out->kind = 2;
            $item = self::to7($value->values, $scope);
            $out->cases->choices->values = $item;
        }
        else throw new \TypeError('Expected an exact Event constructor');
        return $out;
    }
    private static function from8(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        switch ($value->kind) {
        case 0: return new \LeanNominalsubtypes\EventEmpty();
        case 1: return new \LeanNominalsubtypes\EventBox(self::from1($value->cases->box->value, $scope));
        case 2: return new \LeanNominalsubtypes\EventChoices(self::from7($value->cases->choices->values, $scope));
        default: throw new \RuntimeException('Invalid native Event constructor');
        }
    }
    private static function to9(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalsubtypes_alias_pair');
        $field3_left = self::to3($value->left, $scope);
        $out->left = $field3_left;
        $field3_right = self::to3($value->right, $scope);
        $out->right = $field3_right;
        return $out;
    }
    private static function from9(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanNominalsubtypes\AliasPair(self::from3($value->left, $scope), self::from3($value->right, $scope));
    }
    private static function to10(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalsubtypes_list_nat_span');
        $scope->budget->charge(count($value), 32);
        $memory = $scope->allocate('nominalsubtypes_nat', count($value), true);
        foreach ($value as $i => $item) { $entry = self::to0($item, $scope); $memory[$i] = $entry; }
        $out->data = count($value) ? \FFI::addr($memory[0]) : null;
        $out->length = count($value);
        return $out;
    }
    private static function from10(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        $scope->budget->charge($value->length, max(32, \FFI::sizeof($scope->ffi->type('nominalsubtypes_nat'))));
        if (!$value->length) return [];
        if ($value->data === null || \FFI::isNull($value->data)) throw new \RuntimeException('Native array has a missing buffer');
        if ($scope->ffi->cast('uintptr_t *', \FFI::addr($value->data))[0] % \FFI::alignof($scope->ffi->type('nominalsubtypes_nat')) !== 0) throw new \RuntimeException('Native array has a misaligned buffer');
        $memory = $scope->ffi->cast('nominalsubtypes_nat *', $value->data);
        $items = [];
        for ($i = 0; $i < $value->length; $i++) $items[] = self::from0($memory[$i], $scope);
        return $items;
    }
    private static function to11(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalsubtypes_pair');
        $field1_left = self::to1($value->left, $scope);
        $out->left = $field1_left;
        $field1_right = self::to1($value->right, $scope);
        $out->right = $field1_right;
        return $out;
    }
    private static function from11(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanNominalsubtypes\Pair(self::from1($value->left, $scope), self::from1($value->right, $scope));
    }
    private static function to12(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalsubtypes_option_nat_value');
        if ($value !== null) {
            $out->has_value = 1;
            $item = self::to0($value->value, $scope);
            $out->value = $item;
        }
        return $out;
    }
    private static function from12(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        if ($value->has_value !== 0 && $value->has_value !== 1) throw new \RuntimeException('Invalid native Option flag');
        return $value->has_value === 0 ? null : new \LeanNominalsubtypes\Some(self::from0($value->value, $scope));
    }
    private static function to13(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('nominalsubtypes_tuple_nat_nat_value');
        $scope->budget->charge(2, 32);
        $item = self::to0($value[0], $scope);
        $out->fst = $item;
        $item = self::to0($value[1], $scope);
        $out->snd = $item;
        return $out;
    }
    private static function from13(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        $scope->budget->charge(2, 32);
        return [self::from0($value->fst, $scope), self::from0($value->snd, $scope)];
    }


    public static function call0(mixed $arg0, mixed $arg1): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to3(Checks::check3($arg0, $validation), $scope);
            $input1 = self::to3(Checks::check3($arg1, $validation), $scope);
            $status = $ffi->nominalsubtypes_aliases(\FFI::addr($input0), \FFI::addr($input1), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_nat_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalsubtypes_array_nat_span');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_array_values(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from4($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_array_nat_span_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalsubtypes_result_nat_nat_value');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_branch(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from5($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_result_nat_nat_value_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call3(mixed $arg0, mixed $arg1): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to1(Checks::check1($arg0, $validation), $scope);
            $input1 = self::to1(Checks::check1($arg1, $validation), $scope);
            $status = $ffi->nominalsubtypes_combine(\FFI::addr($input0), \FFI::addr($input1), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_nat_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalsubtypes_envelope');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to1(Checks::check1($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_echo_envelope(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from1($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_envelope_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalsubtypes_event');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to8(Checks::check8($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_echo_event(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from8($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_event_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to3(Checks::check3($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_echo_groups(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from3($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call7(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_alias_pair');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to9(Checks::check9($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_echo_pair(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from9($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_alias_pair_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call8(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_event');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_event_choices(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from8($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_event_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalsubtypes_event');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_event_empty(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from8($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_event_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalsubtypes_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to8(Checks::check8($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_event_first(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_nat_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalsubtypes_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to8(Checks::check8($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_event_second(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_nat_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalsubtypes_event');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_event_value(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from8($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_event_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalsubtypes_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to1(Checks::check1($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_first(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_nat_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_group_values(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from3($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('nominalsubtypes_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to9(Checks::check9($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_inspect_alias_pair(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_nat_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call16(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_list_nat_span');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_list_values(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from10($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_list_nat_span_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call17(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to11(Checks::check11($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_nested(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_nat_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call18(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_array_nat_span');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_no_items(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from4($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_array_nat_span_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call19(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_option_nat_value');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_optional(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from12($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_option_nat_value_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call20(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_alias_pair');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_pair_values(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from9($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_alias_pair_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call21(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_plain_fin(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_nat_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call22(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_envelope');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_produce_envelope(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from1($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_envelope_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call23(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_tuple_nat_nat_value');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_product(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from13($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_tuple_nat_nat_value_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call24(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_scalar(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_nat_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }

    public static function call25(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('nominalsubtypes_nat');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to1(Checks::check1($arg0, $validation), $scope);
            $status = $ffi->nominalsubtypes_second(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanNominalsubtypes\LeanBridgeError($message, $status);
            }
            return self::from0($out, $scope);
        } finally {
            try { $ffi->nominalsubtypes_nat_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }
}
