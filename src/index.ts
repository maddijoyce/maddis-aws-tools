#!/usr/bin/env node
import * as program from 'commander';
import * as AWS from 'aws-sdk';

import * as apis from './api';
import * as lambdas from './lambda';
import * as pools from './pools';
import * as roles from './roles';
import * as dynamos from './dynamo';

program
  .command('download [services...]')
  .option('-v, --verbose', 'More detailed logs')
  .description('Download one or more services')
  .action((services, options) => {
    if (options.verbose) {
      AWS.config.update({ logger: console });
    }
    if (services.length === 0 || services.indexOf('apis') >= 0) { apis.downloadAll(); }
    if (services.length === 0 || services.indexOf('lambdas') >= 0) { lambdas.downloadAll(); }
    if (services.length === 0 || services.indexOf('dynamos') >= 0) { dynamos.downloadAll(); }
  });

program
  .command('upload [services...]')
  .option('-v, --verbose', 'More detailed logs')
  .description('Upload one or more services')
  .action((services, options) => {
    if (options.verbose) {
      AWS.config.update({ logger: console });
    }
    if (services.length === 0 || services.indexOf('apis') >= 0) { apis.uploadAll(); }
    if (services.length === 0 || services.indexOf('lambdas') >= 0) { lambdas.uploadAll(); }
    if (services.length === 0 || services.indexOf('pools') >= 0) { pools.uploadAll(); }
    if (services.length === 0 || services.indexOf('roles') >= 0) { roles.uploadAll(); }
    if (services.length === 0 || services.indexOf('dynamos') >= 0) { dynamos.uploadAll(); }
  });

program
  .command('*', '', { noHelp: true })
  .action((command) => {
    console.log(`${command}: command not found`);
    program.help();
  });

program.parse(process.argv);