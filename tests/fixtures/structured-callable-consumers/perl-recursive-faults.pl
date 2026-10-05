use strict;
use warnings;
use Scalar::Util qw(refaddr);
use JSON::PP;
use LeanBridge::Recursive;
do './values.pl' or die $@ || $!;

my ($checks, $failures) = (0, 0);
my $where = '';
sub check { ++$checks; die "$where: $_[1]\n" unless $_[0] }
sub quiet {
  my ($held) = @_;
  my @value = LeanBridge::Recursive::fault_snapshot();
  check($value[0] == $held && $value[1] == 0 && $value[5] == $held, "remaining ownership: @value");
  return @value;
}
sub value {
  my ($shape, $seed) = @_;
  return structured_value($shape, $seed) unless $shape eq 'recursive';
  my $leaf = sub { LeanBridge::Recursive::Tree::Leaf->new(value => structured_huge($_[0])) };
  return $leaf->($seed) if $seed % 3 == 0;
  return LeanBridge::Recursive::Tree::Branch->new(children => []) if $seed % 3 == 1;
  return LeanBridge::Recursive::Tree::Branch->new(children => [$leaf->($seed), $leaf->($seed + 1), LeanBridge::Recursive::Tree::Branch->new(children => [])]);
}
my $marker = bless {}, 'RecursivePerlFault';
my @observations;
for my $shape (qw(array list option result tuple record variant alias recursive)) {
  my ($call, $twice, $make) = map { LeanBridge::Recursive->can($_ . '_' . $shape) } qw(call twice make);
  for my $seed (0 .. 3) {
    my ($input, $other) = (value($shape, $seed), value($shape, $seed + 1));
    my $held = $make->($input);
    my @paths = (
      ['callback', sub { $call->($input, sub { $other }) }],
      ['repeated', sub { $twice->($input, sub { $other }) }],
      ['create', sub { my $made = $make->($input); $made->close }],
      ['create-call', sub { my $made = $make->($input); $made->call(LeanBridge::Recursive::true(), $other); $made->close }],
      ['held-call', sub { $held->call(LeanBridge::Recursive::false(), $other) }]
    );
    for my $path (@paths) {
      my ($name, $invoke) = @$path;
      $where = "$shape/$seed/$name/baseline";
      LeanBridge::Recursive::fault_reset(); $invoke->();
      my @baseline = quiet(1);
      my %counts;
      for my $mode (1 .. 4) {
        my $count = $baseline[$mode == 1 ? 2 : $mode == 4 ? 3 : 4];
        for my $object ($mode == 2 ? (0, 1) : (0)) {
          for my $target (1 .. $count) {
            $where = "$shape/$seed/$name/mode=$mode/object=$object/$target of $count";
            LeanBridge::Recursive::fault_reset($target, $mode, $object ? $marker : undef);
            local $SIG{USR1} = sub { die "injected Perl signal\n" };
            my $ok = eval { $invoke->(); 1 }; my $error = $@;
            LeanBridge::Recursive::fault_reset();
            check(!$ok, 'fault must propagate');
            if ($object) { check(ref($error) && refaddr($error) == refaddr($marker), 'error identity') }
            else { check("$error" =~ /allocation failed|status=3|injected recursive Perl conversion failure|injected Perl signal/, "wrong error $error") }
            quiet(1);
            $call->($input, sub { $_[0] }); quiet(1);
            ++$failures; ++$counts{$mode};
          }
        }
      }
      push @observations, {shape => $shape, seed => $seed, path => $name, baseline => \@baseline, counts => \%counts};
    }
    $held->close;
    # Closed wrappers keep only their private Perl-side ownership record.
    undef $held;
    quiet(0);
  }
}
print JSON::PP->new->canonical->encode({checks => $checks, failures => $failures, observations => \@observations}), "\n";
