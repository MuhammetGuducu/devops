import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as apprunner from '@aws-cdk/aws-apprunner-alpha';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

interface InfraStackProps extends cdk.StackProps {
  isPreview: boolean;
  prNumber?: string;
  appVersion?: string;
  commitSha?: string;
}

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);

    const serviceName = props.isPreview ?
      `bachelor-preview-pr-${props.prNumber}` : 'bachelor-rest-api';

    const repoName = props.isPreview ?
      'devops-demo-preview-shared' : 'bachelor-app-repo';

    // Reference existing repository
    const repo = ecr.Repository.fromRepositoryName(this, 'AppRepository', repoName);

    // App Runner Access Role to pull images from ECR
    const appRunnerAccessRole = new iam.Role(this, 'AppRunnerAccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      description: 'Access role for App Runner to pull images from ECR',
      inlinePolicies: {
        ECRAccessPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ecr:GetAuthorizationToken',
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
                'ecr:DescribeRepositories'
              ],
              resources: ['*']
            })
          ]
        })
      }
    });

    // IAM Role for the App Runner Instance itself
    const apprunnerInstanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
      description: 'Rolle für Bachelor Demo Service in App Runner',
    });

    // Add permissions to the instance role
    apprunnerInstanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
    );
    apprunnerInstanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess')
    );

    // X-Ray Observability Configuration (nur Production)
    const observability = props.isPreview ? undefined :
      new apprunner.ObservabilityConfiguration(this, 'ObservabilityConfig', {
        observabilityConfigurationName: `${serviceName}-xray`,
        traceConfigurationVendor: apprunner.TraceConfigurationVendor.AWSXRAY
      });

    // Secrets Manager for API Keys (nur Production)
    let apiSecret: secretsmanager.Secret | undefined;
    if (!props.isPreview) {
      apiSecret = new secretsmanager.Secret(this, 'ApiSecret', {
        secretName: `${serviceName}/api-key`,
        description: 'API Key für Bachelor Demo Service',
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            apiKey: 'DEMO-KEY',
            environment: 'production'
          }),
          generateStringKey: 'value',
          excludePunctuation: true,
          excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'\/@"\\',
          passwordLength: 32
        },
      });
      apiSecret.grantRead(apprunnerInstanceRole);
    }

    // Environment variables to be passed to the container
    const environmentVariables: { [key: string]: string } = {
      NODE_ENV: props.isPreview ? 'preview' : 'production',
      AWS_REGION: this.region,
      SERVICE_NAME: serviceName,
      COMMIT_SHA: props.commitSha || 'local', // Forces deployment on every commit
    };
    if (props.appVersion) {
      environmentVariables.APP_VERSION = props.appVersion;
    }
    if (!props.isPreview) {
      environmentVariables.NEW_FEATURE = 'true';
      environmentVariables.DEBUG_MODE = 'false';
    }

    // App Runner Service Definition
    const service = new apprunner.Service(this, 'AppRunnerService', {
      serviceName: serviceName,
      source: apprunner.Source.fromEcr({
        repository: repo,
        tagOrDigest: props.isPreview ? `pr-${props.prNumber}` : 'latest',
        imageConfiguration: {
          port: 8080,
          environmentVariables,
          environmentSecrets: apiSecret ? {
            API_KEY: apprunner.Secret.fromSecretsManager(apiSecret, 'value'),
          } : undefined,
        },
      }),
      accessRole: appRunnerAccessRole,
      instanceRole: apprunnerInstanceRole,
      observabilityConfiguration: observability,
      healthCheck: apprunner.HealthCheck.http({
        path: '/health',
        interval: cdk.Duration.seconds(20),
        timeout: cdk.Duration.seconds(10),
        healthyThreshold: 2,
        unhealthyThreshold: 5,
      }),
      cpu: apprunner.Cpu.QUARTER_VCPU,
      memory: apprunner.Memory.HALF_GB,
      autoDeploymentsEnabled: false,
    });

    // CloudWatch Dashboard (nur bei Productionsumgebung)
    if (!props.isPreview) {
      new cloudwatch.Dashboard(this, 'ServiceDashboard', {
        dashboardName: `${serviceName}-dashboard`,
        widgets: [[
          new cloudwatch.TextWidget({
            markdown: `# Bachelor DevOps Demo Dashboard\n\n**Environment:** Production\n**Region:** ${this.region}`,
            width: 24,
            height: 2
          })
        ]]
      });
    }

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'ServiceURL', {
      value: `https://${service.serviceUrl}`,
      description: props.isPreview ? 'Preview Environment URL' : 'Production Service URL',
      exportName: `${serviceName}-url`,
    });

    new cdk.CfnOutput(this, 'ECRRepositoryURI', {
      value: repo.repositoryUri,
      description: 'ECR Repository URI',
      exportName: `${serviceName}-ecr-uri`,
    });

    new cdk.CfnOutput(this, 'ServiceARN', {
      value: service.serviceArn,
      description: 'App Runner Service ARN',
    });

    // Stack Tags for organization and cost tracking
    cdk.Tags.of(this).add('Project', 'Bachelor-DevOps-Demo');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('Environment', props.isPreview ? 'preview' : 'production');
  }
}