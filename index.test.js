// index.test.js
const request = require('supertest');
const express = require('express');

// Wir importieren eine vereinfachte Version unserer App
const app = express();
app.get('/', (req, res) => {
  res.send('Hallo Welt! Meine Bachelorarbeit-Implementierung läuft!');
});

describe('GET /', () => {
  it('sollte mit Status 200 und der Hallo-Welt-Nachricht antworten', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('Hallo Welt!');
  });
});