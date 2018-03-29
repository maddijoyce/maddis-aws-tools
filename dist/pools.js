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
const roles = require("./roles");
const config_1 = require("./config");
const identity = new AWS.CognitoIdentity();
exports.cognito = new AWS.CognitoIdentityServiceProvider();
exports.poolFolder = path.join(config_1.base, 'pools');
function downloadOne(id) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs.existsSync(exports.poolFolder)) {
            fs.mkdirSync(exports.poolFolder);
        }
        const idPoolIds = yield identity.listIdentityPools({ MaxResults: 10 }).promise();
        const idPools = yield Promise.all((idPoolIds.IdentityPools || []).map(({ IdentityPoolId }) => __awaiter(this, void 0, void 0, function* () {
            return (yield identity.describeIdentityPool({ IdentityPoolId: IdentityPoolId || '' }).promise());
        })));
        const pool = (yield exports.cognito.describeUserPool({ UserPoolId: id, }).promise()).UserPool;
        const clients = (yield exports.cognito.listUserPoolClients({ UserPoolId: id, MaxResults: 10 }).promise()).UserPoolClients || [];
        if (pool) {
            fs.writeFileSync(path.join(exports.poolFolder, `${pool.Id}.json`), JSON.stringify({
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
            const idPool = idPools.find(({ CognitoIdentityProviders }) => !!(CognitoIdentityProviders || []).find(({ ProviderName }) => ((ProviderName || '').indexOf(pool.Id || 'ID NOT FOUND') >= 0)));
            if (idPool) {
                const idPoolRoles = yield identity.getIdentityPoolRoles({ IdentityPoolId: idPool.IdentityPoolId }).promise();
                yield roles.downloadMany(Object.values(idPoolRoles.Roles || {}));
                fs.writeFileSync(path.join(exports.poolFolder, `${idPool.IdentityPoolId}.json`), JSON.stringify({
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
    });
}
exports.downloadOne = downloadOne;
function downloadMany(ids) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all(ids.map((id) => __awaiter(this, void 0, void 0, function* () { return yield downloadOne(id); })));
    });
}
exports.downloadMany = downloadMany;
function uploadAll() {
    return __awaiter(this, void 0, void 0, function* () {
        const files = fs.readdirSync(exports.poolFolder);
        for (const file of files) {
            const pool = JSON.parse(fs.readFileSync(path.join(exports.poolFolder, file), 'utf8'));
            if (pool && pool.Id) {
                yield exports.cognito.updateUserPool({
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
            }
            else if (pool && pool.IdentityPoolId) {
                const idPool = pool;
                yield identity.updateIdentityPool({
                    IdentityPoolId: idPool.IdentityPoolId,
                    IdentityPoolName: idPool.IdentityPoolName,
                    AllowUnauthenticatedIdentities: idPool.AllowUnauthenticatedIdentities,
                    CognitoIdentityProviders: (idPool.CognitoIdentityProviders || []).map((provider) => ({
                        ProviderName: provider.ProviderName,
                        ClientId: provider.ClientId,
                        ServerSideTokenCheck: provider.ServerSideTokenCheck,
                    })),
                }).promise();
                if (idPool.Roles) {
                    yield identity.setIdentityPoolRoles({
                        IdentityPoolId: idPool.IdentityPoolId,
                        Roles: idPool.Roles,
                    }).promise();
                }
            }
        }
    });
}
exports.uploadAll = uploadAll;
//# sourceMappingURL=pools.js.map