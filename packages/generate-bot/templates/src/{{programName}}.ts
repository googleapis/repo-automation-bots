import { Application, Context } from 'probot';
import * as util from 'util';

//const CONFIGURATION_FILE_PATH = '{{programName}}.yml';

export = (app: Application) => {
    app.on(
      [
        'issues.opened',
        'pull_request.opened',
        'commit_comment.created',
      ],
      async context => {

        if (context.payload.pull_request || context.payload.issue || context.payload.commit_comment) {
            context.log.info("The bot is alive!");
            return
        }
      })
};