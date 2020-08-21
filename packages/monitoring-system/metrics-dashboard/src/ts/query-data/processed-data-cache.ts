/**
 * Processed data for Bot Executions
 */
interface ExecutionsCache {
  /**
   * Count of number of executions by bot
   */
  countByBot: {
    [botName: string]: number;
  };
}

interface ActionsCache {
  actionInfos: {
    [primaryKey: string]: ActionInfo;
  };
}

/**
 * GitHub Action information
 */
export interface ActionInfo {
  repoName: string;
  time: string;
  url: string;
  actionDescription: string;
}

interface ErrorCache {
  errorInfos: {
    [primaryKey: string]: ErrorInfo;
  };
}

/**
 * Bot Execution Error Information
 */
export interface ErrorInfo {
  msg: string;
  time: string;
  logsUrl: string;
  botName: string;
}

export class ProcessedDataCache {
  static Executions: ExecutionsCache = {
    countByBot: {},
  };

  static Actions: ActionsCache = {
    actionInfos: {},
  };

  static Errors: ErrorCache = {
    errorInfos: {},
  };

  static currentFilterTriggers = {
    docs: {},
    countByType: {},
  };
}
