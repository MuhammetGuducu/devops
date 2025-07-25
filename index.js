// index.js
const express = require('express');
const AWSXRay = require('aws-xray-sdk-core');
const app = express();
const port = 8080;

// X-Ray für App Runner konfigurieren
if (process.env._AWS_XRAY_DAEMON_ADDRESS) {
  AWSXRay.enableManualMode();
  app.use(AWSXRay.express.openSegment('Bachelorarbeit-App'));
}

// Hauptroute / Health Check
app.get('/', (req, res) => {
  res.send('Service läuft. Status: OK.');
});

// Test-Route für X-Ray Subsegments
app.get('/trace', (req, res) => {
  // Segment nur wenn X-Ray aktiv
  const segment = AWSXRay.getSegment();
  
  if (segment) {
    const subsegment = segment.addNewSubsegment('trace-operation');
    // Simuliert eine Hintergrund-Operation
    setTimeout(() => {
      subsegment.close();
      res.send('Trace-Anfrage erfolgreich.');
    }, 50);
  } else {
    // Ohne X-Ray direkt antworten
    setTimeout(() => {
      res.send('Trace-Anfrage erfolgreich.');
    }, 50);
  }
});

// Test-Route für Secrets Manager
app.get('/secret', (req, res) => {
  const apiKey = process.env.API_KEY;
  if (apiKey) {
    // Nur die ersten 4 Zeichen anzeigen
    res.send(`API-Schlüssel geladen. Key: ${apiKey.substring(0, 4)}...`);
  } else {
    res.status(500).send('Fehler: API_KEY nicht gefunden.');
  }
});

// X-Ray Segment schließen
if (process.env._AWS_XRAY_DAEMON_ADDRESS) {
  app.use(AWSXRay.express.closeSegment());
}

// Server nur starten, wenn direkt ausgeführt
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Anwendung lauscht auf Port ${port}`);
  });
}

// App für Tests exportieren
module.exports = app;