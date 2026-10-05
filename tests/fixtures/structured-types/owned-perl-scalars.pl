use strict;
use warnings;
use utf8;
use Math::BigInt;
use JSON::PP;
use Scalar::Util qw(refaddr);
use LeanBridge::OwnedProbe;

my $checks = 0;
my %called;
sub check { my ($ok, $why) = @_; die "scalar check " . ($checks + 1) . ": $why\n" unless $ok; ++$checks; }
sub invoke {
    my ($name, @arguments) = @_;
    no strict 'refs';
    ++$called{$name};
    return &{'LeanBridge::OwnedProbe::' . $name}(@arguments);
}
sub rejected {
    my ($code, $expected) = @_;
    my $ok = eval { $code->(); 1 };
    check(!$ok && $@ =~ $expected, "expected $expected; received $@");
}
sub snapshot { [LeanBridge::OwnedProbe::snapshot()] }
sub restored {
    my ($before) = @_;
    my $after = snapshot();
    check(join(',', @$before[0 .. 3, 6, 7]) eq join(',', @$after[0 .. 3, 6, 7]),
        'balanced owner ledger: ' . encode_json($after));
}
sub field {
    my ($packet, $name, $value) = @_;
    my %scalars = %{$packet->scalars}; $scalars{$name} = $value;
    return with($packet, 'scalars', LeanBridge::OwnedProbe::Scalars->new(%scalars));
}
sub with {
    my ($packet, $name, $value) = @_;
    my %fields = %{$packet}; $fields{$name} = $value;
    return LeanBridge::OwnedProbe::Packet->new(%fields);
}
my $empty = snapshot();
my $ticket = invoke('new_ticket', Math::BigInt->new(42), "A\0🌱");
my $huge = Math::BigInt->new(2)->bpow(128)->badd(1);
my $scalars = LeanBridge::OwnedProbe::Scalars->new(unit => undef, flag => LeanBridge::OwnedProbe::true(),
    char => "🌱", natural => $huge, integer => $huge->copy->bneg,
    u8 => 255, u16 => 65535, u32 => 4294967295, u64 => 18446744073709551615,
    i8 => -128, i16 => -32768, i32 => -2147483648, i64 => -9223372036854775808,
    word => 18446744073709551615, signedWord => -9223372036854775808,
    f32 => 1.5, f64 => -2.25, text => "A\0🌱", bytes => "\0\xff\x01");
my $packet = LeanBridge::OwnedProbe::Packet->new(ticket => $ticket, scalars => $scalars,
    optional => LeanBridge::OwnedProbe::Some->new(LeanBridge::OwnedProbe::Some->new(undef)),
    empty => LeanBridge::OwnedProbe::Empty->new);
my $baseline = snapshot();
check(invoke('inspect', $packet), 'Lean inspects every scalar field');
{
    my $out = invoke('echo', $packet);
    check(invoke('inspect', $out), 'all nineteen fields round trip');
    check(refaddr($out) != refaddr($packet) && refaddr($out->scalars) != refaddr($scalars), 'independent result records');
    check(refaddr($out->ticket) != refaddr($ticket), 'independently owned resource field');
    $out->scalars->{bytes} = "changed";
    check($scalars->bytes eq "\0\xff\x01", 'returned bytes are independent');
    my $made = invoke('make_packet', $ticket);
    check(invoke('inspect', $made), 'Lean constructs every scalar field');
}
restored($baseline);
for my $case (0 .. 2) {
    my $option = $case == 0 ? undef : LeanBridge::OwnedProbe::Some->new(
        $case == 1 ? undef : LeanBridge::OwnedProbe::Some->new(undef));
    my $source = with($packet, 'optional', $option);
    check(invoke('option_case', $source) == $case, 'Lean distinguishes nested Option Unit');
    my $out = invoke('echo', $source);
    check(invoke('option_case', $out) == $case, 'nested Option Unit survives a round trip');
}
restored($baseline);
for my $bits (0, 0x80000000, 1, 0x7f800000, 0xff800000, 0x7fc12345, 0x3f800001) {
    my $number = unpack('f<', pack('L<', $bits));
    my $source = field($packet, 'f32', $number);
    my $canonical = $number != $number ? 0x7fc00000 : $bits;
    check(invoke('bits32', $source) == $canonical, 'Lean Float32 bit semantics');
    my $out = invoke('echo', $source);
    check(unpack('L<', pack('f<', $out->scalars->f32)) == $bits, 'Float32 payload, infinity, subnormal and signed zero');
}
for my $hex ('0000000000000000', '0000000000000080', '0100000000000000',
    '000000000000f07f', '000000000000f0ff', 'bc9a78563412f87f', '010000000000f03f') {
    my $bytes = pack('H*', $hex);
    my $number = unpack('d<', $bytes);
    my $source = field($packet, 'f64', $number);
    my $canonical = $number != $number ? unpack('Q<', pack('H*', '000000000000f87f')) : unpack('Q<', $bytes);
    check(invoke('bits64', $source) == $canonical, 'Lean Float64 bit semantics');
    my $out = invoke('echo', $source);
    check(pack('d<', $out->scalars->f64) eq $bytes, 'Float64 payload, infinity, subnormal and signed zero');
}
restored($baseline);
for my $width (0, 1, 31, 32, 33, 63, 64, 65, 127, 128, 129, 511, 4096) {
    my $number = Math::BigInt->new(2)->bpow($width)->bsub(1);
    for my $sign (-1, 0, 1) {
        my $integer = $number->copy->bmul($sign);
        my $out = invoke('echo', field(field($packet, 'natural', $number), 'integer', $integer));
        check($out->scalars->natural->bcmp($number) == 0, 'Nat limb boundary');
        check($out->scalars->integer->bcmp($integer) == 0, 'Int sign and limb boundary');
    }
}
restored($baseline);
for my $value ('', "\0", "e\x{301}", chr(0x10ffff)) {
    my $out = invoke('echo', field($packet, 'text', $value));
    check($out->scalars->text eq $value, 'Unicode and empty text boundary');
}
for my $scalar (0, 0xd7ff, 0xe000, 0x10ffff) {
    my $out = invoke('echo', field($packet, 'char', chr($scalar)));
    check(ord($out->scalars->char) == $scalar, 'Unicode scalar boundary');
}
{
    my $out = invoke('echo', field($packet, 'bytes', ''));
    check($out->scalars->bytes eq '', 'empty bytes');
    my $values = invoke('units', [(undef) x 127]);
    check(@$values == 127 && !(grep { defined($_) } @$values), 'List Unit preserves every element');
    check(@{invoke('units', [])} == 0, 'empty List Unit');
}
restored($baseline);
for my $case (
    ['unit', 0], ['flag', 1], ['natural', Math::BigInt->new(-1)],
    ['u8', -1], ['u8', 256], ['u16', 65536], ['u32', 4294967296],
    ['u64', 18446744073709551616], ['word', -1],
    ['i8', -129], ['i8', 128], ['i16', -32769], ['i32', 2147483648],
    ['i64', -9223372036854775809], ['signedWord', 9223372036854775808],
    ['f32', '1.5'], ['f64', '1.5'], ['text', []], ['bytes', "🌱"],
    ['char', ''], ['char', 'ab']
) {
    rejected(sub { invoke('echo', field($packet, @$case)) },
        qr/range|scalar|integer|boolean|Bool|Unit|Nat|Char|text|string|octet|Byte|utf8|UTF-8|code point/i);
    restored($baseline);
}
{
    no warnings 'utf8';
    for my $key ('char', 'text') {
        rejected(sub { invoke('echo', field($packet, $key, chr(0xd800))) }, qr/scalar|UTF-8|Unicode|surrogate/i);
        restored($baseline);
    }
}
{
    my %missing = %{$scalars}; delete $missing{bytes};
    my $value = bless \%missing, 'LeanBridge::OwnedProbe::Scalars';
    rejected(sub { invoke('echo', with($packet, 'scalars', $value)) }, qr/field|schema/);
}
restored($baseline);
rejected(sub { invoke('units', [(undef) x 262145]) }, qr/limit/);
rejected(sub { invoke('echo', field($packet, 'bytes', 'x' x (16 * 1024 * 1024))) }, qr/limit/);
restored($baseline);
my $exercise = sub { my $out = invoke('echo', $packet); die "wrong scalar copy\n" unless invoke('inspect', $out) };
LeanBridge::OwnedProbe::reset();
$exercise->();
my $observed = snapshot();
my ($allocations, $exceptions) = @$observed[4, 5];
restored($baseline);
my ($allocator_failures, $exception_failures, $native_failures) = (0, 0, 0);
for my $index (1 .. $allocations) {
    LeanBridge::OwnedProbe::reset($index);
    my $ok = eval { $exercise->(); 1 };
    LeanBridge::OwnedProbe::reset();
    check(!$ok, "XS allocation failure $index");
    ++$allocator_failures; restored($baseline);
}
for my $index (1 .. $exceptions) {
    LeanBridge::OwnedProbe::reset(0, $index);
    my $ok = eval { $exercise->(); 1 };
    LeanBridge::OwnedProbe::reset();
    check(!$ok, "Perl exception checkpoint $index");
    ++$exception_failures; restored($baseline);
}
for my $index (0 .. 2000) {
    LeanBridge::OwnedProbe::reset(0, 0, $index);
    my $ok = eval { $exercise->(); 1 };
    LeanBridge::OwnedProbe::reset();
    restored($baseline);
    last if $ok;
    ++$native_failures;
    check($index < 2000, 'native fault walk completes');
}
my $kept = $ticket->retain();
$ticket->close();
check(!$kept->closed(), 'explicit retain survives source closure');
rejected(sub { invoke('inspect', $packet) }, qr/closed/);
$kept->close(); undef $kept; undef $packet; undef $ticket; undef $scalars;
restored($empty);
LeanBridge::OwnedProbe::Runtime::shutdown();
my $final = snapshot();
check($final->[0] == 0 && $final->[1] == 0 && $final->[2] == 0, 'all host and native ownership released');
print encode_json({checks => $checks, scalarFields => 19, exports => [sort keys %called],
    live => $final->[1], identities => $final->[2], allocatorFailures => $allocator_failures,
    exceptions => $exception_failures, nativeFailures => $native_failures});
