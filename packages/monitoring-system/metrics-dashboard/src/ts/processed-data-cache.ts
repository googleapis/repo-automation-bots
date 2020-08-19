interface ExecutionsCache {
    docs: {},
    countByBot: {
        [botName: string]: number
    }
}

export class ProcessedDataCache {
    
    /**
     * Bot_Executions that match the current user filters
     */
    static currentFilterExecutions = {
        docs: {},                     // the execution documents
        countByBot: {}                // count of number of executions by bot
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