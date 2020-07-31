export interface BotDocument {
  bot_name: string; // Primary Key
}

export interface BotExecutionDocument {
  execution_id: string; // Primary Key
  bot_id?: string;
  start_time?: number;
  end_time?: number;
  logs_url?: string;
}

export interface TaskQueueStatusDocument {
  timestamp: number; // Primary Key
  queue_name: string; // Primary Key
  in_queue?: number;
}

export interface ErrorDocument {
  execution_id: string; // Primary Key
  timestamp: number; // Primary Key
  error_msg: string;
}

export interface TriggerDocument {
  execution_id: string; // Primary Key
  github_event?: string;
  trigger_type?: string;
}

export interface ActionDocument {
  execution_id: string; // Primary Key
  action_type: string; // Primary Key
  timestamp: number; // Primary Key
  destination_object?: string;
  destination_repo?: string;
  value?: string;
}

export interface GitHubRepositoryDocument {
  repo_name: string, // Primary Key
  owner_name: string, // Primary Key
  owner_type: 'org' | 'user', // Primary Key
}

export interface ActionTypeDocument {}

export interface GitHubEventDocument {}

export interface GitHubObjectDocument {}

export interface FirestoreSchema {
  Bot: {
    [bot_name: string]: BotDocument;
  };
  Bot_Execution: {
    [execution_id: string]: BotExecutionDocument;
  };
  Task_Queue_Status: {
    [bot_name_timestamp: string]: TaskQueueStatusDocument;
  };
  Error: {
    [error_id: string]: ErrorDocument;
  };
  Trigger: {
    [trigger_id: string]: TriggerDocument;
  };
  Action: {
    [action_id: string]: ActionDocument;
  };
  Action_Type: {
    [action_type_id: string]: ActionTypeDocument;
  };
  GitHub_Event: {
    [payload_hash: string]: GitHubEventDocument;
  };
  GitHub_Repository: {
    [repo_name_owner_name_owner_type: string]: GitHubRepositoryDocument;
  };
  GitHub_Object: {
    [object_type_repository_object_id: string]: GitHubObjectDocument;
  };
}
