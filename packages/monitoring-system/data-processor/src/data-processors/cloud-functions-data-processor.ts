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
import {GCF, CloudFunction} from 'googleapis-nodejs-functions';
import {FirestoreCollection} from '../types/firestore-schema';
import {WriteResult} from '@google-cloud/firestore';

export interface CloudFunctionsProcessorOptions extends ProcessorOptions {
  functionsClient?: GCF;
  projectId: string;
}

export class CloudFunctionsProcessor extends DataProcessor {
  private functionsClient: GCF;

  constructor(options: CloudFunctionsProcessorOptions) {
    super(options);
    this.functionsClient =
      options.functionsClient || new GCF({projectId: options.projectId});
  }

  public async collectAndProcess(): Promise<void> {
    return this.getAllGCFNames()
      .then(names => {
        return this.storeBotNames(names);
      })
      .then(() => {
        this.logger.info('Finished processing Cloud Functions');
      })
      .catch(error => {
        this.logger.error({
          message: 'Failed to process Cloud Functions',
          error: error,
        });
        throw error;
      });
  }

  private getAllGCFNames(): Promise<string[]> {
    const cloudFunctionsPromise = this.functionsClient.getCloudFunctions();
    if (!cloudFunctionsPromise) {
      throw new Error('Cloud Functions client returned a void promise');
    }

    return cloudFunctionsPromise.then(response => {
      const functions: CloudFunction[] = response[0];
      if (!functions) {
        throw new Error('Invalid response from Cloud Functions client');
      }
      return functions.map(fn => fn.metadata.entryPoint);
    });
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
