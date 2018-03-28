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
const config_1 = require("./config");
const iam = new AWS.IAM();
exports.roleFolder = path.join(config_1.base, 'roles');
const last = (array) => array[array.length - 1];
function downloadOne(roleArn) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs.existsSync(exports.roleFolder)) {
            fs.mkdirSync(exports.roleFolder);
        }
        const RoleName = last(roleArn.split('/') || []) || '';
        const role = RoleName && (yield iam.getRole({ RoleName }).promise()).Role;
        if (role) {
            const policies = yield iam.listRolePolicies({ RoleName }).promise();
            const documents = yield Promise.all(policies.PolicyNames.map((PolicyName) => __awaiter(this, void 0, void 0, function* () { return yield iam.getRolePolicy({ RoleName, PolicyName }).promise(); })));
            fs.writeFileSync(path.join(exports.roleFolder, `${role.RoleName}.json`), JSON.stringify({
                Path: role.Path,
                RoleName: role.RoleName,
                RoleId: role.RoleId,
                Arn: role.Arn,
                AssumeRolePolicyDocument: JSON.parse(decodeURIComponent(role.AssumeRolePolicyDocument || '')),
                PolicyDocuments: documents.map(({ PolicyName, PolicyDocument }) => ({
                    PolicyName,
                    PolicyDocument: JSON.parse(decodeURIComponent(PolicyDocument || '')),
                })),
            }, null, 2));
        }
    });
}
exports.downloadOne = downloadOne;
function downloadMany(roleArns) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all(roleArns.map((arn) => __awaiter(this, void 0, void 0, function* () { return yield downloadOne(arn); })));
    });
}
exports.downloadMany = downloadMany;
function uploadAll() {
    return __awaiter(this, void 0, void 0, function* () {
        const files = fs.readdirSync(exports.roleFolder);
        for (const file of files) {
            const role = JSON.parse(fs.readFileSync(path.join(exports.roleFolder, file), 'utf8'));
            yield iam.updateAssumeRolePolicy({
                RoleName: role.RoleName,
                PolicyDocument: JSON.stringify(role.AssumeRolePolicyDocument || ''),
            }).promise();
            if (role.PolicyDocuments) {
                for (const document of role.PolicyDocuments) {
                    yield iam.putRolePolicy({
                        RoleName: role.RoleName,
                        PolicyName: document.PolicyName,
                        PolicyDocument: JSON.stringify(document.PolicyDocument || ''),
                    }).promise();
                }
            }
        }
    });
}
exports.uploadAll = uploadAll;
function createRole(name) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield iam.createRole({
            RoleName: name,
            AssumeRolePolicyDocument: JSON.stringify({
                Version: '2012-10-17',
                Statement: [{
                        Effect: 'Allow',
                        Principal: { Service: 'appsync.amazonaws.com' },
                        Action: 'sts:AssumeRole',
                    }],
            }),
        }).promise();
        if (res.Role) {
            yield downloadOne(res.Role.Arn);
        }
    });
}
exports.createRole = createRole;
//# sourceMappingURL=roles.js.map