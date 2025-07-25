import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as apprunner from '@aws-cdk/aws-apprunner-alpha';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';

// Props-Interface für die Stack-Logik
interface InfraStackProps extends cdk.StackProps {
  isPreview: boolean;
  prNumber?: string;
}

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);

    // Namen für Prod vs. Preview
    const serviceName = props.isPreview ? 
      `bachelor-preview-pr-${props.prNumber}` : 'bachelor-rest-api';
    const repoName = props.isPreview ? 
      `bachelor-preview-repo-pr-${props.prNumber}` : 'bachelor-app-repo';
    const secretName = `bachelor-app/api-key`;

    // ECR Repository
    const repo = new ecr.Repository(this, 'AppRepository', {
      repositoryName: repoName,
      // Aufräum-Policy: Preview = Zerstören, Prod = Behalten
      removalPolicy: props.isPreview ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      // Preview: Auto-Delete Images bei Stack-Löschung
      emptyOnDelete: props.isPreview ? true : false,
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: props.isPreview ? 3 : 10 }]
    });

    // IAM-Rolle für App Runner
    const apprunnerInstanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
    });

    // X-Ray Berechtigungen hinzufügen
    apprunnerInstanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
    );

    // X-Ray Observability (nur Prod)
    const observability = props.isPreview ? undefined : new apprunner.ObservabilityConfiguration(this, 'Observability', {
      observabilityConfigurationName: 'bachelor-xray-config',
      traceConfigurationVendor: apprunner.TraceConfigurationVendor.AWSXRAY
    });

    // Secrets Manager (nur Prod)
    let apiSecret: secretsmanager.Secret | undefined;
    if (!props.isPreview) {
      apiSecret = new secretsmanager.Secret(this, 'ApiSecret', {
        secretName: secretName,
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ key: 'DEFAULT_KEY' }),
          generateStringKey: 'value',
          excludePunctuation: true,
          excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'\/@"\\',
        },
      });
      // Berechtigung für App Runner
      apiSecret.grantRead(apprunnerInstanceRole);
    }

    // App Runner Service
    const service = new apprunner.Service(this, 'RestApiService', {
      serviceName: serviceName,
      source: apprunner.Source.fromEcr({
        repository: repo,
        tagOrDigest: props.isPreview ? `pr-${props.prNumber}` : 'latest',
        imageConfiguration: {
          port: 8080,
          environmentSecrets: apiSecret ? {
            API_KEY: apprunner.Secret.fromSecretsManager(apiSecret, 'value'),
          } : undefined,
          environmentVariables: {
            NODE_ENV: props.isPreview ? 'development' : 'production',
          },
        },
      }),
      instanceRole: apprunnerInstanceRole,
      observabilityConfiguration: observability,
      healthCheck: apprunner.HealthCheck.http({
        path: '/',
        interval: cdk.Duration.seconds(10),
        timeout: cdk.Duration.seconds(5),
        healthyThreshold: 1,
        unhealthyThreshold: 3,
      }),
      cpu: apprunner.Cpu.QUARTER_VCPU,
      memory: apprunner.Memory.HALF_GB,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ServiceURL', {
      value: `https://${service.serviceUrl}`,
      description: props.isPreview ? 'URL der Preview-Umgebung' : 'URL der Produktionsumgebung',
    });

    new cdk.CfnOutput(this, 'ECRRepositoryURI', {
      value: repo.repositoryUri,
      description: 'ECR Repository URI',
    });
  }
}