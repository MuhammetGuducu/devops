// index.test.js
const request = require('supertest');
const app = require('./index');

describe('GET / - Hauptseite', () => {
  it('Antwortet mit Status 200 und HTML', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('DevOps Demo Service');
    expect(response.text).toContain('Available Endpoints');
  });
});

describe('GET /health - Health Check', () => {
  it('Antwortet mit Status 200 und JSON', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('version');
  });
});

describe('GET /deployment - Deployment Info', () => {
  it('Antwortet mit Deployment-Informationen', async () => {
    const response = await request(app).get('/deployment');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('environment');
    expect(response.body).toHaveProperty('infrastructure');
  });
});

describe('GET /metrics - Service Metriken', () => {
  it('Antwortet mit Metrik-Daten', async () => {
    const response = await request(app).get('/metrics');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('requests');
    expect(response.body).toHaveProperty('performance');
    expect(response.body).toHaveProperty('resources');
  });
});

describe('GET /trace - Trace Route', () => {
  it('Antwortet mit Status 200', async () => {
    const response = await request(app).get('/trace');
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Trace erfolgreich erstellt');
  });
});

describe('GET /feature-flags - Feature Flags', () => {
  it('Antwortet mit Feature Flag Status', async () => {
    const response = await request(app).get('/feature-flags');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('flags');
    expect(response.body).toHaveProperty('source');
  });
});

describe('POST /feature-flags/:flag - Feature Flag Update', () => {
  it('Aktualisiert ein Feature Flag', async () => {
    const response = await request(app)
      .post('/feature-flags/testFlag')
      .send({ enabled: true });
    expect(response.statusCode).toBe(200);
    expect(response.body.flag).toBe('testFlag');
    expect(response.body.enabled).toBe(true);
  });
});

describe('GET /chaos - Chaos Engineering', () => {
  it('Antwortet mit verfügbaren Szenarien', async () => {
    const response = await request(app).get('/chaos');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('availableScenarios');
  });

  it('Simuliert langsame Response', async () => {
    const response = await request(app).get('/chaos?scenario=slow');
    expect(response.statusCode).toBe(200);
    expect(response.body.scenario).toBe('slow');
  }, 3000); // Timeout erhöht für langsame Response, sonst

  it('Simuliert Fehler', async () => {
    const response = await request(app).get('/chaos?scenario=error');
    expect(response.statusCode).toBe(500);
    expect(response.body.scenario).toBe('error');
  });
});

describe('GET /config - Configuration', () => {
  it('Antwortet mit Konfigurationsdaten', async () => {
    const response = await request(app).get('/config');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('application');
    expect(response.body).toHaveProperty('features');
    expect(response.body).toHaveProperty('aws');
  });
});

describe('POST /webhook - Webhook Endpoint', () => {
  it('Empfängt Webhook-Daten', async () => {
    const response = await request(app)
      .post('/webhook')
      .send({ event: 'test', data: 'sample' });
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toContain('erfolgreich empfangen');
  });
});

describe('404 Handler', () => {
  it('Antwortet mit 404 für unbekannte Routes', async () => {
    const response = await request(app).get('/unknown');
    expect(response.statusCode).toBe(404);
    expect(response.body).toHaveProperty('availableEndpoints');
  });
});