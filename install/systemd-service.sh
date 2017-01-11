#!/bin/bash

# BEAME_INSTA_SSL_USER=pi BEAME_INSTA_SSL_ARGV='tunnel 5555 http --fqdn SOMETHING.beameio.net' BEAME_INSTA_SSL_DIR=/usr/lib/node_modules/beame-insta-ssl sudo -E ./systemd-service.sh

set -eu

err_trap_func() {
	echo "ERROR: Installation failed"
}

trap err_trap_func ERR

if [[ $EUID -ne 0 ]]; then
   echo "Installation failed" 
   echo "Please run this script as root" 
   exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

: ${BEAME_INSTA_SSL_USER:=beame-insta-ssl}
: ${BEAME_INSTA_SSL_SVC:=beame-insta-ssl}
: ${BEAME_INSTA_SSL_NODEJS_BIN:=$(which nodejs)}
: ${BEAME_INSTA_SSL_SYSTEMD_FILE:="/etc/systemd/system/$BEAME_INSTA_SSL_SVC.service"}
: ${BEAME_INSTA_SSL_SYSTEMD_EXTRA:=''}
: ${BEAME_INSTA_SSL_DIR:="$(dirname "$SCRIPT_DIR")"}
: ${BEAME_INSTA_SSL_ARGV:="tunnel 8443 https"}

if [[ $BEAME_INSTA_SSL_NODEJS_BIN ]];then
	echo "+ Will be using NodeJS at $BEAME_INSTA_SSL_NODEJS_BIN"
else
	echo "+ NodeJS not found"
	exit 2
fi

"$SCRIPT_DIR/check-nodejs-version.sh" "$BEAME_INSTA_SSL_NODEJS_BIN"

if getent passwd "$BEAME_INSTA_SSL_USER" >/dev/null 2>&1;then
	echo "+ User $BEAME_INSTA_SSL_USER already exists"
else
	echo "+ Adding user for beame-insta-ssl: $BEAME_INSTA_SSL_USER"
	adduser --system --group --disabled-password --shell /bin/false "$BEAME_INSTA_SSL_USER"
fi

echo "+ Creating $BEAME_INSTA_SSL_SYSTEMD_FILE file for beame-insta-ssl"
cat >"$BEAME_INSTA_SSL_SYSTEMD_FILE" <<E
[Service]
Type=simple
Environment=NODE_ENV=production
User=$BEAME_INSTA_SSL_USER
WorkingDirectory=$BEAME_INSTA_SSL_DIR
ExecStart=$BEAME_INSTA_SSL_NODEJS_BIN main.js $BEAME_INSTA_SSL_ARGV
Restart=always
RestartSec=10

$BEAME_INSTA_SSL_SYSTEMD_EXTRA

[Install]
WantedBy=multi-user.target
E

echo "+ Enabling the $BEAME_INSTA_SSL_SVC service"
systemctl enable "$BEAME_INSTA_SSL_SVC"

echo "+ Reloading systemd"
systemctl daemon-reload

echo "+ SUCCESS. Installation complete."
echo "+ To start the service issue:"
echo "service $BEAME_INSTA_SSL_SVC start"
