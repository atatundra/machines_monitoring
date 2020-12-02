const fs = require('fs');
let modBusData = require('./modbusPolling')
let ethernetData = require('./ethernetPolling')

const setupPage = require('child_process').fork('./web/setting.js',[3307]);

let d = fs.readFileSync('./config.json');
let config = JSON.parse(d)


let mbConfigs = {

    controllerID: 0x04,
    bolidIP: '192.168.10.140'

}

let ethConfigs = {
    
}

//============================сбор данных по ModBus

modBusData.start(mbConfigs,setupPage)
ethernetData.start(modBusData)


setupPage.on('exit',code => console.log(`exit code ${code}`))

setupPage.on('message', message =>{ modBusData.incoming(message) })



