#  GitHub Automation Bots Monitoring System [Internal Only]

A system to collect metrics on GitHub Repo Automation Bot executions and make it easily accessible to bot SREs and developers for debugging and facilitating the development process.

[Read the design document here](http://go/automation-bot-monitoring-system-design)

## Usage

### Bot SRE: View currently configured metrics

Currently, there are 3 ways to view Automation Bot metrics, each of which are described below. 

The [roadmap](#Roadmap) for this project includes supporting all metrics in the [Metrics Dashboard](#Metrics-Dashboard) so you don't have to choose from the 3 methods below.

#### Cloud Logging: Logs-based metrics only

Logs-based metrics are one of the sources from which the Monitoring System collects data. You can view these metrics directly in Cloud Logging as well in the [repo-automation-bots GCP Project](https://pantheon.corp.google.com/logs/query?project=repo-automation-bots&folder=true&organizationId=true&query=%0A). _Note: You will need access to this project in order to view the logs_

For more information on which metrics are emitted via logs, refer to the [gcf-utils documentation](https://github.com/googleapis/repo-automation-bots/tree/master/packages/gcf-utils).

#### Metrics Dashboard: subset of all metrics

A subset of the metrics mined by the Monitoring System are visualized on the [Metrics Dashboard deployed here](https://repo-automation-bots-metrics.web.app/). You will need an `@google.com` account to be able to access the data on the dashboard. 

In the future, we will be making all metrics available via this dashboard. To learn more, see the [Metrics Dashboard section](#Metrics-Dashboard) below

#### Firestore: all available metrics

All data points collected and processed by the Monitoring System are stored in the Firestore instance for this project. To learn more about how to query and retrieve this data, see the [Firestore section](#Firestore) below.

### Bot Developer: Log metrics from your bot

// TODO

#### Trigger Information and GitHub Actions

// TODO

#### Custom Metrics

// TODO

## Overview Components

### Data Processor

// What does it do
// Where does it live
// Learn more link

### Firestore

// What does it do
// Where does it live
// Learn more link

### Metrics Dashboard

// What does it do
// Where does it live
// Learn more link

## Roadmap