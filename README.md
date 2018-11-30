ICASR integration standard
==========================
The ICASR integration standard defines how individual Systematic Review Apps interact.


Manifest
========
Each tool conforming to the ICASR standard should include a manifest file within its distribution. This file lays out its acceptable inputs, outputs and purpose.

The manifest file is a JSON compatible file published within the root of the projects repository. Its layout it roughly equivalent to the [NPM package.json](https://docs.npmjs.com/files/package.json) format with some additional fields.

The Manifest is located by checking for the following file names in order: `icasr.json`, `manifest.json`, `package.json` (as an extension of an NPM package.json format).


Example
-------

```json
{
  "name": "crebp-citation-dedupe",
  "version": "1.0.0",
  "description": "Simple deduper tool for citation libraries",
  "main": "index.js",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/CREBP/sra-dedupe.git"
  },
  "keywords": [
    "crebp",
    "sra",
    "dedupe"
  ],
  "author": "Matt Carter <m@ttcarter.com> (https://github.com/hash-bang)",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/CREBP/sra-dedupe/issues"
  },
  "homepage": "https://github.com/CREBP/sra-dedupe#readme",
  "engines": {
    "node": ">=6.0.0"
  },
  "settings": [
    "operation": {
      "type": "choice",
      "options": [
	{"id": "mark", "title": "Mark duplicates in LABEL field"},
	{"id": "delete", "title": "Delete duplicates"}
      ]
    },
  ],
  "inputs": [
    {
      "type": "citations",
      "format": "json",
      "filename": "input.json"
    }
  ],
  "worker": {
    "type": "docker",
    "container": "crebp/citation-dedupe",
    "mount": "/app"
  },
  "outputs": [
    {
      "type": "citations",
      "format": "json",
      "filename": "output.json"
    }
  ],
}
```


Manifest specification
----------------------

| Key                   | Type             | Validation                  | Description                                                                                                                                              |
|-----------------------|------------------|-----------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `name`                | `string`         | Required                    | Short, alpha numeric (no space, hyphans + underscore), name for the app                                                                                  |
| `version`             | `string`         | Required                    | [SemVer compatible](https://semver.org) version of the App                                                                                               |
| `description`         | `string`         | Required                    | Human readable description of the tool. Ideally a simple description of around one paragraph                                                             |
| `main`                | `string`         | Required, Valid file        | Pointer to the entry point of the app                                                                                                                    |
| `repository`          | `object`         |                             | Repository information                                                                                                                                   |
| `repository.type`     | `string`         | Enum('git')                 | The repository type                                                                                                                                      |
| `repository.url`      | `string`         | URL                         | The repository location                                                                                                                                  |
| `keywords`            | `array <string>` |                             | A list of keywords to match against when searching for apps                                                                                              |
| `author`              | `object`         |                             | Information about the author matching the NPM package.json spec                                                                                          |
| `license`             | `string`         | Required, Enum(licenses)    | Which license the app is available under                                                                                                                 |
| `bugs`                | `object`         |                             | NPM package.json spec for bug reporting                                                                                                                  |
| `bugs.url`            | `string`         | URL                         | The URL to report bugs                                                                                                                                   |
| `homepage`            | `string`         | URL                         | The URL to the app homepage or other information                                                                                                         |
| `engines`             | `object`         |                             | Details about the execution environment the App needs to run under. These take the form of the execution context and SemVer version                      |
| `settings`            | `array`          |                             | Array of input settings to display to the user when queuing up the app for execution                                                                     |
| `inputs`              | `array`          |                             | Array of valid input formats the app accepts                                                                                                             |
| `inputs.[].accepts`   | `array <string>` | Array of globs              | If `(input.type == 'other')` this is an array of acceptable file globs                                                                                   |
| `inputs.[].filename`  | `string`         |                             | The single filename to store the input as (if `worker.type == 'docker'`)                                                                                 |
| `inputs.[].upload`    | `string`         | URL                         | A URL endpoint which accepts multipart-mime uploads of files (if `worker.type == 'url'`), if `.filename` is also specified this is used to name the file |
| `inputs.[].type`      | `string`         | Required, Enum('citations', 'manual', 'other') | What inputs are accepted for this input type                                                                                          |
| `inputs.[].format`    | `string`         | Enum(RefLib formats)        | The RefLib compatible format that the worker accepts                                                                                                     |
| `worker`              | `object`         |                             | Details on how the worker functions                                                                                                                      |
| `worker.type`         | `string`         | Enum('url', 'docker')       | How to handle worker process                                                                                                                             |
| `worker.container`    | `string`         | Docker container name       | The docker image to use when deploying the worker (if `worker.type == 'docker'`)                                                                         |
| `worker.url`          | `string`         | URL                         | URL exposed if `worker.type=='url'` this will receive the input data specified in `inputs`                                                               |
| `worker.mount`        | `string`         | Path                        | The mount path to expose to a docker process. If `inputs.[].filename` is specified the input file is placed in this path                                 |
| `worker.ui`           | `string`         | URL                         | Indicates that the worker exposes a UI as a URL which interacts with the user                                                                            |
| `outputs`             | `array`          |                             | Array of valid output formats the app accepts                                                                                                            |
| `outputs.[].type`     | `string`         | Required, Enum('citations', 'manual', 'other') | The output type of the worker                                                                                                         |
| `outputs.[].format`   | `string`         | Enum(RefLib formats)        | The RefLib compatible format that the worker outputs                                                                                                     |
| `outputs.[].filename` | `string`         |                             | The filename of the output data                                                                                                                          |
| `outputs.[].download` | `string`         | URL                         | An API endpoint that the worker will post data to when complete                                                                                          |


**Notes:**

* Any URL type can also accept [ES2015 template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) `server`, `port` (e.g. `http://${server}:${port}/api/endpoint`)
* If `worker.ui` has a value, the worker is initialized and the user redirected to the UI to interact with the worker. `outputs` specifies how the finished data is returned to the system for processing when this stage completes

See the [scenarios documentation](./scenarios.md) for implementation examples.


Oversight implementation
------------------------
While individual Apps provide a specification, the oversight process needs to provide the individual App with the data needed to operate.

The lifecycle of an App is as follows:

1. (If `worker.type == 'docker'`) download and install the Docker image from [Docker Hub](https://hub.docker.com)
2. Examine the `inputs` array for an applicable format and set it as active (henceforth `input`)
3. Examine the `outputs` array for an applicable format and set it as active (henceforth `output`)
4. (If `output.download`) set up a URL which listens for file input
4. (If `input.upload`) POST the contents of the file (named `input.filename`) to the specified URL in the format specified in `input.format`
5. (If `worker.type == 'docker' && worker.mount && input.filename`) copy the input file as the path `${worker.mount}/${input.filename}`
6. (If `worker.type == 'docker'`) Execute the docker process providing any `settings` values as parameters
7. (If `worker.ui`) Redirect the user to the UI
8. (If `worker.type == 'docker' && worker.mount`) Retrieve the output file from the mounted directory

FIXME: The above needs heavy work, a flow diagram and pseudo-code



Glossary
========

* **App** - An individual piece of component software which performs one or more actions on a data set and returns a result.
* **Docker** - [A containerizing environment](https://www.docker.com) which can enclose executable software within a dependable and re-distributable environment.
* **Worker** - The actual processing unit of an _App_. This can work in a variety of ways, specified by `worker.type` in the manifest.
