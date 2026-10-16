# Independent installed Perl caller for recursive and mutually recursive checked records.
use strict;
use warnings;
use Config;
use Cwd qw(abs_path);
use Digest::SHA qw(sha256_hex);
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed refaddr reftype);

my ($fixture, $route) = @ARGV;
die "usage: perl.pl recursive|mutual ordinary|reviewed\n"
    unless @ARGV == 2 && $fixture =~ /\A(?:recursive|mutual)\z/
        && $route =~ /\A(?:ordinary|reviewed)\z/;
my %modules = (
    recursive => {
        lean => 'RecursiveCheckedRecords', module => 'LeanBridge::RecursiveCheckedRecords',
        record => 'Packet', fields => [qw(value digit tail)], make => 'mkPacket',
        normalize => 'normalizePacket', bound => '.digit', link => '.tail?',
    },
    mutual => {
        lean => 'MutualCheckedRecords', module => 'LeanBridge::MutualCheckedRecords',
        record => 'Envelope', fields => [qw(value mode next)], make => 'mkEnvelope',
        normalize => 'normalizeEnvelope', bound => '.mode', link => '.next?.more.packet',
    },
);
my $contract = $modules{$fixture};
my $file = $contract->{module}; $file =~ s{::}{/}g; require "$file.pm";
my $module = $contract->{module};
my $record_class = $module . '::' . $contract->{record};
my $some_class = $module . '::Some';
my $stop_class = $module . '::Step::Stop';
my $more_class = $module . '::Step::More';
my $parameter = $route eq 'ordinary' ? 'arg0' : 'value0';
my $rounds = 64;
my ($checks, $rejections, $host_rejections, $calls, $snapshots, $recoveries,
    $snapshot_controls) = (0, 0, 0, 0, 0, 0, 0);
my %failures;

sub check {
    die "recursive checked-record assertion failed: " . ($_[1] // 'unknown') . "\n"
        unless $_[0];
    ++$checks;
}
sub n { Math::BigInt->new("$_[0]") }
sub plus { $_[0]->copy->badd($_[1]) }
sub some { $some_class->new($_[0]) }
sub node {
    my ($value, $digit, $tail) = @_;
    my $link = !defined($tail) ? undef
        : $fixture eq 'recursive' ? some($tail)
        : some($more_class->new(packet => $tail));
    return $record_class->new(
        $contract->{fields}[0] => ref($value) ? $value : n($value),
        $contract->{fields}[1] => ref($digit) ? $digit : n($digit),
        $contract->{fields}[2] => $link,
    );
}
sub chain {
    my ($values) = @_;
    my $result;
    for my $pair (reverse @$values) { $result = node($pair->[0], $pair->[1], $result) }
    return $result;
}
sub stopped {
    my ($value, $digit) = @_;
    return node($value, $digit) if $fixture eq 'recursive';
    return $record_class->new(
        value => ref($value) ? $value : n($value),
        mode => ref($digit) ? $digit : n($digit),
        next => some($stop_class->new()),
    );
}

sub snapshot_value {
	no warnings 'recursion';
    my ($value, $active) = @_;
    return ['undef'] unless defined $value;
    if (blessed($value) && $value->isa('Math::BigInt')) {
        return ['bigint', $value->bstr];
    }
    my $reference = ref($value);
    return ['scalar', "$value"] unless $reference;
    my $identity = refaddr($value);
    return ['cycle'] if $active->{$identity};
    local $active->{$identity} = 1;
    my $kind = reftype($value) // '';
    return ['array', map { snapshot_value($_, $active) } @$value]
        if $kind eq 'ARRAY';
    if ($kind eq 'HASH') {
        my $class = blessed($value) // '';
        return ['object', $class,
            map { [$_, snapshot_value($value->{$_}, $active)] } sort keys %$value];
    }
    die "unsupported snapshot reference: $reference\n";
}
sub snapshot { JSON::PP->new->canonical->encode(snapshot_value($_[0], {})) }
sub same { snapshot($_[0]) eq snapshot($_[1]) }
sub invoke {
    my ($name, @arguments) = @_;
    my $function = $module->can($name);
    check($function, "public function $name");
    ++$calls;
    return $function->(@arguments);
}
sub accepted {
    my ($name, $arguments, $expected, $label) = @_;
    my $before = snapshot($arguments);
    my $result = invoke($name, @$arguments);
    check(same($result, $expected), "$label exact result");
    check(snapshot($arguments) eq $before, "$label preserves every input");
    ++$snapshots;
    return $result;
}
sub refused {
    my ($name, $arguments, $message, $label) = @_;
    my $before = snapshot($arguments);
    my $passed = eval { invoke($name, @$arguments); 1 };
    my $error = "$@";
    check(!$passed, "$label rejects invalid checked input");
    check($error eq "$message\n", "$label exact rejection: $error");
    check(snapshot($arguments) eq $before, "$label preserves every input");
    ++$rejections; ++$snapshots;
    $failures{$label} //= $error;
}
sub host_refused {
    my ($name, $arguments, $pattern, $label) = @_;
    my $before = snapshot($arguments);
    my $passed = eval { invoke($name, @$arguments); 1 };
    my $error = "$@";
    check(!$passed && $error =~ $pattern, "$label host rejection: $error");
    check(snapshot($arguments) eq $before, "$label preserves every input");
    ++$host_rejections; ++$snapshots;
    $failures{$label} //= $error;
}
sub normalized {
    my ($value, $amount) = @_;
    return undef unless defined $value;
    my $class = blessed($value) // '';
    return some(normalized($value->{value}, $amount)) if $class eq $some_class;
    return $stop_class->new() if $fixture eq 'mutual' && $class eq $stop_class;
    return $more_class->new(packet => normalized($value->{packet}, $amount))
        if $fixture eq 'mutual' && $class eq $more_class;
    my ($head, $digit, $tail) = map { $value->{$_} } @{$contract->{fields}};
    my $normalized_head = $amount == 2 && $fixture eq 'recursive'
        ? plus($digit, 1) : plus($head, $amount);
    return $record_class->new(
        $contract->{fields}[0] => $normalized_head,
        $contract->{fields}[1] => $digit->copy,
        $contract->{fields}[2] => normalized_link($tail, $amount),
    );
}
sub normalized_link {
    my ($link, $amount) = @_;
    return undef unless defined $link;
    return some(normalized($link->{value}, $amount)) if $fixture eq 'recursive';
    my $step = $link->{value};
    return some($stop_class->new()) if blessed($step) eq $stop_class;
    return some($more_class->new(packet => normalized($step->{packet}, $amount)));
}
sub recover {
    my $value = invoke('first', chain([[40, 2], [80, 1]]));
    check($value->bstr eq '41', 'valid call recovers after refusal');
    ++$recoveries;
}

for my $name (qw(first second echo groups echo_groups produce)) {
    check($module->can($name), "export $name");
}
my @controls = (
    [n(0), 0], [n(1), 1.0], [[node(1, 0)], [node(1, 0), node(2, 0)]],
    [node(1, 0), node(1, 1)], [node(1, 0), node(2, 0)],
    [node(1, 0, node(1, 0)), node(1, 0)], [some(node(1, 0)), undef],
    [chain([[1, 0], [1, 0]]), chain([[1, 0], [2, 0]])],
);
push @controls, [stopped(1, 0), node(1, 0)], [some($stop_class->new()), undef],
    [$more_class->new(packet => node(1, 0)), some(node(1, 0))]
    if $fixture eq 'mutual';
for my $pair (@controls) {
    check(snapshot($pair->[0]) ne snapshot($pair->[1]), 'independent snapshot control');
    ++$snapshot_controls;
}

my $huge = Math::BigInt->bone->blsft(100);
for my $value (n(0), n(5), map { plus($huge, $_) } 0 .. $rounds - 1) {
    accepted('produce', [$value], chain([[plus($value, 1), 1], [plus($value, 2), 2]]),
        'constructor-free result');
}
host_refused('produce', [-1], qr/Expected Math::BigInt/, 'scalar-nat'); recover();
host_refused('produce', [n(-1)], qr/Nat cannot be negative/, 'negative-nat'); recover();

my $root = chain([[40, 2], [80, 1]]);
accepted('first', [$root], n(41), 'first');
accepted('first', [node(0, 1)], n(1), 'zero value');
accepted('first', [chain([[99, 2], [0, 0], [7, 1]])], n(100), 'late zero');
accepted('second', [$root], $fixture eq 'recursive' ? n(3) : n(42), 'second');
accepted('second', [chain([[89, 2], [0, 1]])], $fixture eq 'recursive' ? n(3) : n(91), 'second late');
my $echoed = accepted('echo', [$root], normalized($root, 1), 'echo');
check(refaddr($echoed) != refaddr($root), 'recursive result owns independent storage');
accepted('echo', [chain([[1, 0], [2, 1], [3, 2], [4, 0]])],
    normalized(chain([[1, 0], [2, 1], [3, 2], [4, 0]]), 1), 'long echo');
my $deep_valid = chain([map { [$_ % 90, $_ % 3] } 0 .. 39]);
accepted('first', [$deep_valid], n(1), 'bounded deep first');
accepted('echo', [$deep_valid], normalized($deep_valid, 1), 'bounded deep echo');
accepted('second', [$deep_valid], $fixture eq 'recursive' ? n(1) : n(2), 'bounded deep second');
my $shared = node(5, 1);
accepted('groups', [[some($shared), undef, some($shared)]], n(3), 'shared alias is not a cycle');
accepted('groups', [[]], n(0), 'empty aliases');
accepted('groups', [[undef, some($root)]], n(2), 'inactive alias branch');
accepted('echo_groups', [[some($root), undef, some($shared)]],
    [some(normalized($root, 2)), undef, some(normalized($shared, 2))], 'echo aliases');
accepted('echo_groups', [[]], [], 'empty alias result');
if ($fixture eq 'mutual') {
    accepted('first', [stopped(40, 2)], n(41), 'active empty variant');
    accepted('echo', [stopped(40, 2)], stopped(41, 2), 'echo empty variant');
    accepted('echo', [node(1, 0, stopped(2, 1))], node(2, 0, stopped(3, 1)), 'nested empty variant');
    accepted('second', [node(1, 0, stopped(2, 1))], n(3), 'second empty variant');
}

my $rejected = " was rejected by $contract->{lean}.";
my $link = $contract->{link};
my $bound = $contract->{bound};
refused('first', [node(100, 0)], "$parameter.value${rejected}plusOne", 'outer-subtype'); recover();
refused('first', [node($huge, 0)], "$parameter.value${rejected}plusOne", 'huge-subtype'); recover();
refused('first', [chain([[40, 2], [100, 1]])], "$parameter$link.value${rejected}plusOne", 'late-subtype'); recover();
refused('first', [chain([[40, 2], [40, 2], [100, 1]])], "$parameter$link$link.value${rejected}plusOne", 'deep-subtype'); recover();
refused('first', [node(40, 3)], "$parameter$bound is not below its Fin 3 bound", 'outer-fin'); recover();
refused('first', [chain([[40, 2], [80, 3]])], "$parameter$link$bound is not below its Fin 3 bound", 'late-fin'); recover();
refused('first', [node(0, 2)], "$parameter${rejected}$contract->{make}", 'outer-record'); recover();
refused('first', [chain([[40, 2], [0, 2]])], "$parameter$link${rejected}$contract->{make}", 'late-record'); recover();
refused('echo', [chain([[40, 2], [0, 2]])], "$parameter$link${rejected}$contract->{make}", 'echo-record'); recover();
refused('second', [node(90, 0)], "$parameter.value${rejected}plusTwo", 'second-subtype'); recover();
refused('second', [chain([[1, 0], [90, 0]])], "$parameter$link.value${rejected}plusTwo", 'second-late-subtype'); recover();
refused('groups', [[undef, some(node(100, 0))]], "${parameter}[1]?.value${rejected}plusOne", 'group-subtype'); recover();
refused('groups', [[some($root), some(node(0, 2))]], "${parameter}[1]?${rejected}$contract->{make}", 'group-record'); recover();
refused('groups', [[some(node(1, 3))]], "${parameter}[0]?$bound is not below its Fin 3 bound", 'group-fin'); recover();
refused('echo_groups', [[some(node(90, 0))]], "${parameter}[0]?.value${rejected}plusTwo", 'echo-group-subtype'); recover();
refused('echo_groups', [[undef, some(chain([[1, 0], [95, 1]]))]],
    "${parameter}[1]?$link.value${rejected}plusTwo", 'echo-group-late-subtype'); recover();

host_refused('first', [some(node(1, 0))], qr/Expected exact \Q$record_class\E/, 'option-as-record'); recover();
host_refused('first', [bless({ map { $_ => node(1, 0)->{$_} } @{$contract->{fields}} }, 'Wrong::Record')],
    qr/Expected exact \Q$record_class\E/, 'wrong-record-class'); recover();
my $missing = node(1, 0); delete $missing->{$contract->{fields}[2]};
host_refused('first', [$missing], qr/fields do not match the generated schema/, 'missing-field'); recover();
my $proof = node(1, 0); $proof->{linked} = 1;
host_refused('first', [$proof], qr/fields do not match the generated schema/, 'proof-field'); recover();
host_refused('first', [node(n(-1), 0)], qr/Nat cannot be negative/, 'negative-value'); recover();
host_refused('first', [node(1, n(-1))], qr/Nat cannot be negative/, 'negative-bound'); recover();
my $bare = node(1, 0); $bare->{$contract->{fields}[2]} = node(1, 0);
host_refused('first', [$bare], qr/Expected undef or Some/, 'bare-child'); recover();
host_refused('groups', [node(1, 0)], qr/Expected a plain untied array reference/, 'record-as-array'); recover();
host_refused('groups', [[node(1, 0)]], qr/Expected undef or Some/, 'bare-record-as-option'); recover();
host_refused('echo_groups', [[some(undef)]], qr/Expected exact \Q$record_class\E/, 'absent-record'); recover();
if ($fixture eq 'mutual') {
    my $record_step = node(1, 0); $record_step->{next} = some(node(1, 0));
    host_refused('first', [$record_step], qr/Expected an exact generated variant constructor/, 'record-as-step'); recover();
    my $bare_step = node(1, 0); $bare_step->{next} = $stop_class->new();
    host_refused('first', [$bare_step], qr/Expected undef or Some/, 'bare-step'); recover();
}
my $cyclic = node(1, 0);
$cyclic->{$contract->{fields}[2]} = $fixture eq 'recursive' ? some($cyclic)
    : some($more_class->new(packet => $cyclic));
host_refused('first', [$cyclic], qr/Cyclic Perl copied value/, 'cycle'); recover();
host_refused('groups', [[some($cyclic)]], qr/Cyclic Perl copied value/, 'group-cycle'); recover();
my $too_deep = chain([map { [1, 0] } 0 .. 99]);
host_refused('first', [$too_deep], qr/Perl copied graph depth or node limit exceeded/, 'depth'); recover();

for my $round (0 .. $rounds - 1) {
    my $value = $round % 90;
    accepted('first', [chain([[$value, $value % 3], [99 - $value, 0]])], n($value + 1), 'round first');
    refused('first', [chain([[$value, $value % 3], [100 + $round, 0]])],
        "$parameter$link.value${rejected}plusOne", 'round late subtype');
    accepted('second', [node($value, $round % 3)],
        $fixture eq 'recursive' ? n($round % 3 + 1) : n($value + 2), 'round second');
    refused('groups', [[some(node($value, 0)), some(node(0, 2))]],
        "${parameter}[1]?${rejected}$contract->{make}", 'round group record');
    host_refused('first', [$cyclic], qr/Cyclic Perl copied value/, 'round cycle');
    accepted('groups', [[map { some(node($value, 0)) } 1 .. ($round % 4)]], n($round % 4), 'round aliases');
    ++$recoveries;
}

my $root_path = abs_path($ENV{PERL5LIB});
open my $maps, '<', '/proc/self/maps' or die $!;
my %libraries;
while (<$maps>) {
    my ($path) = /\s(\/\S+\.so)$/;
    next unless $path && index($path, "$root_path/") == 0;
    open my $file_handle, '<:raw', $path or die $!;
    local $/;
    $libraries{substr($path, length($root_path) + 1)} = sha256_hex(<$file_handle>);
}
print JSON::PP->new->canonical->encode({
    fixture => $fixture, route => $route, checks => $checks,
    rejections => $rejections, hostRejections => $host_rejections,
    calls => $calls, snapshots => $snapshots, recoveries => $recoveries,
    snapshotControls => $snapshot_controls, rounds => $rounds,
    wordBits => 8 * $Config{ptrsize}, perl => "$^V",
    threaded => ($Config{useithreads} // '') eq 'define' ? JSON::PP::true : JSON::PP::false,
    api => abs_path($INC{$file . '.pm'}), nativeLibraries => \%libraries,
    failures => \%failures,
}) . "\n";
