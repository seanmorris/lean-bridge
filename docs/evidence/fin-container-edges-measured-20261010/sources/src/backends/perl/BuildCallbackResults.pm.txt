package LeanBridgeBuild;
use strict;
use warnings;

# This template is appended only to owned-v5 component installers. Legacy and
# runtime distributions keep Build.pm unchanged, including its exact version.
sub owned_values {
  my ($manifest) = @_;
  my $fail = sub { die "Invalid owned Perl callback-result contract: $_[0]\n" };
  my $json = JSON::PP->new->canonical;
  my $same = sub { $json->encode($_[0]) eq $json->encode($_[1]) };
  my $version = sub { defined($_[0]) && !ref($_[0]) && $json->encode($_[0]) eq "$_[1]" };
  my $digest = sub { defined($_[0]) && !ref($_[0]) && $_[0] =~ /\A[0-9a-f]{64}\z/ };
  my $exact = sub {
    my ($value, @keys) = @_;
    $fail->('unexpected ownership fields') unless ref($value) eq 'HASH'
      && $same->([sort keys %$value], [sort @keys]);
  };
  my $model = read_json('model.json');
  my $binding = read_json('binding-manifest.json');
  my $receipt = read_json('native-component.json');
  my $ir = read_json('binding-ir.json');
  $fail->('invalid witness documents') unless ref($manifest) eq 'HASH' && ref($model) eq 'HASH'
    && ref($binding) eq 'HASH' && ref($receipt) eq 'HASH' && ref($ir) eq 'HASH';
  my $owned = $manifest->{ownedValues};
  my $graph = $model->{ownedGraph};
  $fail->('unsupported v5 schema') unless ref($manifest) eq 'HASH'
    && $version->($manifest->{schemaVersion}, 1)
    && defined($manifest->{module}) && $manifest->{module} =~ /\ALeanBridge(?:::[A-Za-z][A-Za-z0-9_]*)+\z/
    && $manifest->{module} !~ /\ALeanBridge::Runtime(?:::|\z)/
    && ref($owned) eq 'HASH' && $version->($owned->{schemaVersion}, 5)
    && ref($model) eq 'HASH' && $version->($model->{schemaVersion}, 11)
    && ref($graph) eq 'HASH' && $version->($graph->{schemaVersion}, 6)
    && ref($binding) eq 'HASH' && $version->($binding->{schemaVersion}, 5)
    && ref($receipt) eq 'HASH' && $version->($receipt->{schemaVersion}, 7)
    && ref($ir) eq 'HASH' && ref($ir->{types}) eq 'ARRAY' && ref($ir->{declarations}) eq 'ARRAY';
  $fail->('inconsistent independent witnesses') unless $same->($binding->{owned}, $owned)
    && $same->($model->{bindingIr}, $ir)
    && $digest->($model->{bindingIrSha256})
    && $owned->{bindingIrSha256} eq $model->{bindingIrSha256}
    && $receipt->{bindingIrSha256} eq $model->{bindingIrSha256}
    && $receipt->{modelSha256} eq sha256_hex(read_bytes('model.json'))
    && $model->{profile} eq 'native-library-v1' && $receipt->{profile} eq 'native-library-v1'
    && $binding->{profile} eq 'native-library-v1' && $binding->{backend} eq 'perl'
    && $version->($model->{pointerBits}, 64) && $model->{byteOrder} eq 'little'
    && $digest->($manifest->{runtimeIdentity}) && $digest->($manifest->{nativeRuntimeIdentity})
    && $binding->{runtimeIdentity} eq $manifest->{runtimeIdentity}
    && $receipt->{runtimeIdentity} eq $manifest->{nativeRuntimeIdentity};
  my $relative = $manifest->{module}; $relative =~ s{::}{/}g;
  $fail->('invalid public module or native identities') unless $binding->{publicModule} eq "lib/$relative.pm"
    && defined($owned->{prefix}) && $owned->{prefix} =~ /\A[A-Za-z_][A-Za-z0-9_]*\z/
    && $owned->{gmpLibrary} eq 'libgmp-lean-bridge.so.10'
    && defined($owned->{componentLibrary}) && $owned->{componentLibrary} =~ /\Alibcomponent_[0-9a-f]{20}\.so\z/
    && $owned->{componentLibrary} eq $receipt->{library}
    && $digest->($owned->{publicHeaderSha256}) && $digest->($owned->{publicSourceSha256});
  $fail->('public C identities differ from the inventory') unless ref($manifest->{files}) eq 'HASH'
    && defined($manifest->{files}{"owned/include/$owned->{prefix}.h"})
    && $manifest->{files}{"owned/include/$owned->{prefix}.h"} eq $owned->{publicHeaderSha256}
    && defined($manifest->{files}{"owned/src/$owned->{prefix}.c"})
    && $manifest->{files}{"owned/src/$owned->{prefix}.c"} eq $owned->{publicSourceSha256};
  my $parameter = sub {
    my ($parameters, $anchor) = @_;
    $fail->('invalid parameter anchor') unless ref($parameters) eq 'ARRAY' && defined($anchor) && !ref($anchor);
    my @matches = grep { defined($parameters->[$_]{name}) && $parameters->[$_]{name} eq $anchor } 0..$#$parameters;
    $fail->('ambiguous parameter anchor') unless @matches == 1;
    return $matches[0];
  };
  my @signatures;
  for my $type (sort { $a->{id} cmp $b->{id} } @{$ir->{types}}) {
    next unless $type->{kind} eq 'callback' && $type->{callable}{result}{ownership} eq 'borrow';
    my $result = $type->{callable}{result};
    $fail->('non-local callback anchor') unless $result->{lifetime}{scope} eq 'parameter';
    my $index = $parameter->($type->{callable}{parameters}, $result->{lifetime}{anchor});
    $fail->('invalid callback owner parameter') unless $type->{callable}{parameters}[$index]{ownership} eq 'borrow';
    push @signatures, {id => $type->{id}, parameter => $index};
  }
  $fail->('missing callback signatures') unless @signatures;
  my $callbacks = {schemaVersion => 1, ownership => 'borrow', lifetime => 'parameter',
    anchor => 'original-argument-owner', expiration => 'owner-release-or-transfer',
    descendants => 'transitive', validation => 'generation-and-owner-tree',
    independentOwnership => 'explicit-retain-or-copy', maximumDepth => 128,
    hostResultHandoff => 'before-callback-frame-expires', signatures => \@signatures};
  $fail->('callback owners differ from native signatures') unless $same->($graph->{callbackResultAnchors}, $callbacks)
    && $same->($receipt->{callbackResultAnchors}, $callbacks);
  my %public_callbacks = (%$callbacks, arguments => 'whole-values', results => 'checked-whole-values',
    emptyValues => 'owner-scoped', independentRetains => 'preserved', identityEquality => 'native-identity',
    parameterNumbering => 'callback-local', hostReply => 'value-or-whole-owner',
    hostArguments => 'borrowed-raw-values', nativeClosures => 'identity-preserved',
    independentOwnership => 'retain-or-copy_value');
  $fail->('callback owners differ from the public policy') unless $same->($owned->{callbackResultAnchors}, \%public_callbacks);

  my (@moves, @anchors, @receivers);
  for my $fn (@{$ir->{declarations}}) {
    my $receiver = defined($fn->{receiver});
    my @parameters = ($receiver ? ($fn->{receiver}) : (), @{$fn->{parameters}});
    my @moving = grep { $parameters[$_]{ownership} eq 'transfer' } 0..$#parameters;
    push @moves, {bindingId => $fn->{id}, parameters => \@moving} if @moving;
    push @receivers, {bindingId => $fn->{id}, kind => $fn->{kind}, owner => $fn->{owner}, argument => 0} if $receiver;
    next unless $fn->{result}{ownership} eq 'borrow';
    my $lifetime = $fn->{result}{lifetime};
    if ($lifetime->{scope} eq 'receiver') {
      $fail->('missing receiver result anchor') unless $receiver && $lifetime->{anchor} eq 'receiver';
      push @anchors, {bindingId => $fn->{id}, receiver => JSON::PP::true};
    } else {
      $fail->('invalid result anchor scope') unless $lifetime->{scope} eq 'parameter';
      push @anchors, {bindingId => $fn->{id}, parameter => $parameter->($fn->{parameters}, $lifetime->{anchor})};
    }
  }
  my %native;
  $native{inputTransfers} = {schemaVersion => 1, ownership => 'whole-result-owner',
    validation => 'before-consumption', consumption => 'before-lean-call',
    failure => 'consumed-after-handoff', viewLifetime => 'until-call-returns', exports => \@moves} if @moves;
  $native{resultAnchors} = {schemaVersion => @receivers ? 2 : 1, ownership => 'borrow',
    lifetime => @receivers ? 'receiver-or-parameter' : 'parameter', anchor => 'original-result-owner',
    expiration => 'owner-release-or-transfer', descendants => 'transitive', validation => 'generation-and-owner-tree',
    independentOwnership => 'explicit-retain-or-copy', maximumDepth => 128, exports => \@anchors} if @anchors;
  $native{receiverExports} = {schemaVersion => 1, callingConvention => 'receiver-first', exports => \@receivers} if @receivers;
  my %extensions = (
    inputTransfers => {arguments => 'whole-values', aliases => 'shared-owner', borrowedInputs => 'reject', independentRetains => 'preserved'},
    resultAnchors => {arguments => 'whole-values', results => 'checked-whole-values', emptyValues => 'owner-scoped',
      independentRetains => 'preserved', identityEquality => 'native-identity'},
    receiverExports => {values => 'checked-whole-result', members => 'snake-case', properties => 'read-only-zero-argument-methods',
      owners => 'nominal-whole-values', consumingReceivers => 'original-owner-handoff'}
  );
  for my $name (qw(inputTransfers resultAnchors receiverExports)) {
    if (exists $native{$name}) {
      my %expected = (%{$native{$name}}, %{$extensions{$name}});
      $fail->("inconsistent $name capability") unless $same->($graph->{$name}, $native{$name})
        && $same->($receipt->{$name}, $native{$name}) && $same->($owned->{$name}, \%expected);
    } else {
      $fail->("invented $name capability") if exists($graph->{$name}) || exists($receipt->{$name}) || exists($owned->{$name});
    }
  }
  $exact->($owned, qw(schemaVersion prefix gmpLibrary componentLibrary bindingIrSha256
    publicHeaderSha256 publicSourceSha256 callbackResultAnchors), keys %native);
  if (exists $graph->{hostCallbacks}) {
    my $host = $graph->{hostCallbacks};
    $fail->('invalid host callback capability') unless ref($host) eq 'HASH' && $version->($host->{schemaVersion}, 1)
      && $host->{lifetime} eq 'call' && $host->{recovery} eq 'typed-value-v1'
      && $digest->($host->{trampolineSha256}) && ref($host->{signatures}) eq 'ARRAY' && @{$host->{signatures}}
      && $receipt->{callbackSourceSha256} eq $host->{trampolineSha256}
      && exists($manifest->{files}{'callbacks.c'}) && $manifest->{files}{'callbacks.c'} eq $host->{trampolineSha256};
  } else {
    $fail->('unexpected host callback source') if exists($receipt->{callbackSourceSha256}) || exists($manifest->{files}{'callbacks.c'});
  }
  return $owned;
}
1;
