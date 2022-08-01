# StarShell Wallet Beta Setup: The "Weekly" Channel

Welcome to the beta program. Since browser extensions must go through a lengthy review process (even for betas), we are providing the "Weekly" channel for users to install and test the beta on a (roughly) weekly update release cycle.

When a new release is published, you will be forced to update in order to continue beta testing.


## Getting Started

In the interest of maximum security, its highly recommended that you **DO NOT install this extension in your day-to-day web browser**. Instead, download and install a completely separate browser program that you will only use for beta testing this wallet.

## Connect to the Weekly channel

To make the update process simple, you will need to clone the Weekly channel git repository.

For advanced users, [#cloning-and-updating-with-git](clone and update the repository using git).
For everyone else, [#cloning-and-updating-with-github-desktop](clone and update using GitHub Desktop).


### Cloning and updating with GitHub Desktop

1. Download and setup [GitHub Deskop](https://desktop.github.com/).

2. Open the [StarShell Beta Repository](https://github.com/SolarRepublic/starshell-beta) and click the green "Code" button, then "Open with GitHub Desktop".

3. Continue to [Setting up with browser](#setting-up-with-browser)


### Cloning and updating with git

1. Make sure you have [git](https://git-scm.com/downloads) installed.

2. Open a terminal and change directory to where you want to save the built extension. Then run:

```bash
git clone https://github.com/SolarRepublic/starshell-beta
```

3. When a new release is published, open a terminal and change directory into the folder that was created by the clone and run:

```bash
git pull
```


## Setting up with browser

 - [Chrome](#setting-up-chrome-canary)
 - [Firefox](#setting-up-firefox-developer-edition)


### Setting up Chrome Canary

1. Download and install [Chrome Canary](https://www.google.com/chrome/canary/).

2. Open [chrome://extensions/](chrome://extensions/).

3. Enable Developer mode in the top-right corner.

4. Click the "Load unpacked" button.



## Setting up Firefox Developer Edition

1. Download and install [Firefox Developer Edition](https://www.mozilla.org/en-US/firefox/developer/)

2. Open [firefox.starshell.net](https://firefox.starshell.net/)

3. Install the add-on (see [here](https://www.accessfirefox.org/Install_Addon_Manually.php) for help)


