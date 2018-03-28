import * as fs from 'fs';
import * as path from 'path';
import * as AWS from 'aws-sdk';

import { base } from './config';

const dynamo = new AWS.DynamoDB();
export const tableFolder = path.join(base, 'tables');

export async function downloadAll() {
  if (!fs.existsSync(tableFolder)) { fs.mkdirSync(tableFolder); }

  const tableNames = (await dynamo.listTables().promise()).TableNames || [];
  for (const tableName of tableNames) {
    const table = (await dynamo.describeTable({ TableName: tableName }).promise()).Table;

    if (table) {
      fs.writeFileSync(path.join(tableFolder, `${table.TableName}.json`), JSON.stringify({
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
}

export async function uploadAll() {
  const files = fs.readdirSync(tableFolder);

  for (const file of files) {
    const table = JSON.parse(fs.readFileSync(path.join(tableFolder, file), 'utf8'));

    try {
      await dynamo.updateTable({
        TableName: table.TableName,
        AttributeDefinitions: (table.AttributeDefinitions || []).map((definition : any) => ({
          AttributeName: definition.AttributeName,
          AttributeType: definition.AttributeType,
        })),
        ProvisionedThroughput: table.ProvisionedThroughput && {
          ReadCapacityUnits: table.ProvisionedThroughput.ReadCapacityUnits,
          WriteCapacityUnits: table.ProvisionedThroughput.WriteCapacityUnits,
        },
      }).promise();
    } catch (e) {
      if (!e.message.match(/provisioned throughput for the table will not change/)) {
        throw e;
      }
    }
  }
}

type TableKey = { name : string; type : 'S' | 'N' | 'B'; };
type TableKeys = { hash : TableKey; range? : TableKey; };

export async function createTable(name : string, keys : TableKeys) {
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

  await dynamo.createTable(params).promise();
  await downloadAll();
}

export async function addIndex(tableName : string, indexName : string, keys : TableKeys) {
  const table = JSON.parse(fs.readFileSync(path.join(tableFolder, `${tableName}.json`), 'utf8'));

  const params = {
    TableName: table.TableName,
    AttributeDefinitions: table.AttributeDefinitions,
    GlobalSecondaryIndexUpdates: [{
      Create: {
        IndexName: indexName,
        KeySchema: [{
          AttributeName: keys.hash.name,
          KeyType: 'HASH',
        }],
        Projection: {
          ProjectionType: 'ALL',
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 1,
          WriteCapacityUnits: 1,
        }
      },
    }],
  };
  if (!params.AttributeDefinitions.find((d : any) => (d.AttributeName === keys.hash.name))) {
    params.AttributeDefinitions.push({
      AttributeName: keys.hash.name,
      AttributeType: keys.hash.type,
    });
  }
  if (keys.range) {
    if (!params.AttributeDefinitions.find((d : any) => (keys.range && d.AttributeName === keys.range.name))) {
      params.AttributeDefinitions.push({
        AttributeName: keys.range.name,
        AttributeType: keys.range.type,
      });
    }
    params.GlobalSecondaryIndexUpdates[0].Create.KeySchema.push({
      AttributeName: keys.range.name,
      KeyType: 'RANGE',
    });
  }

  await dynamo.updateTable(params).promise();
  await downloadAll();
}

export const typeToInitial = (type : string) : 'S' | 'N' | 'B' => {
  const char = type.charAt(0).toLocaleUpperCase();

  if (char === 'S' || char === 'N' || char === 'B') {
    return char;
  } else {
    throw new Error(`${type} not available (number, string or binary)`);
  }
};