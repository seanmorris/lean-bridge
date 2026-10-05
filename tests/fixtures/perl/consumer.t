use strict;
use warnings;
use utf8;
use Test::More;
use Scalar::Util qw(refaddr blessed);
use Math::BigInt;
use Config;
use POSIX ();
use LeanBridge::Workshop;
use LeanBridge::Runtime;

sub fails {
  my ($label, $pattern, $call) = @_;
  local $@;
  my $ok = eval { $call->(); 1 };
  ok(!$ok, $label);
  like("$@", $pattern, "$label diagnostic");
}
sub clean {
  my $snapshot = LeanBridge::Runtime::_snapshot();
  is($snapshot->{live_scopes}, 0, 'no leaked conversion scopes');
  is($snapshot->{live_callbacks}, 0, 'no leaked host callbacks');
  is($snapshot->{live_wrappers}, 0, 'no leaked resource wrappers');
  is($snapshot->{live_identities}, 0, 'no leaked native identities');
}

is(LeanBridge::Workshop::add(19, 23), 42, 'ordinary Lean addition');
is(LeanBridge::Workshop::echo_unit(undef), undef, 'Unit is undef');
ok(LeanBridge::Workshop::echo_bool(LeanBridge::Workshop::true()), 'Bool true');
ok(!LeanBridge::Workshop::echo_bool(LeanBridge::Workshop::false()), 'Bool false');
fails('Bool rejects strings', qr/Bool requires/, sub { LeanBridge::Workshop::echo_bool('true') });
fails('Unit rejects zero', qr/Unit requires/, sub { LeanBridge::Workshop::echo_unit(0) });

for my $case (
  [8, 255], [16, 65535], [32, 4294967295], [64, 18446744073709551615],
) {
  my ($bits, $max) = @$case;
  my $call = LeanBridge::Workshop->can("echo_uint$bits");
  ok($call, "UInt$bits function exists");
  next unless $call;
  is($call->(0), 0, "UInt$bits zero");
  is($call->($max), $max, "UInt$bits maximum remains exact");
  fails("UInt$bits rejects negative", qr/unsigned integer/, sub { $call->(-1) });
  fails("UInt$bits rejects numeric text", qr/integer/, sub { $call->('12') });
  fails("UInt$bits rejects fractions", qr/integer/, sub { $call->(1.5) });
  fails("UInt$bits upper bound", qr/integer/, sub { $call->($max + 1) }) if $bits < 64;
}
for my $case (
  [8, -128, 127], [16, -32768, 32767], [32, -2147483648, 2147483647],
  [64, -9223372036854775808, 9223372036854775807],
) {
  my ($bits, $min, $max) = @$case;
  my $call = LeanBridge::Workshop->can("echo_int$bits");
  is($call->($min), $min, "Int$bits minimum remains exact");
  is($call->($max), $max, "Int$bits maximum remains exact");
  fails("Int$bits upper bound", qr/integer/, sub { $call->($max + 1) });
}
for my $bits (31, 32, 53, 64, 4096) {
  my $big = Math::BigInt->new(2)->bpow($bits)->badd(1);
  is(LeanBridge::Workshop::echo_nat($big)->bstr, $big->bstr, "Nat preserves $bits-bit boundary");
  my $negative = $big->copy->bneg;
  is(LeanBridge::Workshop::echo_int($negative)->bstr, $negative->bstr, "Int preserves negative $bits-bit boundary");
}
fails('Nat rejects negative BigInt', qr/Nat cannot/, sub { LeanBridge::Workshop::echo_nat(Math::BigInt->new(-1)) });
fails('Nat requires BigInt', qr/Math::BigInt/, sub { LeanBridge::Workshop::echo_nat(12) });
fails('Int rejects infinity', qr/finite/, sub { LeanBridge::Workshop::echo_int(Math::BigInt->binf()) });
is(LeanBridge::Workshop::echo_float32(1.234567890123), unpack('f', pack('f', 1.234567890123)), 'Float32 binary32 rounding');
is(LeanBridge::Workshop::echo_float(1.234567890123), 1.234567890123, 'Float binary64');
is(unpack('H*', pack('d', LeanBridge::Workshop::echo_float(-0.0))), unpack('H*', pack('d', -0.0)), 'Float negative zero');
my $infinity = 9**9**9;
is(LeanBridge::Workshop::echo_float($infinity), $infinity, 'Float infinity');
my $nan = unpack('d', pack('H*', '000000000000f87f'));
my $nan_out = LeanBridge::Workshop::echo_float($nan);
ok($nan_out != $nan_out, 'Float NaN');

my $text = "A\0λ🚀";
is(LeanBridge::Workshop::echo_string($text), $text, 'Unicode and embedded NUL');
my $bytes = pack('C*', 0, 1, 127, 128, 255);
is(LeanBridge::Workshop::echo_bytes($bytes), $bytes, 'octets remain binary');
my $unicode_bytes = 'abc'; utf8::upgrade($unicode_bytes);
fails('ByteArray rejects Unicode', qr/octet string/, sub { LeanBridge::Workshop::echo_bytes($unicode_bytes) });
fails('String rejects surrogate', qr/Unicode/, sub { LeanBridge::Workshop::echo_string(chr(0xd800)) });
fails('copy budget', qr/16 MiB/, sub { LeanBridge::Workshop::echo_bytes('x' x (16 * 1024 * 1024 + 1)) });

my $packet = LeanBridge::Workshop::Packet->new(
  label => LeanBridge::Workshop::Label->new(text => $text, bytes => $bytes),
  values => [0, 42, 4294967295], enabled => LeanBridge::Workshop::true(),
);
my $copied = LeanBridge::Workshop::echo_packet($packet);
is_deeply($copied, $packet, 'nested copied record');
isnt(refaddr($copied), refaddr($packet), 'record result is an independent copy');
$copied->{values}[0] = 99;
is($packet->{values}[0], 0, 'arrays are independently copied');
is_deeply(LeanBridge::Workshop::echo_packets([$packet, $packet]), [$packet, $packet], 'arrays of nested records');
my $reading = LeanBridge::Workshop::Reading->new(value => 4294967295);
is_deeply(LeanBridge::Workshop::echo_reading($reading), $reading, 'compiler-unboxed copied record');
is_deeply(LeanBridge::Workshop::echo_readings([$reading]), [$reading], 'array of compiler-unboxed records');
my $bad = LeanBridge::Workshop::Packet->new(%$packet, values => [1, -1]);
fails('nested conversion cleans partial values', qr/integer/, sub { LeanBridge::Workshop::echo_packet($bad) });
clean();

my %scalars = (
  unitVal => undef, boolVal => LeanBridge::Workshop::true(),
  uint8Val => 255, uint16Val => 65535, uint32Val => 4294967295, uint64Val => 18446744073709551615,
  int8Val => -128, int16Val => -32768, int32Val => -2147483648, int64Val => -9223372036854775808,
  natVal => Math::BigInt->new(2)->bpow(4096), intVal => Math::BigInt->new(-2)->bpow(4095),
  float32Val => 1.25, floatVal => 1.234567890123, stringVal => $text, bytesVal => $bytes,
);
is_deeply(LeanBridge::Workshop::echo_scalars(LeanBridge::Workshop::Scalars->new(%scalars)),
  LeanBridge::Workshop::Scalars->new(%scalars), 'all sixteen scalar record fields');
{
  package MutatingBigInt;
  our @ISA = ('Math::BigInt');
  our $before_stringify;
  sub bstr { $before_stringify->() if $before_stringify; return Math::BigInt::bstr($_[0]); }
  package MutatingText;
  sub TIESCALAR { bless { read => $_[1] }, $_[0] }
  sub FETCH { $_[0]->{read}->() }
}
{
  my $number = bless Math::BigInt->new(42), 'MutatingBigInt';
  my $changing_record = LeanBridge::Workshop::Scalars->new(%scalars, natVal => $number);
  local $MutatingBigInt::before_stringify = sub { undef $changing_record };
  my $result = LeanBridge::Workshop::echo_scalars($changing_record);
  ok(!defined($changing_record), 'BigInt conversion can release the caller record reference');
  is($result->{natVal}->bstr, '42', 'conversion retains the record while user Perl code runs');
}
{
  my $changing_array = [LeanBridge::Workshop::Packet->new(
    label => LeanBridge::Workshop::Label->new(text => '', bytes => $bytes),
    values => [42], enabled => LeanBridge::Workshop::true(),
  )];
  tie $changing_array->[0]{label}{text}, 'MutatingText', sub { undef $changing_array; return 'saved' };
  my $result = LeanBridge::Workshop::echo_packets($changing_array);
  ok(!defined($changing_array), 'scalar magic can release the caller array reference');
  is($result->[0]{label}{text}, 'saved', 'conversion retains array and nested record storage');
}
for my $field (sort keys %scalars) {
  (my $name = $field) =~ s/Val\z//;
  my $call = LeanBridge::Workshop->can("call_$name");
  is_deeply($call->($scalars{$field}, sub { $_[0] }), $scalars{$field}, "$name callback input and result");
}
clean();

{
  my $counter = LeanBridge::Workshop::new_counter(42);
  is(LeanBridge::Workshop::read_counter($counter), 42, 'resource read');
  is(refaddr(LeanBridge::Workshop::same_counter($counter)), refaddr($counter), 'canonical live resource identity');
  my $closure = LeanBridge::Workshop::make_adder(7);
  is($closure->call(35), 42, 'returned Lean closure');
  is(LeanBridge::Workshop::with_callback(20, sub { $_[0] * 2 }), 41, 'synchronous host callback');
  is(LeanBridge::Workshop::with_callback(1, sub { LeanBridge::Workshop::add($_[0], 40) }), 42, 'callback reentry');
  my $runner = LeanBridge::Workshop::new_runner(42);
  is($runner->call(sub { $runner->close; $_[0] }), 42, 'closure can close during its own call');
  ok($runner->closed, 'self-closed closure stays closed');
  my $retained = LeanBridge::Workshop::keep_callback(sub { $_[0] });
  fails('retained host callback expires safely', qr/callback has expired/, sub { $retained->call(1) });
  $retained->close;
  my $big = Math::BigInt->new(2)->bpow(4096);
  is(LeanBridge::Workshop::callback_nat($big, sub { $_[0]->copy->badd(1) })->bstr, $big->copy->badd(1)->bstr, 'BigInt callback conversion and stack growth');
  is(LeanBridge::Workshop::callback_text($text, sub { $_[0] . '!' }), $text . '!', 'Unicode callback');
  is(LeanBridge::Workshop::with_pair(20, 22, sub { $_[0] + $_[1] }), 42, 'multi-argument callback');
  is_deeply(LeanBridge::Workshop::callback_packet($packet, sub { $_[0] }), $packet, 'nested record callback');
  is_deeply(LeanBridge::Workshop::callback_packets([$packet], sub { $_[0] }), [$packet], 'nested record array callback');
  fails('record callback failure cleanup', qr/record exploded/, sub {
    LeanBridge::Workshop::callback_packet($packet, sub { die "record exploded\n" });
  });
  my $exception = bless { message => 'original exception' }, 'PerlConsumerException';
  my $caught;
  eval { LeanBridge::Workshop::with_callback(1, sub { die $exception }) }; $caught = $@;
  is(refaddr($caught), refaddr($exception), 'callback rethrows the original exception object');
  fails('invalid callback return', qr/integer/, sub { LeanBridge::Workshop::with_callback(1, sub { 'invalid' }) });
  is(LeanBridge::Workshop::with_callback(1, sub { $counter->close; 41 }), 42, 'close a resource during callback');
  ok($counter->closed, 'resource reports closed'); $counter->close;
  fails('stale resource', qr/closed/, sub { LeanBridge::Workshop::read_counter($counter) });
  fails('wrong resource kind', qr/wrong Lean resource/, sub { LeanBridge::Workshop::read_counter($closure) });
  fails('forged wrapper', qr/invalid or foreign/, sub { LeanBridge::Workshop::read_counter(bless {}, 'LeanBridge::Workshop::Counter') });
  $closure->close; $closure->close;
  fails('closed closure', qr/closed/, sub { $closure->call(1) });
}
clean();
for (1..1000) {
  my $counter = LeanBridge::Workshop::new_counter($_);
  LeanBridge::Workshop::same_counter($counter)->close;
  LeanBridge::Workshop::make_adder(1)->close;
}
{
  my $counter = LeanBridge::Workshop::new_counter(2);
  my $closure = LeanBridge::Workshop::make_adder(1);
}
clean();
is(LeanBridge::Runtime::_snapshot()->{runtime_init_runs}, 1, 'one shared runtime initialization');
SKIP: {
  skip 'Perl was compiled without interpreter threads', 2 unless $Config{useithreads};
  require threads;
  my $message = threads->create(sub {
    eval { LeanBridge::Workshop::add(1, 2) };
    return "$@";
  })->join;
  like($message, qr/cross-interpreter/, 'cross-interpreter call is rejected before Lean execution');
  is(LeanBridge::Workshop::add(19, 23), 42, 'creating a thread does not replace the runtime owner');
}
my $child = fork();
die "fork failed: $!" unless defined $child;
if (!$child) {
  eval { LeanBridge::Workshop::add(1, 2) };
  POSIX::_exit("$@" =~ /initiating process/ ? 0 : 1);
}
waitpid($child, 0);
is($?, 0, 'post-fork call is rejected; a fresh process must import its own runtime');
if ($ENV{LEAN_BRIDGE_PERL_OTHER}) {
  require LeanBridge::Other;
  my $counter = LeanBridge::Workshop::new_counter(42);
  is(LeanBridge::Other::value($counter), 42, 'resource crosses independently compiled component boundary');
  is(refaddr(LeanBridge::Other::same($counter)), refaddr($counter), 'canonical identity across components');
  is(LeanBridge::Other::multiply(6, 7), 42, 'unrelated ordinary project executes its own Lean definition');
  is(LeanBridge::Runtime::_snapshot()->{runtime_init_runs}, 1, 'components share one runtime');
  $counter->close;
  fails('closed cross-component handle', qr/closed/, sub { LeanBridge::Other::value($counter) });
  clean();
}
done_testing();
