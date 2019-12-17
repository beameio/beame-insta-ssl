.PHONY: clean build test

default:
	exit 1

clean:
	rm -rf node_modules

build:
	npm install

test: build
ifndef BEAME_TESTS_CREDS_FQDN
	$(error BEAME_TESTS_CREDS_FQDN is undefined)
endif
	(cd tests && ./main.ngs --tests all)
