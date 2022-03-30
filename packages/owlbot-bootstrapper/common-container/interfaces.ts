export enum Language {
  Nodejs,
  Python,
  Java,
  Ruby,
  Php,
  Dotnet,
}

export interface Secret {
  privateKey: string;
  appId: string;
  secret: string;
}
