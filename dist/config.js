"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const AWS = require("aws-sdk");
const dotenv = require("dotenv");
const rcfile = dotenv.config({ path: path.resolve(process.cwd(), '.maddirc') });
if (rcfile.error) {
    throw new Error('.maddirc file not found');
}
const parsedrc = rcfile.parsed;
exports.config = {
    accessKeyId: parsedrc.AWS_ID,
    secretAccessKey: parsedrc.AWS_SECRET,
    region: parsedrc.AWS_REGION,
    directory: parsedrc.CONFIG_DIR || 'config',
    username: parsedrc.GQL_USERNAME,
    password: parsedrc.GQL_PASSWORD,
};
exports.base = path.join(process.cwd(), exports.config.directory);
if (!fs.existsSync(exports.base)) {
    fs.mkdirSync(exports.base);
}
AWS.config.update({
    accessKeyId: exports.config.accessKeyId,
    secretAccessKey: exports.config.secretAccessKey,
    region: exports.config.region,
    apiVersions: {
        appsync: '2017-07-25',
    },
});
exports.default = exports.config;
//# sourceMappingURL=config.js.map