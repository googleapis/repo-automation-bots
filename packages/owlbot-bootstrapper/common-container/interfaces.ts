/**
 * Language enum representing all languages that use owlbot-bootstrapper
 */
export enum Language {
  Nodejs = 'nodejs',
  Python = 'python',
  Java = 'java',
  Ruby = 'ruby',
  Php = 'php',
  Dotnet = 'dotnet',
}

/**
 * Secret interface from secret manager for a bot
 */
export interface Secret {
  privateKey: string;
  appId: string;
  secret: string;
}
