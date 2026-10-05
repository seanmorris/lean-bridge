# Independent public values for copied Perl callbacks and returned closures.
use strict;
use warnings;
use Math::BigInt;

sub structured_ctor {
  my ($name, @fields) = @_;
  return "LeanBridge::Structured::$name"->new(@fields);
}
sub structured_some { return structured_ctor('Some', $_[0]); }
sub structured_ok { return structured_ctor('Ok', $_[0]); }
sub structured_err { return structured_ctor('Err', $_[0]); }
sub structured_text { return "seed=$_[0]\0e\x{301}\x{1f642}\x{10ffff}"; }
sub structured_huge {
  return Math::BigInt->bone->blsft(1024 + $_[0])->badd(19 + $_[0]);
}
sub structured_array {
  my ($seed) = @_;
  return [] if $seed % 4 == 0;
  return [undef, structured_some(''), structured_some("\0"),
    structured_some(structured_text($seed))];
}
sub structured_list {
  my ($seed) = @_;
  return [] if $seed % 4 == 0;
  return [structured_ok([4294967295, structured_text($seed)]),
    structured_err(structured_text($seed)), structured_ok([$seed, '']),
    structured_err('')];
}
sub structured_option {
  my ($seed) = @_;
  return undef if $seed % 3 == 0;
  return structured_some(undef) if $seed % 3 == 1;
  return structured_some(structured_some(undef));
}
sub structured_result {
  my ($seed) = @_;
  return structured_ok(undef) if $seed % 4 == 0;
  return structured_ok(structured_some($seed)) if $seed % 4 == 1;
  return structured_err([structured_text($seed), '', "\0"]) if $seed % 4 == 2;
  return structured_err([]);
}
sub structured_tuple {
  my ($seed) = @_;
  return [structured_text($seed), [pack('C*', 0, 255, $seed),
    structured_huge($seed)]];
}
sub structured_record {
  my ($seed) = @_;
  my $nested = $seed % 3 == 0 ? undef : $seed % 3 == 1
    ? structured_some(structured_ok([18446744073709551615, undef]))
    : structured_some(structured_err(structured_text($seed)));
  return structured_ctor('Payload', text => structured_text($seed),
    rows => structured_array($seed), count => structured_huge($seed),
    nested => $nested);
}
sub structured_variant {
  my ($seed) = @_;
  return structured_ctor('Packet::Empty') if $seed % 3 == 0;
  return structured_ctor('Packet::Payload', label => structured_text($seed),
    rows => structured_array($seed)) if $seed % 3 == 1;
  return structured_ctor('Packet::Counts', positive => structured_huge($seed),
    negative => structured_huge($seed + 1)->bneg);
}
sub structured_value {
  my ($shape, $seed) = @_;
  my %factories = (array => \&structured_array, list => \&structured_list,
    option => \&structured_option, result => \&structured_result,
    tuple => \&structured_tuple, record => \&structured_record,
    variant => \&structured_variant, alias => \&structured_record);
  die "Unknown structured shape: $shape\n" unless exists $factories{$shape};
  return $factories{$shape}->($seed);
}
