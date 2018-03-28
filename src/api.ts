import * as fs from 'fs';
import * as path from 'path';
import * as AWS from 'aws-sdk';

import * as pools from './pools';
import * as roles from './roles';
import { base } from './config';

const appsync = new AWS.AppSync();
const apiFolder = path.join(base, 'apis');

export async function downloadAll() {
  if (!fs.existsSync(apiFolder)) { fs.mkdirSync(apiFolder); }

  const apis = await appsync.listGraphqlApis().promise();
  if (apis.graphqlApis && apis.graphqlApis.length) {
    for (const api of apis.graphqlApis) {
      const myApiFolder = path.join(apiFolder, api.name || '.');
      if (!fs.existsSync(myApiFolder)) {
        fs.mkdirSync(myApiFolder);
      }
      if (api.userPoolConfig) {
        pools.downloadOne(api.userPoolConfig.userPoolId);
      }

      const dataSources = (await appsync.listDataSources({ apiId: api.apiId || '' }).promise()).dataSources || [];
      roles.downloadMany(dataSources.map(({ serviceRoleArn }) => serviceRoleArn || ''));

      const types = (await appsync.listTypes({ apiId: api.apiId || '', format: 'SDL' }).promise()).types || [];
      for (const type of types) {
        const typeFolder = path.join(myApiFolder, type.name || '.');
        if (!fs.existsSync(typeFolder)) {
          fs.mkdirSync(typeFolder);
        }

        const resolvers = (await appsync.listResolvers({ apiId: api.apiId || '', typeName: type.name || '' }).promise()).resolvers || [];
        for (const resolver of resolvers) {
          fs.writeFileSync(path.join(typeFolder, `${resolver.fieldName}.request.vtl`), resolver.requestMappingTemplate);
          fs.writeFileSync(path.join(typeFolder, `${resolver.fieldName}.response.vtl`), resolver.responseMappingTemplate);
        }

        fs.writeFileSync(path.join(typeFolder, 'configuration.json'), JSON.stringify({
          typeName: type.name,
          description: type.description,
          resolvers: resolvers.map((resolver) => ({
            fieldName: resolver.fieldName,
            dataSourceName: resolver.dataSourceName,
          })),
        }, null, 2));
        fs.writeFileSync(path.join(typeFolder, 'definition.gql'), type.definition);
      }

      fs.writeFileSync(path.join(myApiFolder, 'configuration.json'), JSON.stringify({
        apiId: api.apiId,
        name: api.name,
        authenticationType: api.authenticationType,
        userPoolConfig: api.userPoolConfig && {
          userPoolId: api.userPoolConfig.userPoolId,
          awsRegion: api.userPoolConfig.awsRegion,
          defaultAction: api.userPoolConfig.defaultAction,
          appIdClientRegex: api.userPoolConfig.appIdClientRegex,
        },
        dataSources: dataSources.map((source) => ({
          dataSourceArn: source.dataSourceArn,
          name: source.name,
          description: source.description,
          type: source.type,
          serviceRoleArn: source.serviceRoleArn,
          dynamodbConfig: source.dynamodbConfig && {
            tableName: source.dynamodbConfig.tableName,
            awsRegion: source.dynamodbConfig.awsRegion,
            useCallerCredentials: source.dynamodbConfig.useCallerCredentials,
          },
          lambdaConfig: source.lambdaConfig && {
            lambdaFunctionArn: source.lambdaConfig.lambdaFunctionArn,
          },
          elasticsearchConfig: source.elasticsearchConfig && {
            endpoint: source.elasticsearchConfig.endpoint,
            awsRegion: source.elasticsearchConfig.awsRegion,
          },
        })),
      }, null, 2));
    }
  }
}

export async function uploadAll() {
  const files = fs.readdirSync(apiFolder);

  if (files.length) {
    for (const file of files) {
      const api = JSON.parse(fs.readFileSync(path.join(apiFolder, file, 'configuration.json'), 'utf8'));

      await appsync.updateGraphqlApi({
        apiId: api.apiId,
        name: api.name,
        authenticationType: api.authenticationType,
        userPoolConfig: api.userPoolConfig && {
          userPoolId: api.userPoolConfig.userPoolId,
          awsRegion: api.userPoolConfig.awsRegion,
          defaultAction: api.userPoolConfig.defaultAction,
          appIdClientRegex: api.userPoolConfig.appIdClientRegex,
        },
      }).promise();

      for (const source of api.dataSources) {
        const dataSource : AWS.AppSync.UpdateDataSourceRequest = {
          apiId: api.apiId,
          name: source.name,
          description: source.description,
          type: source.type,
          serviceRoleArn: source.serviceRoleArn,
        };
        if (source.dynamodbConfig) {
          dataSource.dynamodbConfig = {
            tableName: source.dynamodbConfig.tableName,
            awsRegion: source.dynamodbConfig.awsRegion,
            useCallerCredentials: source.dynamodbConfig.useCallerCredentials,
          };
        }
        if (source.lambdaConfig) {
          dataSource.lambdaConfig = {
            lambdaFunctionArn: source.lambdaConfig.lambdaFunctionArn,
          };
        }
        if (source.elasticsearchConfig) {
          dataSource.elasticsearchConfig = {
            endpoint: source.elasticsearchConfig.endpoint,
            awsRegion: source.elasticsearchConfig.awsRegion,
          };
        }

        await appsync.updateDataSource(dataSource).promise();
      }
    }
  }
}
