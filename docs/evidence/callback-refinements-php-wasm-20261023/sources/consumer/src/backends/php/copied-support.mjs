/**
 * PHP copied values and bounded scratch, independent of Lean object layouts.
 *
 * @file
 */
import { phpValueMethods } from "./copied-equality.mjs";

/** Exact value wrappers shared by each generated package's namespace. */
export const copiedPhpValues = String.raw`
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
${phpValueMethods}
}

`;

/** Private PHP helpers. Integer arithmetic stays below signed 64-bit overflow. */
export const copiedPhpHelpers = String.raw`
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
`;
