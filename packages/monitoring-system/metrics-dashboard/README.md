# Metrics Dashboard: GitHub Automation Bots Monitoring System

A web-based dashboard to visualize metrics collected by the Automation Bot Monitoring System

> Note: This dashboard is currently under development

## Usage

To view the current deployment of the dashboard, visit [repo-automation-bots-metrics.web.app](https://repo-automation-bots-metrics.web.app/)

> Note: You will need to use the 'Sign-in with Google' option and log-in with your `@google.com` email to view the data.

## Development

The dashboard is developed with TypeScript alongside HTML and CSS. It is currently deployed to [Firebase Hosting in the repo-automation-bots-metrics project](https://firebase.corp.google.com/project/repo-automation-bots-metrics). 

> Note: You will need access to this project to view the hosting configuration

### Compiling for the web

Running `npm run compile` in the root directory will handle all the compile tasks for you and store the build files in `build/compiled`. However, if you wish to learn the details of the compile process, keep reading.

The HTML and CSS files can be deployed to Firebase as-is. These are directly copied from the `src` directory to the `build/public` directory.

To compile the TypeScript files:

1. We first use the `tsc` compiler and store the JavaScript output in `build/tsc-compiled`
2. We then use `webpack` to create 2 bundles - one for the auth flow and one for the app. These are stored in `build/webpack-compiled`
3. Lastly, we copy the webpack bundles to the `build/public` directory alongside the HTML and CSS files.

### Overview of Components

#### auth.ts

Uses Firebase Auth libraries to handle the authentication workflow and redirect user to the app on successful authentication

#### index.ts

The entry-point for the dashboard app. It initializes the listeners and assigns events for DOM elements.

#### Authenticated Firestore

A singleton class that returns a configured and authenticated Firestore Client

#### Firestore Listener

This module contains all the Firestore queries that are added as 'listeners' to the Firestore instance. 

#### Change Processor

A module to handle changes to the Firestore query as reported by the listeners.

#### Processed Data Cache

An in-memory cache for objects built from Firestore query results

#### Render

This module renders the results from Firestore on the DOM. This is a temporary solution and eventually will be swapped for a ReactJS app.

### Deploy

Run `npm run deploy` to deploy the files under `build/public` to Firebase Hosting