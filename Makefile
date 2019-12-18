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
