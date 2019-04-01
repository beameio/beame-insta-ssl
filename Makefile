.PHONY: clean build test

default:
	exit 1

clean:
	rm -rf node_modules

build:
	npm install

test: build
	rm -r ~/.beame || true
	./test.ngs
