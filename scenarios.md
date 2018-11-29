Scenarios
=========


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
      "type": "citations",
      "format": "json"
    }
  ],
  "worker": {
    "type": "url",
    "url": "http://acme.com/process/citations"
  },
  "outputs": [
    {
      "type": "citations",
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
      "type": "citations",
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
      "type": "citations",
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
      "type": "citations",
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
      "type": "citations",
      "format": "csv",
      "download": "http://${server}:${port}/api/export",
    }
  ],
}
```
