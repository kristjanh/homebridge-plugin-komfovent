
/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-var-requires */

import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

const axios = require('axios').default;
const convert = require("xml-js");

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { KomfoventPlatformAccessory } from './platformAccessory';

type KomfoDetails = {
  V: {
    ET: {_text: string}
    FC: {_text: string}
    OT: {_text: string}
    SF: {_text: string}
    EF: {_text: string}
    ST: {_text: string}
  }
}

export class KomfoventPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public deviceData: KomfoDetails
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name)

    if (!this.config['host'] || !this.config['user'] || !this.config['password']) {
      const err = 'Plugin not configured, please supply host, user and password'
      this.log.error(err)
      throw err
    }

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback')
      this.discoverDevices()
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory)
  }

  async login()  {
    return new Promise<void>(async (resolve, reject) => {
      const url = '/';
      try {
          const apiClient = axios.create({
              baseURL: 'http://' + this.config['host'],
              headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
              }
          })

          const response = await apiClient.post(url, '1=' + this.config['user'] + '&2=' + this.config['password'])

          if (response.data.errorCode && response.data.errorCode != '0') {
              console.error('login returned error', response.data);
              reject();
          }

          if (response.data.indexOf('Incorrect password!') !== -1) {
              reject();
              throw 'Autentication failed';
          }

          resolve();
      } catch (err) {
          console.error(err);
          reject();
      }
    });
  }

  public async getDeviceData() {
    return new Promise<void>(async (resolve, reject) => {
      const url = '/det.asp'
      try {
        const apiClient = axios.create({
          baseURL: 'http://' + this.config['host'],
        })
    
        const response = await apiClient.get(url);
        
        if (response.data.errorCode && response.data.errorCode != '0') {
          this.log.error('det.asp returned error', response.data);
          reject();
        }

        if (response.data.indexOf('Incorrect password!') !== -1) {
          this.login().then(() => this.getDeviceData());
          return;
        }

        this.deviceData = JSON.parse(convert.xml2json(response.data, { compact: true, spaces: 2 }));
        this.log.debug('Fetch device data: %o', this.deviceData);
        resolve();

      } catch (err) {
        this.log.error('getDeviceData error', err);
        reject();
      }
    });    
  }

  async discoverDevices() {
    await this.getDeviceData();

    setInterval(async () => {
      this.getDeviceData();
    }, 4000);

    const devices = [
      {
        deviceId: 'OT',
        displayName: 'Outside Temperature',
        deviceType: 'OUT_TEMP'
      },
      {
        deviceId: 'SF',
        displayName: 'Supply air',
        deviceType: 'SUPPLY_FAN'
      },
      {
        deviceId: 'EF',
        displayName: 'Exhaust air',
        deviceType: 'EXHAUST_FAN'
      },
      {
        deviceId: 'FC',
        displayName: 'Air filter maintenance',
        deviceType: 'FILTER'
      }
    ];

    for (const device of devices) {
      const uuid = this.api.hap.uuid.generate(device.deviceId);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
      if (existingAccessory) {
        this.log.debug('Restoring existing accessory from cache:', existingAccessory.displayName);
        existingAccessory.context.device = this.deviceData;
        existingAccessory.context.deviceType = device.deviceType;
        this.api.updatePlatformAccessories([existingAccessory]);
        new KomfoventPlatformAccessory(this, existingAccessory);
      } else {
        this.log.debug('Adding new accessory:', device.displayName);
        const accessory = new this.api.platformAccessory(device.displayName, uuid);
        accessory.context.device = this.deviceData;
        accessory.context.deviceType = device.deviceType;
        new KomfoventPlatformAccessory(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
