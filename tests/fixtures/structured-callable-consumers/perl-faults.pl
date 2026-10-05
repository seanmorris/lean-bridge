# Isolated probe process. The original installed XS and archives stay unchanged.
use strict;
use warnings;
use Carp qw(confess);
use JSON::PP;
use Scalar::Util qw(refaddr weaken);
use DynaLoader;
use XSLoader;
my $original_loader = \&XSLoader::load;
{
  no warnings 'redefine';
  local *XSLoader::load = sub {
    goto &$original_loader unless defined($_[0]) && $_[0] eq 'LeanBridge::Structured';
    my $library = DynaLoader::dl_load_file($ARGV[0], 0x01) or die DynaLoader::dl_error();
    my $symbol = DynaLoader::dl_find_symbol($library, 'boot_LeanBridge__Structured') or die DynaLoader::dl_error();
    my $boot = DynaLoader::dl_install_xsub('LeanBridge::Structured::bootstrap', $symbol, $ARGV[0]);
    $boot->(@_);
  };
  require LeanBridge::Structured;
}
my ($checks, $failures, $context) = (0, 0, 'initialization');
my %error_modes = (message => 0, object => 0);
sub check ($;$) {
  confess("Structured cleanup assertion ($context): " . ($_[1] // '')) unless $_[0];
  ++$checks;
}
sub probe_reset { return LeanBridge::Structured::_structured_probe(@_); }
sub quiet {
  my ($wrappers) = @_;
  my $native = LeanBridge::Runtime::_snapshot();
  check($native->{live_scopes} == 0 && $native->{live_callbacks} == 0
    && $native->{live_wrappers} == $wrappers && $native->{live_identities} == $wrappers,
    JSON::PP->new->encode($native));
  my $probe = probe_reset(0);
  check($probe->{live_scopes} == 0 && $probe->{live_owners} == 0,
    JSON::PP->new->encode($probe));
  return $probe;
}
my $true = LeanBridge::Structured::true();
my $false = LeanBridge::Structured::false();
my $marker = bless({}, 'StructuredProbeError');
my @scenarios;
for my $shape (qw(array list option result tuple record variant alias)) {
  my ($call, $twice, $make) = map { LeanBridge::Structured->can($_ . '_' . $shape) }
    qw(call twice make);
  check($call && $twice && $make, 'public exports');
  for my $seed (0 .. 3) {
    my $value = structured_value($shape, $seed);
    my $other = structured_value($shape, $seed + 1);
    my $held = $make->($value);
    # A closure without captures can stay cached by Perl's compiled op tree.
    # Capture a per-iteration value so the weak reference measures ownership.
    my $capture = "$shape/$seed";
    my $code = sub { die 'lost callback capture' unless length($capture); return $_[0]; };
    my @paths = (
      ['callback', sub { $call->($value, $code) }],
      ['twice', sub { $twice->($value, $code) }],
      ['create', sub { my $closure = $make->($value); $closure->close; }],
      ['create-call', sub { my $closure = $make->($value); $closure->call($true, $other); $closure->close; }],
      ['held-call', sub { $held->call($false, $other) }]);
    for my $path (@paths) {
      my ($name, $invoke) = @$path;
      $context = "$shape/$seed/$name";
      probe_reset(0); $invoke->();
      my $baseline = quiet(1); my $count = $baseline->{count};
      check($count > 0, 'executed conversion checkpoints');
      for my $error_mode ('message', 'object') {
        for my $target (1 .. $count) {
          $context = "$shape/$seed/$name/$error_mode/$target of $count";
          probe_reset($target, $error_mode eq 'object' ? $marker : undef);
          my $passed = eval { $invoke->(); 1 }; my $error = $@;
          probe_reset(0);
          check(!$passed, 'injected failure must propagate');
          if ($error_mode eq 'object') {
            check(ref($error) && refaddr($error) == refaddr($marker), 'original error object');
          } else {
            check("$error" =~ /injected structured conversion failure/, "unexpected error: $error");
          }
          quiet(1); $call->($value, $code); quiet(1); ++$failures;
          ++$error_modes{$error_mode};
        }
      }
      push @scenarios, {shape => $shape, seed => $seed, path => $name,
        checkpoints => $count, baseline => $baseline};
    }
    $held->close; quiet(0);
    my $weak = $code; weaken($weak); undef $code;
    undef @paths;
    check(!defined($weak), 'callback scopes release the CODE reference');
  }
}
# Mutating or releasing the closure while converting a borrowed call must not
# invalidate the native reference held by that call's scope.
my $deferred = 0;
for my $shape (qw(tuple record variant alias)) {
  my $make = LeanBridge::Structured->can('make_' . $shape);
  my $held = $make->(structured_value($shape, 2));
  my $input = structured_value($shape, 2);
  my $original = Math::BigInt->can('bstr'); my $seen = 0;
  {
    no warnings 'redefine';
    local *Math::BigInt::bstr = sub {
      if (!$seen++) { $held->close; check($held->closed, 'close during argument conversion'); }
      $original->(@_);
    };
    $held->call($false, $input);
  }
  check($seen > 0 && $held->closed, 'borrow survived wrapper disposal');
  quiet(0); ++$deferred;
}
print JSON::PP->new->canonical->encode({schemaVersion => 1, checks => $checks,
  failures => $failures, errorModes => \%error_modes,
  scenarios => \@scenarios, deferredClose => $deferred,
  liveScopes => 0, liveOwners => 0, liveCallbacks => 0, liveIdentities => 0}) . "\n";
