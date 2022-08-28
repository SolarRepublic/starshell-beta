# StarShell Wallet Dev

## Install

```shell
git submodule update --init
yarn install
```

## Running locally

There are several ways to run the extension depending on the intent.

To simply play with the extension in a sandbox environment run:
```shell
yarn serve:chrome
```

This may require that your system has a chrome webdriver installed, depending on the OS. It should launch a standalone, vanilla chrome process with the extension pre-installed.


#### Testing in Chrome, Chromium, Brave, Edge, etc. for Desktop

```shell
yarn watch:chrome
```

Then follow the instructions [here](https://github.com/SolarRepublic/starshell-beta-releases#setting-up-with-browser).


#### Testing in Firefox for Desktop

```shell
yarn dev:firefox
```

Then, in a separate shell:
```shell
yarn serve:firefox
```


### Testing in Firefox for Android

```shell
yarn watch:firefox-android
```

In a separate shell:
```shell
yarn serve:firefox-android
```