import * as fs from 'fs';
import * as path from 'path';
import * as AWS from 'aws-sdk';
import { format } from 'prettier';

import * as pools from './pools';
import * as roles from './roles';
import { base, config } from './config';

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
        fs.writeFileSync(path.join(typeFolder, 'definition.gql'), format(type.definition || '', { parser: 'graphql' }).replace(/\n\n/g, '\n'));
      }

      const introspection = (await appsync.getIntrospectionSchema({ apiId: api.apiId || '', format: 'JSON' }).promise()).schema || '';
      fs.writeFileSync(path.join(myApiFolder, 'introspection.json'), introspection.toString());
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

      const typeFiles = fs.readdirSync(path.join(apiFolder, file));
      for (const typeFile of typeFiles) {
        if (typeFile.indexOf('.json') < 0) {
          const definition = fs.readFileSync(path.join(apiFolder, file, typeFile, 'definition.gql'), 'utf8');
          const type = JSON.parse(fs.readFileSync(path.join(apiFolder, file, typeFile, 'configuration.json'), 'utf8'));

          await appsync.updateType({
            apiId: api.apiId,
            typeName: type.typeName,
            format: 'SDL',
            definition: definition,
          }).promise();

          for (const resolver of type.resolvers) {
            const request = fs.readFileSync(path.join(apiFolder, file, typeFile, `${resolver.fieldName}.request.vtl`), 'utf8');
            const response = fs.readFileSync(path.join(apiFolder, file, typeFile, `${resolver.fieldName}.response.vtl`), 'utf8');
            await appsync.updateResolver({
              apiId: api.apiId,
              typeName: type.typeName,
              fieldName: resolver.fieldName,
              dataSourceName: resolver.dataSourceName,
              requestMappingTemplate: request,
              responseMappingTemplate: response,
            }).promise();
          }
        }
      }
    }
  }
}

export async function createDynamoDataSource(apiName : string, name : string, role : string) {
  const api = JSON.parse(fs.readFileSync(path.join(apiFolder, apiName, 'configuration.json'), 'utf8'));
  await appsync.createDataSource({
    apiId: api.apiId,
    name: name,
    type: 'AMAZON_DYNAMODB',
    dynamodbConfig: {
      awsRegion: config.region,
      tableName: name,
    },
    serviceRoleArn: role,
  }).promise();
  await downloadAll();
}

export async function createType(apiName : string, typeName : string, typeType : string) {
  const api = JSON.parse(fs.readFileSync(path.join(apiFolder, apiName, 'configuration.json'), 'utf8'));
  await appsync.createType({
    apiId: api.apiId,
    definition: `${typeType} ${typeName} {
      id: ID!
    }`,
    format: 'SDL',
  }).promise();
  await downloadAll();
}

export async function createResolver(apiName : string, type : string, field : string, dataSource : string) {
  const api = JSON.parse(fs.readFileSync(path.join(apiFolder, apiName, 'configuration.json'), 'utf8'));
  await appsync.createResolver({
    apiId: api.apiId,
    typeName: type,
    fieldName: field,
    dataSourceName: dataSource,
    requestMappingTemplate: `{
      "version": "2017-02-28",
      "payload": $util.toJson($context.identity)
    }`,
    responseMappingTemplate: '$util.toJson($context.result)',
  }).promise();
  await downloadAll();
}