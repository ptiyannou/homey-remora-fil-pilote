'use strict';
const Homey = require('homey');
const { RemoraClient } = require('../../lib/remora-client');
const Board = require('../../lib/board');
class RadiatorDriver extends Homey.Driver {
  async onInit() { this.boards = new Map(); }
  async onPair(session) {
    let remora;
    session.setHandler('get_context', async () => ({ repair: false, host: '' }));
    session.setHandler('connect', async ({ host }) => {
      remora = undefined;
      const result = await new RemoraClient(host).probe();
      const existing = this.boards.get(result.chip);
      if (existing) await existing.changeHost(result.host);
      this.saveHost(result.chip, result.host);
      remora = result;
      return { chip: result.chip, firmware: result.firmware, hardware: result.hardware };
    });
    session.setHandler('list_devices', async () => {
      if (!remora) throw new Error('Validez d’abord l’adresse de la Remora.');
      const paired = new Set(this.getDevices().map(d => d.getData().id));
      return Array.from({ length: 7 }, (_, i) => ({
        name: `Remora — Radiateur ${i + 1}`,
        data: { id: `${remora.chip}:fp${i + 1}`, chip: remora.chip, zone: i + 1 },
        store: { host: remora.host },
      })).filter(d => !paired.has(d.data.id));
    });
  }
  async onRepair(session, device) {
    session.setHandler('get_context', async () => ({ repair: true, host: device.board.client.host }));
    session.setHandler('connect', async ({ host }) => {
      const board = device.board;
      await board.changeHost(host);
      this.saveHost(device.getData().chip, board.client.host);
      return { chip: board.chip };
    });
  }
  saveHost(chip, host) {
    const hosts = this.homey.settings.get('remora_hosts') || {};
    hosts[chip] = host; this.homey.settings.set('remora_hosts', hosts);
  }
  attach(device) {
    const { chip } = device.getData();
    if (!this.boards.has(chip)) {
      const host = (this.homey.settings.get('remora_hosts') || {})[chip] || device.getStoreValue('host');
      this.boards.set(chip, new Board(this.homey, chip, host));
    }
    const board = this.boards.get(chip);
    board.devices.add(device); return board;
  }
  detach(device) {
    const board = device.board;
    if (!board) return;
    board.devices.delete(device);
    device.board = null;
    if (!board.devices.size) { board.close(); this.boards.delete(board.chip); }
  }
  async onUninit() { for (const board of this.boards.values()) board.close(); }
}
module.exports = RadiatorDriver;
