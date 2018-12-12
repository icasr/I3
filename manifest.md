Manifest Specification
======================
Each tool conforming to the ICASR standard should include a manifest file within its distribution. This file lays out its acceptable inputs, outputs and purpose.

The manifest file is a JSON compatible file published within the root of the projects repository. Its layout it roughly equivalent to the [NPM package.json](https://docs.npmjs.com/files/package.json) format with some additional fields.

The manifest is located by checking for the following file names in order: `iie.json`, `package.json` (as an extension of an NPM package.json format).


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
  "settings": {
    "operation": {
      "type": "choice",
      "options": [
	{"id": "mark", "title": "Mark duplicates in the \"label\" field"},
	{"id": "delete", "title": "Delete duplicates"}
      ]
    },
  },
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

See the [scenarios documentation](./scenarios.md) for more manifest examples.


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
| `settings`            | `string` or `object` | Relative path or URL    | Input settings to display to the user when queuing up the app for execution                                                                              |
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
* When `input.type == 'other'` and `input.filename` is specified whatever file is taken as input is renamed to `input.filename` automatically
* `settings` can be either a relative path to a local file (must begin with `./`), a URL to a HTML file or an Object of settings to display to the user when setting up the App.

See the [scenarios documentation](./scenarios.md) for implementation examples.


Settings
--------
The `settings` key can be one of the following value types:

1. **Local HTML file** - If the value is a string and begins with `./` settings are treated as a repository-local HTML file to be displayed to the user. Submitting the HTML form will confirm the settings
2. **Remote HTML file** - If the value is a string and begins with `http://` or `https://` the HTML file is retrieved from the remote server and treated the same as a local HTML file
3. **MacGyver form spec** - If the value is an object it is treated as a [MacGyver form](https://github.com/MomsFriendlyDevCo/macgyver)


---
[Back to contents](./README.md)
