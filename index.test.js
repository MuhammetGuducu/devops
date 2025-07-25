// index.test.js
const request = require('supertest');
const app = require('./index'); // App importieren

describe('GET / - Hauptroute', () => {
  it('Antwortet mit Status 200 OK', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('Service läuft. Status: OK.');
  });
});

describe('GET /trace - Trace-Route', () => {
  it('Antwortet mit Status 200 OK', async () => {
    const response = await request(app).get('/trace');
    expect(response.statusCode).toBe(200);
    expect(response.text).toBe('Trace-Anfrage erfolgreich.');
  });
});

// Test für Secret-Route (lokal erwartet: Fehler)
describe('GET /secret - Secret-Route', () => {
  it('Antwortet mit Status 500, wenn Secret fehlt', async () => {
    const response = await request(app).get('/secret');
    expect(response.statusCode).toBe(500);
  });
});