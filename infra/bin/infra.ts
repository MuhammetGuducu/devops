#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();

// Lese Context-Werte
const prNumber = app.node.tryGetContext('pr_number');
const appVersion = app.node.tryGetContext('appVersion');
const commitSha = app.node.tryGetContext('commitSha');
const isPreview = app.node.tryGetContext('isPreview') === 'true';

if (prNumber) {
  // Preview-Stack für Pull Request
  new InfraStack(app, `BachelorPreviewStack-PR${prNumber}`, {
    stackName: `bachelor-preview-pr-${prNumber}`,
    isPreview: true,
    prNumber: prNumber,
    appVersion: appVersion,
    commitSha: commitSha,
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'eu-central-1',
    },
  });
} else {
  // Produktions-Stack
  new InfraStack(app, 'BachelorProdStack', {
    stackName: 'bachelor-prod-stack',
    isPreview: false,
    appVersion: appVersion,
    commitSha: commitSha,
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'eu-central-1',
    },
  });
}