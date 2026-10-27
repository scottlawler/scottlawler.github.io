'use strict';
const https = require('https');

const ENDPOINT = () => process.env.TU_ENDPOINT || 'https://secureapi.tlo.com/TLOWebService.asmx';
const NS = 'http://tlo.com/';

// ── Minimal XML helpers ────────────────────────────────────────
function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function tag(name, value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'object') {
    const inner = Object.entries(value).map(([k,v]) => tag(k, v)).join('');
    return inner ? `<tlo:${name}>${inner}</tlo:${name}>` : '';
  }
  return `<tlo:${name}>${esc(value)}</tlo:${name}>`;
}

function buildEnvelope(method, inputTag, fields) {
  const inner = Object.entries(fields).map(([k,v]) => tag(k, v)).join('\n        ');
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tlo="${NS}">
  <soapenv:Header/>
  <soapenv:Body>
    <tlo:${method}>
      <tlo:${inputTag}>
        ${inner}
      </tlo:${inputTag}>
    </tlo:${method}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Simple XML value extractor (handles nested single values)
function xmlVal(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

// Extracts all occurrences of a tag as array of inner XML strings
function xmlAll(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  const results = [];
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1]);
  return results;
}

// ── HTTP POST ──────────────────────────────────────────────────
function post(soapBody, soapAction) {
  return new Promise((resolve, reject) => {
    const url = new URL(ENDPOINT());
    const auth = Buffer.from(`${process.env.TU_USERNAME}:${process.env.TU_PASSWORD}`).toString('base64');
    const opts = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `"${NS}${soapAction}"`,
        'Authorization': `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(soapBody, 'utf8'),
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(soapBody);
    req.end();
  });
}

// ── Base credentials ───────────────────────────────────────────
function baseCreds(extras = {}) {
  return {
    Username:        process.env.TU_USERNAME,
    Password:        process.env.TU_PASSWORD,
    DPPAPurpose:     process.env.TU_DPPA_PURPOSE ?? '0',
    GLBPurpose:      process.env.TU_GLB_PURPOSE  ?? '0',
    NumberOfRecords: extras.NumberOfRecords ?? '10',
    StartingRecord:  extras.StartingRecord  ?? '0',
  };
}

// Parse PersonSearch XML response into a structured object
function parsePersonSearch(xml) {
  const errCode = xmlVal(xml, 'ErrorCode');
  const txnId   = xmlVal(xml, 'TransactionId');
  const count   = xmlVal(xml, 'NumberOfRecordsFound');
  const records = xmlAll(xml, 'TLOPersonSearchOutputRecord').map(rec => {
    const name = xmlVal(rec, 'BasicName');
    const addr = xmlVal(rec, 'BasicAddressRecord');
    const dob  = xmlVal(rec, 'BasicDateOfBirthRecord');
    const ssn  = xmlVal(rec, 'BasicSSNRecord');
    const ph   = xmlVal(rec, 'BasicPhoneListing');
    return {
      Names: name ? {
        BasicName: {
          FirstName: xmlVal(name, 'FirstName'),
          LastName:  xmlVal(name, 'LastName'),
          MiddleName:xmlVal(name, 'MiddleName'),
        }
      } : null,
      Addresses: addr ? {
        BasicAddressRecord: {
          Address: {
            Line1:  xmlVal(addr, 'Line1'),
            City:   xmlVal(addr, 'City'),
            State:  xmlVal(addr, 'State'),
            Zip:    xmlVal(addr, 'Zip'),
          }
        }
      } : null,
      DatesOfBirth: dob ? { BasicDateOfBirthRecord: { DOB: xmlVal(dob, 'DOB') } } : null,
      SSNRecords:   ssn ? { BasicSSNRecord: { SSN: xmlVal(ssn, 'SSN') } } : null,
      Phones:       ph  ? { BasicPhoneListing: { PhoneNumber: xmlVal(ph, 'PhoneNumber') } } : null,
    };
  });
  return {
    PersonSearchResult: {
      TransactionId:   txnId,
      ErrorCode:       errCode,
      NumberOfRecordsFound: count,
      PersonSearchOutputRecords: { TLOPersonSearchOutputRecord: records }
    }
  };
}

// ── Public API ─────────────────────────────────────────────────
async function echoTest() {
  const body = buildEnvelope('EchoTest', 'echoTestInput', {
    ...baseCreds({ NumberOfRecords: '0', StartingRecord: '0' })
  });
  const { status, body: xml } = await post(body, 'EchoTest');
  const errCode = xmlVal(xml, 'ErrorCode');
  const txnId   = xmlVal(xml, 'TransactionId');
  if (status !== 200) throw new Error(`SOAP HTTP ${status}`);
  if (errCode && errCode !== '0') throw new Error(`TLO error ${errCode}`);
  return { EchoTestResult: { ErrorCode: errCode, TransactionId: txnId } };
}

async function personSearch(params = {}) {
  const fields = { ...baseCreds() };
  if (params.firstName || params.lastName) {
    fields.Name = {};
    if (params.firstName) fields.Name.FirstName = params.firstName.toUpperCase();
    if (params.lastName)  fields.Name.LastName  = params.lastName.toUpperCase();
  }
  if (params.dob)     fields.DOB   = String(params.dob).replace(/\D/g, '').substring(0, 8);
  if (params.ssn)     fields.SSN   = String(params.ssn).replace(/\D/g, '').substring(0, 9);
  if (params.phone)   fields.Phone = String(params.phone).replace(/\D/g, '').substring(0, 10);
  if (params.address || params.city || params.state || params.zip) {
    fields.Address = {};
    if (params.address) fields.Address.StreetAddress = params.address;
    if (params.city)    fields.Address.City  = params.city.toUpperCase();
    if (params.state)   fields.Address.State = params.state.toUpperCase();
    if (params.zip)     fields.Address.Zip   = params.zip;
  }
  const body = buildEnvelope('PersonSearch', 'genericSearchInput', fields);
  const { status, body: xml } = await post(body, 'PersonSearch');
  if (status !== 200) {
    const err = new Error(`SOAP HTTP ${status}`);
    err.responseBody = xml;
    err.responseStatus = status;
    throw err;
  }
  return parsePersonSearch(xml);
}

module.exports = { echoTest, personSearch };
