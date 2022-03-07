import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { KomfoventPlatform } from './platform';

export class KomfoventPlatformAccessory {
  public deviceData: any;

	private filterService!: Service
	private supplyFanService!: Service
	private supplyTempService!: Service
	private exhaustFanService!: Service
	private exhaustTempService!: Service
	private outdoorTemperatureService!: Service

  constructor(
    private readonly platform: KomfoventPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.deviceData = this.accessory.context.device;

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Komfovent')
      .setCharacteristic(this.platform.Characteristic.Model, 'DOMEKT')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '450R');

    this.platform.log.debug('Add %s', this.accessory.displayName);

    if (this.accessory.context.deviceType === 'OUT_TEMP') {
      this.outdoorTemperatureService = this.accessory.getService(this.platform.Service.TemperatureSensor) || this.accessory.addService(this.platform.Service.TemperatureSensor)
      this.outdoorTemperatureService.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName)
      this.outdoorTemperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(() => {
          return this.getOutdoorTemp()
        });

        setInterval(() => {
          this.outdoorTemperatureService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getOutdoorTemp())
        }, 60000)
    }

    if (this.accessory.context.deviceType === 'SUPPLY_FAN') {
      this.supplyFanService = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2)
      this.supplyFanService.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName)
      this.supplyFanService.getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .onGet(() => {
          return this.rotationSupplySpeed()
        })

      this.supplyTempService = this.accessory.getService(this.platform.Service.TemperatureSensor) || this.accessory.addService(this.platform.Service.TemperatureSensor)
      this.supplyTempService.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName + ' temperature')
      this.supplyTempService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(() => {
          return this.getSupplyTemp()
        })

      setInterval(() => {
        this.supplyFanService.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.rotationSupplySpeed());
        this.supplyTempService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getSupplyTemp());
      }, 5000);
    }

    if (this.accessory.context.deviceType === 'EXHAUST_FAN') {
      this.exhaustFanService = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2)
      this.exhaustFanService.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName)
      this.exhaustFanService.getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .onGet(() => {
          return this.rotationExhaustSpeed()
        })
      this.exhaustTempService = this.accessory.getService(this.platform.Service.TemperatureSensor) || this.accessory.addService(this.platform.Service.TemperatureSensor)
      this.exhaustTempService.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName + ' temperature')
      this.exhaustTempService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(() => {
          return this.getExhaustTemp()
        })

      setInterval(() => {
        this.exhaustFanService.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.rotationExhaustSpeed());
        this.exhaustTempService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.getExhaustTemp());
      }, 5000);        
    }

    if (this.accessory.context.deviceType === 'FILTER') {
      this.filterService = this.accessory.getService(this.platform.Service.FilterMaintenance) || this.accessory.addService(this.platform.Service.FilterMaintenance)
      this.filterService.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName)
      this.filterService.getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
        .onGet(() => {
          return this.getIsFilterOk()
            ? this.platform.Characteristic.FilterChangeIndication.FILTER_OK
            : this.platform.Characteristic.FilterChangeIndication.CHANGE_FILTER
        })
      this.filterService.getCharacteristic(this.platform.Characteristic.FilterLifeLevel)
        .onGet(() => {
          return this.getFilterClogging()
        })
    }
  }

  public getFilterClogging() {
    return parseFloat(this.platform.deviceData.V.FC._text.match(/[\d]+/))
  }

  public getIsFilterOk() {
    const filterClogging = this.getFilterClogging()
    return filterClogging > 90
  }

  public getOutdoorTemp() {
    return parseFloat(this.platform.deviceData.V.OT._text.match(/[\d\.]+/));
  }

  public rotationSupplySpeed() {
    return parseFloat(this.platform.deviceData.V.SF._text.match(/[\d]+/));
  }

  public rotationExhaustSpeed() {
    return parseFloat(this.platform.deviceData.V.EF._text.match(/[\d]+/));
  }

  public getSupplyTemp() {
    return parseFloat(this.platform.deviceData.V.ST._text.match(/[\d\.]+/));
  }

  public getExhaustTemp() {
    return parseFloat(this.platform.deviceData.V.ET._text.match(/[\d\.]+/));
  }
}
