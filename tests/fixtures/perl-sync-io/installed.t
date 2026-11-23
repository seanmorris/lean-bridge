use v5.36;
use strict;
use warnings;
use utf8;
use Test::More;
use Math::BigInt;
use Config;
use POSIX ();
use Scalar::Util qw(refaddr);
require LeanBridge::Journal;
sub dies_with ($f) {
    my $ok = eval { $f->(); 1 }; my $e=$@;
    die "expected this call to fail" if $ok;
    return $e;
}
my $yes = LeanBridge::Journal::true(); my $no = LeanBridge::Journal::false();
is(LeanBridge::Journal::count(),0,'fresh process');
is(LeanBridge::Journal::bump(3),3,'ordered state mutation');
is(LeanBridge::Journal::echo(17),17,'pure companion is not async');
is(LeanBridge::Journal::bump(4),7,'second mutation sees previous effect');
is(LeanBridge::Journal::rt_unit(undef),undef,'Unit');
ok(!LeanBridge::Journal::rt_bool($no) && LeanBridge::Journal::rt_bool($yes),'native booleans');
my $u64=unpack('Q<',"\xff"x8); my $i64=unpack('q<',("\0"x7)."\x80");
for my $case ([uint8=>255],[uint16=>65535],[uint32=>4294967295],[uint64=>$u64],[usize=>$u64],
              [int8=>-128],[int16=>-32768],[int32=>-2147483648],[int64=>$i64],[isize=>$i64]) {
    my ($type,$number)=@$case; my $fn=LeanBridge::Journal->can("rt_$type");
    is($fn->($number),$number,"exact $type endpoint");
}
my $text = "snow 雪\0🙂"; my $bytes = "\0\xff\x01";
is(LeanBridge::Journal::rt_string($text),$text,'Unicode + interior NUL');
is(LeanBridge::Journal::rt_char('🙂'),'🙂','non-BMP Char');
my $raw = LeanBridge::Journal::rt_bytes($bytes);
ok($raw eq $bytes && !utf8::is_utf8($raw),'opaque octets');
is(LeanBridge::Journal::rt_string(''),'','empty text');
is(LeanBridge::Journal::rt_bytes(''),'','empty bytes');
my $big = Math::BigInt->new(2)->bpow(257)->badd(3);
for my $n ($big,Math::BigInt->new(0)) {
    my $r=LeanBridge::Journal::rt_nat($n); isa_ok($r,'Math::BigInt'); is($r->bstr,$n->bstr,'exact Nat');
}
my $neg=$big->copy->bneg;
is(LeanBridge::Journal::rt_int($neg)->bstr,$neg->bstr,'exact negative Int');
is(LeanBridge::Journal::rt_float32(16777217),16777216,'round to binary32');
my $minuszero=unpack('d<',pack('H*','0000000000000080'));
is(pack('d<',LeanBridge::Journal::rt_float64($minuszero)),pack('d<',$minuszero),'signed zero');
my $nan=unpack('d<',pack('H*','000000000000f87f')); my $got_nan=LeanBridge::Journal::rt_float64($nan);
ok($got_nan != $got_nan,'binary64 NaN');
for my $bad ([unit=>1],[bool=>1],[uint8=>256],[uint32=>-1],[int8=>-129],[int64=>$u64],
             [char=>"ab"],[char=>chr(0xd800)],[string=>chr(0xd800)],[bytes=>$text],
             [float64=>"3.14"],[nat=>$neg],[int=>"123"],[int=>Math::BigInt->bnan]) {
    my ($type,$v)=@$bad; my $fn=LeanBridge::Journal->can("rt_$type");
    my $error=dies_with(sub { $fn->($v) }); ok(!ref($error) && length($error),"reject invalid $type before entering Lean");
}
is(LeanBridge::Journal::count(),7,'rejected calls left state intact');
{
    # Conversion can invoke Perl even after the native call returned an owned buffer.
    # The XS cleanup guard must survive that exception; it is not a Lean EIO failure.
    my $sentinel=bless {},'Local::FormatFailure';
    no warnings 'redefine';
    local *Math::BigInt::new = sub { die $sentinel };
    my $failure=dies_with(sub { LeanBridge::Journal::rt_int($neg) });
    is(refaddr($failure),refaddr($sentinel),'original Perl exception during output conversion');
}
is(LeanBridge::Journal::rt_int($neg)->bstr,$neg->bstr,'successful call after conversion exception');
for my $reject ($yes,$no) {
    for my $ok ($yes,$no) {
        my $f=sub { LeanBridge::Journal::choose($reject,$ok,$text) };
        my $result;
        if ($reject) {
            my $e=dies_with($f); isa_ok($e,'LeanBridge::Journal::EIOError');
            isa_ok($e,'LeanBridge::Journal::Error::choose'); is($e->declaration,'Journal.choose','declared failure provenance');
            $result=$e->payload;
        } else { $result=$f->() }
        isa_ok($result,'LeanBridge::Journal::'.($ok?'Ok':'Err'));
        is($result->value,$ok?$text:37,'returned or thrown payload intact');
    }
    for my $tag (0,1,2) {
        my $f=sub { LeanBridge::Journal::nested($reject,$tag,$neg,$text,$bytes) };
        my $r=$reject ? dies_with($f)->payload : $f->();
        isa_ok($r,'LeanBridge::Journal::'.($tag?'Err':'Ok'));
        if (!$tag) { is($r->value,$text,'nested text') }
        elsif ($tag==1) { isa_ok($r->value,'LeanBridge::Journal::Ok'); is($r->value->value->bstr,$neg->bstr,'nested integer') }
        else { isa_ok($r->value,'LeanBridge::Journal::Err'); is($r->value->value,$bytes,'nested octets') }
    }
}
my $path='journal.txt';
is(LeanBridge::Journal::store($path,$text),undef,'synchronous filesystem write');
is(LeanBridge::Journal::read($path),$text,'read sees the write');
dies_with(sub { LeanBridge::Journal::store($path,chr(0xd800)) });
is(LeanBridge::Journal::read($path),$text,'failed validation did not overwrite the file');
my $error=dies_with(sub { LeanBridge::Journal::read('absent.txt') });
isa_ok($error,'LeanBridge::Journal::IOError'); is($error->declaration,'Journal.read','IO.Error provenance');
like($error->message,qr/absent\.txt/,'IO.Error carries the message');
is(LeanBridge::Journal::count(),7,'declared failure did not poison the runtime');
my $pid=fork(); die "fork failed: $!" unless defined $pid;
if (!$pid) { my $e=dies_with(sub { LeanBridge::Journal::count() }); POSIX::_exit($e =~ /initiating process/ ? 0 : 1) }
waitpid($pid,0); is($?,0,'forked process cannot enter the inherited runtime');
SKIP: {
    skip 'unthreaded Perl',1 unless $Config{useithreads};
    require threads;
    my $err=threads->create(sub { dies_with(sub { LeanBridge::Journal::count() }) })->join;
    like($err,qr/initiating process and Perl interpreter thread/,'foreign interpreter cannot enter');
}
my $snapshot=LeanBridge::Runtime::_snapshot();
is($snapshot->{runtime_init_runs},1,'one process-wide Lean runtime');
is_deeply([@{$snapshot}{qw(live_identities live_wrappers live_scopes live_callbacks)}],[0,0,0,0],'runtime counters restored');
done_testing;
