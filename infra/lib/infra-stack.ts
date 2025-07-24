// lib/infra-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as apprunner from '@aws-cdk/aws-apprunner-alpha';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. ECR Repository erstellen
    const repo = new ecr.Repository(this, 'AppRepository', {
      repositoryName: 'bachelor-app-repo',
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [{ maxImageCount: 5 }]
    });

    /*
    // 2. App Runner Service
    new apprunner.Service(this, 'RestApiService', {
      serviceName: 'bachelor-rest-api',
      source: apprunner.Source.fromEcr({
        repository: repo,
        tagOrDigest: 'latest',
        imageConfiguration: { port: 8080 }
      }),
      autoDeploymentsEnabled: true,
      cpu: apprunner.Cpu.QUARTER_VCPU,
      memory: apprunner.Memory.HALF_GB,
    });
    */
  }
}