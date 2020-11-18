// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
import {DataProcessor, ProcessorOptions} from './data-processor-abstract';
import {FirestoreCollection} from '../types/firestore-schema';
import {WriteResult} from '@google-cloud/firestore';
import {CloudFunctionsServiceClient} from '@google-cloud/functions';

export interface CloudFunctionsProcessorOptions extends ProcessorOptions {
  functionsClient?: CloudFunctionsServiceClient;
  projectId: string;
}

export class CloudFunctionsProcessor extends DataProcessor {
  private functionsClient: CloudFunctionsServiceClient;
  private projectId: string;

  constructor(options: CloudFunctionsProcessorOptions) {
    super(options);
    this.projectId = options.projectId;
    this.functionsClient =
      options.functionsClient ||
      new CloudFunctionsServiceClient({projectId: options.projectId});
  }

  public async collectAndProcess(): Promise<void> {
    try {
      const names = await this.getAllGCFNames();
      await this.storeBotNames(names);
      this.logger.info('Finished processing Cloud Functions');
    } catch (error) {
      this.logger.error({
        message: 'Failed to process Cloud Functions',
        error: error,
      });
      throw error;
    }
  }

  private async getAllGCFNames(): Promise<string[]> {
    const [functions] = await this.functionsClient.listFunctions({
      parent: this.functionsClient.locationPath(this.projectId, 'us-central1'),
    });
    return functions.map(fn => fn.entryPoint!);
  }

  private storeBotNames(names: string[]): Promise<WriteResult[]> {
    const updates = names.map(name =>
      this.updateFirestore({
        doc: {
          bot_name: name,
        },
        collection: FirestoreCollection.Bot,
      })
    );
    return Promise.all(updates);
  }
}
