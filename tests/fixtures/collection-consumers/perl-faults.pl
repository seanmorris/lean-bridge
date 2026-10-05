# Separate process, isolated test XS. Installed package files stay unchanged.
use strict;
use warnings;
use Carp qw(confess);
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(refaddr weaken);
use DynaLoader;
use XSLoader;
my $original_loader = \&XSLoader::load;
{
  no warnings 'redefine';
  local *XSLoader::load = sub {
    goto &$original_loader unless defined($_[0]) && $_[0] eq 'LeanBridge::Collections';
    my $library = DynaLoader::dl_load_file($ARGV[0], 0x01) or die DynaLoader::dl_error();
    my $symbol = DynaLoader::dl_find_symbol($library, 'boot_LeanBridge__Collections') or die DynaLoader::dl_error();
    my $boot = DynaLoader::dl_install_xsub('LeanBridge::Collections::bootstrap', $symbol, $ARGV[0]);
    $boot->(@_);
  };
  require LeanBridge::Collections;
}
my $context = 'initialization';
sub check ($;$) { confess("Collection cleanup assertion ($context): " . ($_[1] // '')) unless $_[0]; }
sub quiet {
  my $live = LeanBridge::Runtime::_snapshot();
  check($live->{live_scopes} == 0 && $live->{live_callbacks} == 0 && $live->{live_wrappers} == 0, JSON::PP->new->encode($live));
}
sub recovered {
  my $out = LeanBridge::Collections::array_reverse_uint32([[1, 2, 3]]);
  check(join(',', @{$out->[0]}) eq '3,2,1'); quiet();
}
sub faults {
  my ($call) = @_;
  LeanBridge::Collections::_collection_probe(0); $call->();
  my $count = LeanBridge::Collections::_collection_probe(0); quiet(); check($count > 0);
  for my $target (1 .. $count) {
    $context = "conversion checkpoint $target of $count";
    LeanBridge::Collections::_collection_probe($target);
    my $passed = eval { $call->(); 1 }; my $error = $@;
    LeanBridge::Collections::_collection_probe(0);
    check(!$passed && "$error" =~ /injected collection conversion failure/, "passed=" . ($passed // '') . " error=$error"); quiet(); recovered();
  }
  return $count;
}
my $huge = Math::BigInt->bone->blsft(5120)->badd(17);
sub primitive {
  return LeanBridge::Collections::Primitives->new(unit => undef, flag => LeanBridge::Collections::true(),
    u8 => 255, u16 => 65535, u32 => 4294967295, u64 => 18446744073709551615,
    i8 => -128, i16 => -32768, i32 => -2147483648, i64 => -9223372036854775808,
    natural => $huge, integer => $huge->copy->bneg, f32 => -0.0, f64 => 3.25,
    text => "\x{1f331}\0", bytes => "\xff\0\x80", char => "\x{1f331}", usize => 18446744073709551615, isize => -9223372036854775808);
}
my $record = primitive();
my $packet = LeanBridge::Collections::Packet->new(label => 'box', values => [[$record, $record], [], [$record]],
  empty => LeanBridge::Collections::Empty->new(), single => LeanBridge::Collections::Single->new(value => 9),
  count => LeanBridge::Collections::Count->new(value => $huge), pair => LeanBridge::Collections::Pair->new(first => 1, second => 'a'),
  reversed => LeanBridge::Collections::Reversed->new(second => 'b', first => 2));
my $deep = 42; $deep = [$deep] for 1 .. 24;
my $count = faults(sub { LeanBridge::Collections::record_shuffle($packet) })
  + faults(sub { LeanBridge::Collections::record_duplicate($packet) })
  + faults(sub { LeanBridge::Collections::array_duplicate(["\0\xff"]) })
  + faults(sub { LeanBridge::Collections::array_reverse_nat([[$huge, $huge], []]) })
  + faults(sub { LeanBridge::Collections::record_empty(LeanBridge::Collections::Empty->new()) })
  + faults(sub { LeanBridge::Collections::record_single(LeanBridge::Collections::Single->new(value => 1)) })
  + faults(sub { LeanBridge::Collections::deep($deep) });
for (1 .. 16) {
  $context = "partial input $_";
  my $array = [['copied first'], ['copied second', undef]]; my $weak = $array; weaken($weak);
  my $passed = eval { LeanBridge::Collections::array_reverse_string($array); 1 }; my $error = $@;
  check(!$passed && "$error" =~ /String requires/, "array error=$error"); quiet();
  undef $array; check(!defined($weak)); recovered();
  my $input = primitive(); $input->{text} = undef; $weak = $input; weaken($weak);
  $passed = eval { LeanBridge::Collections::record_reverse([$input]); 1 }; $error = $@;
  check(!$passed && "$error" =~ /String requires/, "record error=$error"); quiet();
  undef $input; check(!defined($weak)); recovered();
}
my $error_object = bless {}, 'ConversionError';
my $host_failures = 0;
for my $method ('bstr', 'new') {
  no strict 'refs'; no warnings 'redefine';
  my $original = Math::BigInt->can($method);
  for my $target (1, 2) {
    for my $call (sub { LeanBridge::Collections::array_reverse_nat([[$huge, $huge]]) },
        sub { LeanBridge::Collections::record_reverse([$record]) }) {
      $context = "$method exception $target"; my $seen = 0;
      local *{"Math::BigInt::$method"} = sub { die $error_object if ++$seen == $target; $original->(@_) };
      my $passed = eval { $call->(); 1 }; my $error = $@;
      check(!$passed && refaddr($error) == refaddr($error_object)); quiet(); ++$host_failures;
    }
  }
}
my ($reentrant_fields, $reentrant_outer_arrays) = (0, 0);
for my $mutation ('clear', 'replace', 'append') {
  $context = "reentrant record $mutation";
  my $input = primitive(); my $original = Math::BigInt->can('bstr'); my $seen = 0;
  {
    no warnings 'redefine';
    local *Math::BigInt::bstr = sub {
      if (!$seen++) {
        %$input = () if $mutation eq 'clear';
        %$input = (text => 'changed') if $mutation eq 'replace';
        $input->{extra} = 99 if $mutation eq 'append';
      }
      $original->(@_);
    };
    my $out = LeanBridge::Collections::record_reverse([$input])->[0];
    check(keys(%$out) == 19 && $out->natural->bcmp($huge) == 0 && $out->integer->bcmp($huge->copy->bneg) == 0);
    check($out->text eq "\x{1f331}\0" && $out->bytes eq "\xff\0\x80" && $out->char eq "\x{1f331}"); quiet(); ++$reentrant_fields;
  }
  $context = "reentrant outer Array $mutation";
  my $rows = [[$huge], [Math::BigInt->new(42)]]; $seen = 0;
  {
    no warnings 'redefine';
    local *Math::BigInt::bstr = sub {
      if (!$seen++) {
        @$rows = () if $mutation eq 'clear';
        @$rows = ([Math::BigInt->new(99)]) if $mutation eq 'replace';
        push @$rows, [Math::BigInt->new(99)] if $mutation eq 'append';
      }
      $original->(@_);
    };
    my $out = LeanBridge::Collections::array_reverse_nat($rows);
    check(@$out == 2 && $out->[0][0]->bcmp(42) == 0 && $out->[1][0]->bcmp($huge) == 0); quiet(); ++$reentrant_outer_arrays;
  }
}
recovered();
print JSON::PP->new->canonical->encode({ checks => $count + 32 + $host_failures + $reentrant_fields + $reentrant_outer_arrays,
  conversion_checkpoints => $count, partial_inputs => 32, host_exceptions => $host_failures,
  reentrant_fields => $reentrant_fields, reentrant_outer_arrays => $reentrant_outer_arrays }) . "\n";
