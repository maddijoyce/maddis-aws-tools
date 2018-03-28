import * as path from 'path';
import * as fs from 'fs';
import * as AWS from 'aws-sdk';
import * as dotenv from 'dotenv';

type Environment = {
  AWS_ID : string;
  AWS_SECRET : string;
  AWS_REGION : string;
  AWS_BACKEND_TAG : string;
  CONFIG_DIR? : string;
};
const rcfile = dotenv.config({ path: path.resolve(process.cwd(), '.maddirc') });

if (rcfile.error) {
  throw new Error('.maddirc file not found');
}
const parsedrc = rcfile.parsed as Environment;

export const config = {
  accessKeyId: parsedrc.AWS_ID,
  secretAccessKey: parsedrc.AWS_SECRET,
  region: parsedrc.AWS_REGION,
  backendTag: parsedrc.AWS_BACKEND_TAG,
  directory: parsedrc.CONFIG_DIR || 'config',
};

export const base = path.join(process.cwd(), config.directory);
if (!fs.existsSync(base)) {
  fs.mkdirSync(base);
}

AWS.config.update({
  accessKeyId: config.accessKeyId,
  secretAccessKey: config.secretAccessKey,
  region: config.region,
  apiVersions: {
    appsync: '2017-07-25',
  },
});

export default config;