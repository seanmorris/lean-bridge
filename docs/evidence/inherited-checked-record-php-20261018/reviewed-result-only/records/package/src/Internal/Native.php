<?php
declare(strict_types=1);
namespace LeanInheritedcheckedrecords\Internal;

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
            \LeanInheritedcheckedrecords\Span::class => ['lo', 'hi'],
            \LeanInheritedcheckedrecords\Ticket::class => ['toSpan', 'word'],
            \LeanInheritedcheckedrecords\Stamped::class => ['toTicket', 'mark'],
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
        elseif ($left instanceof \LeanInheritedcheckedrecords\Bytes) { $left = $left->toString(); $right = $right->toString(); }
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
        elseif ($value instanceof \LeanInheritedcheckedrecords\Bytes) self::text($hash, 'y', $value->toString(), $budget);
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
        if (!$value instanceof \LeanInheritedcheckedrecords\Span) throw new \TypeError('Expected Span');
        if (array_keys(get_object_vars($value)) !== ['lo', 'hi']) throw new \TypeError('Span requires exactly its initialized fields');
        self::check0($value->lo, $budget);
        self::check0($value->hi, $budget);
        return $value;
    }
    public static function check2(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanInheritedcheckedrecords\Ticket) throw new \TypeError('Expected Ticket');
        if (array_keys(get_object_vars($value)) !== ['toSpan', 'word']) throw new \TypeError('Ticket requires exactly its initialized fields');
        self::check1($value->toSpan, $budget);
        self::check0($value->word, $budget);
        return $value;
    }
    public static function check3(mixed $value, Budget $budget): mixed {
        $budget->charge(1, 16);
        if (!$value instanceof \LeanInheritedcheckedrecords\Stamped) throw new \TypeError('Expected Stamped');
        if (array_keys(get_object_vars($value)) !== ['toTicket', 'mark']) throw new \TypeError('Stamped requires exactly its initialized fields');
        self::check2($value->toTicket, $budget);
        self::check0($value->mark, $budget);
        return $value;
    }
}

final class Native
{
    private const DEFINITIONS = <<<'CDEFS'
typedef struct { int code; void *message; size_t message_length; } BridgeError;
typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } inheritedcheckedrecords_nat;
void inheritedcheckedrecords_nat_clear(inheritedcheckedrecords_nat *);
typedef struct { inheritedcheckedrecords_nat lo; inheritedcheckedrecords_nat hi; } inheritedcheckedrecords_span;
void inheritedcheckedrecords_span_clear(inheritedcheckedrecords_span *);
typedef struct { inheritedcheckedrecords_span to_span; inheritedcheckedrecords_nat word; } inheritedcheckedrecords_ticket;
void inheritedcheckedrecords_ticket_clear(inheritedcheckedrecords_ticket *);
typedef struct { inheritedcheckedrecords_ticket to_ticket; inheritedcheckedrecords_nat mark; } inheritedcheckedrecords_stamped;
void inheritedcheckedrecords_stamped_clear(inheritedcheckedrecords_stamped *);
int inheritedcheckedrecords_produce(inheritedcheckedrecords_nat *, inheritedcheckedrecords_ticket *, BridgeError *);
int inheritedcheckedrecords_produce_stamped(inheritedcheckedrecords_nat *, inheritedcheckedrecords_stamped *, BridgeError *);
CDEFS;
    private static ?\FFI $ffi = null;
    private static function load(): \FFI {
        return \LeanBridge\CopiedNativeV1\Runtime::load(__DIR__ . '/../../native/linux-x64', json_decode(<<<'EVIDENCE'
{
  "componentId": "inheritedcheckedrecords@1.0.0",
  "componentReceiptSha256": "c4d5a2f755addac12d700ceb9d5185a2b2a07594170976268ce4ad37349330e8",
  "identity": "60e126716ed4b2c1b86c16dc903b754faa5a9957740e6fcf821e14a55f12d1b1",
  "libraries": {
    "libcomponent_95491bb762dabafaf0ed.so": "e183f646c9ebeddc2ef01799f4e7480c27b6bcba74b7b0b4e61025277eee15cf",
    "libinheritedcheckedrecords.so": "78d759244f7cefb25951d4139e12d8ceb26217ac7b1b9201c4e364310ee32450",
    "liblean_bridge_native.so": "459fcd2098d4b646ab6ae0f4cdccd1f222908cb162562bfc3940a533cd4e4e21",
    "libleanshared.so": "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"
  },
  "library": "libinheritedcheckedrecords.so",
  "loadOrder": [
    "libleanshared.so",
    "liblean_bridge_native.so",
    "libcomponent_95491bb762dabafaf0ed.so",
    "libinheritedcheckedrecords.so"
  ],
  "runtimeIdentity": "4b5a7fdf0cb11d4bb429181cfd50b330c5622ed8f5f5382a293955a439b595b5"
}
EVIDENCE, true, 512, JSON_THROW_ON_ERROR), self::DEFINITIONS);
    }
    private static function to0(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('inheritedcheckedrecords_nat');
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
        $out = $scope->allocate('inheritedcheckedrecords_span');
        $field0_lo = self::to0($value->lo, $scope);
        $out->lo = $field0_lo;
        $field0_hi = self::to0($value->hi, $scope);
        $out->hi = $field0_hi;
        return $out;
    }
    private static function from1(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanInheritedcheckedrecords\Span(self::from0($value->lo, $scope), self::from0($value->hi, $scope));
    }
    private static function to2(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('inheritedcheckedrecords_ticket');
        $field1_to_span = self::to1($value->toSpan, $scope);
        $out->to_span = $field1_to_span;
        $field0_word = self::to0($value->word, $scope);
        $out->word = $field0_word;
        return $out;
    }
    private static function from2(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanInheritedcheckedrecords\Ticket(self::from1($value->to_span, $scope), self::from0($value->word, $scope));
    }
    private static function to3(mixed $value, Scope $scope): \FFI\CData {
        $out = $scope->allocate('inheritedcheckedrecords_stamped');
        $field2_to_ticket = self::to2($value->toTicket, $scope);
        $out->to_ticket = $field2_to_ticket;
        $field0_mark = self::to0($value->mark, $scope);
        $out->mark = $field0_mark;
        return $out;
    }
    private static function from3(mixed $value, Scope $scope): mixed {
        $scope->budget->charge(1, 16);
        return new \LeanInheritedcheckedrecords\Stamped(self::from2($value->to_ticket, $scope), self::from0($value->mark, $scope));
    }


    public static function call0(mixed $arg0): mixed {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        
        $out = $ffi->new('inheritedcheckedrecords_ticket');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->inheritedcheckedrecords_produce(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanInheritedcheckedrecords\LeanBridgeError($message, $status);
            }
            return self::from2($out, $scope);
        } finally {
            try { $ffi->inheritedcheckedrecords_ticket_clear(\FFI::addr($out)); }
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
        
        $out = $ffi->new('inheritedcheckedrecords_stamped');
        $error = $ffi->new('BridgeError');
        try {
            $input0 = self::to0(Checks::check0($arg0, $validation), $scope);
            $status = $ffi->inheritedcheckedrecords_produce_stamped(\FFI::addr($input0), \FFI::addr($out), \FFI::addr($error));
            
            if ($status !== 0) {
                $message = $error->message === null || \FFI::isNull($error->message) ? 'Native Lean call failed' : \FFI::string($error->message, min($error->message_length, 16384));
                throw new \LeanInheritedcheckedrecords\LeanBridgeError($message, $status);
            }
            return self::from3($out, $scope);
        } finally {
            try { $ffi->inheritedcheckedrecords_stamped_clear(\FFI::addr($out)); }
            finally {
                
                $scope->close();
            }
        }
    }
}
