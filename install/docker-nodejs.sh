#!/bin/bash -eu

: ${NODEJS_VER:=6.9.4}
: ${NODEJS_SHA256:=a1faed4afbbdbdddeae17a24b873b5d6b13950c36fabcb86327a001d24316ffb}

NODEJS_URL="https://nodejs.org/dist/v${NODEJS_VER}/node-v${NODEJS_VER}-linux-x64.tar.gz"

curl "$NODEJS_URL" >/tmp/node.tar.gz

sha256sum -c <<E
$NODEJS_SHA256  /tmp/node.tar.gz
E

cd /opt
tar xzf /tmp/node.tar.gz
rm /tmp/node.tar.gz

ln -sf node-v${NODEJS_VER}-linux-x64 nodejs
ln -sf  /opt/nodejs/bin/node /usr/bin/node
ln -sf  /opt/nodejs/bin/node /usr/bin/nodejs
ln -sf /opt/nodejs/bin/npm /usr/bin/npm
