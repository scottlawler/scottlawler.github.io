'use strict';
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
const { personSearch, echoTest } = require('./soap-client');

const app  = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('combined'));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed`));
  }
}));
app.use(express.json());

// Serve the TransNexus HTML pages directly from workspace
// Access at http://localhost:3000/transnexus.html for live API (avoids mixed-content block)
const WORKSPACE = path.join(__dirname, '../../');
app.use(express.static(WORKSPACE, { index: false }));

// ── Health / connectivity check ───────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const echo = await echoTest();
    const errCode = echo?.EchoTestResult?.ErrorCode;
    res.json({
      status: 'ok',
      tu_connected: true,
      errorCode: errCode,
      ts: new Date().toISOString()
    });
  } catch (err) {
    console.error('EchoTest failed:', err.message);
    res.status(503).json({
      status: 'degraded',
      tu_connected: false,
      error: err.message,
      ts: new Date().toISOString()
    });
  }
});

// ── PersonSearch ──────────────────────────────────────────────
app.post('/api/lookup', async (req, res) => {
  try {
    const { firstName, lastName, dob, ssn, address, city, state, zip, phone,
            numberOfRecords, startingRecord } = req.body;

    if (!lastName && !firstName && !ssn && !phone) {
      return res.status(400).json({ error: 'Provide at least one of: lastName, firstName, ssn, phone' });
    }

    const result = await personSearch({ firstName, lastName, dob, ssn, address, city, state, zip,
                                        phone, numberOfRecords, startingRecord });
    const errCode = result?.PersonSearchResult?.ErrorCode;
    if (errCode && parseInt(errCode) !== 0) {
      return res.status(422).json({ success: false, errorCode: errCode, data: result });
    }
    res.json({ success: true, data: result });

  } catch (err) {
    console.error('Lookup error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── WSDL introspection (dev only) ────────────────────────────
app.get('/api/methods', async (req, res) => {
  try {
    const { getClient } = require('./soap-client');
    const client = await getClient();
    res.json(client.describe());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\nTransNexus proxy running → http://localhost:${PORT}`);
  console.log(`  Pages:   http://localhost:${PORT}/transnexus.html`);
  console.log(`           http://localhost:${PORT}/data-analysis.html`);
  console.log(`  Health:  http://localhost:${PORT}/health`);
  console.log(`  API:     http://localhost:${PORT}/api/lookup (POST)`);
  console.log(`  TU user: ${process.env.TU_USERNAME}`);
});
