.PHONY: clean build tests

default:
	exit 1

clean:
	rm -rf node_modules

build:
	npm install

tests:
ifndef BEAME_TESTS_ROOT_CREDS_FQDN
	$(error BEAME_TESTS_ROOT_CREDS_FQDN is undefined)
endif
ifndef BEAME_INTERNAL_AUTH_SERVER_FQDN
	$(error BEAME_INTERNAL_AUTH_SERVER_FQDN is undefined)
endif
	(cd tests && ./main.ngs --tests all)

tests_extra:
ifndef BEAME_TESTS_ROOT_CREDS_FQDN
	$(error BEAME_TESTS_ROOT_CREDS_FQDN is undefined)
endif
	rm -rf /tmp/tests/
	mkdir /tmp/tests
	cp -R ~/$$BEAME_TESTS_ROOT_CREDS_FQDN /tmp/tests/
	# skip tunnels since they are already tested with the main.ngs
	(cd tests && SKIP_TUNNELS=true HOME=/tmp/tests ./test.ngs)
