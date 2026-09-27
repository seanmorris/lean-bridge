use strict;
use warnings;
use Config;
BEGIN { require threads if ($Config{useithreads} // '') eq 'define'; }
use DynaLoader;
use Digest::SHA qw(sha256_hex);
use JSON::PP;
use File::Copy qw(copy);
use File::Temp qw(tempdir);
use POSIX ();
use LeanBridge::Runtime::OwnedAssets;

my ($mode, $root) = @ARGV;
my $checks = 0;
sub check { ++$checks; die "asset check $checks: $_[1]\n" unless $_[0]; }
sub read_bytes {
  open my $file, '<:raw', $_[0] or die $!;
  local $/; return <$file>;
}
my $assets = JSON::PP->new->decode(read_bytes("$root/assets.json"));
sub load_assets { LeanBridge::Runtime::OwnedAssets::load($_[0]); }
sub clone_assets {
  my $directory = tempdir('asset-copy-XXXXXX', DIR => $root, CLEANUP => 1);
  my @copy;
  for my $asset (@$assets) {
    my ($name) = $asset->{path} =~ m{([^/]+)\z};
    my $path = "$directory/$name";
    copy($asset->{path}, $path) or die $!;
    push @copy, { %$asset, path => $path };
  }
  return \@copy;
}
sub rejected {
  my ($input, $pattern, $label) = @_;
  my $ok = eval { load_assets($input); 1 };
  check(!$ok && $@ =~ $pattern, "$label: $@");
}
sub absent {
  check(!defined LeanBridge::Runtime::_mapped_library($assets->[0]{path}), 'dependency not mapped');
  check(!defined LeanBridge::Runtime::_mapped_library($assets->[1]{path}), 'extension not mapped');
}
if ($mode eq 'cold') {
  for my $bad (undef, {}, [], [undef], [{}], [{ %{$assets->[0]}, sha256 => 'bad' }],
      [{ %{$assets->[0]}, path => [] }], [{ %{$assets->[0]}, path => './relative' }],
      [{ %{$assets->[0]}, path => "$root/bad\0path" }],
      [{ %{$assets->[0]}, soname => '../bad.so' }],
      [{ %{$assets->[0]}, unexpected => 1 }], [$assets->[0], $assets->[0]]) {
    rejected($bad, qr/Invalid|Duplicate/, 'malformed artifact list');
    absent();
  }
  my $missing = [map { { %$_ } } @$assets];
  $missing->[-1]{path} = "$root/absent.so";
  rejected($missing, qr/Missing owned native artifact/, 'missing final dependency');
  absent();
  for my $index (0, 1) {
    my $copy = clone_assets();
    open my $file, '>>:raw', $copy->[$index]{path} or die $!;
    print $file "changed"; close $file or die $!;
    rejected($copy, qr/checksum mismatch/, 'changed dependency rejected before any native load');
    check(!defined LeanBridge::Runtime::_mapped_library($copy->[0]{path}), 'earlier private dependency not loaded');
    absent();
  }
} elsif ($mode eq 'preloaded') {
  my $handle = DynaLoader::dl_load_file($assets->[0]{path}, 0) or die DynaLoader::dl_error();
  rejected($assets, qr/Unregistered owned native artifact/, 'unmanaged exact-byte dependency');
  check(!defined LeanBridge::Runtime::_mapped_library($assets->[1]{path}), 'extension not loaded after unmanaged dependency');
  DynaLoader::dl_unload_file($handle);
} elsif ($mode eq 'conflict') {
  my $handle = DynaLoader::dl_load_file("$root/conflict/liblb-loader-private.so", 0) or die DynaLoader::dl_error();
  rejected($assets, qr/checksum mismatch/, 'foreign SONAME with different bytes');
  check(!defined LeanBridge::Runtime::_mapped_library($assets->[1]{path}), 'extension not loaded after SONAME conflict');
  DynaLoader::dl_unload_file($handle);
} elsif ($mode eq 'warm') {
  my $global = DynaLoader::dl_load_file("$root/liblb-loader-global.so", 0x01) or die DynaLoader::dl_error();
  my $paths = load_assets($assets);
  check(@$paths == 2 && $paths->[0] eq $assets->[0]{path} && $paths->[1] eq $assets->[1]{path}, 'authenticated private paths');
  my $library = DynaLoader::dl_load_file($paths->[-1], 0) or die DynaLoader::dl_error();
  my $symbol = DynaLoader::dl_find_symbol($library, 'boot_LeanBridge__LoaderProbe') or die DynaLoader::dl_error();
  my $boot = DynaLoader::dl_install_xsub('LeanBridge::LoaderProbe::bootstrap', $symbol, $paths->[-1]);
  $boot->('LeanBridge::LoaderProbe');
  check(LeanBridge::LoaderProbe::read() == 29, 'authenticated load uses private dependency');
  for (1..5) {
    my $again = load_assets($assets);
    check(join("\n", @$again) eq join("\n", @$paths), 'same package warm reuse');
  }
  my $copy = clone_assets();
  my $reused = load_assets($copy);
  check(join("\n", @$reused) eq join("\n", @$paths), 'compatible relocated copy reuses checked mappings');
  check(!defined LeanBridge::Runtime::_mapped_library($copy->[-1]{path}), 'compatible copy does not load a second XS runtime');
  for my $index (0, 1) {
    my $bad = clone_assets();
    open my $file, '>>:raw', $bad->[$index]{path} or die $!;
    print $file "changed"; close $file or die $!;
    rejected($bad, qr/checksum mismatch/, 'warm reuse verifies this package before cache lookup');
  }
  my $missing = clone_assets();
  unlink $missing->[0]{path} or die $!;
  rejected($missing, qr/Missing owned native artifact/, 'warm package missing its own dependency');
  my $conflict = clone_assets();
  copy("$root/conflict/liblb-loader-private.so", $conflict->[0]{path}) or die $!;
  $conflict->[0]{sha256} = sha256_hex(read_bytes($conflict->[0]{path}));
  rejected($conflict, qr/Conflicting owned native artifact/, 'different valid package cannot replace a pinned SONAME');
  my $child = fork();
  die "fork failed: $!" unless defined $child;
  if (!$child) {
    my $ok = eval { load_assets(undef); 1 };
    POSIX::_exit(!$ok && $@ =~ /initiating process and Perl interpreter thread/ ? 0 : 72);
  }
  waitpid($child, 0); check($? == 0, 'fork rejected before descriptor validation');
  if (($Config{useithreads} // '') eq 'define') {
    check(threads->create(sub {
      my $ok = eval { load_assets(undef); 1 };
      return !$ok && $@ =~ /initiating process and Perl interpreter thread/ ? 1 : 0;
    })->join(), 'thread rejected before descriptor validation');
  }
  check(LeanBridge::LoaderProbe::read() == 29, 'rejected packages do not damage the live owner');
} else { die "Unknown asset mode"; }
print JSON::PP->new->canonical->encode({ checks => $checks, mode => $mode });
