import { Application, Context } from 'probot';
import * as util from 'util';

const CONFIGURATION_FILE_PATH = 'helloworld.yml';

interface Configuration {
  randomBoolean: boolean;
}


export = (app: Application) => {
  app.on(
    [
      'issues.opened',
      'pull_request.opened',
      'commit_comment.created',
    ],
    async context => {
      const config = (await context.config(
        CONFIGURATION_FILE_PATH,
        {}
      )) as Configuration;

      if((context.payload.pull_request || context.payload.issue || context.payload.commit_comment) && config.randomBoolean) {
        context.log.info("The bot is alive!");
        return;
  }
})
};