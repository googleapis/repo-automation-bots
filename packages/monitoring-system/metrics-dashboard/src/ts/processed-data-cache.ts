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

export class ProcessedDataCache {
    
    static Executions: ExecutionsCache = {
        countByBot: {}                
    };

    static currentFilterErrors = {
        formattedErrors: {}           // errors formatted with execution info
    }

    static currentFilterTriggers = {
        docs: {},
        countByType: {},
    }

    static currentFilterActions = {
        formattedActions: {}          // actions formatted with repo info
    }
}