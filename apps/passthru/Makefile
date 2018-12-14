.PHONY: build test
default: build

build:
	docker build -t crebp/passthru .

test:
	-rm -rf /tmp/passthru-test
	mkdir /tmp/passthru-test
	cp data/citations.json /tmp/passthru-test/input.json
	docker run --volume /tmp/passthru-test:/app crebp/passthru
	-rm -rf /tmp/passthru-test
