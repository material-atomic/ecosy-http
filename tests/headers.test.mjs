// Content-Type mà máy chủ nhận được với từng kiểu body, gửi qua bản build (dist) như người dùng gói.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Http } from '../dist/index.mjs';

const srv = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ct: req.headers['content-type'] ?? null, body })); });
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const h = new Http({ baseURL: `http://127.0.0.1:${srv.address().port}` });
const form = () => { const f = new FormData(); f.append('a', '1'); f.append('f', new Blob(['x']), 'x.txt'); return f; };

test('FormData: runtime writes multipart with its boundary', async () => {
  const r = await h.post('/', form());
  assert.match(r.data.ct, /^multipart\/form-data; boundary=/);
});
test('FormData: a Content-Type set by the request is dropped, not sent', async () => {
  const r = await h.post('/', form(), { headers: { 'Content-Type': 'application/json' } });
  assert.match(r.data.ct, /^multipart\/form-data; boundary=/);
});
test('URLSearchParams: form-urlencoded, body as is', async () => {
  const r = await h.post('/', new URLSearchParams({ a: '1' }));
  assert.match(r.data.ct, /^application\/x-www-form-urlencoded/);
  assert.equal(r.data.body, 'a=1');
});
test('Blob: its own type, body as is', async () => {
  const r = await h.post('/', new Blob(['raw'], { type: 'text/csv' }));
  assert.equal(r.data.ct, 'text/csv');
  assert.equal(r.data.body, 'raw');
});
test('object: application/json', async () => {
  const r = await h.post('/', { a: 1 });
  assert.equal(r.data.ct, 'application/json');
  assert.equal(r.data.body, '{"a":1}');
});
test('a lowercase content-type from the request wins, sent once', async () => {
  const r = await h.post('/', { a: 1 }, { headers: { 'content-type': 'application/vnd.api+json' } });
  assert.equal(r.data.ct, 'application/vnd.api+json');
});
test.after(() => srv.close());
