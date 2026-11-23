<?php
declare(strict_types=1);
use Brick\Math\BigInteger;
use LeanLedger\Bytes;
use LeanLedger\Internal\{Budget,WireValues};

require_once '/vendor/lean-bridge/ledger/bootstrap.php';
if (PHP_INT_SIZE!==4) throw new Exception('Expected real wasm32 Zend');
$vectors=[
    ['unit', null, '0000000000000000'], ['bool', true, '0100000000000000'],
    ['int8', -128, '80ffffffffffffff'], ['int16', -32768, '0080ffffffffffff'],
    ['int32', PHP_INT_MIN, '00000080ffffffff'], ['isize', PHP_INT_MIN, '00000080ffffffff'],
    ['uint8', 255, 'ff00000000000000'], ['uint16', 65535, 'ffff000000000000'],
    ['uint32', BigInteger::of('4294967295'), 'ffffffff00000000'],
    ['usize', BigInteger::of('4294967295'), 'ffffffff00000000'],
    ['int64', BigInteger::of('-9223372036854775808'), '0000000000000080'],
    ['int64', BigInteger::of('9223372036854775807'), 'ffffffffffffff7f'],
    ['uint64', BigInteger::of('18446744073709551615'), 'ffffffffffffffff'],
    ['nat', BigInteger::of('18446744073709551616'), '000000000000000000000000000000000100000000000000'],
    ['int', BigInteger::of('-18446744073709551616'), '010000000000000000000000000000000100000000000000'],
    ['int', BigInteger::zero(), '0000000000000000'], ['char', '🗝', 'ddf5010000000000'],
    ['float32', -1.5, '0000c0bf00000000'], ['float64', 1.0, '000000000000f03f'],
    ['bytes', Bytes::fromString("\x00\xff"), '00ff'], ['string', "δ\0", 'ceb400']
];
foreach ($vectors as [$kind,$value,$hex]) {
    if (bin2hex(WireValues::input($kind,$value,new Budget()))!==$hex) throw new Exception("Wrong encoded ".$kind);
    $decoded=WireValues::output($kind,"\0",hex2bin($hex));
    $valid=$value instanceof BigInteger ? $decoded instanceof BigInteger && $value->isEqualTo($decoded)
        : ($value instanceof Bytes ? $value->equals($decoded) : $value===$decoded);
    if (!$valid) throw new Exception("Wrong decoded ".$kind);
}
// Bytes chosen independently of the encoder. Wire corruption is not an
// application conversion limit, even when the malformed integer is large.
$word = static fn(int $v): string => pack('V2',$v,$v<0?-1:0);
$large = str_repeat("\0",6815)."\1";
$malformed = [
    ['unit',"\0",$word(1)], ['bool',"\0",$word(2)],
    ['uint8',"\0",$word(-1)], ['int8',"\0",$word(128)],
    ['uint16',"\0",$word(65536)], ['int16',"\0",$word(-32769)],
    ['int32',"\0",pack('V2',-1,0)], ['uint32',"\0",pack('V2',0,1)],
    ['char',"\0",$word(0xd800)], ['char',"\0",$word(0x110000)],
    ['float32',"\0",pack('V2',0,1)], ['string',"\0","\xff"],
    ['bytes',"\1",''], [['bool','string'],"\2",''],
    [[['bool','string'],'uint8'],"\0\1",$word(3)],
    ['int',"\0",''], ['nat',"\0",$word(0)."\0"],
    ['int',"\0",$word(1)], ['nat',"\0",$word(1).$word(1)],
    ['int',"\0",$word(0).$word(1).$word(0)],
    ['int',"\0",$word(2).$large], ['int',"\0",$large.$word(0)]
];
foreach ($malformed as $i=>[$kind,$tags,$bytes]) {
    try { WireValues::output($kind,$tags,$bytes); }
    catch (UnexpectedValueException $e) { continue; }
    throw new Exception("Accepted malformed output #".$i);
}
try { WireValues::output('int',"\0",$word(0).$large); throw new Exception('Accepted oversized integer'); }
catch (ValueError $e) {}
echo "codec:",count($vectors),":malformed:",count($malformed),":limit:1";
