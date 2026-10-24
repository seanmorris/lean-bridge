package LeanBridge::Runtime::OwnedAssets;
use strict;
use warnings;
use Cwd qw(abs_path);
use Digest::SHA;
use LeanBridge::Runtime;

my %loaded;

sub _verified_path {
  my ($path, $expected) = @_;
  die "Invalid owned native artifact path\n"
    unless defined($path) && !ref($path) && $path =~ m{\A/} && index($path, "\0") < 0;
  my $canonical = abs_path($path);
  die "Missing owned native artifact: $path\n" unless defined($canonical) && -f $canonical;
  open my $file, '<:raw', $canonical or die "Cannot read owned native artifact $path: $!\n";
  my $actual = Digest::SHA->new(256)->addfile($file)->hexdigest;
  close $file or die "Cannot close owned native artifact $path: $!\n";
  die "Owned native artifact checksum mismatch: $path\n" unless $actual eq $expected;
  return $canonical;
}

# Descriptors come from the generated package, not an installed mutable manifest.
# Native libraries name their verified ELF SONAME. XS images have no SONAME and
# use their byte identity, so distinct modules can share the same leaf filename.
sub load {
  LeanBridge::Runtime::_check_context();
  my ($assets) = @_;
  die "Invalid owned native artifact list\n" unless ref($assets) eq 'ARRAY' && @$assets;
  my @prepared;
  my %seen;
  for my $asset (@$assets) {
    die "Invalid owned native artifact descriptor\n" unless ref($asset) eq 'HASH'
      && keys(%$asset) == (exists($asset->{soname}) ? 3 : 2)
      && defined($asset->{sha256}) && !ref($asset->{sha256}) && $asset->{sha256} =~ /\A[0-9a-f]{64}\z/
      && exists($asset->{path});
    my $soname = $asset->{soname};
    die "Invalid owned native artifact SONAME\n" if exists($asset->{soname})
      && (!defined($soname) || ref($soname) || $soname !~ /\A[A-Za-z0-9_][A-Za-z0-9_.+-]*\.so(?:\.[0-9]+)*\z/);
    my $key = defined($soname) ? "so:$soname" : "xs:$asset->{sha256}";
    die "Duplicate owned native artifact: $key\n" if $seen{$key}++;
    # Always hash this package's files, including on a compatible warm load.
    my $path = _verified_path($asset->{path}, $asset->{sha256});
    push @prepared, { %$asset, key => $key, path => $path };
  }
  # Check every existing mapping before loading any new dependency.
  for my $asset (@prepared) {
    my $prior = $loaded{$asset->{key}};
    die "Conflicting owned native artifact: $asset->{key}\n"
      if $prior && $prior->{sha256} ne $asset->{sha256};
    for my $candidate ($asset->{path}, defined($asset->{soname}) ? $asset->{soname} : (),
        $prior ? $prior->{path} : ()) {
      my $mapped = LeanBridge::Runtime::_mapped_library($candidate);
      next unless defined $mapped;
      $mapped = _verified_path($mapped, $asset->{sha256});
      die "Unregistered owned native artifact is already loaded: $mapped\n"
        unless $prior && $mapped eq $prior->{path};
    }
    if ($prior) {
      die "Pinned owned native artifact is no longer mapped\n"
        unless defined LeanBridge::Runtime::_mapped_library($prior->{path});
      $asset->{resolved} = _verified_path($prior->{path}, $asset->{sha256});
    }
  }
  my @paths;
  for my $asset (@prepared) {
    if (!defined $asset->{resolved}) {
      LeanBridge::Runtime::_open_private_library($asset->{path});
      my $mapped = LeanBridge::Runtime::_mapped_library($asset->{path});
      die "New owned native artifact is not mapped\n" unless defined $mapped;
      $mapped = _verified_path($mapped, $asset->{sha256});
      die "Owned native artifact mapped a different file\n" unless $mapped eq $asset->{path};
      $loaded{$asset->{key}} = { path => $mapped, sha256 => $asset->{sha256} };
      $asset->{resolved} = $mapped;
    }
    push @paths, $asset->{resolved};
  }
  return \@paths;
}

1;
