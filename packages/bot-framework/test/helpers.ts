// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as express from 'express';
import sinon from 'sinon';
import fs from 'fs';
import {
  InstallationHandler,
  AppInstallation,
  InstalledRepository,
} from '../src/installations';
import {SecretLoader, BotSecrets} from '../src/secrets/secret-loader';

export function mockRequest(body: object, headers: Record<string, any>) {
  const request = Object.create(
    Object.getPrototypeOf(express.request),
    Object.getOwnPropertyDescriptors(express.request)
  );
  request.rawBody = Buffer.from(JSON.stringify(body));
  request.body = body;
  request.headers = headers;
  return request;
}

export function mockRequestFromFixture(
  fixture: string,
  headers: Record<string, any>
) {
  const request = Object.create(
    Object.getPrototypeOf(express.request),
    Object.getOwnPropertyDescriptors(express.request)
  );
  const rawBody = fs.readFileSync(fixture);
  request.rawBody = rawBody;
  request.body = JSON.parse(rawBody.toString('utf-8'));
  request.headers = headers;
  return request;
}

export function mockResponse() {
  const response = {} as any;
  response.status = sinon.stub().returns(response);
  response.json = sinon.stub().returns(response);
  response.send = sinon.stub().returns(response);
  return response;
}

export class MockInstallationHandler implements InstallationHandler {
  private installations: AppInstallation[] = [];
  private installedRepositoriesByInstallation: Map<
    number,
    InstalledRepository[]
  > = new Map();

  reset() {
    this.installations = [];
    this.installedRepositoriesByInstallation = new Map();
  }

  setInstallations(installations: AppInstallation[]) {
    this.installations = installations;
  }

  setInstalledRepositories(
    installationId: number,
    InstalledRepositories: InstalledRepository[]
  ) {
    this.installedRepositoriesByInstallation.set(
      installationId,
      InstalledRepositories
    );
  }

  async *eachInstallation(): AsyncGenerator<AppInstallation, void, void> {
    for (const installation of this.installations) {
      yield installation;
    }
  }
  async *eachInstalledRepository(
    installationId: number
  ): AsyncGenerator<InstalledRepository, void, void> {
    const installedRepositories =
      this.installedRepositoriesByInstallation.get(installationId) || [];
    for (const repo of installedRepositories) {
      yield repo;
    }
  }
}

export class MockSecretLoader implements SecretLoader {
  async load(botName: string): Promise<BotSecrets> {
    return {
      privateKey: `my-${botName}-private-key`,
      webhookSecret: `my-${botName}-webhook-secret`,
      appId: '123456',
    };
  }
}
