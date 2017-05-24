default:
	exit 1

build:
	npm install

test: build
	rm -r ~/.beame || true
	./test.ngs
