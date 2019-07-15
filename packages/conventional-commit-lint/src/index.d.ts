// define types for a few modules used by probot that do not have their
// own definitions published. Before taking this step, folks should first
// check whether type bindings are already published.
declare module "promise-events" {
  class EventEmitter {}
}

declare module "@commitlint/lint" {
  interface ILint {
    input: string;
    valid: boolean;
    errors: IError[];
  }

  interface IError {
    message: string;
  }

  export default function (commit: string, rules: any): ILint;
}

declare module "@commitlint/config-conventional" {
  export const rules: any;
}