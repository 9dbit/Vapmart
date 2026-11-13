import assert from 'node:assert/strict';
import test from 'node:test';
import {verifiedJubelioLabelLink} from '../src/jubelio-label';

test('accepts signed HTTPS label URLs returned by Jubelio on rotating public CDN hosts',()=>{
 const urls=[
  'https://shipment.jubelio.com/fixture-label.pdf',
  'https://storage.googleapis.com/jubelio-labels/label.pdf?token=signed%2Babc',
  'https://labels.example-cdn.id/download?id=sample&signature=abc',
  'https://bucket.s3.ap-southeast-1.amazonaws.com/labels/example.pdf?X-Amz-Signature=123'
 ];
 for(const x of urls){const r=verifiedJubelioLabelLink(x);assert.equal(r.url,x);assert.ok(r.hostname.includes('.'));}
});
test('rejects link injection, local addresses and non-HTTPS links before sending to browser',()=>{
 const rejected=[
  null,42,'','//storage.googleapis.com/private','http://storage.googleapis.com/file.pdf',
  'https://127.0.0.1/private','https://[::1]/admin','https://localhost/private',
  'https://metadata.google.internal/latest','https://label.local/private',
  'https://test.invalid/label.pdf','https://label.com:8443/label',
  'https://user:secret@cdn.example.com/label.pdf','https://example.com/#fragment',
  'https://example..com/label.pdf','https://-example.com/label.pdf','https://example.com/label.pdf\n'
 ];
 for(const x of rejected)assert.throws(()=>verifiedJubelioLabelLink(x),/Alamat label Jubelio belum terverifikasi/,String(x));
});
