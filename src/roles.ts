import * as fs from 'fs';
import * as path from 'path';
import * as AWS from 'aws-sdk';

import { base } from './config';

const iam = new AWS.IAM();
export const roleFolder = path.join(base, 'roles');

const last : (t : string[]) => string | undefined = (array) => array[array.length - 1];

export async function downloadOne(roleArn : string) {
  if (!fs.existsSync(roleFolder)) { fs.mkdirSync(roleFolder); }

  const RoleName = last(roleArn.split('/') || []) || '';
  const role = RoleName && (await iam.getRole({ RoleName }).promise()).Role;

  if (role) {
    const policies = await iam.listRolePolicies({ RoleName }).promise();
    const documents = await Promise.all(policies.PolicyNames.map(async (PolicyName) =>
      await iam.getRolePolicy({ RoleName, PolicyName }).promise()));

    fs.writeFileSync(path.join(roleFolder, `${role.RoleName}.json`), JSON.stringify({
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
}

export async function downloadMany(roleArns : string[]) {
  await Promise.all(roleArns.map(async (arn) => await downloadOne(arn)));
}

export async function uploadAll() {
  const files = fs.readdirSync(roleFolder);

  for (const file of files) {
    const role = JSON.parse(fs.readFileSync(path.join(roleFolder, file), 'utf8'));

    await iam.updateAssumeRolePolicy({
      RoleName: role.RoleName,
      PolicyDocument: JSON.stringify(role.AssumeRolePolicyDocument || ''),
    }).promise();

    if (role.PolicyDocuments) {
      for (const document of role.PolicyDocuments) {
        await iam.putRolePolicy({
          RoleName: role.RoleName,
          PolicyName: document.PolicyName,
          PolicyDocument: JSON.stringify(document.PolicyDocument || ''),
        }).promise();
      }
    }
  }
}

export async function createRole(name : string) {
  const res = await iam.createRole({
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
    await downloadOne(res.Role.Arn);
  }
}