// index.js
const express = require('express');
const app = express();
const port = 8080;

app.get('/', (req, res) => {
  res.send('Hallo Welt! Meine Bachelorarbeit-Implementierung läuft!');
});

app.listen(port, () => {
  console.log(`Anwendung lauscht auf Port ${port}`);
});