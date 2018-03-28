import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as unzip from 'unzip-stream';
import * as zip from 'adm-zip';
import * as AWS from 'aws-sdk';

import { downloadOne } from './roles';
import { base } from './config';

const lambda = new AWS.Lambda();
export const funcFolder = path.join(base, 'functions');

export async function downloadAll() {
  if (!fs.existsSync(funcFolder)) { fs.mkdirSync(funcFolder); }

  const functions = (await lambda.listFunctions().promise()).Functions || [];
  for (const func of functions) {
    if (!fs.existsSync(path.join(funcFolder, func.FunctionName || '.'))) {
      fs.mkdirSync(path.join(funcFolder, func.FunctionName || '.'));
    }

    fs.writeFileSync(path.join(funcFolder, func.FunctionName || '.', 'configuration.json'), JSON.stringify({
      FunctionArn: func.FunctionArn,
      FunctionName: func.FunctionName,
      Description: func.Description,
      Handler: func.Handler,
      Runtime: func.Runtime,
      Timeout: func.Timeout,
      Role: func.Role,
    }, null, 2));

    if (func.Role) {
      await downloadOne(func.Role);
    }

    const funcFile = await lambda.getFunction({ FunctionName: func.FunctionName || '' }).promise();
    if (funcFile && funcFile.Code && funcFile.Code.Location) {
      https.get(funcFile.Code.Location, (res) =>
        res.pipe(unzip.Parse())
          .on('entry', (entry) =>
            entry.pipe(fs.createWriteStream(path.join(funcFolder, func.FunctionName || '.', entry.path)))));
    }
  }
}

export async function uploadAll() {
  const files = fs.readdirSync(funcFolder);

  for (const file of files) {
    const func = JSON.parse(fs.readFileSync(path.join(funcFolder, file, 'configuration.json'), 'utf8'));
    await lambda.updateFunctionConfiguration({
      FunctionName: func.FunctionName,
      Description: func.Description,
      Handler: func.Handler,
      Runtime: func.Runtime,
      Timeout: func.Timeout,
      Role: func.Role,
    }).promise();

    const funcFiles = fs.readdirSync(path.join(funcFolder, file)).filter((funcFile) => funcFile !== 'configuration.json');
    const archive = new zip();
    for (const funcFile of funcFiles) {
      archive.addLocalFile(path.join(funcFolder, file, funcFile));
    }
    const zipFile = archive.toBuffer();

    await lambda.updateFunctionCode({
      FunctionName: func.FunctionName,
      Publish: true,
      ZipFile: zipFile,
    }).promise();
  }
}