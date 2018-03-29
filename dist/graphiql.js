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
const koa = require("koa");
const koaApollo = require("apollo-server-koa");
const config_1 = require("./config");
const api_1 = require("./api");
const pools_1 = require("./pools");
function start(apiName, clientName, port, username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        const api = JSON.parse(fs.readFileSync(path.join(api_1.apiFolder, apiName, 'configuration.json'), 'utf8'));
        const pool = JSON.parse(fs.readFileSync(path.join(pools_1.poolFolder, `${api.userPoolConfig.userPoolId}.json`), 'utf8'));
        const client = pool.Clients.find((c) => (c.ClientName === clientName));
        const auth = (yield pools_1.cognito.adminInitiateAuth({
            AuthFlow: 'ADMIN_NO_SRP_AUTH',
            UserPoolId: pool.Id,
            ClientId: client.ClientId,
            AuthParameters: {
                USERNAME: username || config_1.config.username,
                PASSWORD: password || config_1.config.password,
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
        }
        else {
            console.log('Login Failed');
        }
    });
}
exports.start = start;
//# sourceMappingURL=graphiql.js.map