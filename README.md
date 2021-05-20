# hwf-jupyterlab-telemetry

[![repo social preview image](https://repository-images.githubusercontent.com/365260663/1b881e00-b95b-11eb-9339-4d0ccc89821c)](#)

![Github Actions Status](https://github.com/educational-technology-collective/hwf-jupyterlab-telemetry.git/workflows/Build/badge.svg)[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/educational-technology-collective/hwf-jupyterlab-telemetry.git/main?urlpath=lab)

A JupyterLab extension.


This extension is composed of a Python package named `hwf-jupyterlab-telemetry`
for the server extension and a NPM package named `hwf-jupyterlab-telemetry`
for the frontend extension.


## Requirements

* JupyterLab >= 3.0

## Install

To install the extension, execute:

```bash
pip install hwf-jupyterlab-telemetry
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall hwf-jupyterlab-telemetry
```


## Troubleshoot

If you are seeing the frontend extension, but it is not working, check
that the server extension is enabled:

```bash
jupyter server extension list
```

If the server extension is installed and enabled, but you are not seeing
the frontend extension, check the frontend extension is installed:

```bash
jupyter labextension list
```


## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the hwf-jupyterlab-telemetry directory
# Install package in development mode
pip install -e .
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Server extension must be manually installed in develop mode
jupyter server extension enable hwf-jupyterlab-telemetry
# Rebuild extension Typescript source after making changes
jlpm run build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm run watch

# Run JupyterLab in another terminal, restarting when the Python files are changed
jupyter lab --no-browser --autoreload
```

(Note: Adding "`&`" to the ends of the commands above will allow them to run in the backdround.  That will allow both processes to run in the same terminal, which may be more convenient.)

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm run build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
# Server extension must be manually disabled in develop mode
jupyter server extension disable hwf-jupyterlab-telemetry
pip uninstall hwf-jupyterlab-telemetry
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `hwf-jupyterlab-telemetry` within that folder.

# hwf-jupyterlab-telemetry
