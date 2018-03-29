import * as fs from 'fs';
import * as path from 'path';
import * as AWS from 'aws-sdk';

import * as roles from './roles';
import { base } from './config';

const identity = new AWS.CognitoIdentity();
export const cognito = new AWS.CognitoIdentityServiceProvider();
export const poolFolder = path.join(base, 'pools');

export async function downloadOne(id : string) {
  if (!fs.existsSync(poolFolder)) { fs.mkdirSync(poolFolder); }

  const idPoolIds = await identity.listIdentityPools({ MaxResults: 10 }).promise();
  const idPools = await Promise.all((idPoolIds.IdentityPools || []).map(async ({ IdentityPoolId }) => (
    await identity.describeIdentityPool({ IdentityPoolId: IdentityPoolId || '' }).promise())));

    const pool = (await cognito.describeUserPool({ UserPoolId: id, }).promise()).UserPool;
    const clients = (await cognito.listUserPoolClients({ UserPoolId: id, MaxResults: 10 }).promise()).UserPoolClients || [];
    if (pool) {
      fs.writeFileSync(path.join(poolFolder, `${pool.Id}.json`), JSON.stringify({
        Id: pool.Id,
        Name: pool.Name,
        Policies: pool.Policies && {
          PasswordPolicy: pool.Policies.PasswordPolicy && {
            MinimumLength: pool.Policies.PasswordPolicy.MinimumLength,
            RequireUppercase: pool.Policies.PasswordPolicy.RequireUppercase,
            RequireLowercase: pool.Policies.PasswordPolicy.RequireLowercase,
            RequireNumbers: pool.Policies.PasswordPolicy.RequireNumbers,
            RequireSymbols: pool.Policies.PasswordPolicy.RequireSymbols,
          },
        },
        LambdaConfig: pool.LambdaConfig && {
          PreSignUp: pool.LambdaConfig.PreSignUp,
          CustomMessage: pool.LambdaConfig.CustomMessage,
          PostConfirmation: pool.LambdaConfig.PostConfirmation,
          PreAuthentication: pool.LambdaConfig.PreAuthentication,
          PostAuthentication: pool.LambdaConfig.PostAuthentication,
          DefineAuthChallenge: pool.LambdaConfig.DefineAuthChallenge,
          CreateAuthChallenge: pool.LambdaConfig.CreateAuthChallenge,
          VerifyAuthChallengeResponse: pool.LambdaConfig.VerifyAuthChallengeResponse,
          PreTokenGeneration: pool.LambdaConfig.PreTokenGeneration,
          UserMigration: pool.LambdaConfig.UserMigration,
        },
        MfaConfiguration: pool.MfaConfiguration,
        Clients: clients.map((client) => ({
          ClientId: client.ClientId,
          ClientName: client.ClientName,
        })),
      }, null, 2));

      const idPool = idPools.find(({ CognitoIdentityProviders }) =>
        !!(CognitoIdentityProviders || []).find(({ ProviderName }) =>
          ((ProviderName || '').indexOf(pool.Id || 'ID NOT FOUND') >= 0)));
      if (idPool) {
        const idPoolRoles = await identity.getIdentityPoolRoles({ IdentityPoolId: idPool.IdentityPoolId }).promise();
        await roles.downloadMany(Object.values(idPoolRoles.Roles || {}));

        fs.writeFileSync(path.join(poolFolder, `${idPool.IdentityPoolId}.json`), JSON.stringify({
          IdentityPoolId: idPool.IdentityPoolId,
          IdentityPoolName: idPool.IdentityPoolName,
          AllowUnauthenticatedIdentities: idPool.AllowUnauthenticatedIdentities,
          CognitoIdentityProviders: (idPool.CognitoIdentityProviders || []).map((provider) => ({
            ProviderName: provider.ProviderName,
            ClientId: provider.ClientId,
            ServerSideTokenCheck: provider.ServerSideTokenCheck,
          })),
          Roles: idPoolRoles.Roles,
        }, null, 2));
      }
    }
}

export async function downloadMany(ids : string[]) {
  await Promise.all(ids.map(async (id) => await downloadOne(id)));
}

export async function uploadAll() {
  const files = fs.readdirSync(poolFolder);

  for (const file of files) {
    const pool = JSON.parse(fs.readFileSync(path.join(poolFolder, file), 'utf8'));

    if (pool && pool.Id) {
      await cognito.updateUserPool({
        UserPoolId: pool.Id,
        Policies: pool.Policies && {
          PasswordPolicy: pool.Policies.PasswordPolicy && {
            MinimumLength: pool.Policies.PasswordPolicy.MinimumLength,
            RequireUppercase: pool.Policies.PasswordPolicy.RequireUppercase,
            RequireLowercase: pool.Policies.PasswordPolicy.RequireLowercase,
            RequireNumbers: pool.Policies.PasswordPolicy.RequireNumbers,
            RequireSymbols: pool.Policies.PasswordPolicy.RequireSymbols,
          },
        },
        LambdaConfig: pool.LambdaConfig && {
          PreSignUp: pool.LambdaConfig.PreSignUp,
          CustomMessage: pool.LambdaConfig.CustomMessage,
          PostConfirmation: pool.LambdaConfig.PostConfirmation,
          PreAuthentication: pool.LambdaConfig.PreAuthentication,
          PostAuthentication: pool.LambdaConfig.PostAuthentication,
          DefineAuthChallenge: pool.LambdaConfig.DefineAuthChallenge,
          CreateAuthChallenge: pool.LambdaConfig.CreateAuthChallenge,
          VerifyAuthChallengeResponse: pool.LambdaConfig.VerifyAuthChallengeResponse,
          PreTokenGeneration: pool.LambdaConfig.PreTokenGeneration,
          UserMigration: pool.LambdaConfig.UserMigration,
        },
        MfaConfiguration: pool.MfaConfiguration,
      }).promise();
    } else if (pool && pool.IdentityPoolId) {
      const idPool = pool;
      await identity.updateIdentityPool({
        IdentityPoolId: idPool.IdentityPoolId,
        IdentityPoolName: idPool.IdentityPoolName,
        AllowUnauthenticatedIdentities: idPool.AllowUnauthenticatedIdentities,
        CognitoIdentityProviders: (idPool.CognitoIdentityProviders || []).map((provider : any) => ({
          ProviderName: provider.ProviderName,
          ClientId: provider.ClientId,
          ServerSideTokenCheck: provider.ServerSideTokenCheck,
        })),
      }).promise();

      if (idPool.Roles) {
        await identity.setIdentityPoolRoles({
          IdentityPoolId: idPool.IdentityPoolId,
          Roles: idPool.Roles,
        }).promise();
      }
    }
  }
}