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
      `devops-demo-preview-pr-${props.prNumber}` : 'devops-demo-service';
    const repoName = props.isPreview ? 
      `devops-demo-preview-repo-pr-${props.prNumber}` : 'devops-demo-repo';

    // ECR Repository mit erweiterten Tags
    const repo = new ecr.Repository(this, 'AppRepository', {
      repositoryName: repoName,
      removalPolicy: props.isPreview ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      emptyOnDelete: props.isPreview,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      lifecycleRules: [{
        description: 'Behalte nur die neuesten Images',
        maxImageCount: props.isPreview ? 3 : 20,
        rulePriority: 1
      }]
    });

    // Tags für bessere Organisation
    cdk.Tags.of(repo).add('Project', 'Bachelor-DevOps');
    cdk.Tags.of(repo).add('Environment', props.isPreview ? 'preview' : 'production');

    // IAM-Rolle für App Runner mit erweiterten Berechtigungen
    const apprunnerInstanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
      description: 'Rolle für DevOps Demo Service in App Runner',
    });

    // Berechtigungen
    apprunnerInstanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
    );
    apprunnerInstanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess')
    );

    // X-Ray Observability Configuration
    const observability = props.isPreview ? undefined : 
      new apprunner.ObservabilityConfiguration(this, 'ObservabilityConfig', {
        observabilityConfigurationName: `${serviceName}-xray`,
        traceConfigurationVendor: apprunner.TraceConfigurationVendor.AWSXRAY
      });

    // Secrets Manager für API Keys
    let apiSecret: secretsmanager.Secret | undefined;
    if (!props.isPreview) {
      apiSecret = new secretsmanager.Secret(this, 'ApiSecret', {
        secretName: `${serviceName}/api-key`,
        description: 'API Key für DevOps Demo Service',
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

    // Umgebungsvariablen
    const environmentVariables: { [key: string]: string } = {
      NODE_ENV: props.isPreview ? 'preview' : 'production',
      AWS_REGION: this.region,
      SERVICE_NAME: serviceName,
    };

    // Version und Commit SHA hinzufügen wenn verfügbar
    if (props.appVersion) {
      environmentVariables.APP_VERSION = props.appVersion;
    }
    if (props.commitSha) {
      environmentVariables.COMMIT_SHA = props.commitSha;
    }

    // Feature Flags für Demo
    if (!props.isPreview) {
      environmentVariables.NEW_FEATURE = 'true';
      environmentVariables.DEBUG_MODE = 'false';
    }

    // App Runner Service mit erweiterten Konfigurationen
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
      instanceRole: apprunnerInstanceRole,
      observabilityConfiguration: observability,
      healthCheck: apprunner.HealthCheck.http({
        path: '/health',
        interval: cdk.Duration.seconds(10),
        timeout: cdk.Duration.seconds(5),
        healthyThreshold: 1,
        unhealthyThreshold: 3,
      }),
      cpu: apprunner.Cpu.QUARTER_VCPU,
      memory: apprunner.Memory.HALF_GB,
      autoDeploymentsEnabled: !props.isPreview,
    });

    // CloudWatch Dashboard (nur Production)
    if (!props.isPreview) {
      const dashboard = new cloudwatch.Dashboard(this, 'ServiceDashboard', {
        dashboardName: `${serviceName}-dashboard`,
        widgets: [[
          new cloudwatch.TextWidget({
            markdown: `# DevOps Demo Service Dashboard\n\n**Environment:** Production\n**Region:** ${this.region}`,
            width: 24,
            height: 2
          })
        ]]
      });
    }

    // Outputs
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

    // Stack Tags
    cdk.Tags.of(this).add('Project', 'Bachelor-DevOps-Demo');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('Environment', props.isPreview ? 'preview' : 'production');
  }
}