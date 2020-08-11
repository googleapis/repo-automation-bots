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
import {
  CloudFunctionsServiceClient as CloudFunctionClient,
  v1,
} from '@google-cloud/functions';

export interface CloudFunctionsProcessorOptions extends ProcessorOptions {
  // functionsClient?: v1.CloudFunctionsServiceClient;
  projectId: string;
  location: string;
}

export class CloudFunctionsProcessor extends DataProcessor {
  // private functionsClient: v1.CloudFunctionsServiceClient;
  private projectId: string;
  private location: string;

  constructor(options: CloudFunctionsProcessorOptions) {
    super(options);
    // this.functionsClient = options.functionsClient || new CloudFunctionClient();
    this.projectId = options.projectId;
    this.location = options.location;
  }

  public async collectAndProcess(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private getAllGCFNames(): string[] {
    throw new Error('Method not implemented.');
  }
}
