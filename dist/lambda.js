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
const https = require("https");
const path = require("path");
const unzip = require("unzip-stream");
const zip = require("adm-zip");
const AWS = require("aws-sdk");
const roles_1 = require("./roles");
const config_1 = require("./config");
const lambda = new AWS.Lambda();
exports.funcFolder = path.join(config_1.base, 'functions');
function downloadAll() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs.existsSync(exports.funcFolder)) {
            fs.mkdirSync(exports.funcFolder);
        }
        const functions = (yield lambda.listFunctions().promise()).Functions || [];
        for (const func of functions) {
            if (!fs.existsSync(path.join(exports.funcFolder, func.FunctionName || '.'))) {
                fs.mkdirSync(path.join(exports.funcFolder, func.FunctionName || '.'));
            }
            fs.writeFileSync(path.join(exports.funcFolder, func.FunctionName || '.', 'configuration.json'), JSON.stringify({
                FunctionArn: func.FunctionArn,
                FunctionName: func.FunctionName,
                Description: func.Description,
                Handler: func.Handler,
                Runtime: func.Runtime,
                Timeout: func.Timeout,
                Role: func.Role,
            }, null, 2));
            if (func.Role) {
                yield roles_1.downloadOne(func.Role);
            }
            const funcFile = yield lambda.getFunction({ FunctionName: func.FunctionName || '' }).promise();
            if (funcFile && funcFile.Code && funcFile.Code.Location) {
                https.get(funcFile.Code.Location, (res) => res.pipe(unzip.Parse())
                    .on('entry', (entry) => entry.pipe(fs.createWriteStream(path.join(exports.funcFolder, func.FunctionName || '.', entry.path)))));
            }
        }
    });
}
exports.downloadAll = downloadAll;
function uploadAll() {
    return __awaiter(this, void 0, void 0, function* () {
        const files = fs.readdirSync(exports.funcFolder);
        for (const file of files) {
            const func = JSON.parse(fs.readFileSync(path.join(exports.funcFolder, file, 'configuration.json'), 'utf8'));
            yield lambda.updateFunctionConfiguration({
                FunctionName: func.FunctionName,
                Description: func.Description,
                Handler: func.Handler,
                Runtime: func.Runtime,
                Timeout: func.Timeout,
                Role: func.Role,
            }).promise();
            const funcFiles = fs.readdirSync(path.join(exports.funcFolder, file)).filter((funcFile) => funcFile !== 'configuration.json');
            const archive = new zip();
            for (const funcFile of funcFiles) {
                archive.addLocalFile(path.join(exports.funcFolder, file, funcFile));
            }
            const zipFile = archive.toBuffer();
            yield lambda.updateFunctionCode({
                FunctionName: func.FunctionName,
                Publish: true,
                ZipFile: zipFile,
            }).promise();
        }
    });
}
exports.uploadAll = uploadAll;
//# sourceMappingURL=lambda.js.map