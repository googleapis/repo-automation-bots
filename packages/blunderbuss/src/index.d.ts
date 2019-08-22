// define types for a few modules used by probot that do not have their
// own definitions published. Before taking this step, folks should first
// check whether type bindings are already published.
declare module "promise-events" {
  class EventEmitter {
  }
}
