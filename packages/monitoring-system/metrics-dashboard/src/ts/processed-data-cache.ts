/**
 * Processed data for Bot Executions
 */
interface ExecutionsCache {
    /**
     * Count of number of executions by bot
     */
    countByBot: {
        [botName: string]: number
    }
}

interface ActionsCache {
    actionInfos: {
        [primaryKey: string]: ActionInfo
    }
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

export class ProcessedDataCache {
    
    static Executions: ExecutionsCache = {
        countByBot: {}                
    };

    static Actions: ActionsCache = {
        actionInfos: {}
    }

    static currentFilterErrors = {
        formattedErrors: {}           // errors formatted with execution info
    }

    static currentFilterTriggers = {
        docs: {},
        countByType: {},
    }
}