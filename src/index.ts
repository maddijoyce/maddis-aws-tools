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
  .description('Download one or more services')
  .option('-v, --verbose', 'More detailed logs')
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
  .description('Upload one or more services')
  .option('-v, --verbose', 'More detailed logs')
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
  .command('create-type <api> <name>')
  .option('-t, --type <type>', 'type type')
  .action((api, name, options) => {
    apis.createType(api, name, options.type || 'type');
  });

program
  .command('create-resolver <api> <type> <field> <dataSource>')
  .action((api, type, field, dataSource) => {
    apis.createResolver(api, type, field, dataSource);
  });

program
  .command('create-datasource <api> <dataSource> <role>')
  .option('-t, --type <type>', 'data source type')
  .description('Create AppSync data source')
  .action((api, dataSource, role, options) => {
    if (options.type === 'dynamo') {
      apis.createDynamoDataSource(api, dataSource, role);
    }
  });

program
  .command('create-role <name>')
  .description('Create iam role')
  .action((name) => {
    roles.createRole(name);
  });

program
  .command('create-table <name> <hash> [range]')
  .description('Create dynamodb table')
  .option('-h, --hash <type>', 'hash key type')
  .option('-r, --range <type>', 'range key type')
  .action((name, hash, range, options) => {
    dynamos.createTable(name, {
      hash: { name: hash, type: (dynamos.typeToInitial(options.hash || 'S')) },
      range: range && { name: range, type: (dynamos.typeToInitial(options.range || 'S')) },
    });
  });

  program
  .command('create-index <table> <name> <hash> [range]')
  .description('Create dynamodb table')
  .option('-h, --hash <type>', 'hash key type')
  .option('-r, --range <type>', 'range key type')
  .action((table, name, hash, range, options) => {
    dynamos.addIndex(table, name, {
      hash: { name: hash, type: (dynamos.typeToInitial(options.hash || 'S')) },
      range: range && { name: range, type: (dynamos.typeToInitial(options.range || 'S')) },
    });
  });


program
  .command('*', '', { noHelp: true })
  .action((command) => {
    console.log(`${command}: command not found`);
    program.help();
  });

program.parse(process.argv);