#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();

// Lese die Pull-Request-Nummer aus dem Kontext, der von der GitHub Action übergeben wird
const prNumber = app.node.tryGetContext('pr_number');

if (prNumber) {
  // Wenn eine PR-Nummer vorhanden ist, erstelle einen temporären Preview-Stack
  new InfraStack(app, `BachelorPreviewStack-PR${prNumber}`, {
    stackName: `bachelor-preview-pr-${prNumber}`,
    isPreview: true,
    prNumber: prNumber,
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  });
} else {
  // Andernfalls erstelle den permanenten Produktions-Stack
  new InfraStack(app, 'BachelorProdStack', {
    stackName: 'bachelor-prod-stack',
    isPreview: false,
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  });
}
