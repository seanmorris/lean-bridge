use strict;
use warnings;
use utf8;
use JSON::PP;
use Scalar::Util qw(refaddr blessed weaken);
use POSIX qw(isnan HUGE_VAL);
use Config;
use LeanBridge::Recursive;

our $checks = 0;
sub check {
  ++$checks;
  die "Perl graph assertion $checks at " . (caller)[2] . "\n" unless $_[0];
}
sub rejects {
  my ($pattern, $call) = @_;
  my $success = eval { $call->(); 1 };
  my $error = $@;
  die "Expected $pattern at " . (caller)[2] . ", got " . ($success ? 'success' : $error) . "\n" if $success || $error !~ $pattern;
  check(1);
}
sub snapshot { [LeanBridge::Recursive::Probe::snapshot()] }
sub clean { my $state = snapshot(); check($state->[0] == 0 && $state->[1] == 0); }
sub graph_reset { LeanBridge::Recursive::Probe::reset(@_); }
sub payload {
  LeanBridge::Recursive::Scalars->new(
    unit => undef, bool => LeanBridge::Recursive::true(),
    u8 => 255, u16 => 65535, u32 => 4294967295, u64 => 18446744073709551615,
    i8 => -128, i16 => -32768, i32 => -2147483648, i64 => -9223372036854775808,
    natural => Math::BigInt->new(2)->bpow(1001)->badd(7),
    integer => Math::BigInt->new(2)->bpow(1001)->badd(7)->bneg(),
    f32 => 1.5, f64 => -2.25, text => "A\0🌱", bytes => pack('C*', 0, 255, 1),
    char => '🌱', word => 4294967295, signedWord => -2147483648, @_);
}
sub tree_value {
  LeanBridge::Recursive::Tree::Branch->new(children => [
    LeanBridge::Recursive::Tree::Leaf->new(payload => payload()),
    LeanBridge::Recursive::Tree::Branch->new(children => [])]);
}
sub envelope_value {
  my $tree = tree_value();
  LeanBridge::Recursive::Envelope->new(tree => $tree, alternatives => [[], [$tree]],
    fallback => LeanBridge::Recursive::Some->new($tree),
    outcome => LeanBridge::Recursive::Ok->new([$tree, $tree]),
    marker => LeanBridge::Recursive::Some->new(LeanBridge::Recursive::Some->new(undef)), @_);
}
sub same_value {
  my ($left, $right) = @_;
  return !defined($right) unless defined($left);
  return 0 unless defined($right) && ref($left) eq ref($right);
  return $left eq $right unless ref($left);
  if (blessed($left) && $left->isa('Math::BigInt')) { return $left->bcmp($right) == 0; }
  if (ref($left) eq 'ARRAY') {
    return 0 unless @$left == @$right;
    for my $i (0 .. $#$left) { return 0 unless same_value($left->[$i], $right->[$i]); }
    return 1;
  }
  return 0 unless keys(%$left) == keys(%$right);
  for my $key (keys %$left) { return 0 unless exists($right->{$key}) && same_value($left->{$key}, $right->{$key}); }
  return 1;
}
sub identity_count { B::svref_2object($_[0])->REFCNT }
sub perl_identity {
  return (perl => $Config{version}, threaded => ($Config{useithreads} // '') eq 'define' ? JSON::PP::true : JSON::PP::false,
    wordBits => 8 * $Config{ivsize}, pointerBits => 8 * $Config{ptrsize});
}
1;
