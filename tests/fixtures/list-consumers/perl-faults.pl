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
    goto &$original_loader unless defined($_[0]) && $_[0] eq 'LeanBridge::Lists';
    my $library = DynaLoader::dl_load_file($ARGV[0], 0x01) or die DynaLoader::dl_error();
    my $symbol = DynaLoader::dl_find_symbol($library, 'boot_LeanBridge__Lists') or die DynaLoader::dl_error();
    my $boot = DynaLoader::dl_install_xsub('LeanBridge::Lists::bootstrap', $symbol, $ARGV[0]);
    $boot->(@_);
  };
  require LeanBridge::Lists;
}
my $context = 'initialization';
sub check ($;$) { confess("List cleanup assertion ($context): " . ($_[1] // '')) unless $_[0]; }
sub some { LeanBridge::Lists::Some->new($_[0]) }
sub ok { LeanBridge::Lists::Ok->new($_[0]) }
sub err { LeanBridge::Lists::Err->new($_[0]) }
sub quiet {
  my $live = LeanBridge::Runtime::_snapshot();
  check($live->{live_scopes} == 0 && $live->{live_callbacks} == 0 && $live->{live_wrappers} == 0, JSON::PP->new->encode($live));
}
sub recovered {
  my $out = LeanBridge::Lists::reverse_uint32([1, 2, 3]);
  check(join(',', @$out) eq '3,2,1'); quiet();
}
sub faults {
  my ($call) = @_;
  LeanBridge::Lists::_list_probe(0); $call->();
  my $count = LeanBridge::Lists::_list_probe(0); quiet(); check($count > 0);
  for my $target (1 .. $count) {
    $context = "conversion checkpoint $target of $count";
    LeanBridge::Lists::_list_probe($target);
    my $passed = eval { $call->(); 1 }; my $error = $@;
    LeanBridge::Lists::_list_probe(0);
    check(!$passed && "$error" =~ /injected List conversion failure/, "passed=" . ($passed // '') . " error=$error"); quiet(); recovered();
  }
  return $count;
}
my $huge = Math::BigInt->bone->blsft(5120)->badd(17);
my $packet = LeanBridge::Lists::Packet->new(sequences => [[1, 2, 3], [], [4]],
  branches => [undef, some(ok([$huge, undef])), some(err("oops\0"))],
  buffers => ["\0\xff", ''], arrays => [[[LeanBridge::Lists::true(), "\x{1f33f}"]], []]);
my $deep = 42; $deep = [$deep] for 1 .. 24;
my $count = faults(sub { LeanBridge::Lists::transform($packet) })
  + faults(sub { LeanBridge::Lists::duplicate("\0\xff") })
  + faults(sub { LeanBridge::Lists::reverse_nat([$huge, $huge]) })
  + faults(sub { LeanBridge::Lists::nest(some([ok([undef]), err('bad'), ok([])])) })
  + faults(sub { LeanBridge::Lists::swap(ok([[$huge, Math::BigInt->new(42)], [1, 2]])) })
  + faults(sub { LeanBridge::Lists::swap(err(['first', 'last'])) })
  + faults(sub { LeanBridge::Lists::deep($deep) });
for (1 .. 16) {
  $context = "partial input $_";
  my $input = ['copied first', undef]; my $weak = $input; weaken($weak);
  my $passed = eval { LeanBridge::Lists::reverse_string($input); 1 }; my $error = $@;
  check(!$passed && "$error" =~ /String requires/, "passed=" . ($passed // '') . " error=$error"); quiet();
  undef $input; check(!defined($weak)); recovered();
}
# Preserve the original host exception and release partially converted Lists.
my $error_object = bless {}, 'ConversionError';
my $host_failures = 0;
for my $method ('bstr', 'new') {
  no strict 'refs'; no warnings 'redefine';
  my $original = Math::BigInt->can($method);
  for my $target (1, 2) {
    $context = "$method exception $target";
    my $seen = 0;
    local *{"Math::BigInt::$method"} = sub { die $error_object if ++$seen == $target; $original->(@_) };
    my $passed = eval { LeanBridge::Lists::reverse_nat([$huge, $huge]); 1 }; my $error = $@;
    check(!$passed && refaddr($error) == refaddr($error_object)); quiet(); ++$host_failures;
  }
}
# Pin all slots before the first element conversion can clear or resize the input.
my $reentrant = 0;
for my $mutation ('clear', 'replace', 'append') {
  $context = "reentrant $mutation";
  no warnings 'redefine';
  my ($list, $original) = ([$huge, Math::BigInt->new(42)], Math::BigInt->can('bstr'));
  my $seen = 0;
  local *Math::BigInt::bstr = sub {
    if (!$seen++) {
      @$list = () if $mutation eq 'clear';
      @$list = (Math::BigInt->new(99)) if $mutation eq 'replace';
      push @$list, Math::BigInt->new(99) if $mutation eq 'append';
    }
    $original->(@_);
  };
  my $out = LeanBridge::Lists::reverse_nat($list);
  check(@$out == 2 && $out->[0]->bcmp(42) == 0 && $out->[1]->bcmp($huge) == 0); quiet(); ++$reentrant;
}
recovered();
print JSON::PP->new->canonical->encode({ checks => $count + 16 + $host_failures + $reentrant, conversion_checkpoints => $count, partial_inputs => 16, host_exceptions => $host_failures, reentrant_lists => $reentrant }) . "\n";
