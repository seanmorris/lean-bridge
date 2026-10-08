#!/usr/bin/env bash
# Install Playwright's system dependencies and browsers inside a CI step's 20-minute limit.
# apt's idle timeout never fires on a slow but live mirror, so every phase has its own deadline.
# Each long phase runs as the leader of a new session and process group. At its deadline the group
# gets SIGTERM, then SIGKILL, and the phase ends only when no member of that group is still running,
# so a descendant that ignores SIGTERM cannot outlive it. Dependencies install as root through
# non-interactive sudo; browsers download as the invoking user into that user's normal cache.
# After a failed dependency attempt dpkg is recovered and archive.ubuntu.com becomes the preferred
# entry of the runner's mirror list (apt tries the lowest priority number first). Release files,
# the security suite and package signatures stay as configured.
set -euo pipefail
self=$(realpath "${BASH_SOURCE[0]}")

# Is any process of this group executing? Zombies have finished and are ignored.
group_running()
{
	local stat rest state pgrp
	for stat in /proc/[0-9]*/stat
	do
		# A process can exit between the glob and the read.
		{ read -r rest < "$stat"; } 2> /dev/null || continue
		rest=${rest##*) }
		read -r state _ pgrp _ <<< "$rest"
		[[ $pgrp == "$1" && $state != Z ]] && return 0
	done
	return 1
}

# A phase runs while its leader executes or any member of its group does. The leader counts on its
# own until it is a zombie, because it joins its new group only once setsid has run. Its pid cannot
# be reused before it is reaped.
phase_running()
{
	local rest state
	if { read -r rest < "/proc/$1/stat"; } 2> /dev/null
	then
		rest=${rest##*) }
		read -r state _ <<< "$rest"
		[[ $state != Z ]] && return 0
	fi
	group_running "$1"
}

# Poll until an elapsed-time deadline, including time spent polling and being scheduled.
await_group()
{
	local deadline=$(( SECONDS + $2 ))
	while (( SECONDS < deadline ))
	do
		phase_running "$1" || return 0
		sleep 0.1
	done
	! phase_running "$1"
}

# supervise LIMIT GRACE COMMAND...: exit with the command's status, or 124 after its deadline.
supervise()
{
	local limit=$1 grace=$2 pid status=0
	shift 2
	setsid "$@" &
	pid=$!
	if ! await_group "$pid" "$limit"
	then
		status=124
		kill -TERM -- "-$pid" 2> /dev/null || :
		await_group "$pid" "$grace" || :
	fi
	# Descendants may outlive the leader, so the whole group is always stopped.
	kill -KILL -- "-$pid" 2> /dev/null || :
	if ! await_group "$pid" 5
	then
		echo "::error::process group $pid still has running members after SIGKILL" >&2
		return 1
	fi
	if (( status == 0 ))
	then
		wait "$pid" || status=$?
	else
		wait "$pid" || :
	fi
	return "$status"
}

if [[ ${1:-} == --supervise ]]
then
	shift
	supervise "$@"
	exit
fi

# Phase limits in seconds: two dependency attempts, kill grace, dpkg recovery, browsers, verification.
# Only tests override them; workflows must use the defaults.
read -r deps_first deps_second grace recover_limit browser_limit verify_limit extra \
	<<< "${LEAN_BRIDGE_PLAYWRIGHT_LIMITS:-300 330 30 120 180 60}"
for limit in "$deps_first" "$deps_second" "$grace" "$recover_limit" "$browser_limit" "$verify_limit"
do
	[[ $limit =~ ^[1-9][0-9]*$ ]] || { echo "invalid Playwright phase limit: '$limit'" >&2; exit 2; }
done
[[ -z ${extra:-} ]] || { echo "too many Playwright phase limits" >&2; exit 2; }
readonly mirrors=${LEAN_BRIDGE_APT_MIRRORS:-/etc/apt/apt-mirrors.txt}
root=$(cd "$(dirname "$self")/.." && pwd)
readonly cli="$root/node_modules/playwright/cli.js"
node=$(command -v node)
(( $# > 0 )) || { echo "usage: $0 chromium|firefox|webkit..." >&2; exit 2; }
for engine in "$@"
do
	case "$engine" in chromium|firefox|webkit) ;; *) echo "unknown Playwright engine: $engine" >&2; exit 2;; esac
done
[[ -f $cli ]] || { echo "pinned Playwright CLI is missing: $cli" >&2; exit 2; }

as_root()
{
	sudo -n "$BASH" "$self" --supervise "$@"
}

# Give archive.ubuntu.com entries the first priority and keep every other entry, in its original
# priority order, behind them. Only lines of the form URL or URL<TAB>priority:N are understood.
prefer_archive()
{
	if [[ ! -f $mirrors ]]
	then
		echo "::warning::$mirrors is missing; the second attempt keeps the configured apt sources"
		return 0
	fi
	local preferred status=0
	# shellcheck disable=SC2016 # the quoted text is an awk program
	preferred=$(timeout --kill-after=2 10 awk '
		function fail(code) { bad = code; exit }
		/^[[:space:]]*$/ { next }
		$0 !~ /^https?:\/\/[^[:space:]]+(\tpriority:[0-9]+)?$/ { fail(3) }
		{
			split($0, field, "\t"); url = field[1]
			rank = field[2] == "" ? 1000000 + NR : substr(field[2], 10) + 0
			if(url ~ /^https?:\/\/archive\.ubuntu\.com\//) archive[++archives] = url
			else { other[++others] = url; order[others] = rank * 1000000 + NR }
		}
		END {
			if(bad) exit bad
			if(!archives) exit 4
			for(i = 2; i <= others; i++)
				for(j = i; j > 1 && order[j - 1] > order[j]; j--)
				{ swap = order[j]; order[j] = order[j - 1]; order[j - 1] = swap; swap = other[j]; other[j] = other[j - 1]; other[j - 1] = swap }
			for(i = 1; i <= archives; i++) printf "%s\tpriority:1\n", archive[i]
			for(i = 1; i <= others; i++) printf "%s\tpriority:%d\n", other[i], i + 1
		}' "$mirrors") || status=$?
	case "$status" in
		0) printf '%s\n' "$preferred" | sudo -n timeout --kill-after=2 10 tee "$mirrors" > /dev/null
			echo "Preferred archive.ubuntu.com in $mirrors";;
		3) echo "::warning::$mirrors has an unexpected entry; the second attempt keeps it unchanged";;
		4) echo "::warning::$mirrors names no archive.ubuntu.com mirror; the second attempt keeps it unchanged";;
		*) echo "::error::reading $mirrors failed with $status" >&2; return 1;;
	esac
}

first=0
as_root "$deps_first" "$grace" "$node" "$cli" install-deps "$@" || first=$?
if (( first != 0 ))
then
	echo "::warning::Playwright dependency installation attempt 1 exited with $first; retrying once"
	as_root "$recover_limit" 10 dpkg --configure -a
	prefer_archive
	second=0
	as_root "$deps_second" "$grace" "$node" "$cli" install-deps "$@" || second=$?
	if (( second != 0 ))
	then
		echo "::error::Playwright dependency installation failed: attempt 1 exited with $first, attempt 2 with $second"
		exit 1
	fi
fi
supervise "$browser_limit" "$grace" "$node" "$cli" install "$@"
timeout --kill-after=5 "$verify_limit" "$node" "$root/scripts/verify-playwright-browsers.mjs" "$@"
