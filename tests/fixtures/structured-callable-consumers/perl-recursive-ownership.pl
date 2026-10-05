use strict;
use warnings;
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed reftype);
use LeanBridge::Recursive;
do './values.pl' or die $@ || $!;

sub normalized {
  my ($value) = @_;
  return undef unless defined($value);
  return ['integer', $value->bstr] if blessed($value) && $value->isa('Math::BigInt');
  return ['array', map { normalized($_) } @$value] if ref($value) eq 'ARRAY';
  return [ref($value), map { [$_, normalized($value->{$_})] } sort keys %$value] if (reftype($value) // '') eq 'HASH';
  return $value;
}
my $leaf = LeanBridge::Recursive::Tree::Leaf->new(value => Math::BigInt->bone->blsft(257));
my $tree = LeanBridge::Recursive::Tree::Branch->new(children => [$leaf]);
# Initialize without invoking a host callback, including in the broken-scope
# counterfactual. No native caller may consume its deliberately expired reply.
my $initialize = LeanBridge::Recursive::make_recursive($tree);
$initialize->close; undef $initialize;
my @missing;
my $checks = 0;
for my $shape (qw(array list option result tuple record variant alias recursive)) {
  my $value = $shape eq 'recursive' ? $tree : structured_value($shape, $shape eq 'option' || $shape eq 'result' ? 2 : 1);
  my $actual;
  my $ok = eval { $actual = LeanBridge::Recursive::ownership($shape, $value, sub { $_[0] }); 1 };
  if (!$ok) {
    die $@ unless "$@" =~ /Callback owners released before native copying/;
    push @missing, $shape;
    next;
  }
  die "Borrowed callback result differs: $shape\n" unless JSON::PP->new->canonical->encode(normalized($actual)) eq JSON::PP->new->canonical->encode(normalized($value));
  ++$checks;
}
die scalar(@missing) . ' Callback owners released before native copying: ' . join(',', @missing) . "\n" if @missing;
my @remaining = LeanBridge::Recursive::fault_snapshot();
die "Retained callback storage\n" if $remaining[0] || $remaining[1] || $remaining[5];
print encode_json({ownershipChecks => $checks, checkedBeforeDecode => JSON::PP::true}), "\n";
