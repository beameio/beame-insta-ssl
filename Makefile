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
	cp -R ~/.beame/v2/$$BEAME_TESTS_ROOT_CREDS_FQDN /tmp/tests/
	(cd tests && HOME=/tmp/tests ./test.ngs)
	rm -rf /tmp/tests/