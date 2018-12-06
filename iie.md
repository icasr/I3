Oversight process / IIE
=======================

IIE flow
--------
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


---
[Back to contents](./README.md)
