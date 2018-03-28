"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const AWS = require("aws-sdk");
const prettier_1 = require("prettier");
const pools = require("./pools");
const roles = require("./roles");
const config_1 = require("./config");
const appsync = new AWS.AppSync();
const apiFolder = path.join(config_1.base, 'apis');
function downloadAll() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs.existsSync(apiFolder)) {
            fs.mkdirSync(apiFolder);
        }
        const apis = yield appsync.listGraphqlApis().promise();
        if (apis.graphqlApis && apis.graphqlApis.length) {
            for (const api of apis.graphqlApis) {
                const myApiFolder = path.join(apiFolder, api.name || '.');
                if (!fs.existsSync(myApiFolder)) {
                    fs.mkdirSync(myApiFolder);
                }
                if (api.userPoolConfig) {
                    pools.downloadOne(api.userPoolConfig.userPoolId);
                }
                const dataSources = (yield appsync.listDataSources({ apiId: api.apiId || '' }).promise()).dataSources || [];
                roles.downloadMany(dataSources.map(({ serviceRoleArn }) => serviceRoleArn || ''));
                const types = (yield appsync.listTypes({ apiId: api.apiId || '', format: 'SDL' }).promise()).types || [];
                for (const type of types) {
                    const typeFolder = path.join(myApiFolder, type.name || '.');
                    if (!fs.existsSync(typeFolder)) {
                        fs.mkdirSync(typeFolder);
                    }
                    const resolvers = (yield appsync.listResolvers({ apiId: api.apiId || '', typeName: type.name || '' }).promise()).resolvers || [];
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
                    fs.writeFileSync(path.join(typeFolder, 'definition.gql'), prettier_1.format(type.definition || '', { parser: 'graphql' }).replace(/\n\n/g, '\n'));
                }
                const introspection = (yield appsync.getIntrospectionSchema({ apiId: api.apiId || '', format: 'JSON' }).promise()).schema || '';
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
    });
}
exports.downloadAll = downloadAll;
function uploadAll() {
    return __awaiter(this, void 0, void 0, function* () {
        const files = fs.readdirSync(apiFolder);
        if (files.length) {
            for (const file of files) {
                const api = JSON.parse(fs.readFileSync(path.join(apiFolder, file, 'configuration.json'), 'utf8'));
                yield appsync.updateGraphqlApi({
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
                    const dataSource = {
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
                    yield appsync.updateDataSource(dataSource).promise();
                }
                const typeFiles = fs.readdirSync(path.join(apiFolder, file));
                for (const typeFile of typeFiles) {
                    if (typeFile.indexOf('.json') < 0) {
                        const definition = fs.readFileSync(path.join(apiFolder, file, typeFile, 'definition.gql'), 'utf8');
                        const type = JSON.parse(fs.readFileSync(path.join(apiFolder, file, typeFile, 'configuration.json'), 'utf8'));
                        yield appsync.updateType({
                            apiId: api.apiId,
                            typeName: type.typeName,
                            format: 'SDL',
                            definition: definition,
                        }).promise();
                        for (const resolver of type.resolvers) {
                            const request = fs.readFileSync(path.join(apiFolder, file, typeFile, `${resolver.fieldName}.request.vtl`), 'utf8');
                            const response = fs.readFileSync(path.join(apiFolder, file, typeFile, `${resolver.fieldName}.response.vtl`), 'utf8');
                            yield appsync.updateResolver({
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
    });
}
exports.uploadAll = uploadAll;
function createDynamoDataSource(apiName, name, role) {
    return __awaiter(this, void 0, void 0, function* () {
        const api = JSON.parse(fs.readFileSync(path.join(apiFolder, apiName, 'configuration.json'), 'utf8'));
        yield appsync.createDataSource({
            apiId: api.apiId,
            name: name,
            type: 'AMAZON_DYNAMODB',
            dynamodbConfig: {
                awsRegion: config_1.config.region,
                tableName: name,
            },
            serviceRoleArn: role,
        }).promise();
        yield downloadAll();
    });
}
exports.createDynamoDataSource = createDynamoDataSource;
function createType(apiName, typeName, typeType) {
    return __awaiter(this, void 0, void 0, function* () {
        const api = JSON.parse(fs.readFileSync(path.join(apiFolder, apiName, 'configuration.json'), 'utf8'));
        yield appsync.createType({
            apiId: api.apiId,
            definition: `${typeType} ${typeName} {
      id: ID!
    }`,
            format: 'SDL',
        }).promise();
        yield downloadAll();
    });
}
exports.createType = createType;
function createResolver(apiName, type, field, dataSource) {
    return __awaiter(this, void 0, void 0, function* () {
        const api = JSON.parse(fs.readFileSync(path.join(apiFolder, apiName, 'configuration.json'), 'utf8'));
        yield appsync.createResolver({
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
        yield downloadAll();
    });
}
exports.createResolver = createResolver;
//# sourceMappingURL=api.js.map