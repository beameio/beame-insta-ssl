#!/bin/bash -eu

: ${NODEJS_VER:=8.15.1}
: ${NODEJS_SHA256:=16e203f2440cffe90522f1e1855d5d7e2e658e759057db070a3dafda445d6d1f}

NODEJS_URL="https://nodejs.org/dist/v${NODEJS_VER}/node-v${NODEJS_VER}-linux-x64.tar.gz"

curl "$NODEJS_URL" >/tmp/node.tar.gz

shasum -a 256 -c <<E
$NODEJS_SHA256  /tmp/node.tar.gz
E

cd /opt
tar xzf /tmp/node.tar.gz
rm /tmp/node.tar.gz

ln -sf node-v${NODEJS_VER}-linux-x64 nodejs
ln -sf /opt/nodejs/bin/node /usr/bin/node
ln -sf /opt/nodejs/bin/node /usr/bin/nodejs
ln -sf /opt/nodejs/bin/npm /usr/bin/npm
