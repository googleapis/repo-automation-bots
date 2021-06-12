#!/bin/bash

# Copyright 2021 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Update the package-lock.json files and run tests.

# When the test fails, it stores the test log and the summary in the
# temp directory, and revert the changes in the sub directory.

# When the test passes, it keeps the changes so that you can create a
# PR, or multiple PRs.

# The only option is `--ncu`
# To use this option, you need to install npm-check-updates
# npm i -g npm-check-updates

# With `--ncu` option, this script will first try to update
# package.json with major bumps with npm-check-updates, then
# it continues to update package-lock.json and run tests.
# When this first trial fails, it reset the subdirectory and
# start from `npm i`.

set -euo pipefail

if command -v tput >/dev/null && [[ -n "${TERM:-}" ]]; then
  readonly IO_COLOR_RED="$(tput setaf 1)"
  readonly IO_COLOR_GREEN="$(tput setaf 2)"
  readonly IO_COLOR_YELLOW="$(tput setaf 3)"
  readonly IO_COLOR_RESET="$(tput sgr0)"
else
  readonly IO_COLOR_RED=""
  readonly IO_COLOR_GREEN=""
  readonly IO_COLOR_YELLOW=""
  readonly IO_COLOR_RESET=""
fi

# Logs a message using the given color. The first argument must be one
# of the IO_COLOR_* variables defined above, such as
# "${IO_COLOR_YELLOW}". The remaining arguments will be logged in the
# given color. The log message will also have an RFC-3339 timestamp
# prepended (in UTC). You can disable the color output by setting
# TERM=vt100.
function log_impl() {
    local color="$1"
    shift
    local timestamp
    timestamp="$(date -u "+%Y-%m-%dT%H:%M:%SZ")"
    echo "================================================================"
    echo "${color}${timestamp}:" "$@" "${IO_COLOR_RESET}"
    echo "================================================================"
}

# Logs the given message with normal coloring and a timestamp.
function log() {
  log_impl "${IO_COLOR_RESET}" "$@"
}

# Logs the given message in green with a timestamp.
function log_green() {
  log_impl "${IO_COLOR_GREEN}" "$@"
}

# Logs the given message in yellow with a timestamp.
function log_yellow() {
  log_impl "${IO_COLOR_YELLOW}" "$@"
}

# Logs the given message in red with a timestamp.
function log_red() {
  log_impl "${IO_COLOR_RED}" "$@"
}

readonly tmpdir=$(mktemp -d -t update-package-locks-XXXXX)

log_yellow "Using ${tmpdir} as the log directory"

function notify() {
    echo "${IO_COLOR_YELLOW}============================================="
    echo "To delete the temp files, run the following command:"
    echo "${IO_COLOR_RESET}"
    echo "rm -rf ${tmpdir}"
}

trap notify EXIT

# Iterate the subdirectories under packages directory.
readonly scriptdir=$(dirname "$0")
readonly rootdir=$(cd "${scriptdir}"; cd ..; pwd)

cd "${rootdir}"

readonly summarylog="${tmpdir}/summary.txt"
readonly failure_summary="${tmpdir}/failure-summary.txt"
readonly failure_details="${tmpdir}/failure-details.txt"

set +e

dump_details() {
    local package="${1}"
    local logfile="${2}"
    {
	echo "${package} log";
	echo "";
	echo '```';
	cat "${logfile}";
	echo '```'
    } >> "${failure_details}"
}

try_update() {
    local with_ncu=""
    if [ "$#" == 1 ]; then
	with_ncu="${1}"
    fi
    log_yellow "Running 'npm update' ${with_ncu} in ${package}"
    if [ -z "${with_ncu}" ]; then
	logfile="${tmpdir}/${package}-npm-update.log"
    else
	logfile="${tmpdir}/${package}-npm-update-with-ncu.log"
    fi
    if ! npm update --no-color > "${logfile}"; then
	# Failed, add it to summary and continue.
	echo "- [ ] ${package}: 'npm update' ${with_ncu} failed" >> "${failure_summary}"

	# For copy paste into the issue.
	dump_details "${package}" "${logfile}"

	# display failure
	log_red "${package}: 'npm update' ${with_ncu} failed"
	git restore .
	return 1
    fi

    log_yellow "Running 'npm i' ${with_ncu} in ${package}"
    if [ -z "${with_ncu}" ]; then
	logfile="${tmpdir}/${package}-npm-i.log"
    else
	logfile="${tmpdir}/${package}-npm-i-with-ncu.log"
    fi
    if ! npm i --no-color > "${logfile}"; then
	# Failed, add it to summary and continue.
	echo "- [ ] ${package}: 'npm i' ${with_ncu} failed" >> "${failure_summary}"

	# For copy paste into the issue.
	dump_details "${package}" "${logfile}"

	# display failure
	log_red "${package}: 'npm i' ${with_ncu} failed"
	git restore .
	return 1
    fi

    log_yellow "Running 'npm fix' ${with_ncu} in ${package}"
    if [ -z "${with_ncu}" ]; then
	logfile="${tmpdir}/${package}-npm-fix.log"
    else
	logfile="${tmpdir}/${package}-npm-fix-with-ncu.log"
    fi
    if ! npm run fix --no-color > "${logfile}"; then
	# Failed, add it to summary and continue.
	echo "- [ ] ${package}: 'npm fix' ${with_ncu} failed" >> "${failure_summary}"

	# For copy paste into the issue.
	dump_details "${package}" "${logfile}"

	# display failure
	log_red "${package}: 'npm fix' ${with_ncu} failed"

	git restore .
	return 1
    fi

    log_yellow "Running 'npm run test' ${with_ncu} in ${package}"
    if [ -z "${with_ncu}" ]; then
	logfile="${tmpdir}/${package}-npm-run-test.log"
    else
	logfile="${tmpdir}/${package}-npm-run-test-with-ncu.log"
    fi
    if ! npm run test --no-color > "${logfile}"; then
	# Failed, add it to summary and continue.
	echo "- [ ] ${package}: 'npm run test' ${with_ncu} failed" >> "${failure_summary}"

	# For copy paste into the issue.
	dump_details "${package}" "${logfile}"

	# display failure
	log_red "${package}: 'npm run test' ${with_ncu} failed"

	git restore .
	return 1
    fi

    log_green "${package}: successfully updated package-lock.json ${with_ncu}"
    return 0
}

for subdir in packages/*/
do
    subdir="${subdir%*/}"
    package="${subdir##*/}"
    pushd "${subdir}"

    # Skip if there's no package-lock.json
    if [ ! -f "package-lock.json" ]; then
	log_red "skipping ${package}"
	popd
	continue
    fi

    log_yellow "Updating package-lock.json in ${package}"

    if [ "${1}" == "--ncu" ]; then
	rm package-lock.json
	log_yellow "Running 'ncu -u' in ${package}"
	logfile="${tmpdir}/${package}-ncu.log"
	if ! ncu -u > "${logfile}"; then
	    # Failed, add it to summary and continue.
	    echo "- [ ] ${package}: 'ncu -u' failed" >> "${failure_summary}"

	    # For copy paste into the issue.
	    dump_details "${package}" "${logfile}"

	    # display failure
	    log_red "${package}: 'ncu -u' failed"
	    git restore .
	else
	    # Succeeded, let's try updating package-lock.json too.
	    if ! try_update "with ncu"; then
		# Failed with ncu, try update it without ncu
		rm package-lock.json
		try_update
	    fi
	fi
    fi

    if [ -z "$(git status --porcelain .)" ]; then
	# Working directory clean
	echo "${package}: Nothing to commit" >> "${summarylog}"
	log_yellow "${package}: Nothing to commit"
    else
	# There are uncommitted changes
	echo "${package}: Updated files" >> "${summarylog}"
	log_green "${package}: Updated files"
    fi
    popd
done

set -e

if [ -f "${summarylog}" ]; then
    log_yellow "Showing the summary"
    cat "${summarylog}"
fi

if [ -f "${failure_summary}" ]; then
    log_red "Showing the failures"
    cat "${failure_summary}"
    echo "Consider using ${failure_details} for filing the issue."
fi

log_yellow "All the logs are stored in ${tmpdir}"
