# Independent Perl caller for proof-erased checked records with closed values.
use strict;
use warnings;
use JSON::PP ();
use Math::BigInt;
use Scalar::Util qw(blessed reftype);
use LeanBridge::CheckedRecordValueIndices;

my ($checks, $calls, $rejections, $recoveries, $snapshots) = (0, 0, 0, 0, 0);
my $prefix = 'arg0';
my $result_only = 0;
my $api = 'LeanBridge::CheckedRecordValueIndices';

sub check {
    die "value-index assertion failed: $_[1]\n" unless $_[0];
    ++$checks;
}
sub n { Math::BigInt->new("$_[0]") }
sub nat_equal {
    return defined($_[0]) && blessed($_[0]) && $_[0]->isa('Math::BigInt')
        && $_[0]->bstr eq n($_[1])->bstr;
}
sub record {
    my ($name, %fields) = @_;
    my $class = "${api}::$name";
    return $class->new(%fields);
}
sub snapshot {
    my ($value) = @_;
    return 'undef' unless defined $value;
    return 'nat:' . $value->bstr
        if blessed($value) && $value->isa('Math::BigInt');
    return 'array:[' . join(',', map { snapshot($_) } @$value) . ']'
        if ref($value) eq 'ARRAY';
    if (my $class = blessed($value)) {
        die "unexpected non-hash record: $class\n"
            unless (reftype($value) // '') eq 'HASH';
        return 'record:' . $class . '{' . join(',', map {
            $_ . '=' . snapshot($value->{$_})
        } sort keys %$value) . '}';
    }
    return 'scalar:' . $value unless ref($value);
    die 'unexpected caller reference: ' . ref($value) . "\n";
}
sub same_inputs { snapshot($_[0]) eq $_[1] }
sub clean_error {
    my ($error) = @_;
    $error =~ s/\n\z//;
    return $error;
}
sub invoke {
    my ($name, $arguments, $accepted, $label) = @_;
    my $before = snapshot($arguments);
    no strict 'refs';
    my $function = *{"${api}::$name"}{CODE}
        or die "missing public function: $name\n";
    ++$calls;
    my $result = $function->(@$arguments);
    check($accepted->($result), "$label result");
    check(same_inputs($arguments, $before), "$label preserves caller input");
    ++$snapshots;
    return $result;
}
sub refused {
    my ($name, $arguments, $message, $host, $label) = @_;
    my $before = snapshot($arguments);
    no strict 'refs';
    my $function = *{"${api}::$name"}{CODE}
        or die "missing public function: $name\n";
    ++$calls;
    my ($passed, $error);
    {
        local $@;
        $passed = eval { $function->(@$arguments); 1 };
        $error = clean_error($@);
    }
    check(!$passed, "$label refuses invalid input");
    if ($host) {
        check($error =~ /^Nat cannot be negative at /,
            "$label host refusal: $error");
    } else {
        check(index($error, "$message at ") == 0,
            "$label exact checked-record refusal: $error");
    }
    check(same_inputs($arguments, $before), "$label preserves rejected input");
    ++$rejections; ++$snapshots;
}
sub recover {
    my $value = record('ZeroToken', count => n(99));
    ++$calls;
    check(nat_equal(LeanBridge::CheckedRecordValueIndices::zero_nat_index($value), 99)
        && nat_equal($value->count, 99), 'valid call recovers after refusal');
    ++$recoveries;
}
sub produced {
    my ($name, $arguments, $accepted, $label) = @_;
    no strict 'refs';
    my $function = *{"${api}::$name"}{CODE}
        or die "missing public producer: $name\n";
    ++$calls;
    check($accepted->($function->(@$arguments)), $label);
}
sub exact_class {
    my ($value, $name) = @_;
    return (blessed($value) // '') eq "${api}::$name";
}

my $huge = Math::BigInt->bone->blsft(128)->binc;
unless ($result_only) {
    invoke('true_bool_index', [record('On', count => n(0))],
        sub { nat_equal($_[0], 0) }, 'true Bool index');
    invoke('false_bool_index', [record('Off', count => n(1))],
        sub { nat_equal($_[0], 1) }, 'false Bool index');
    invoke('ab_string_index', [record('Ab', size => n(2))],
        sub { nat_equal($_[0], 2) }, 'String index');
    invoke('empty_string_index', [record('EmptyToken', count => n(9))],
        sub { nat_equal($_[0], 9) }, 'empty String index');
    invoke('unicode_string_index', [record('UnicodeToken', count => n(10))],
        sub { nat_equal($_[0], 10) }, 'Unicode String index');
    invoke('empty_sized_index', [record('EmptySized', data => [])],
        sub { nat_equal($_[0], 0) }, 'zero Nat index');
    invoke('zero_nat_index', [record('ZeroToken', count => n(11))],
        sub { nat_equal($_[0], 11) }, 'zero Token index');
    invoke('wide_nat_index', [record('WideToken', count => $huge->copy)],
        sub { nat_equal($_[0], $huge) }, '129-bit Nat index');

    refused('ab_string_index', [record('Ab', size => n(1))],
        "$prefix was rejected by CheckedRecordValueIndices.mkAb", 0, 'String index'); recover();
    refused('empty_sized_index', [record('EmptySized', data => [n(1)])],
        "$prefix was rejected by CheckedRecordValueIndices.mkEmptySized", 0, 'Nat index'); recover();
    refused('true_bool_index', [record('On', count => n(1))],
        "$prefix was rejected by CheckedRecordValueIndices.mkOn", 0, 'true index'); recover();
    refused('false_bool_index', [record('Off', count => n(0))],
        "$prefix was rejected by CheckedRecordValueIndices.mkOff", 0, 'false index'); recover();
    refused('true_bool_index', [record('On', count => n(-1))],
        '', 1, 'negative true Nat'); recover();
    refused('zero_nat_index', [record('ZeroToken', count => n(-1))],
        '', 1, 'negative token Nat'); recover();
}

produced('produce_true_bool', [], sub {
    exact_class($_[0], 'On') && nat_equal($_[0]->count, 0)
}, 'produce true Bool');
produced('produce_false_bool', [], sub {
    exact_class($_[0], 'Off') && nat_equal($_[0]->count, 1)
}, 'produce false Bool');
produced('produce_ab', [], sub {
    exact_class($_[0], 'Ab') && nat_equal($_[0]->size, 2)
}, 'produce String index');
produced('produce_empty_string', [n(23)], sub {
    exact_class($_[0], 'EmptyToken') && nat_equal($_[0]->count, 23)
}, 'produce empty String index');
produced('produce_unicode_string', [n(24)], sub {
    exact_class($_[0], 'UnicodeToken') && nat_equal($_[0]->count, 24)
}, 'produce Unicode String index');
produced('produce_empty_sized', [], sub {
    exact_class($_[0], 'EmptySized') && ref($_[0]->data) eq 'ARRAY'
        && @{$_[0]->data} == 0
}, 'produce zero-sized record');
produced('produce_zero_nat', [n(25)], sub {
    exact_class($_[0], 'ZeroToken') && nat_equal($_[0]->count, 25)
}, 'produce zero Nat index');
produced('produce_wide_nat', [$huge->copy], sub {
    exact_class($_[0], 'WideToken') && nat_equal($_[0]->count, $huge)
}, 'produce 129-bit Nat index');

my $expected = $result_only
    ? { calls => 8, checks => 8, recoveries => 0, rejections => 0, snapshots => 0 }
    : { calls => 28, checks => 48, recoveries => 6, rejections => 6, snapshots => 14 };
check($calls == $expected->{calls} && $checks == $expected->{checks}
    && $recoveries == $expected->{recoveries} && $rejections == $expected->{rejections}
    && $snapshots == $expected->{snapshots}, 'exact caller totals');
print JSON::PP->new->canonical->encode({
    calls => $calls, checks => $checks, recoveries => $recoveries
    , rejections => $rejections, snapshots => $snapshots
}), "\n";
