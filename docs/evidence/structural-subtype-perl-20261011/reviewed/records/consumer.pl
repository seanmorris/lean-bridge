use strict;
use warnings;
use utf8;
use B qw(svref_2object SVf_IOK SVf_NOK SVf_POK);
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed);

sub structural_nat { Math::BigInt->new("$_[0]") }

# Compare independent primitive snapshots, never generated wrapper equality.
sub structural_snapshot {
    my ($value) = @_;
    return ['none'] unless defined $value;
    my $class = blessed($value);
    return ['Math::BigInt', $value->bstr()] if defined($class) && $class eq 'Math::BigInt';
    if (defined $class) {
        die "unexpected wrapper $class" unless $class =~ /\ALeanBridge::StructuralSubtypes::(?:Some|Ok|Err)\z/;
        die 'unexpected wrapper fields' unless join(',', sort keys %$value) eq 'value';
        return [$class, structural_snapshot($value->{value})];
    }
    return ['array', [map { structural_snapshot($_) } @$value]] if ref($value) eq 'ARRAY';
    die 'unexpected reference' if ref $value;
    # Inspect flags before stringification, which can otherwise hide a UInt8/String mixup.
    my $flags = svref_2object(\$value)->FLAGS;
    return ['number', 0 + $value] if $flags & (SVf_IOK | SVf_NOK);
    return ['string', [unpack('U*', $value)]] if $flags & SVf_POK;
    die 'unexpected scalar';
}

sub structural_same {
    my $json = JSON::PP->new->canonical;
    return $json->encode(structural_snapshot($_[0])) eq $json->encode(structural_snapshot($_[1]));
}

# Perl croak adds one location, not an arbitrary suffix to the Lean cause.
sub structural_diagnostic {
    my ($actual, $cause, $file) = @_;
    return $actual =~ /\A\Q$cause\E at \Q$file\E line [1-9][0-9]*\.\n\z/ ? 1 : 0;
}

# Synthetic APIs are used only by the independent caller-control test.
sub check_structural_subtypes {
    my ($api) = @_;
    my ($checks, $rejections, $snapshot_controls) = (0, 0, 0);
    my ($some, $ok, $err) = @{$api}{qw(Some Ok Err)};
    my $check = sub { die "failed: $_[1]\n" unless $_[0]; $checks++ };
    my $equal = sub { $check->(structural_same($_[0], $_[1]), $_[2]) };
    my $json = JSON::PP->new->canonical;
    my $refused = sub {
        my ($name, $args, $path, $constructor, $bound) = @_;
        my $before = $json->encode(structural_snapshot($args));
        my $expected = defined($bound) ? "$path is not below its Fin $bound bound"
            : "$path was rejected by StructuralSubtypes.$constructor";
        my $accepted = eval { $api->{$name}->(@$args); 1 };
        my $error = $@;
        die "accepted: $expected\n" if $accepted;
        $check->(structural_diagnostic($error, $expected, __FILE__), "refusal: $expected; got $error");
        $check->($json->encode(structural_snapshot($args)) eq $before, 'complete rejected inputs unchanged');
        $rejections++;
    };
    my $huge = structural_nat(2)->bpow(100);
    my $wide = structural_nat('184467440737095516170');
    my $original = [[$some->($huge), undef], [$some->([255, "a\0tail"])]];
    my @mutations = (
        [[$some->($huge->copy->binc), undef], $original->[1]],
        [[undef, undef], $original->[1]],
        [[$some->($huge), undef, undef], $original->[1]],
        [$original->[0], [$some->([254, "a\0tail"])]],
        [$original->[0], [$some->([255, "a\0changed"])]],
        [$original->[0], [undef]],
    );
    for my $changed (@mutations) {
        $check->(!structural_same($changed, $original), 'snapshot mutation control');
        $snapshot_controls++;
    }
    $equal->($api->{scalar}->($huge), $huge, 'wide scalar');
    $refused->('scalar', [structural_nat(0)], 'value0', 'checkedPositive');
    for my $name (qw(arrays lists specialized)) {
        $equal->($api->{$name}->([]), [], "$name empty");
        my $values = [structural_nat(1), $huge, structural_nat(3)];
        $equal->($api->{$name}->($values), $values, "$name wide values");
        for my $position (0..2) {
            my @bad = @$values; $bad[$position] = structural_nat(0);
            $refused->($name, [\@bad], "value0[$position]", 'checkedPositive');
        }
        $equal->($api->{$name}->($values), $values, "$name recovery");
    }
    $equal->($api->{options}->(undef), undef, 'absent option');
    $equal->($api->{options}->($some->($huge)), $some->($huge), 'present option');
    $refused->('options', [$some->(structural_nat(0))], 'value0?', 'checkedPositive');
    my $text = "héllo\0tail\x{1F642}";
    $equal->($api->{product}->([$huge, $text]), [$huge, $text], 'Unicode and complete NUL suffix');
    $refused->('product', [[structural_nat(0), $text]], 'value0.0', 'checkedPositive');
    $refused->('product', [[$huge, '']], 'value0.1', 'checkedWord');
    $equal->($api->{branch}->($ok->($huge)), $ok->($huge), 'active ok');
    $equal->($api->{branch}->($err->($text)), $err->($text), 'active error');
    $refused->('branch', [$ok->(structural_nat(0))], 'value0.ok', 'checkedPositive');
    $refused->('branch', [$err->('')], 'value0.error', 'checkedWord');
    my $bytes = [undef, $some->([255, $huge])];
    $equal->($api->{byte_branches}->($bytes), $bytes, 'UInt8 and Nat');
    $refused->('byte_branches', [[undef, $some->([0, $huge])]], 'value0[1]?.0', 'checkedByte');
    $refused->('byte_branches', [[undef, $some->([1, structural_nat(0)])]], 'value0[1]?.1', 'checkedPositive');
    my $nested = [[undef, $some->([$huge, $wide->copy->bdec])], [], [$some->([structural_nat(2), structural_nat(3)])]];
    $equal->($api->{nested}->($nested), structural_nat(3), 'nested valid');
    for my $row (0..2) {
        for my $column (0..2) {
            my $rows = [map { [map { $some->([$huge->copy, $wide->copy->bdec]) } 0..2] } 0..2];
            $rows->[$row][$column] = $some->([structural_nat(0), $wide->copy]);
            $refused->('nested', [$rows], "value0[$row][$column]?.1", undef, $wide->bstr);
            $rows->[$row][$column] = $some->([structural_nat(0), $wide->copy->bdec]);
            $refused->('nested', [$rows], "value0[$row][$column]?.0", 'checkedPositive');
            $rows->[$row][$column] = $some->([structural_nat(1), $wide->copy->bdec]);
            $equal->($api->{nested}->($rows), structural_nat(3), 'nested recovery');
        }
    }
    my $first = [$some->(structural_nat(1)), undef, $some->($huge->copy)];
    my $second = [$some->($huge->copy), $some->(structural_nat(3)), undef];
    my $normalized = [$some->($huge->copy->binc), $some->(structural_nat(4)), undef];
    $equal->($api->{alias_pair}->([$first, $second]), [$first, $normalized], 'per-site alias constructors');
    $equal->($api->{alias_arguments}->($first, $second), [@$first, @$normalized], 'per-parameter constructors');
    $equal->($api->{plain_fin}->([undef, $some->(structural_nat(0)), $some->(structural_nat(9))]), structural_nat(3), 'Fin endpoints');
    $refused->('plain_fin', [[$some->(structural_nat(10))]], 'value0[0]?', undef, '10');
    for my $position (0..2) {
        my $left = [$some->(structural_nat(1)), $some->($huge->copy), $some->(structural_nat(3))];
        $left->[$position] = $some->(structural_nat(0));
        $refused->('alias_pair', [[$left, $second]], "value0.0[$position]?", 'checkedPositive');
        my $right = [$some->($huge->copy), $some->(structural_nat(3)), $some->(structural_nat(4))];
        $right->[$position] = $some->(structural_nat(0));
        $refused->('alias_pair', [[$first, $right]], "value0.1[$position]?", 'normalizePositive');
    }
    for my $round (0..999) {
        my $late = [$some->($huge->copy), $some->(structural_nat(3)), $some->(structural_nat(4))];
        my $position = $round % 3; $late->[$position] = $some->(structural_nat(0));
        $refused->('alias_arguments', [$first, $late], "value1[$position]?", 'normalizePositive');
        my $before = $json->encode(structural_snapshot([$first, $second]));
        $equal->($api->{alias_arguments}->($first, $second), [@$first, @$normalized], 'late recovery');
        $check->($json->encode(structural_snapshot([$first, $second])) eq $before, 'normalization does not mutate either input');
    }
    return {checks => $checks, rejections => $rejections, snapshotControls => $snapshot_controls};
}

unless (caller) {
    require LeanBridge::StructuralSubtypes;
    my %api;
    for my $name (qw(scalar arrays lists specialized options product branch byte_branches nested alias_pair alias_arguments plain_fin)) {
        $api{$name} = LeanBridge::StructuralSubtypes->can($name) or die "missing export $name";
    }
    for my $name (qw(Some Ok Err)) {
        my $class = "LeanBridge::StructuralSubtypes::$name";
        $api{$name} = sub { $class->new($_[0]) };
    }
    print JSON::PP->new->canonical->encode(check_structural_subtypes(\%api)), "\n";
}
1;
