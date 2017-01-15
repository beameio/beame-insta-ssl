#!/bin/bash

set -eu

BIN="$1"

echo "+ Checking NodeJS version. Expecting 6.9.X."
v="$($BIN -v)"
v="${v:1}"

if [[ $v =~ ^6\.9\. ]];then
	echo "+ Node 6.9.X detected - OK"
else
	echo "+ ERROR: Node version $v detected but beame-insta-server requires node version 6.9.X"
	exit 10
fi

