/**
 * Strict scalar checks for finite PHP copied values on either integer width.
 *
 * @file
 */

/** Private source shared by validation, comparison and native conversion. */
export const phpGraphScalars = String.raw`
final class GraphBudget
{
    private int $bytes = 16 * 1024 * 1024;
    private int $visits = 262144;
    public function step(int $depth): void {
        if ($depth > 128) throw new \ValueError('Copied value exceeds 128 levels');
        if ($this->visits-- <= 0) throw new \ValueError('Copied value exceeds 262144 visits');
        $this->charge(16);
    }
    public function children(int $count): void {
        if ($count < 0 || $count > $this->visits) throw new \ValueError('Copied value exceeds 262144 visits');
        $this->charge($count, 32);
    }
    public function charge(int $count, int $width = 1): void {
        if ($count < 0 || $width < 1 || $count > intdiv($this->bytes, $width)) throw new \ValueError('Copied value exceeds 16 MiB');
        $this->bytes -= $count * $width;
    }
}

final class GraphScalars
{
    public static function decimal(\Brick\Math\BigInteger $value, GraphBudget $budget): string {
        try { $text = (string) $value; }
        catch (\Error $error) { throw new \TypeError('BigInteger must be initialized', 0, $error); }
        $budget->charge(strlen($text));
        if (strlen($text) > 16385 || strlen(ltrim($text, '-')) > 16384
            || preg_match('/^(?:0|-?[1-9][0-9]*)$/D', $text) !== 1) throw new \ValueError('BigInteger requires at most 16384 canonical decimal digits');
        return $text;
    }
    private static function compare(string $left, string $right): int {
        $a = $left[0] === '-'; $b = $right[0] === '-';
        if ($a !== $b) return $a ? -1 : 1;
        $left = ltrim($left, '-'); $right = ltrim($right, '-');
        $order = strlen($left) <=> strlen($right);
        if ($order === 0) $order = strcmp($left, $right);
        return $a ? -$order : $order;
    }
    public static function check(array $type, mixed $value, GraphBudget $budget): void {
        $name = $type['name'];
        if ($name === 'unit') { if ($value !== null) throw new \TypeError('Unit requires null'); }
        elseif ($name === 'bool') { if (!is_bool($value)) throw new \TypeError('Bool requires bool'); }
        elseif ($name === 'float32' || $name === 'float64') { if (!is_float($value)) throw new \TypeError('Float requires float without coercion'); }
        elseif ($name === 'char') {
            if (!is_string($value)) throw new \TypeError('Char requires string');
            if (strlen($value) < 1 || strlen($value) > 4 || preg_match('/\A.\z/us', $value) !== 1) throw new \ValueError('Char requires one Unicode scalar');
        } elseif ($name === 'string') {
            if (!is_string($value)) throw new \TypeError('String requires string');
            if (strlen($value) > 16 * 1024 * 1024) throw new \ValueError('Copied value exceeds 16 MiB');
            if (preg_match('//u', $value) !== 1) throw new \ValueError('String requires valid UTF-8');
        } elseif ($name === 'bytes') {
            if (!$value instanceof GRAPH_NAMESPACE\Bytes) throw new \TypeError('ByteArray requires Bytes');
        } else {
            if ($type['host'] === 'bigint') {
                if (!$value instanceof \Brick\Math\BigInteger) throw new \TypeError('Integer requires Brick Math BigInteger');
                $text = self::decimal($value, $budget);
            } else {
                if (!is_int($value)) throw new \TypeError('Integer requires int without coercion');
                $text = (string) $value;
            }
            if (($type['min'] !== null && self::compare($text, $type['min']) < 0)
                || ($type['max'] !== null && self::compare($text, $type['max']) > 0)) throw new \ValueError('Integer is outside the declared Lean range');
        }
    }
}
`;
