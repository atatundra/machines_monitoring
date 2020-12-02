const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();
const fs = require('fs');
const processing = require('./processing');
const csv = require('./write_to_csv')
const encoding = require('encoding-japanese');
const EventEmitter = require('events');
const listen = new EventEmitter;
let d = fs.readFileSync('./config.json');
let config = JSON.parse(d)

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const moment = require('moment');

let mbsStatus   = "Initializing...";

// Modbus 'state' constants
let MBS_STATE_INIT         = 'инициализация';
let MBS_STATE_CELL_READING = 'чтение ячеек'
let MBS_STATE_CELL_READ    = 'ячейки прочитаны';
//let MBS_STATE_IDLE         = 'занят';
let MBS_STATE_NEXT         = 'следующий'
let MBS_STATE_GOOD_CONNECT = 'подключен';
let MBS_STATE_FAIL_CONNECT = 'подключение не удалось';
let MBS_STATE_READING      = 'чтение';
let MBS_STATE_GOOD_READ    = 'опрос по ModBus...';
let MBS_STATE_FAIL_READ    = 'ошибка чтения';
let MBS_STATE_COMMAND      = 'команда на очереди';
let MBS_STATE_BUSY         = 'идёт выполнение комманды'


listen.on('log',(text)=>{
    fs.appendFile('log.txt','\n'+ moment().format("DD MMM HH:mm:ss   ") +text, (err) => {
      if (err) throw err;
    })
  })


//Configuration values
let conf = {
   
}


let mbsData = {

}

let message

let mbsScanList = {
    status: 0x10,
    time: 0x50,
    panel_lamp2: 0x90,   //2-я половина кнопок
    panel_lamp1: 0xD0  //1-я половина кнопок
    
}
let mbsScan = 3000
let mbsState = MBS_STATE_INIT;
let p = 0
for(let machine of config.machines){
    if(machine.connect=='udp-mb'){
        if(machine.type=="haas_port"){
            mbsScanList['port'+machine.adress] = 0x2001+p
            p++      
        }                
    }
    
}

//==============================
let connectClient = function ()
{
    client.setID      (conf.controllerID)
    client.connectUDP (conf.bolidIP ,{port:40000, localport:40001})
        .then(()=>{
            mbsState = MBS_STATE_GOOD_CONNECT;
            mbsStatus = 'ModBus line is connected';

            //mbsState = MBS_STATE_CELL_READ
            readAllPanelCell()
        })
        .catch((e)=>{
            mbsState = MBS_STATE_FAIL_CONNECT;
            mbsStatus = e.message;
            console.log(e); })
}


//==============================
async function readAllPanelCell(adress)
{   
    mbsState = MBS_STATE_CELL_READING
    client.readHoldingRegisters(0x10,0x20)
    .then((d)=>mbsData.status=d.buffer)
    .then(async ()=>{
        for(let [numb,machine] of config.machines.entries()){
            if(machine.panel != null && mbsData.status[machine.panel.adress] != 0xff){
                  console.log(`чтение панели ${machine.name}`);
                  config.machines[numb].panel.operators = []
                  for(let c=1;c<14;c++){  await readPanellCell(machine.panel.adress,c,numb)
                                          await sleep(100)  }
            }
          }
    })
    .then(()=>{ 
        mbsState = MBS_STATE_CELL_READ 
        console.log('чтение панелей закончено');

        let index =0
        fs.writeFile('./config.json', JSON.stringify(config, null, 2), function(err,result){
            if(err) console.log('error', err);
        })

        // csv.RFID_write(config.RFID_list)  //список RFID для 1С
    })
    
    
    
    
}


//==============================
let readModbusData = async function ()
{
    mbsState = (mbsState != MBS_STATE_COMMAND) ? MBS_STATE_READING : MBS_STATE_COMMAND
    for(let register in mbsScanList) {
        client.readHoldingRegisters( mbsScanList[register] ,0x20 )
        .then((data)=>{mbsState = (mbsState != MBS_STATE_COMMAND) ? MBS_STATE_GOOD_READ : MBS_STATE_COMMAND
                       mbsStatus = 'успешно'
                       mbsData[register] = data.buffer})
        .catch((e)=>{  mbsState = MBS_STATE_FAIL_READ
                       mbsStatus = e.message;
                       console.log(register);
                       console.log(e); })
        await sleep(100)
    }
    wdt()
    
    setupPage.send({ status:mbsData.status })
}

let wdt_flags = {}
let wdt = async function () {
    for(let timer of config.WDT){
        if(wdt_flags[timer.name]==undefined) wdt_flags[timer.name] = 0
        else if (wdt_flags[timer.name]<2) processing.start(mbsData)           //Обработка полученных данных
        
        let time = (0b0000000011111111 & mbsData.time[timer.adress])<<8
        
        time = time ^ mbsData.panel_lamp2[timer.adress]

        if(mbsData[timer.name]==time) wdt_flags[timer.name] ++
        else wdt_flags[timer.name] = 0


        mbsData[timer.name] = time



        if(wdt_flags[timer.name]>1){
            console.log('нет данных, команда на перезагрузку '+timer.name);
            await client.writeRegister(0x0010+timer.adress,0x00002)
        }else if(mbsData[timer.name]<1800){
            console.log('обновление таймера '+timer.name);
            await client.writeRegister(0x0010+timer.adress,0x0E10)
        }
        

        
    }

    initialization()
}
let init_story = []
//==============================
let initialization = async function ()
{
    let num =0
    for(let [i,port] of Object.entries(mbsData)){
        if(i.indexOf('port')==0){
            
            let id = +(i[4]+i[5])
            if(init_story[id]==undefined)init_story[id]=0
            

            if(init_story[id]==0){
                if((mbsData.status[id]&0b00000001)==0b00000000){

                    init_story[id]=1
                    console.log('initialization '+id); 
                    let Q500 = [0x1385,0x5135,0x3030]
                    await client.writeRegisters(0x2001+num,[0x0881+id,...Q500,0x0D00])
                    await sleep(100)
                }

            }else{
                init_story[id]=0
            }
                
            
            num++
        }    
    }
    
    await panel_indication()
}


//==============================Отключение индикации на панели
let panel_indication_on_story = []
let panel_indication = async function ()
{
    let indication_List = processing.check()
    if(indication_List[0].length != 0){
        console.log(`отключение выбранной причины простоя на следующих панелях: ${indication_List[0]}`); 

        for (const to_off_adress of indication_List[0]) {
            await client.writeRegisters(0x0282,[(0x0481 + to_off_adress), 0x0700,0x00]);
            await sleep(100)
            console.log('ОТРУБАЕМ   ' + to_off_adress);
        }
         
    }
    if(indication_List[1].length != 0){
        console.log(`напоминание об авторизации на следующих панелях: ${indication_List[1]}`);
        for (const to_on_adress of indication_List[1]) {
            if(panel_indication_on_story[to_on_adress]==undefined) panel_indication_on_story[to_on_adress]=0
            if(panel_indication_on_story[to_on_adress]==0){
                await client.writeRegisters(0x0282,[(0x0481 + to_on_adress), 0x20ff,0x0000]);// очистка экрана
                await sleep(30)
                await client.writeRegisters(0x0282,[0x1281 + to_on_adress, 0x2002, 0x0e20, 0xc0c2, 0xd2ce, 0xd0c8, 0xc7d3, 0xc9d2, 0xc5d1 ,0xdc00]) // авторизуйтесь                                 // авторизуйтесь
                await sleep(30)
                await client.writeRegisters(0x0282,[(0x0481 + to_on_adress), 0x0Aff,0xff00]);// включение всех светодиодов на панели
                await sleep(50)
            }
            
            panel_indication_on_story[to_on_adress]++
                        
        }

    }else{
        panel_indication_on_story = []
    }
    check_barcode()
}


//==============================Штрих-код
let barcode_timeout = []
let check_barcode = function()
{
    for(let machine of config.machines){
        if(machine.panel != null){

            if((mbsData.status[machine.panel.adress] != 0xff) && ((mbsData.status[machine.panel.adress]&0b00001000))==0b00001000){
                console.log('barcode!');
                if(barcode_timeout[machine.panel.adress]==undefined || barcode_timeout[machine.panel.adress]==4) barcode_timeout[machine.panel.adress]=0

                if(barcode_timeout[machine.panel.adress]==0){
                    read_barcode(machine)
                }
                barcode_timeout[machine.panel.adress]++
                console.log(`code ${machine.name}`);
            
            
            }else{
                barcode_timeout[machine.panel.adress]=0
            }
        }
    }
}


//==============================

let read_barcode = function(bcode_read_machine)
{
    console.log(bcode_read_machine);
    client.writeRegisters(0x0282,[0x0281+bcode_read_machine.panel.adress,0x1600])
        .then(()=>sleep(500))
        .then(()=>client.readHoldingRegisters(0x1000,0x10))
        .then((d)=>{
            
            console.log(d.buffer);
            csv.write(d.buffer.toString('utf8'))
        })
        .then(()=>console.log(d.buffer.toString('utf8')))
}

//==============================

let setupPage
let waiting = function()
{
    let readNewCard = function()
    {
        client.writeRegisters(0x0282,[0x0281+message.waitRFID,0x1400])
        .then(()=>sleep(50))
        .then(()=>client.readHoldingRegisters(0x1000,0x10))
        .then((RFID)=>{
            setupPage.send({newRFID:RFID.buffer.readUIntBE(0,5)})
            console.log(RFID);
        })
    }
    let counter = 0
    let interval = setInterval(function()
    {
        if(counter==73) clearInterval(interval)
        client.readHoldingRegisters(0x10,0x20)
        .then((d)=>{ if((d.buffer[message.waitRFID]& 0b00000001) == 0b00000001) { clearInterval(interval); readNewCard() }  })
        counter++
    }, 200);
}


//==============================

let waitRFID = function()
{
    let prilozhite = Buffer([0xcf,0xd0,0xc8,0xcb,0xce,0xc6,0xc8,0xd2,0xc5])
    let kartu      = Buffer([0xca,0xc0,0xd0,0xd2,0xd3])                   
    
    function message_to_display(string,stringOnDisplay)
    {
      let buf1 = Buffer.alloc(5)
      buf1.writeUInt8(string.length+4,0)
      buf1.writeUInt8(0x81+message.waitRFID,1)
      buf1.writeUInt8(0x20,2)
      buf1.writeUInt8(stringOnDisplay,3)
      buf1.writeUInt8(string.length,4)
      let m = Buffer.concat([buf1,string])
      return m
    }
    let string2 = message_to_display(prilozhite, 1)
    let string3 = message_to_display(kartu, 2)

    console.log(message.waitRFID);
    
    client.writeRegisters(0x0282,[0x0481+message.waitRFID,0x20ff,0x00])
    .then(()=>sleep(500))
    .then(()=>client.writeRegisters(0x0282,string2))
    .then(()=>sleep(500))      
    .then(()=>client.writeRegisters(0x0282,string3))
    .then(()=>sleep(500))
    .then(waiting)
    .catch(console.log)
}


//==============================
async function readPanellCell(adress,id, machine_index)
{
    await client.writeRegisters(0x0282,[0x0381+adress,0x6100+id])
                .then(()=>sleep(500))
                .then(()=>client.readHoldingRegisters(0x1000,0x10))
                .then((d)=>{  
                    let arr = []
                    for(let i=5;i<d.buffer.length;i++){
                        if(d.buffer.readUInt8(i)!=0x00){  
                            if(d.buffer.readUInt8(i)>127) {
                                arr[i-5]=d.buffer.readUInt8(i)+848
                            }else{
                                arr[i-5]=d.buffer.readUInt8(i)
                            }
                              
                        }
                        else{  i=d.buffer.length  }
                    }
            
                    let arr16 = new Uint16Array(arr)
                    let buf = Buffer.from(arr16.buffer)
                    
                    if(d.buffer.readUInt16BE(0)!=0xffff){
                        console.log(`${id} RFID:${d.buffer.readUIntBE(0, 5).toString(16)} оператор:${buf.toString('utf16le')}`);
                        
                        if (typeof config.RFID_list[d.buffer.readUIntBE(0, 5).toString(16)] == "undefined") {
                            let index = 1
                            for (const op in config.RFID_list) {
                                index++
                            }
                            config.RFID_list[d.buffer.readUIntBE(0, 5).toString(16)]={ 
                                id:index,name:buf.toString('utf16le')
                            }
                        }
                        console.log(d.buffer.readUIntBE(0, 5).toString(16));

                        config.machines[machine_index].panel.operators[id-1] = {
                            cell: id,
                            RFID: d.buffer.readUIntBE(0, 5).toString(16),
                            operator: buf.toString('utf16le')
                        }
                    return  }
                    else {  delete config.machines[machine_index].panel.operators[id-1]  }    })
                .catch((e)=>console.log(e))  
}


//==============================
async function writeOperator(operator)
{
    let unicodeString = encoding.convert(operator.name, { to:   'ASCII',    from: 'UTF8',   type: 'arraybuffer' });
    let ascii =[]
    for(let symbol of unicodeString){      if(symbol>127)ascii.push(symbol-848)    }
    // ascii.push(0x00)    
    if(ascii.length<10){     while(ascii.length!=10){ ascii.push(0x00) }    }               //до прошивки панели,длина должна быть 10
    if(operator.RFID==0xffffffff) ascii = [0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff]
    let nameBuf = Buffer(ascii)    
    let buf     = Buffer.alloc(10);  
    buf.writeUInt8      (9+ascii.length,0)
    buf.writeUInt8      (0x81+operator.panelAdress,1)
    buf.writeUInt8      (0x20,2)
    buf.writeUInt8      (0x80+operator.cellNumber,3)
    buf.writeUInt8      (5+ascii.length,4)
    buf.writeUIntBE     (operator.RFID,5,5)
    let concatBuf = Buffer.concat([buf,nameBuf])

    await client.writeRegisters(0x0282,concatBuf)
        .then(()=>sleep(500))
        .then(()=>readPanellCell(operator.panelAdress,operator.cellNumber, operator.machineIndex))
        .then(()=>setupPage.send({writeSucces: config}))
        .then(()=>fs.writeFile('./config.json', JSON.stringify(config, null, 2)))
}

 
//==============================

let command = function ()
{
    mbsState = MBS_STATE_BUSY
    console.log(message);
    if(message.waitRFID)
    {
        waitRFID()
        setTimeout(()=>{ mbsState = MBS_STATE_NEXT },15000)

    }else if(message.writeOperator)
    {
        writeOperator(message.writeOperator)
        setTimeout(()=>{ mbsState = MBS_STATE_NEXT },3000)

    }else if(message.anyMessage)
    {
        let any =[]
        let mes = message.anyMessage.split(' ')
        for(let s of mes){  any.push(Number('0x'+s))  }
        any.unshift(any.length)
        let anyBuf = Buffer(any)
        console.log(anyBuf);

        client.writeRegisters(0x0282,anyBuf)
        .then((r)=>{ setupPage.send({ report:r }) })
        .catch((e)=>{ console.log(e); setupPage.send({ report:e }) })

        setTimeout(()=>{ mbsState = MBS_STATE_NEXT },1000)

    }else if(message.switch)
    {
        console.log();        
        console.log('switch');
        client.writeRegister(message.switch[1],message.switch[2])
        .then(()=>mbsState = MBS_STATE_NEXT)
        setTimeout(()=>{ mbsState = MBS_STATE_NEXT },1000)

    }else if(message.waitRFID == 0)
    {
        waitRFID()
        setTimeout(()=>{ mbsState = MBS_STATE_NEXT },15000)
        
    }
    
}


//==============================
let incoming = function (command)
{
    console.log('icoming');
    //console.log(command);
    
    message = command
    
    mbsState = MBS_STATE_COMMAND
}

//==============================
let last_status
let runModbus = function ()
{
    let nextAction;
    
    
    if(mbsState != last_status) console.log(mbsState);
    last_status = mbsState

    switch (mbsState) {
        case MBS_STATE_INIT:
            nextAction = connectClient
            break;

        case MBS_STATE_NEXT:
            nextAction = readModbusData
            break;
        
        case MBS_STATE_GOOD_CONNECT:
            nextAction = readAllPanelCell
            break;

        case MBS_STATE_CELL_READ:
            nextAction = readModbusData
            break;

        case MBS_STATE_FAIL_CONNECT:
            nextAction = connectClient
            break;
        
        case MBS_STATE_GOOD_READ:
            nextAction = readModbusData
            break;

        case MBS_STATE_READING:
            nextAction = readModbusData
            break;

        case MBS_STATE_COMMAND:
            nextAction = command
            break;

        case MBS_STATE_BUSY:
            nextAction = undefined
            break;


        case MBS_STATE_FAIL_READ:
            if(client.isOpen) { mbsState = MBS_STATE_NEXT;  }
            else              { nextAction = connectClient; }
    
        default:
            break;
    }


    if (nextAction !== undefined)
    {
        nextAction();
        //mbsState = MBS_STATE_IDLE;
    }
    
    setTimeout(runModbus, mbsScan)
}


function start (mbConfigs, set)
{
    setupPage = set
    conf = mbConfigs
    
    runModbus()
}


//===================================
function data()
{
    return mbsData
}

module.exports.start = start;
module.exports.incoming = incoming;
module.exports.data = data;
