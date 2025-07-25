// index.js - DevOps Demo Service
const express = require('express');
const AWSXRay = require('aws-xray-sdk-core');
const NodeCache = require('node-cache');
const app = express();
const port = 8080;

// Deployment-Info aus Umgebungsvariablen
const deploymentInfo = {
  version: process.env.APP_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  region: process.env.AWS_REGION || 'eu-central-1',
  commitSha: process.env.COMMIT_SHA || 'local',
  deploymentTime: new Date().toISOString(),
  startupTime: Date.now()
};

// Metriken für Monitoring
const metrics = {
  requests: 0,
  errors: 0,
  responseTimes: [],
  featureFlags: {
    newFeatureEnabled: process.env.NEW_FEATURE === 'true',
    debugMode: process.env.DEBUG_MODE === 'true'
  }
};

// Cache für Feature Flags
const featureCache = new NodeCache({ stdTTL: 60 });

// X-Ray nur in Production aktivieren
const isXRayEnabled = process.env._AWS_XRAY_DAEMON_ADDRESS && process.env.NODE_ENV !== 'test';

if (isXRayEnabled) {
  AWSXRay.enableManualMode();
  app.use(AWSXRay.express.openSegment('DevOps-Demo-Service'));
}

// Request-Tracking Middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  metrics.requests++;
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metrics.responseTimes.push(duration);
    // Nur letzte 100 Zeiten behalten
    if (metrics.responseTimes.length > 100) {
      metrics.responseTimes.shift();
    }
  });
  
  next();
});

// JSON Body Parser
app.use(express.json());

// Hauptseite mit DevOps-Info
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>DevOps Demo Service</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #232f3e; }
          .info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
          code { background: #e5e5e5; padding: 2px 6px; border-radius: 3px; }
          a { color: #0073bb; text-decoration: none; margin: 0 10px; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>🚀 DevOps Demo Service</h1>
        <div class="info">
          <h2>Deployment Information</h2>
          <p><strong>Environment:</strong> ${deploymentInfo.environment}</p>
          <p><strong>Version:</strong> ${deploymentInfo.version}</p>
          <p><strong>Commit:</strong> <code>${deploymentInfo.commitSha.substring(0, 8)}</code></p>
          <p><strong>Region:</strong> ${deploymentInfo.region}</p>
        </div>
        
        <h2>🔍 Available Endpoints</h2>
        <nav>
          <a href="/health">Health Check</a> |
          <a href="/deployment">Deployment Info</a> |
          <a href="/metrics">Service Metrics</a> |
          <a href="/trace">X-Ray Trace Test</a> |
          <a href="/feature-flags">Feature Flags</a> |
          <a href="/chaos">Chaos Engineering</a> |
          <a href="/config">Configuration</a>
        </nav>
        
        <div class="info">
          <h3>DevOps Features Demonstrated:</h3>
          <ul>
            <li>✅ Automated CI/CD Pipeline</li>
            <li>✅ Infrastructure as Code (AWS CDK)</li>
            <li>✅ Container-based Deployment</li>
            <li>✅ Automated Testing & Security Scanning</li>
            <li>✅ Feature Flags & Dynamic Configuration</li>
            <li>✅ Observability (Metrics, Traces, Logs)</li>
            <li>✅ Preview Environments for PRs</li>
            <li>✅ Blue/Green Deployments</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});


// Fehlerhafte Version für Test Rollback bei Fehlern
app.get('/health', (req, res) => {
  console.log('🚨 Provoking intentional health check failure!');
  res.status(500).json({ status: 'unhealthy', error: 'Intentional failure for rollback test' });
});

/*
// Gültig Health Check
app.get('/health', (req, res) => {
  const uptime = Math.floor((Date.now() - deploymentInfo.startupTime) / 1000);
  const health = {
    status: 'healthy',
    uptime: `${uptime} seconds`,
    timestamp: new Date().toISOString(),
    version: deploymentInfo.version,
    checks: {
      memory: process.memoryUsage().heapUsed < 500 * 1024 * 1024 ? 'ok' : 'warning',
      responseTime: metrics.responseTimes.length > 0 ? 
        Math.floor(metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length) + 'ms' : 'N/A'
    }
  };
  res.json(health);
});
*/

// Deployment-Informationen
app.get('/deployment', (req, res) => {
  res.json({
    ...deploymentInfo,
    infrastructure: {
      platform: 'AWS App Runner',
      container: 'Docker',
      orchestration: 'AWS CDK',
      ci_cd: 'GitHub Actions'
    },
    pipeline: {
      stages: ['Source', 'Test', 'Security Scan', 'Build', 'Deploy'],
      lastDeployment: deploymentInfo.deploymentTime,
      deploymentMethod: deploymentInfo.environment === 'production' ? 'Blue/Green' : 'Rolling'
    }
  });
});

// Service-Metriken
app.get('/metrics', (req, res) => {
  const avgResponseTime = metrics.responseTimes.length > 0
    ? Math.floor(metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length)
    : 0;
  
  res.json({
    requests: {
      total: metrics.requests,
      errors: metrics.errors,
      errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) + '%' : '0%'
    },
    performance: {
      averageResponseTime: avgResponseTime + 'ms',
      samples: metrics.responseTimes.length
    },
    resources: {
      memory: {
        used: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.floor(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      },
      uptime: Math.floor((Date.now() - deploymentInfo.startupTime) / 1000) + ' seconds'
    },
    timestamp: new Date().toISOString()
  });
});

// X-Ray Trace Demo
app.get('/trace', (req, res) => {
  // Safe X-Ray handling
  let segment = null;
  try {
    if (isXRayEnabled) {
      segment = AWSXRay.getSegment();
    }
  } catch (err) {
    // X-Ray nicht verfügbar, ignorieren
  }
  
  const processData = (callback) => {
    if (segment) {
      const subsegment = segment.addNewSubsegment('data-processing');
      subsegment.addAnnotation('operation', 'demo-trace');
      subsegment.addMetadata('request', {
        path: req.path,
        method: req.method
      });
      
      setTimeout(() => {
        subsegment.close();
        callback();
      }, Math.random() * 100 + 50);
    } else {
      setTimeout(callback, Math.random() * 100 + 50);
    }
  };
  
  processData(() => {
    res.json({
      message: 'Trace erfolgreich erstellt',
      traceEnabled: !!segment,
      environment: deploymentInfo.environment,
      tip: segment ? 'Prüfe AWS X-Ray Console für detaillierte Traces' : 'X-Ray ist nur in Production verfügbar'
    });
  });
});

// Feature Flags Endpoint
app.get('/feature-flags', (req, res) => {
  const flags = {
    newDashboard: featureCache.get('newDashboard') ?? false,
    enhancedMetrics: featureCache.get('enhancedMetrics') ?? true,
    betaFeatures: featureCache.get('betaFeatures') ?? (deploymentInfo.environment !== 'production'),
    maintenanceMode: featureCache.get('maintenanceMode') ?? false
  };
  
  res.json({
    flags,
    source: 'runtime-configuration',
    lastUpdate: new Date().toISOString(),
    info: 'Feature Flags ermöglichen Änderungen ohne Deployment'
  });
});

// Feature Flag Update (POST)
app.post('/feature-flags/:flag', (req, res) => {
  const { flag } = req.params;
  const { enabled } = req.body;
  
  featureCache.set(flag, enabled);
  
  res.json({
    flag,
    enabled,
    message: `Feature Flag '${flag}' wurde auf ${enabled} gesetzt`,
    ttl: '60 seconds'
  });
});

// Chaos Engineering Endpoint
app.get('/chaos', (req, res) => {
  const scenario = req.query.scenario || 'none';
  
  switch (scenario) {
    case 'slow':
      setTimeout(() => {
        res.json({ 
          scenario: 'slow', 
          delay: '2000ms',
          message: 'Langsame Antwort simuliert' 
        });
      }, 2000);
      break;
      
    case 'error':
      metrics.errors++;
      res.status(500).json({ 
        scenario: 'error',
        message: 'Fehler simuliert für Chaos Testing' 
      });
      break;
      
    case 'memory':
      const data = new Array(1000000).fill('memory test');
      res.json({ 
        scenario: 'memory',
        allocated: '~8MB',
        message: 'Memory Spike simuliert' 
      });
      break;
      
    default:
      res.json({
        message: 'Chaos Engineering Test Endpoint',
        availableScenarios: ['slow', 'error', 'memory'],
        usage: '/chaos?scenario=slow',
        purpose: 'Testet Resilience und Monitoring'
      });
  }
});

// Configuration Endpoint
app.get('/config', (req, res) => {
  const config = {
    application: {
      name: 'bachelor-devops-demo',
      version: deploymentInfo.version,
      environment: deploymentInfo.environment
    },
    features: metrics.featureFlags,
    aws: {
      region: process.env.AWS_REGION || 'eu-central-1',
      xrayEnabled: isXRayEnabled,
      secretsEnabled: !!process.env.API_KEY
    },
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage()
    }
  };
  
  if (process.env.API_KEY) {
    config.aws.secretPreview = process.env.API_KEY.substring(0, 4) + '...';
  }
  
  res.json(config);
});

// Webhook Endpoint
app.post('/webhook', (req, res) => {
  console.log('Webhook received:', req.body);
  res.json({
    message: 'Webhook erfolgreich empfangen',
    timestamp: new Date().toISOString(),
    info: 'Dieser Endpoint kann für GitHub Webhooks oder Monitoring-Alerts verwendet werden'
  });
});

// 404 Handler
app.use((req, res) => {
  metrics.errors++;
  res.status(404).json({
    error: 'Endpoint nicht gefunden',
    path: req.path,
    availableEndpoints: [
      '/', '/health', '/deployment', '/metrics', 
      '/trace', '/feature-flags', '/chaos', '/config'
    ]
  });
});

// Error Handler
app.use((err, req, res, next) => {
  metrics.errors++;
  console.error('Error:', err);
  res.status(500).json({
    error: 'Interner Server Fehler',
    message: err.message,
    environment: deploymentInfo.environment
  });
});

// X-Ray Segment schließen
if (isXRayEnabled) {
  app.use(AWSXRay.express.closeSegment());
}

// Server nur starten, wenn direkt ausgeführt
if (require.main === module) {
  app.listen(port, () => {
    console.log(`DevOps Demo Service läuft auf Port ${port}`);
    console.log(`Environment: ${deploymentInfo.environment}`);
    console.log(`Version: ${deploymentInfo.version}`);
  });
}

// App für Tests exportieren
module.exports = app;