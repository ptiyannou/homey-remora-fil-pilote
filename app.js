'use strict';
const Homey = require('homey');
class RemoraApp extends Homey.App {
  async onInit() {
    this.homey.flow.getActionCard('set_mode').registerRunListener(({ device, mode }) => device.setMode(mode));
    this.homey.flow.getActionCard('set_board_mode').registerRunListener(({ device, mode }) => device.setAllModes(mode));
    this.homey.flow.getConditionCard('is_mode').registerRunListener(({ device, mode }) => {
      if (!device.getAvailable()) throw new Error('La Remora est indisponible.');
      return device.getCapabilityValue('remora_mode') === mode;
    });
    this.log('Remora Fil Pilote : HTTP local, SDK 3.');
  }
}
module.exports = RemoraApp;
