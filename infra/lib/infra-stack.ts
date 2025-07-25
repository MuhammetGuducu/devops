import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as apprunner from '@aws-cdk/aws-apprunner-alpha';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

// Props-Interface für Stack-Logik
interface InfraStackProps extends cdk.StackProps {
  isPreview: boolean;
  prNumber?: string;
}

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);

    // Namen für Prod vs. Preview
    const serviceName = props.isPreview ? `bachelor-preview-pr-${props.prNumber}` : 'bachelor-rest-api';
    const repoName = props.isPreview ? `bachelor-preview-repo-pr-${props.prNumber}` : 'bachelor-app-repo';
    const secretName = `bachelor-app/api-key`;

    // 1. ECR Repository
    const repo = new ecr.Repository(this, 'AppRepository', {
      repositoryName: repoName,
      // Aufräum-Policy: Preview = Zerstören, Prod = Behalten
      removalPolicy: props.isPreview ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 5 }]
    });

    // 2. Observability mit X-Ray (nur für Prod)
    const observability = props.isPreview ? undefined : new apprunner.ObservabilityConfiguration(this, 'Observability', {
      observabilityConfigurationName: 'bachelor-xray-config',
      traceConfiguration: {
        vendor: apprunner.TraceVendor.AWSXRAY
      }
    });

    // 3. Secrets Manager (nur für Prod)
    const apiSecret = props.isPreview ? undefined : new secretsmanager.Secret(this, 'ApiSecret', {
      secretName: secretName,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ key: 'DEFAULT_KEY' }),
        generateStringKey: 'value',
        excludePunctuation: true,
      },
    });

    // 4. App Runner Service
    const service = new apprunner.Service(this, 'RestApiService', {
      serviceName: serviceName,
      source: apprunner.Source.fromEcr({
        repository: repo,
        tagOrDigest: 'latest',
        imageConfiguration: {
          port: 8080,
          // Secret nur in Prod-Umgebung injizieren
          environmentSecrets: apiSecret ? {
            API_KEY: apprunner.Secret.fromSecretsManager(apiSecret, 'value'),
          } : undefined,
        },
      }),
      // X-Ray nur in Prod-Umgebung
      observabilityConfiguration: observability,
      // Health Check nur in Prod-Umgebung (für Zero-Downtime-Deployments)
      healthCheckConfiguration: props.isPreview ? undefined : {
        protocol: apprunner.HealthCheckProtocol.HTTP,
        path: '/',
        interval: cdk.Duration.seconds(10),
        timeout: cdk.Duration.seconds(5),
        healthyThreshold: 1,
        unhealthyThreshold: 3,
      },
      // Preview-Services beim Löschen mit entfernen
      removalPolicy: props.isPreview ? cdk.RemovalPolicy.DESTROY : undefined,
      cpu: apprunner.Cpu.QUARTER_VCPU,
      memory: apprunner.Memory.HALF_GB,
    });

    // Output für Preview-URL
    if (props.isPreview) {
      new cdk.CfnOutput(this, 'PreviewURL', {
        value: `https://${service.serviceUrl}`,
        description: 'URL der Preview-Umgebung',
      });
    }
  }
}
