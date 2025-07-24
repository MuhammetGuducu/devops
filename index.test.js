// index.test.js
const request = require('supertest');
const express = require('express');

const app = express();
app.get('/', (req, res) => {
  res.send('Test!');
});

describe('GET /', () => {
  it('sollte mit Status 200 antworten', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('Hallo Welt!');
  });
});