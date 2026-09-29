'use strict';
const Homey = require('homey');
const LABELS = { off: 'Off', eco: 'Eco', comfort: 'Confort', frost: 'Hors gel' };
class RadiatorDevice extends Homey.Device {
  async onInit() {
    this.synced = false;
    await this.setUnavailable('Connexion à la Remora…');
    this.board = this.driver.attach(this);
    this.registerCapabilityListener('remora_mode', mode => this.setMode(mode));
    this.board.start();
    // A device added after the shared polling loop started still receives state immediately.
    try { await this.board.refresh(); } catch (error) { this.error(error.message); }
  }
  async applyState(state) {
    const previous = this.getCapabilityValue('remora_mode');
    await this.setCapabilityValue('remora_mode', state.mode);
    await this.setCapabilityValue('alarm_load_shedding', state.shedding);
    if (state.shedding) await this.setWarning('Délestage : sortie forcée en Hors gel.');
    else await this.unsetWarning();
    await this.setAvailable();
    if (this.synced && previous !== state.mode) {
      await this.homey.flow.getDeviceTriggerCard('mode_changed').trigger(this, { mode: LABELS[state.mode] }, {}).catch(error => this.error(error));
    }
    this.synced = true;
  }
  async setMode(mode) { return this.board.command(this.getData().zone, mode); }
  async setAllModes(mode) { return this.board.command(0, mode); }
  async onDeleted() { this.driver.detach(this); }
  async onUninit() { this.driver.detach(this); }
}
module.exports = RadiatorDevice;
