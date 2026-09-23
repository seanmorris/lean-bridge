package LeanBridge::Runtime;
use strict;
use warnings;
use DynaLoader;
use Digest::SHA qw(sha256_hex);
use JSON::PP;
use File::Basename qw(dirname);
use Math::BigInt;
use LeanBridge::Runtime::Platform;
our @ISA = ('DynaLoader');
our $VERSION = '0.001';
sub dl_load_flags { 0x01 }
my @libraries;
my %module_sources;
my %component_libraries;
my $root = __FILE__; $root =~ s/\.pm\z//;
sub _read {
  open my $file, '<:raw', $_[0] or die "Cannot read $_[0]: $!\n";
  local $/; return <$file>;
}
my $runtime_bytes = _read("$root/runtime.json");
my $manifest = JSON::PP->new->decode($runtime_bytes);
my $binding_bytes = _read("$root/binding.json");
my $binding = JSON::PP->new->decode($binding_bytes);
die "Incompatible native Lean runtime identity\n"
  unless $binding->{nativeRuntimeIdentity} eq sha256_hex($runtime_bytes);
my $identity = sha256_hex($binding_bytes);
LeanBridge::Runtime::Platform::platform(JSON::PP->new->decode(_read("$root/target.json"))->{glibcMinimumVersion});
LeanBridge::Runtime::Platform::installed_abi(JSON::PP->new->decode(_read("$root/install-receipt.json")));
sub _identity { return $identity; }
sub _load {
  my ($path, $expected) = @_;
  die "Native artifact checksum mismatch: $path\n" unless sha256_hex(_read($path)) eq $expected;
  my $library = DynaLoader::dl_load_file($path, 0x01)
    or die "Cannot load native artifact $path: " . DynaLoader::dl_error() . "\n";
  push @libraries, $library; # Keep the shared runtime alive until process shutdown.
}
for my $name ('libleanshared.so', 'liblean_bridge_native.so') {
  _load("$root/native/$name", $manifest->{files}{"lib/$name"}{sha256});
}
__PACKAGE__->bootstrap($VERSION);
sub _load_component {
  _check_context();
  my ($path, $library, $sha256, $runtime_identity, $sources, $component_id) = @_;
  die "Incompatible shared Lean runtime\n" unless $identity eq $runtime_identity;
  die "Missing compiled Lean component identity\n"
    unless defined($component_id) && !ref($component_id) && length($component_id);
  die "Conflicting compiled Lean component: $component_id\n"
    if exists($component_libraries{$component_id}) && $component_libraries{$component_id} ne $sha256;
  $path =~ s/\.pm\z//;
  LeanBridge::Runtime::Platform::installed_abi(JSON::PP->new->decode(_read("$path/install-receipt.json")));
  for my $module (keys %$sources) {
    die "Conflicting compiled Lean module: $module\n"
      if exists($module_sources{$module}) && $module_sources{$module} ne $sources->{$module};
  }
  _load("$path/native/$library", $sha256);
  $component_libraries{$component_id} = $sha256;
  @module_sources{keys %$sources} = values %$sources;
}
sub CLONE_SKIP { 1 }
1;

__END__
=head1 NAME

LeanBridge::Runtime - Shared native Lean runtime for generated Perl packages

=head1 INSTALLATION

Compatible prebuilt XS is preferred. If none matches, installation compiles the
supplied XS with the local Perl headers and C compiler. Lean and the native
component libraries are already compiled. No Lean, Lake or Node installation is
required. LEAN_BRIDGE_PERL_INSTALL_MODE selects auto, prebuilt-only or build-xs.

=head1 LIFETIME

Generated components load this runtime automatically. Resource objects provide
close and closed methods. Calls and callbacks stay in the initiating process
and Perl interpreter thread. After fork, automatic cleanup discards inherited
wrappers without calling Lean. Start a fresh process to use the bridge.
Host callbacks may not escape their initiating call.

=cut
