import {OwlBot} from './owl-bot';
import {readFileSync} from 'fs';
// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';

module.exports = (app: Probot) => {
  console.info('gots here');
  if (!process.env.PRIVATE_KEY_PATH) {
    throw Error('must provide path to GitHub app private key');
  }
  const privateKey = readFileSync(process.env.PRIVATE_KEY_PATH, 'utf8');
  OwlBot(privateKey, app);
};
