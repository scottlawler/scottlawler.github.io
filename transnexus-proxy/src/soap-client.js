'use strict';
const soap = require('node-soap');
const fs   = require('fs');

let soapClient = null;
let wsdlCachedAt = null;
const WSDL_CACHE_MS = 23 * 60 * 60 * 1000; // refresh every 23h per API guide

async function getClient() {
  const now = Date.now();
  if (soapClient && wsdlCachedAt && (now - wsdlCachedAt) < WSDL_CACHE_MS) return soapClient;

  const wsdlUrl = process.env.TU_WSDL;
  if (!wsdlUrl) throw new Error('TU_WSDL not set in .env');

  const options = { endpoint: process.env.TU_ENDPOINT };

  // mTLS if certs are configured
  if (process.env.TU_CERT_PATH && process.env.TU_KEY_PATH) {
    options.wsdl_options = {
      cert: fs.readFileSync(process.env.TU_CERT_PATH),
      key:  fs.readFileSync(process.env.TU_KEY_PATH),
      rejectUnauthorized: true,
    };
  }

  soapClient = await soap.createClientAsync(wsdlUrl, options);

  // Basic Auth header when not using mTLS
  if (!(process.env.TU_CERT_PATH && process.env.TU_KEY_PATH)) {
    const token = Buffer.from(`${process.env.TU_USERNAME}:${process.env.TU_PASSWORD}`).toString('base64');
    soapClient.addHttpHeader('Authorization', `Basic ${token}`);
  }

  wsdlCachedAt = now;
  console.log('SOAP client (re)initialised — WSDL cached');
  return soapClient;
}

// Base credentials block required on every request
function creds(extras = {}) {
  return {
    Username:       process.env.TU_USERNAME,
    Password:       process.env.TU_PASSWORD,
    DPPAPurpose:    parseInt(process.env.TU_DPPA_PURPOSE || '0'),
    GLBPurpose:     parseInt(process.env.TU_GLB_PURPOSE  || '0'),
    NumberOfRecords: extras.numberOfRecords ?? 10,
    StartingRecord:  extras.startingRecord  ?? 0,
    ...extras,
  };
}

// EchoTest — connectivity check
async function echoTest() {
  const client = await getClient();
  const [result] = await client.EchoTestAsync({
    echoTestInput: creds({ NumberOfRecords: 0, StartingRecord: 0 }),
  });
  return result;
}

// PersonSearch — search by name / address / DOB / SSN / phone
async function personSearch(params = {}) {
  const client = await getClient();

  const input = creds({
    numberOfRecords: params.numberOfRecords,
    startingRecord:  params.startingRecord,
  });

  if (params.firstName || params.lastName) {
    input.Name = {};
    if (params.firstName) input.Name.FirstName = params.firstName.toUpperCase().trim();
    if (params.lastName)  input.Name.LastName  = params.lastName.toUpperCase().trim();
  }
  if (params.dob) input.DOB = String(params.dob).replace(/\D/g, '').substring(0, 8);
  if (params.ssn) input.SSN = String(params.ssn).replace(/\D/g, '').substring(0, 9);
  if (params.phone) input.Phone = String(params.phone).replace(/\D/g, '').substring(0, 10);

  if (params.address || params.city || params.state || params.zip) {
    input.Address = {};
    if (params.address) input.Address.StreetAddress = params.address;
    if (params.city)    input.Address.City  = params.city.toUpperCase();
    if (params.state)   input.Address.State = params.state.toUpperCase();
    if (params.zip)     input.Address.Zip   = params.zip;
  }

  const [result] = await client.PersonSearchAsync({ genericSearchInput: input });
  return result;
}

module.exports = { personSearch, echoTest, getClient };
