<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;

use Brick\Math\BigInteger;

/** @internal Encode the fixed-width transport without native 64-bit PHP arithmetic. */
final class WireValues
{
    private const LIMITS = [
        'uint32'=>['0','4294967295'], 'usize'=>['0','4294967295'],
        'int64'=>['-9223372036854775808','9223372036854775807'], 'uint64'=>['0','18446744073709551615']
    ];
    private const SMALL = ['uint8'=>[0,255], 'uint16'=>[0,65535], 'int8'=>[-128,127], 'int16'=>[-32768,32767]];
    private const ZERO = "\0\0\0\0\0\0\0\0";
    private static function magnitude(string $kind, mixed $value, Budget $budget): string {
        if (!$value instanceof BigInteger) throw new \TypeError('Expected Brick Math BigInteger');
        $negative=$value->isNegative();
        if (isset(self::LIMITS[$kind])) {
            [$min,$max]=self::LIMITS[$kind];
            if ($value->isLessThan($min) || $value->isGreaterThan($max)) throw new \ValueError('Integer outside '.$kind.' range');
            $budget->charge(8);
            return str_pad(strrev($value->toBytes($kind==='int64')),8,$negative?"\xff":"\0");
        }
        if (($negative && $kind==='nat') || strlen((string)$value)-($negative?1:0)>16384) throw new \ValueError('Invalid or oversized Lean integer');
        $digits=$value->isZero()?'':strrev($value->abs()->toBytes(false));
        $size=intdiv(strlen($digits)+7,8)*8;
        $budget->charge(8+$size);
        return pack('V2',(int)$negative,0).str_pad($digits,$size,"\0");
    }
    private static function small(string $kind, mixed $v): string {
        if (!is_int($v)) throw new \TypeError('Expected PHP int without coercion');
        [$min,$max]=self::SMALL[$kind]??[PHP_INT_MIN,PHP_INT_MAX];
        if ($v<$min || $v>$max) throw new \ValueError('Integer outside '.$kind.' range');
        return pack('V2',$v,$v<0?-1:0);
    }
    public static function input(string $kind, mixed $v, Budget $budget): string {
        if (isset(self::LIMITS[$kind]) || $kind==='nat' || $kind==='int') return self::magnitude($kind,$v,$budget);
        if ($kind==='string') {
            if (!is_string($v)) throw new \TypeError('Expected a string');
            $budget->charge(strlen($v));
            if (preg_match('//u',$v)!==1) throw new \ValueError('Invalid UTF-8');
            return $v;
        }
        if ($kind==='bytes') {
            if (!$v instanceof \__LB_PUBLIC__\Bytes) throw new \TypeError('Expected Bytes');
            $budget->charge(count($v)); return $v->toString();
        }
        $budget->charge(8);
        if ($kind==='char') {
            if (!is_string($v)) throw new \TypeError('Char requires a string');
            if (strlen($v)>4 || preg_match('/\A.\z/us',$v)!==1) throw new \ValueError('Char requires one Unicode scalar');
            return pack('V2',ScalarCodec::point($v),0);
        }
        if ($kind==='unit') return $v===null ? self::ZERO : throw new \TypeError('Unit requires null');
        if ($kind==='bool') return is_bool($v) ? pack('V2',(int)$v,0) : throw new \TypeError('Bool requires a boolean');
        if ($kind==='float32' || $kind==='float64') {
            if (!is_float($v)) throw new \TypeError('Expected a float without coercion');
            return $kind==='float32' ? pack('g',$v)."\0\0\0\0" : pack('e',$v);
        }
        return self::small($kind,$v);
    }
    public static function output(array|string $kind, string $tags, string $data, int $at=0): mixed {
        if (is_array($kind)) {
            $tag=$tags[$at]??'';
            if ($tag==="\1") return new \__LB_PUBLIC__\Ok(self::output($kind[0],$tags,$data,$at+1));
            if ($tag==="\0") return new \__LB_PUBLIC__\Err(self::output($kind[1],$tags,$data,$at+1));
            throw new \UnexpectedValueException('Malformed Lean sum tag');
        }
        if ($kind==='string') return preg_match('//u',$data)===1 ? $data : throw new \UnexpectedValueException('Invalid Lean UTF-8');
        if ($kind==='bytes') return \__LB_PUBLIC__\Bytes::fromString($data);
        if ($kind==='nat' || $kind==='int') {
            $n=strlen($data);
            if ($n<8 || $n%8 || $n>6816) throw new \UnexpectedValueException('Malformed or oversized Lean integer');
            $sign=substr($data,0,8); $minus=$sign==="\1\0\0\0\0\0\0\0";
            if ($sign!==self::ZERO && (!$minus || $kind!=='int' || $n===8)) throw new \UnexpectedValueException('Malformed integer sign');
            if ($n===8) return BigInteger::zero();
            if (substr($data,-8)===self::ZERO) throw new \UnexpectedValueException('Noncanonical magnitude');
            $v=BigInteger::fromBytes(strrev(substr($data,8)),false);
            if (strlen((string)$v)>16384) throw new \ValueError('Oversized Lean integer');
            return $minus ? $v->negated() : $v;
        }
        if (strlen($data)!==8) throw new \UnexpectedValueException('Malformed scalar width');
        if (isset(self::LIMITS[$kind])) {
            $v=BigInteger::fromBytes(strrev($data),$kind==='int64');
            if ($v->isGreaterThan(self::LIMITS[$kind][1])) throw new \UnexpectedValueException('Malformed integer result');
            return $v;
        }
        if ($kind==='float64') return unpack('e',$data)[1];
        if ($kind==='float32') {
            if (substr($data,4)!=="\0\0\0\0") throw new \UnexpectedValueException('Malformed Float32');
            return unpack('g',$data)[1];
        }
        $v=unpack('l',$data)[1]; // wasm32 is little-endian.
        if (pack('V2',$v,$v<0?-1:0)!==$data) throw new \UnexpectedValueException('Malformed sign extension');
        if ($kind==='unit') return $v===0 ? null : throw new \UnexpectedValueException('Malformed Unit');
        if ($kind==='bool') return match ($v) {0=>false,1=>true,default=>throw new \UnexpectedValueException('Malformed Bool')};
        if ($kind==='char') return ScalarCodec::text($v);
        self::small($kind,$v); return $v;
    }
}
