# StarShell Wallet Dev

## Install

```shell
git submodule update --init
yarn install
```

In a separate directory, also clone [cosmos-grpc](https://github.com/SolarRepublic/cosmos-grpc) and follow its README to install and link the module.

## Running locally

There are several ways to run the extension depending on the intent.

To simply play with the extension in a sandbox environment run:
```shell
yarn serve:chrome
```

This may require that your system has a chrome webdriver installed, depending on the OS. It should launch a standalone, vanilla chrome process with the extension pre-installed.

