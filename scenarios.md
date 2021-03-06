Manifest Scenarios & Examples
=============================


Web-server API
--------------
An App that runs as a web server, exposes an endpoint to accept a citation library (in JSON format) which immediately returns a mutated citation library:

```json
{
  "name": "icasr-app-example-rest-mutator",
  "version": "0.0.0",
  "description": "Simple example of a ReST mutator endpoint",
  "main": "index.js",
  "license": "MIT",
  "engines": {
    "node": ">=10.0.0"
  },
  "inputs": [
    {
      "type": "references",
      "format": "json"
    }
  ],
  "worker": {
    "type": "url",
    "url": "http://acme.com/process/references"
  },
  "outputs": [
    {
      "type": "references",
      "format": "json"
    }
  ],
}
```


Script processing
-----------------
An App that runs within a Docker container, accepts input file (`input.json`) and mutates it into an output file (`output.json`):

```json
{
  "name": "icasr-app-example-docker-mutator",
  "version": "0.0.0",
  "description": "Simple example of a Docker worker which mutates a citation library input",
  "main": "index.js",
  "license": "MIT",
  "engines": {
    "node": ">=10.0.0"
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
    "container": "acme/docker-image",
    "mount": "/app"
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


Web UI
------
An app that runs a web facing interface, accepts a CSV POSTed to a URL, works with user input and eventually posts the finished data back to another URL:


```json
{
  "name": "icasr-app-example-web-ui",
  "version": "0.0.0",
  "description": "Simple example of a Docker enclosed worker providing a full UI with postback to a URL",
  "main": "index.js",
  "license": "MIT",
  "engines": {
    "node": ">=10.0.0"
  },
  "inputs": [
    {
      "type": "references",
      "format": "csv",
      "filename": "library.json",
      "upload": "http://${server}:${port}/import"
    }
  ],
  "worker": {
    "type": "docker",
    "container": "acme/docker-image",
    "ui": "http://${server}:${port}/interactive"
  },
  "outputs": [
    {
      "type": "references",
      "format": "csv",
      "download": "http://${server}:${port}/api/export",
    }
  ],
}
```


Accept a RevMan file output a graph
-----------------------------------
In addition to citation libraries, other formats can also be used as input / output.
The below demonstrates taking a RevMan file and outputting a computed graphic.

```json
{
  "name": "icasr-app-example-revman-graph",
  "version": "0.0.0",
  "description": "Simple example of a Docker worker which accepts a RevMan file and outputs an graphic",
  "main": "index.js",
  "license": "MIT",
  "engines": {
    "node": ">=10.0.0"
  },
  "inputs": [
    {
      "type": "other",
      "accepts": ["*.rm5"],
      "filename": "input.rm5"
    }
  ],
  "worker": {
    "type": "docker",
    "container": "acme/docker-image",
    "mount": "/app"
  },
  "outputs": [
    {
      "type": "other",
      "filename": "graphic.png"
    }
  ],
}
```


Manual processing
-----------------
An app that provides no automated method to accept input or output.
While at first glance this may seem useless, the oversight process can still spawn and manage the tool while its running - even though it has no automated way to recieve data.


```json
{
  "name": "icasr-app-example-manual",
  "version": "0.0.0",
  "description": "Example of an entirely manual process which uses Docker to host it",
  "main": "index.js",
  "license": "MIT",
  "engines": {
    "node": ">=10.0.0"
  },
  "inputs": [
    {
      "type": "manual"
    }
  ],
  "worker": {
    "type": "docker",
    "container": "acme/docker-image",
    "ui": "http://${server}:${port}/legacy-tool"
  },
  "outputs": [
    {
      "type": "manual"
    }
  ],
}
```

---
[Back to contents](./README.md)
