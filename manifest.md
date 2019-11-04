Manifest Specification
======================
Each tool conforming to the ICASR standard should include a manifest file within its distribution. This file lays out its acceptable inputs, outputs and purpose.

The manifest file is a JSON compatible file published within the root of the projects repository. Its layout it roughly equivalent to the [NPM package.json](https://docs.npmjs.com/files/package.json) format with some additional fields.

The manifest is located by checking for the following file names in order: `i3.json`, `package.json` (as an extension of an NPM package.json format).


Example
-------

```json
{
  "name": "iebh-citation-dedupe",
  "title": "IEBH Citation Deduper",
  "version": "1.0.0",
  "description": "Simple deduper tool for citation libraries",
  "assets": {
    "logo": "logo.svg"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/IEBH/sra-dedupe.git"
  },
  "keywords": [
    "iebh",
    "sra",
    "dedupe"
  ],
  "author": "Matt Carter <m@ttcarter.com> (https://github.com/hash-bang)",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/IEBH/sra-dedupe/issues"
  },
  "homepage": "https://github.com/IEBH/sra-dedupe#readme",
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
      "type": "references",
      "format": "json",
      "filename": "input.json"
    }
  ],
  "worker": {
    "type": "docker",
    "base": "iebh/citation-dedupe"
  },
  "outputs": [
    {
      "type": "references",
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
| `name`                | `string`         | Required                    | Short, alpha numeric (no space, hyphens + underscore), name for the app                                                                                  |
| `title`               | `string`         |                             | A more human friendly version of `name`, if omitted the `name` field is used instead                                                                     |
| `version`             | `string`         | Required                    | [SemVer compatible](https://semver.org) version of the App                                                                                               |
| `description`         | `string`         | Required                    | Human readable description of the tool. Ideally a simple description of around one paragraph                                                             |
| `public`              | `boolean`        | Default(true)               | If false, the app will not show up in search results or be available within the UI, this is intended for debugging only                                  |
| `assets`              | `object`         |                             | Optional list of assets to include in the manifest listing                                                                                               |
| `assets.logo`         | `string`         | Valid file                  | Logo to use when displaying the listing                                                                                                                  |
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
| `inputs`              | `array`  or `object` |                         | Array of valid input formats the app accepts or a single input object                                                                                    |
| `inputs.[].accepts`   | `array <string>` | Array of globs              | An [accept compatible](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#accept) list of files that can take this input slot          |
| `inputs.[].filename`  | `string`         |                             | The default filename to store the input as (if `worker.type == 'docker'`)                                                                                |
| `inputs.[].type`      | `string`         | Required, Enum('other', 'text', 'spreadhseet', 'references') | What meta input types are accepted for this input slot                                                                  |
| `inputs.[].format`    | `string`         | Enum(RefLib formats)        | The RefLib compatible format that the worker accepts                                                                                                     |
| `worker`              | `object`         |                             | Details on how the worker functions                                                                                                                      |
| `worker.type`         | `string`         | Enum('url', 'docker')       | How to handle worker process                                                                                                                             |
| `worker.container`    | `string`         | Docker container name       | The docker image to use when deploying the worker (if `worker.type == 'docker'`)                                                                         |
| `worker.url`          | `string`         | URL                         | URL exposed if `worker.type=='url'` this will receive the input data specified in `inputs`                                                               |
| `worker.mount`        | `string`         | Path                        | The mount path to expose to a docker process. If `inputs.[].filename` is specified the input file is placed in this path                                 |
| `worker.ui`           | `string`         | URL                         | Indicates that the worker exposes a UI as a URL which interacts with the user                                                                            |
| `worker.command`      | `array`          |                             | An array of command line options passed to the Docker container                                                                                          |
| `worker.environment`  | `object <string>` |                            | An object containing environment variables to populate and pass to the Docker container                                                                  |
| `outputs`             | `array` or `object`  |                         | Array of valid output formats the app accepts or a single output object                                                                                  |
| `outputs.[].type`     | `string`         | Required, Enum('other', 'text', 'spreadsheet', 'references') | The output type of the worker                                                                                           |
| `outputs.[].format`   | `string`         | Enum(RefLib formats)        | The RefLib compatible format that the worker outputs                                                                                                     |
| `outputs.[].filename` | `string`         |                             | The filename of the output data                                                                                                                          |
| `outputs.[].download` | `string`         | URL                         | An API endpoint that the worker will post data to when complete                                                                                          |


**Notes:**

* Any URL type can also accept [ES2015 template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) `server`, `port` (e.g. `http://${server}:${port}/api/endpoint`)
* If `worker.ui` has a value, the worker is initialized and the user redirected to the UI to interact with the worker. `outputs` specifies how the finished data is returned to the system for processing when this stage completes
* When `input.type == 'other'` and `input.filename` is specified whatever file is taken as input is renamed to `input.filename` automatically
* `settings` can be either a relative path to a local file (must begin with `./`), a URL to a HTML file or an Object of settings to display to the user when setting up the App.
* `worker.command` and `worker.environment` are templatable array / objects which can inherit their values from a variety of inputs. See the next section for details on how to customize.

See the [scenarios documentation](./scenarios.md) for implementation examples.


Passing settings to containers
------------------------------
The `worker.command` and `worker.environment` options use the [Lodash templating system](https://lodash.com/docs/4.17.11#template) to support passing parameters to Docker containers.

For example, in the following we customize the worker command line with the `foo` setting and also specify an optional verbosity:


```json
{
  "worker": {
    "command": [
      "--always-passed-setting",
      "--foo=${settings.foo}",
      "${settings.verbose && '-v'}"
    ],
    "environment": {
      "SOME_SETTING": "Passed!",
      "IS_TALKATIVE": "${setting.verbose}"
    }
  }
}
```

**Exposed template variables**

| Variable   | Type              | Description                                  |
|------------|-------------------|----------------------------------------------|
| `manifest` | `object`          | The manifest file structure as an object     |
| `settings` | `object <string>` | Any supplied user settings or their defaults |



**Notes:**

* If a setting is not explicitly specified by the user but a default is set in the settings object the default will be used instead
* Any blank values are removed from the output. For example in the above if `${setting.verbose}` is falsy in any way that environment variable is not set


Settings
--------
The `settings` key can be one of the following value types:

1. **Local HTML file** - If the value is a string and begins with `./` settings are treated as a repository-local HTML file to be displayed to the user. Submitting the HTML form will confirm the settings
2. **Remote HTML file** - If the value is a string and begins with `http://` or `https://` the HTML file is retrieved from the remote server and treated the same as a local HTML file
3. **MacGyver form spec** - If the value is an object it is treated as a [MacGyver form](https://github.com/MomsFriendlyDevCo/macgyver)


---
[Back to contents](./README.md)
