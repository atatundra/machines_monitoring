const net = require('net');
const fs = require('fs');
const processing = require('./processing');

let d = fs.readFileSync('./config.json');
let config = JSON.parse(d)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let modBusData


let ETH_STATE_INIT         = 'инициализация';
let ETH_STATE_IDLE         = 'занят';
let ETH_STATE_NEXT         = 'следующий'
let ETH_STATE_GOOD_CONNECT = 'подключен';
let ETH_STATE_FAIL_CONNECT = 'подключение не удалось';
let ETH_STATE_SEND         = 'запрос отправлен'
let ETH_STATE_GOOD_READ    = 'прочитано';
let ETH_STATE_FAIL_READ    = 'ошибка чтения';
let ETH_STATE_COMMAND      = 'команда на очереди';

let ethScan = 3000

let ethData = {

}

let ethScanList = {

}

let sockets = [];



//======================================Создаём сокеты для станков, подключенных по ethernet порту

for(let machine of config.machines){
    let i = sockets.length

    if(machine.connect=='eth'){

        sockets[i] = new net.Socket();
        sockets[i].state = ETH_STATE_INIT
        sockets[i].machine = machine
        sockets[i].port = machine.adress[1]
        sockets[i].host = machine.adress[0]

        sockets[i].on('connect',()=> {  sockets[i].state = ETH_STATE_GOOD_CONNECT; console.log( machine.name + ' is connected') })

        sockets[i].on('error',(err)=> {  
            // console.log(err);  
        } )

        sockets[i].on('data', (data)=>{ 
            
            
            if(machine.type=='haas_port'){
                let check = data.toString('ascii')
                if(check.includes('BUSY')||check.includes('FEED HOLD')||check.includes('MDI,IDLE')||check.includes('ALARM ON')||check.includes('IDLE')){
                    if(sockets[i].state==ETH_STATE_SEND){
                        sockets[i].state = ETH_STATE_GOOD_READ
                        let MBdata = modBusData.data()
                        processing.type(machine,{ port: data,  status: MBdata.status,  panel_lamp1: MBdata.panel_lamp1,  panel_lamp2: MBdata.panel_lamp2 })
                        sockets[i].state=ETH_STATE_GOOD_READ
                    }
                    
                }
            }
        })

        

        sockets[i].on('close', (data)=>console.log('close'))
        sockets[i].on('disconnect', (data)=>console.log('socket disconnect'))
    }
    
}


//====================================Отправка запроса на порт HASS

let write = function(socket)
{
    socket.state=ETH_STATE_SEND
    socket.write('?Q500'+'\n')
}


//====================================

let connect = async function(socket)
{
    let MBdata =  modBusData.data()    
    processing.type(socket.machine,{port:'offline',  status: MBdata.status,  panel_lamp1: MBdata.panel_lamp1,  panel_lamp2: MBdata.panel_lamp2})
    socket.connect({ port:socket.port, host:socket.host})
}


//====================================
let start = function (ModBus) {
    modBusData = ModBus
    runEthernet()
}

let runEthernet = function()
{
    let nextAction;
    

    for(let socket of sockets){
        
        switch (socket.state) {
            case ETH_STATE_INIT:
                connect(socket)
                break;
    
            case ETH_STATE_NEXT:
                nextAction = readModbusData
                break;
            
            case ETH_STATE_GOOD_CONNECT:
                write(socket)
                
                break;
    
            case ETH_STATE_FAIL_CONNECT:
                
                connect(socket)
                break;
            
            case ETH_STATE_GOOD_READ:
                
                write(socket)
                
                break;

            case ETH_STATE_SEND:
                connect(socket)
                
            case ETH_STATE_IDLE:
            
                write(socket)
                
                break;
    
            case ETH_STATE_COMMAND:
                nextAction = command
                break;
    
    
            case ETH_STATE_FAIL_READ:
                if(client.isOpen) { mbsState = ETH_STATE_NEXT;  }
                else              { nextAction = connectClient; }
        
            default:
                break;
        }
    
    
    }

    
    setTimeout(runEthernet, ethScan)
    
}



module.exports.start = start;