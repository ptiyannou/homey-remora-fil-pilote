'use strict';
const { RemoraClient } = require('./remora-client');
// One queue and one poll per physical board; seven devices never poll simultaneously.
class Board {
  constructor(homey, chip, host, client = new RemoraClient(host)) {
    this.homey = homey; this.chip = chip; this.client = client;
    this.devices = new Set(); this.tail = Promise.resolve(); this.verified = false; this.closed = false;
  }
  enqueue(fn) {
    const result = this.tail.then(() => { if (this.closed) throw new Error('Connexion fermée.'); return fn(); });
    this.tail = result.catch(() => {}); return result;
  }
  async verify(force = false) {
    if (force || !this.verified) {
      const info = await this.client.identify();
      if (info.chip !== this.chip) throw new Error('Cette adresse correspond à une autre Remora. Réparez l’appairage.');
      this.verified = true;
    }
  }
  async publish(state) { await Promise.all([...this.devices].map(d => d.applyState(state[d.getData().zone]))); }
  async unavailable(error) {
    this.verified = false;
    await Promise.all([...this.devices].map(d => d.setUnavailable(error.message)));
  }
  async refresh() {
    return this.enqueue(async () => {
      try { await this.verify(); await this.publish(await this.client.getState()); }
      catch (error) { await this.unavailable(error); throw error; }
    });
  }
  start() {
    if (this.started) return;
    this.started = true;
    const poll = async () => {
      try { await this.refresh(); } catch (error) { this.homey.app.error(error.message); }
      if (!this.closed) this.timer = this.homey.setTimeout(poll, 30000);
    };
    void poll();
  }
  async command(zone, mode) {
    return this.enqueue(async () => {
      let response, state;
      try {
        await this.verify(true);
        response = await this.client.write(zone, mode);
        state = await this.client.getState();
        await this.publish(state);
      } catch (error) { await this.unavailable(error); throw error; }
      const targets = zone === 0 ? Object.values(state) : [state[zone]];
      if (targets.some(s => s.shedding)) throw new Error('Délestage actif : la Remora peut mémoriser l’ordre et l’appliquer au relestage. Vérifiez son état avant de réessayer.');
      if (response !== 0 || targets.some(s => s.mode !== mode)) throw new Error('Commande non confirmée par la Remora. Certaines sorties peuvent avoir changé.');
      return true;
    });
  }
  async changeHost(host) {
    return this.enqueue(async () => {
      const client = new RemoraClient(host);
      const info = await client.probe();
      if (info.chip !== this.chip) throw new Error('Cette adresse appartient à une autre Remora.');
      this.client = client; this.verified = true;
      await this.publish(info.state);
    });
  }
  close() { this.closed = true; if (this.timer) this.homey.clearTimeout(this.timer); }
}
module.exports = Board;
