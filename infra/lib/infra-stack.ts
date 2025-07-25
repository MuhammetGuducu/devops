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

    // Logischer Service-Name für ENV und Namensgebung von Secrets/Dashboards
    const logicalServiceName = props.isPreview
      ? `bachelor-preview-pr-${props.prNumber}`
      : 'bachelor-rest-api';
    const repoName = props.isPreview
      ? `bachelor-preview-repo-pr-${props.prNumber}`
      : 'bachelor-app-repo';

    // ECR Repository verwendet bestehende, wenn möglich
    const repo = ecr.Repository.fromRepositoryName(this, 'AppRepository', repoName)
      as ecr.Repository ||
      new ecr.Repository(this, 'AppRepository', {
        repositoryName: repoName,
        removalPolicy: props.isPreview ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
        emptyOnDelete: props.isPreview,
        imageScanOnPush: true,
        imageTagMutability: ecr.TagMutability.MUTABLE,
        lifecycleRules: [{
          description: 'Behalte nur die neuesten Images',
          maxImageCount: props.isPreview ? 3 : 20,
          rulePriority: 1,
        }],
      });

    // Tags für bessere Organisation
    cdk.Tags.of(repo).add('Project', 'Bachelor-DevOps');
    cdk.Tags.of(repo).add('Environment', props.isPreview ? 'preview' : 'production');

    // IAM-Rolle für App Runner
    const apprunnerInstanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
      description: 'Rolle für Bachelor Demo Service in App Runner',
    });
    apprunnerInstanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
    );
    apprunnerInstanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess')
    );

    // X-Ray Observability Configuration (nur Production)
    const observability = props.isPreview
      ? undefined
      : new apprunner.ObservabilityConfiguration(this, 'ObservabilityConfig', {
          observabilityConfigurationName: `${logicalServiceName}-xray`,
          traceConfigurationVendor: apprunner.TraceConfigurationVendor.AWSXRAY,
        });

    // Secrets Manager für API Keys (nur Production)
    let apiSecret: secretsmanager.Secret | undefined;
    if (!props.isPreview) {
      apiSecret = new secretsmanager.Secret(this, 'ApiSecret', {
        secretName: `${logicalServiceName}/api-key`,
        description: 'API Key für Bachelor Demo Service',
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ apiKey: 'DEMO-KEY', environment: 'production' }),
          generateStringKey: 'value',
          excludePunctuation: true,
          excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
          passwordLength: 32,
        },
      });
      apiSecret.grantRead(apprunnerInstanceRole);
    }

    // Umgebungsvariablen
    const environmentVariables: { [key: string]: string } = {
      NODE_ENV: props.isPreview ? 'preview' : 'production',
      AWS_REGION: this.region,
      SERVICE_NAME: logicalServiceName,
    };
    if (props.appVersion) {
      environmentVariables.APP_VERSION = props.appVersion;
    }
    if (props.commitSha) {
      environmentVariables.COMMIT_SHA = props.commitSha;
    }
    if (!props.isPreview) {
      environmentVariables.NEW_FEATURE = 'true';
      environmentVariables.DEBUG_MODE = 'false';
    }

    // App Runner Service
    const service = new apprunner.Service(this, 'AppRunnerService', {
      source: apprunner.Source.fromEcr({
        repository: repo,
        tagOrDigest: props.isPreview ? `pr-${props.prNumber}` : 'latest',
        imageConfiguration: {
          port: 8080,
          environmentVariables,
          environmentSecrets: apiSecret
            ? { API_KEY: apprunner.Secret.fromSecretsManager(apiSecret, 'value') }
            : undefined,
        },
      }),
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

    // CloudWatch Dashboard (nur Production)
    if (!props.isPreview) {
      new cloudwatch.Dashboard(this, 'ServiceDashboard', {
        dashboardName: `${logicalServiceName}-dashboard`,
        widgets: [[
          new cloudwatch.TextWidget({
            markdown: `# Bachelor DevOps Demo Dashboard\n\n**Environment:** Production\n**Region:** ${this.region}`,
            width: 24,
            height: 2,
          }),
        ]],
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'ServiceURL', {
      value: `https://${service.serviceUrl}`,
      description: props.isPreview ? 'Preview Environment URL' : 'Production Service URL',
      exportName: `${logicalServiceName}-url`,
    });
    new cdk.CfnOutput(this, 'ECRRepositoryURI', {
      value: repo.repositoryUri,
      description: 'ECR Repository URI',
      exportName: `${logicalServiceName}-ecr-uri`,
    });
    new cdk.CfnOutput(this, 'ServiceARN', {
      value: service.serviceArn,
      description: 'App Runner Service ARN',
    });

    // Stack Tags
    cdk.Tags.of(this).add('Project', 'Bachelor-DevOps-Demo');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('Environment', props.isPreview ? 'preview' : 'production');
  }
}
