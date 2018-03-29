import * as fs from 'fs';
import * as path from 'path';
import * as koa from 'koa';
import * as koaApollo from 'apollo-server-koa';

import { config } from './config';
import { apiFolder } from './api';
import { poolFolder, cognito } from './pools';

export async function start(apiName : string, clientName : string, port : number, username : string, password : string) {
  const api = JSON.parse(fs.readFileSync(path.join(apiFolder, apiName, 'configuration.json'), 'utf8'));
  const pool = JSON.parse(fs.readFileSync(path.join(poolFolder, `${api.userPoolConfig.userPoolId}.json`), 'utf8'));
  const client = pool.Clients.find((c : any) => (c.ClientName === clientName));

  const auth = (await cognito.adminInitiateAuth({
    AuthFlow: 'ADMIN_NO_SRP_AUTH',
    UserPoolId: pool.Id,
    ClientId: client.ClientId,
    AuthParameters: {
      USERNAME: username || config.username,
      PASSWORD: password || config.password,
    },
  }).promise()).AuthenticationResult;

  if (auth) {
    const app = new koa();

    app.use(koaApollo.graphiqlKoa({
      endpointURL: api.uris.GRAPHQL,
      passHeader: `"Authorization": "${auth.IdToken}"`,
    }));

    app.listen(port);
    console.log(`Graphiql running at http://localhost:${port}`);
  } else {
    console.log('Login Failed');
  }
}