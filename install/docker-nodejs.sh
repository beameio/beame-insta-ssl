#!/bin/bash -eu

: ${NODEJS_VER:=12.14.0}
: ${NODEJS_SHA256:=52207f643ab0fba66d5189a51aac280c4834c81f24a7297446896386ec93a5ed}

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
