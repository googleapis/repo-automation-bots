/**
 * Copyright 2019 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { GCFBootstrapper } from '../../src/gcf-utils';

import { Application, Options } from 'probot';
import { resolve } from "path";
import { config } from "dotenv";

describe('GCFBootstrapper Integration', () => {
    describe('getProbotConfig', () => {

        let bootstrapper: GCFBootstrapper;

        beforeEach(async () => {
            bootstrapper = new GCFBootstrapper();
            let res = config({ path: resolve(__dirname, "../../../.env") });
        });

        afterEach(() => {
        });

        it('returns valid options', async () => {
            let options = await bootstrapper.getProbotConfig();
            console.log(options);
        });
    });

    describe('loadProbot', () => {

        let bootstrapper: GCFBootstrapper;

        beforeEach(async () => {
            bootstrapper = new GCFBootstrapper();
            let res = config({ path: resolve(__dirname, "../../.env") });
        });

        afterEach(() => {
        });

        it('is called properly', async () => {
            let pb = await bootstrapper.loadProbot((app: Application) => {
                app.on("foo", async context => {
                    console.log("We are called!");
                });
            });
            //console.log(pb);
            await pb.receive({
                name: "foo",
                id: "bar",
                payload: "baz",
            });
        });
    });
});
