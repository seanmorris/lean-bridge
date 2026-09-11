package LeanBridge::Runtime::Platform;
use strict;
use warnings;
use Config;
use Digest::SHA qw(sha256_hex);
use JSON::PP;

# Perl's oldest compatible API, representation and build options, not an exact
# patch-release string. Install-time selection and load-time checking share this.
sub abi {
  my @keys = qw(api_revision api_version api_subversion archname byteorder ptrsize ivsize uvsize
    nvsize nvtype longsize useithreads usemultiplicity uselongdouble use64bitint use64bitall
    useperlio usequadmath quadkind);
  my %config = map { $_ => defined $Config{$_} ? "$Config{$_}" : '' } @keys;
  $config{binary_options} = [sort Config::bincompat_options()];
  return \%config;
}
sub abi_key { return sha256_hex(JSON::PP->new->canonical->encode(abi())); }
sub platform {
  my ($minimum) = @_;
  die "Perl native packages support Linux x64 only\n"
    unless $^O eq 'linux' && $Config{archname} =~ /(?:x86_64|amd64)/ && $Config{ptrsize} == 8 && $Config{ivsize} == 8;
  my $getconf = -x '/usr/bin/getconf' ? '/usr/bin/getconf' : -x '/bin/getconf' ? '/bin/getconf' : 'getconf';
  open my $probe, '-|', $getconf, 'GNU_LIBC_VERSION' or die "Cannot check glibc compatibility\n";
  my $version = <$probe> // ''; close $probe or die "Cannot check glibc compatibility\n";
  my ($major, $minor) = $version =~ /^glibc\s+(\d+)\.(\d+)/;
  my ($want_major, $want_minor) = $minimum =~ /^(\d+)\.(\d+)$/;
  die "Package requires glibc $minimum or later\n" unless defined($major) && defined($want_major)
    && ($major > $want_major || ($major == $want_major && $minor >= $want_minor));
}
sub installed_abi {
  my ($receipt) = @_;
  die "Installed XS does not match this Perl ABI; reinstall the package with this interpreter\n"
    unless JSON::PP->new->canonical->encode(abi()) eq JSON::PP->new->canonical->encode($receipt->{abi});
}
1;
