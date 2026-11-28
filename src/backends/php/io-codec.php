<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;

/** @internal Shared by both transports; never coerce application inputs. */
final class WireValues
{
    private static function wide(string $kind, mixed $v, Budget $budget): string {
        if (!$v instanceof \Brick\Math\BigInteger) throw new \TypeError('Expected Brick Math BigInteger');
        $decimal = (string)$v;
        $negative = str_starts_with($decimal, '-');
        $digits = $negative ? substr($decimal, 1) : $decimal;
        if (strlen($digits) > 16384 || !preg_match('/^(?:0|[1-9][0-9]*)$/D', $digits)
            || ($negative && ($kind !== 'int' || $digits === '0'))) throw new \ValueError('Integer outside the declared Lean range');
        if (($kind === 'uint64' || $kind === 'usize') && (strlen($digits)>20 || (strlen($digits)===20 && strcmp($digits,'18446744073709551615')>0)))
            throw new \ValueError('Integer outside UInt64 range');
        $budget->charge(strlen($decimal));
        $limbs = IntegerCodec::limbs($digits);
        if ($kind === 'uint64' || $kind === 'usize') return pack('V2', $limbs[0]??0, $limbs[1]??0);
        if (count($limbs)%2) $limbs[]=0;
        $budget->charge(count($limbs),4);
        return pack('V2', (int)$negative, 0).pack('V*', ...$limbs);
    }
    public static function input(string $kind, mixed $value, Budget $budget): string {
        if (in_array($kind,['uint64','usize','nat','int'],true)) return self::wide($kind,$value,$budget);
        if ($kind === 'string') {
            if (!is_string($value)) throw new \TypeError('Expected a UTF-8 string');
            $budget->charge(strlen($value));
            if (preg_match('//u',$value)!==1) throw new \ValueError('String requires valid UTF-8');
            return $value;
        }
        if ($kind === 'bytes') {
            if (!$value instanceof \__LB_PUBLIC__\Bytes) throw new \TypeError('Expected Bytes');
            $budget->charge(count($value)); return $value->toString();
        }
        $budget->charge(8);
        if ($kind === 'char') {
            if (!is_string($value)) throw new \TypeError('Char requires a string');
            if (strlen($value)>4 || preg_match('/\A.\z/us',$value)!==1) throw new \ValueError('Char requires one Unicode scalar');
            return pack('q',ScalarCodec::point($value));
        }
        if ($kind === 'unit') {
            if ($value!==null) throw new \TypeError('Unit requires null');
            return pack('q',0);
        }
        if ($kind === 'bool') {
            if (!is_bool($value)) throw new \TypeError('Bool requires a boolean');
            return pack('q',(int)$value);
        }
        if ($kind === 'float32' || $kind === 'float64') {
            if (!is_float($value)) throw new \TypeError('Expected a float without coercion');
            return $kind==='float32'?pack('g',$value)."\0\0\0\0":pack('e',$value);
        }
        if (!is_int($value)) throw new \TypeError('Expected an int without coercion');
        [$lo,$hi]=match ($kind) {
            'int8'=>[-128,127], 'int16'=>[-32768,32767], 'int32'=>[-2147483648,2147483647],
            'uint8'=>[0,255], 'uint16'=>[0,65535], 'uint32'=>[0,4294967295],
            'int64','isize'=>[PHP_INT_MIN,PHP_INT_MAX], default=>throw new \LogicException('Unknown wire type')
        };
        if ($value<$lo || $value>$hi) throw new \ValueError('Integer outside the declared Lean range');
        return pack('q',$value);
    }
    public static function output(string|array $kind, string $tags, string $data, int $depth=0): mixed {
        if (is_array($kind)) {
            $tag=isset($tags[$depth])?ord($tags[$depth]):-1;
            return match ($tag) {
                1=>new \__LB_PUBLIC__\Ok(self::output($kind[0],$tags,$data,$depth+1)),
                0=>new \__LB_PUBLIC__\Err(self::output($kind[1],$tags,$data,$depth+1)),
                default=>throw new \UnexpectedValueException('Malformed Lean Except tag')
            };
        }
        if ($kind==='string') {
            if (preg_match('//u',$data)!==1) throw new \UnexpectedValueException('Malformed Lean UTF-8 result');
            return $data;
        }
        if ($kind==='bytes') return \__LB_PUBLIC__\Bytes::fromString($data);
        if ($kind==='nat' || $kind==='int') {
            if (strlen($data)%8 || strlen($data)<8 || strlen($data)>8+4*1702) throw new \ValueError('Invalid or oversized Lean integer');
            $sign=unpack('q',substr($data,0,8))[1];
            if ($sign!==0 && ($sign!==1 || $kind!=='int' || strlen($data)===8)) throw new \UnexpectedValueException('Malformed Lean integer sign');
            $limbs=array_values(unpack('V*',substr($data,8)));
            if ($limbs && !$limbs[count($limbs)-1] && !$limbs[count($limbs)-2]) throw new \UnexpectedValueException('Noncanonical Lean integer');
            if ($limbs && !end($limbs)) array_pop($limbs);
            return \Brick\Math\BigInteger::of(IntegerCodec::decimal($limbs,(bool)$sign));
        }
        if (strlen($data)!==8) throw new \UnexpectedValueException('Malformed fixed-width Lean result');
        if ($kind==='float32') return unpack('g',$data)[1];
        if ($kind==='float64') return unpack('e',$data)[1];
        if ($kind==='uint64'||$kind==='usize') return \Brick\Math\BigInteger::of(IntegerCodec::decimal(array_values(unpack('V2',$data)),false));
        $v=unpack('q',$data)[1];
        return match ($kind) {
            'unit'=>$v===0?null:throw new \UnexpectedValueException('Malformed Unit'),
            'bool'=>match($v) {0=>false,1=>true,default=>throw new \UnexpectedValueException('Malformed Bool')},
            'char'=>ScalarCodec::text($v),
            'int8','int16','int32','int64','isize','uint8','uint16','uint32'=>$v,
            default=>throw new \LogicException('Unknown wire result')
        };
    }
}
