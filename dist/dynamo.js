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
const dynamo = new AWS.DynamoDB();
exports.tableFolder = path.join(config_1.base, 'tables');
function downloadAll() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs.existsSync(exports.tableFolder)) {
            fs.mkdirSync(exports.tableFolder);
        }
        const tableNames = (yield dynamo.listTables().promise()).TableNames || [];
        for (const tableName of tableNames) {
            const table = (yield dynamo.describeTable({ TableName: tableName }).promise()).Table;
            if (table) {
                fs.writeFileSync(path.join(exports.tableFolder, `${table.TableName}.json`), JSON.stringify({
                    TableArn: table.TableArn,
                    TableName: table.TableName,
                    AttributeDefinitions: (table.AttributeDefinitions || []).map((definition) => ({
                        AttributeName: definition.AttributeName,
                        AttributeType: definition.AttributeType,
                    })),
                    KeySchema: (table.KeySchema || []).map((schema) => ({
                        AttributeName: schema.AttributeName,
                        KeyType: schema.KeyType,
                    })),
                    ProvisionedThroughput: table.ProvisionedThroughput && {
                        ReadCapacityUnits: table.ProvisionedThroughput.ReadCapacityUnits,
                        WriteCapacityUnits: table.ProvisionedThroughput.WriteCapacityUnits,
                    },
                    LocalSecondaryIndexes: (table.LocalSecondaryIndexes || []).map((index) => ({
                        IndexArn: index.IndexArn,
                        IndexName: index.IndexName,
                        Projection: index.Projection && {
                            ProjectionType: index.Projection.ProjectionType,
                            NonKeyAttributes: index.Projection.NonKeyAttributes,
                        },
                        KeySchema: (index.KeySchema || []).map((schema) => ({
                            AttributeName: schema.AttributeName,
                            KeyType: schema.KeyType,
                        })),
                    })),
                    GlobalSecondaryIndexes: (table.GlobalSecondaryIndexes || []).map((index) => ({
                        IndexArn: index.IndexArn,
                        IndexName: index.IndexName,
                        Projection: index.Projection && {
                            ProjectionType: index.Projection.ProjectionType,
                            NonKeyAttributes: index.Projection.NonKeyAttributes,
                        },
                        KeySchema: (index.KeySchema || []).map((schema) => ({
                            AttributeName: schema.AttributeName,
                            KeyType: schema.KeyType,
                        })),
                        ProvisionedThroughput: index.ProvisionedThroughput && {
                            ReadCapacityUnits: index.ProvisionedThroughput.ReadCapacityUnits,
                            WriteCapacityUnits: index.ProvisionedThroughput.WriteCapacityUnits,
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
        const files = fs.readdirSync(exports.tableFolder);
        for (const file of files) {
            const table = JSON.parse(fs.readFileSync(path.join(exports.tableFolder, file), 'utf8'));
            try {
                yield dynamo.updateTable({
                    TableName: table.TableName,
                    AttributeDefinitions: (table.AttributeDefinitions || []).map((definition) => ({
                        AttributeName: definition.AttributeName,
                        AttributeType: definition.AttributeType,
                    })),
                    ProvisionedThroughput: table.ProvisionedThroughput && {
                        ReadCapacityUnits: table.ProvisionedThroughput.ReadCapacityUnits,
                        WriteCapacityUnits: table.ProvisionedThroughput.WriteCapacityUnits,
                    },
                }).promise();
            }
            catch (e) {
                if (!e.message.match(/provisioned throughput for the table will not change/)) {
                    throw e;
                }
            }
        }
    });
}
exports.uploadAll = uploadAll;
function createTable(name, keys) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            TableName: name,
            AttributeDefinitions: [{ AttributeName: keys.hash.name, AttributeType: keys.hash.type }],
            KeySchema: [{ AttributeName: keys.hash.name, KeyType: 'HASH' }],
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1,
            },
        };
        if (keys.range) {
            params.AttributeDefinitions.push({ AttributeName: keys.range.name, AttributeType: keys.range.type });
            params.KeySchema.push({ AttributeName: keys.range.name, KeyType: 'RANGE' });
        }
        yield dynamo.createTable(params).promise();
        yield downloadAll();
    });
}
exports.createTable = createTable;
createTable('test', { hash: { name: 'id', type: 'S' } });
//# sourceMappingURL=dynamo.js.map