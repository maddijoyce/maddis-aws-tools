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
            }
        }
    });
}
exports.uploadAll = uploadAll;
//# sourceMappingURL=api.js.map