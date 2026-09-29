'use strict';
const http = require('node:http');
const MODES = Object.freeze({ off: 'A', eco: 'E', comfort: 'C', frost: 'H' });
const FROM_CODE = Object.freeze(Object.fromEntries(Object.entries(MODES).map(([k, v]) => [v, k])));
function normalizeHost(input) {
  if (typeof input !== 'string' || !input.trim() || /[\s\\]/.test(input.trim())) throw new Error('Adresse IP/hostname invalide.');
  const url = new URL(input.includes('://') ? input.trim() : `http://${input.trim()}`);
  if (url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Indiquez uniquement une IP ou un hostname HTTP, avec un port facultatif.');
  }
  return url.host;
}
function parseState(data) {
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Réponse /fp invalide.');
  const state = {};
  for (let zone = 1; zone <= 7; zone++) {
    const code = data[`fp${zone}`];
    if (![...Object.values(MODES), 'D'].includes(code)) throw new Error(`État fp${zone} absent ou non pris en charge.`);
    state[zone] = { mode: code === 'D' ? 'frost' : FROM_CODE[code], shedding: code === 'D', code };
  }
  return state;
}
class RemoraClient {
  constructor(host, { timeout = 5000 } = {}) { this.host = normalizeHost(host); this.timeout = timeout; }
  request(path) {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://${this.host}${path}`, { agent: false, headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } }, res => {
        if (res.statusCode !== 200) { res.resume(); reject(new Error(`Remora : HTTP ${res.statusCode}`)); return; }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; if (body.length > 65536) req.destroy(new Error('Réponse Remora trop volumineuse.')); });
        res.on('error', reject);
        res.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('La Remora ne renvoie pas du JSON valide.')); } });
      });
      const timer = setTimeout(() => req.destroy(new Error('La Remora ne répond pas (délai dépassé).')), this.timeout);
      req.on('error', reject);
      req.on('close', () => clearTimeout(timer));
    });
  }
  async identify() {
    const rows = await this.request('/system.json');
    if (!Array.isArray(rows)) throw new Error('Format /system.json non reconnu.');
    const fields = Object.fromEntries(rows.map(row => [row.na, row.va]));
    const chip = fields['Chip ID'];
    if (typeof chip !== 'string' || !/^0x[0-9a-f]+$/i.test(chip) || !fields['Version Matériel'] || !fields['Version Logiciel']) {
      throw new Error('Identification Remora impossible (Chip ID/version manquants).');
    }
    return { chip: chip.toLowerCase(), firmware: fields['Version Logiciel'], hardware: fields['Version Matériel'] };
  }
  async probe() { const info = await this.identify(); return { ...info, host: this.host, state: await this.getState() }; }
  async getState() { return parseState(await this.request('/fp')); }
  async write(zone, mode) {
    if (!Object.hasOwn(MODES, mode)) throw new Error('Mode fil pilote invalide.');
    if (!Number.isInteger(zone) || zone < 0 || zone > 7) throw new Error('Sortie invalide.');
    const query = zone === 0 ? `fp=${MODES[mode].repeat(7)}` : `setfp=${zone}${MODES[mode]}`;
    const result = await this.request(`/?${query}`);
    if (!result || !Number.isInteger(result.response)) throw new Error('Accusé de réception Remora invalide.');
    return result.response;
  }
}
module.exports = { RemoraClient, normalizeHost, parseState, MODES };
