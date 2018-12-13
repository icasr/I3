IIE Roadmap
===========
This section details the development process for the IIE project.
It is understood that the IIE proof-of-concept is likely to take many iterations to perfect with the refinements to the manifest, worker layout and other tooling to change along the way.


Creation of CLI proof-of-concept
--------------------------------
The first step for the IIE project will be to create a command line interface (CLI) program which implements the base standard.
Since CLI applications are easier to develop and debug this should test the [manifest specification](./manifest.md) against CREBP's existing modules before promoting the standard to a wider audience.

This initial stage will include the task of creating the base project, implementing the manifest schema and testing against a selection of simple workers.


Scenario testing
----------------
The next stage is using the CLI tool to run though a set scenario and testing the viability at each stage.

A proposed scenario would be as follows:

| # | Scenario                                           | Tool                                                | Test purpose                                 | Input       | Output                           |
|---|----------------------------------------------------|-----------------------------------------------------|----------------------------------------------|-------------|----------------------------------|
| 1 | Deduplication                                      | [CREBP-Dedupe](https://github.com/CREBP/sra-dedupe) | Command line streaming as a block library    | EndNote XML | Deduplicated library, duplicates |
| 2 | Spider references by one generation forward / back | [CREBP-Spider](https://github.com/CREBP/sra-spider) | Command line streaming individual references | EndNote XML | Original + Spidered references   |
| 3 | Screen the references                              | [Abstrackr](http://abstrackr.cebm.brown.edu)        | Support for legacy, self hosted tools        | CSV         | Partial CSV data                 |


**Notes:**

* Abstrackr accepts an abbreviated CSV file (`title, abstract`) and returns the same data back with a score field added. It will be the job of the IIE process to link this partial data back to the original record


**Example CLI usage**:

The following is an example of the above process using the CLI. Since this tool is still in development the below is conceptual only but provides some insight into how the IIE implementation would work:

We assumes that a workspace already exists with `input-library.xml`.


```
# Accept input-library.xml, dedupe and output to deduped.xml + dupes.xml
iie --input input-library.xml --output deduped.xml --output dupes.xml --action crebp/dedupe

# Input deduped.xml, spider references by one generation forward/back output as spidered.csv
iie --input deduped.xml --output spidered.csv --action crebp/spider --setting forward=1 -setting backward=1

# Input spidered.csv, launch and wait for Abstrackr functionality to compete, output as screened.xml EndNote library
iie --input spidered.csv --output screened.xml --action brown/abstrackr
```

**Notes:**

* The long form options (e.g. `--input`) are used in the above for readability, short form options (`--input` or `-i`) would be available also
* The named action (e.g. `--action crebp/dedupe`) corresponds to a registered Docker image which would contain a [manifest](./manifest.md) indicating how the container should be built and input/output processed


Integration with a UI
---------------------
Once the scenario testing stage has been finalized, production can begin on a more accessible user interface (UI). This would take the underlying API developed for the IIE CLI tool and provide a web page which would bring the tool components together.


Wider implementation of existing tools
--------------------------------------
In order to get wider circulation of the IIE platform more modules will need to be incorporated into its design to encourage other solution creators.



---
[Back to contents](./README.md)
