.PHONY: build test
default: build

build:
	docker build -t crebp/filter .

test:
	-rm -rf /tmp/filter-test
	mkdir /tmp/filter-test
	cp data/citations.json /tmp/filter-test/input.json
	docker run --volume /tmp/filter-test:/app/work crebp/filter -i work/input.json -o work/output.json -f title,year
	cat /tmp/filter-test/output.json
	-rm -rf /tmp/filter-test

shell:
	docker run -it --entrypoint=/bin/sh crebp/filter
