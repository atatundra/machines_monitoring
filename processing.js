const fs = require('fs');
const DB = require('./write_to_DB')
const moment = require('moment');
let d = fs.readFileSync('./config.json');
let config = JSON.parse(d);
//const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


let start = function (data)
{
    
    for (const machine of config.machines) {
        if(machine.connect=="udp-mb"){
            type (machine, data)
        }
        
    }

}


let type = function (machine, data)
{
    
    machine.work          = 0;
    machine.setting       = 0;
    machine.emergency     = 0;
    machine.idle          = 0;
    machine.power         = 0;

    machine.offline       = 0;
    machine.authorized    = 0;
    machine.buttons       = 0;
    machine.panel_online  = 0;
    machine.panel_offline = 0;
    machine.color         = 0;

    let to_DB = {...machine, ...data};

    if(machine.connect=="udp-mb"){
        if(data.status[machine.adress]==0xFF) { 
            machine.offline = 3;
            machine.color = 6
        }
    }else if(machine.connect=="eth"){
        if(data.port == 'offline'){ 
            machine.offline = 3;
            machine.color = 6;
        }   
    }
    
    

    
    switch (machine.type) {
        case "haas_port":
            haas_port(machine, data)
            break;
        case "haas_indication":
            haas_indication(machine, data)
            break;
        case "tpa_indication":
            tpa_indication(machine,data)        
            break;
        case "power":
            power(machine,data)
            break;
        default:
            console.log('undefined type')            
            break;
    }
}

//======================================Обработка данных с порта HAAS
let haas_port = function (machine, data)          
{   
    let to_DB = {...machine, ...data};
    let port
    

    if(machine.connect=="udp-mb"){
        to_DB.status = data.status[machine.adress]
        port = data['port'+machine.adress].toString('ascii')
    }else if(machine.connect=="eth"){
        
        to_DB.status = data.status
        port = data.port.toString('ascii')
    }
    
    if(machine.offline == 3) {
        to_DB.color     = 6;
    }else if(port.includes('BUSY')){
        to_DB.work      = 3;
        to_DB.color     = 1;
        to_DB.power     = 3;
    }else if(port.includes('FEED HOLD')||port.includes('MDI,IDLE')){
        to_DB.setting   = 3;
        to_DB.color     = 2;
        to_DB.power     = 3;
    }else if(port.includes('ALARM ON')){
        to_DB.emergency = 3;
        to_DB.color     = 4;
        to_DB.power     = 3;
    }else if(port.includes('IDLE')){
        to_DB.idle      = 3;
        to_DB.color     = 0;
        to_DB.power     = 3;
    }else{
        to_DB.power     = 0;
        to_DB.color     = 5;
    }
    
    panel(to_DB, machine, data)
    
    
}


//========================================Обработка данных с индикации Haas
//1 канал красный, 3 канал зелёный
let haas_indication = function (machine, data){
    let to_DB = {...machine, ...data};
    to_DB.status = data.status[machine.adress]
    let counter = data.time[machine.adress]

    if(machine.offline==3){
        
    }else if((to_DB.status&0b00100010)==0b00100010){        //жёлтый
        to_DB.idle =3
    }else if((to_DB.status&0b00000010)==0b00000010){  //красный
        to_DB.emergency = 3;
        to_DB.power = 3;
        to_DB.color = 4;
    }else if((to_DB.status&0b00100000)==0b00100000){
        if(counter>1){                  //мигает зелёный
            to_DB.setting = 3;
            to_DB.power = 3;
            to_DB.color = 2;
        }else{                          //зелёный
            to_DB.work=3;
            to_DB.power = 3
            to_DB.color = 1;
        }
    }else{
        to_DB.idle =3
    }
    
    panel(to_DB, machine, data)


}


//========================================Обработка данных с LG-TPA
let tpa_counter =[];
let tpa_indication = function (machine, data)
{
    let to_DB = {...machine, ...data};
    to_DB.status    = data.status[machine.adress]
    to_DB.jump      = 0;

    if (to_DB.status&0b00001000){
        to_DB.jump = 1
        tpa_counter[machine.adress] = 0;
    }else{
        tpa_counter[machine.adress] ++;
    }
    
    if (to_DB.status == 0xFF){
        to_DB.color = 6;
    } else if (to_DB.status != 0b00000000){
        to_DB.power = 3;
        if(tpa_counter[machine.adress]<60){
            if(to_DB.status&0b00110000){
                to_DB.work=3;
                to_DB.color = 1;
            }
        }else if(to_DB.status&0b00000011){
            to_DB.emergency=3;
            to_DB.color = 4;
        }else if(tpa_counter[machine.adress]<200){
            to_DB.setting = 3;
            to_DB.color = 2;
        }else{
            to_DB.idle = 3;
        }
    }else if (to_DB.status == 0b00000000){
        to_DB.color = 5;
    }
    
    panel(to_DB, machine, data)
}


//========================================Обработка данных, подключение по питанию
let power_counter = [];
let power = function (machine, data)
{
    let to_DB = {...machine, ...data};
    to_DB.status = data.status[machine.adress]


    if((to_DB.status!=0xff) && ((to_DB.status&0b00000010)==0b00000010)) {
        to_DB.power = 3;
        if((to_DB.status&0b00100010)==0b00100010){
            power_counter[machine.adress] = 0;
            to_DB.work=3;
            to_DB.color = 1//console.log(mod.machine + ' ' + 'рабочий режим');
        }else if(power_counter[machine.adress]<100){
            to_DB.setting = 3;
            to_DB.color = 2;
            power_counter[machine.adress] ++;
        }else{
            to_DB.idle=3;
            to_DB.color = 0
        }
        
    }
    
   panel(to_DB, machine, data)
}

let buttons = {
    change_time: [],
    name: [],
    panel_indication_off_list: [],
    panel_indication_on_list: [],
    panel_buttons_status : [],
    work_time: []

}



//=========================================
let panel = function (to_DB, machine, data) 
{
    if(machine.panel==null){
        DB.write(to_DB)
        return
    }
    if(buttons.work_time[machine.panel.adress]==undefined){ buttons.work_time[machine.panel.adress]=0 }
    if(to_DB.work==3){ buttons.work_time[machine.panel.adress] = buttons.work_time[machine.panel.adress] + 3 }
    else{ buttons.work_time[machine.panel.adress] = 0 }
    to_DB.buttons = 0

    if( data.panel_lamp1==undefined ){ return }
    to_DB.panel_status = data.status[machine.panel.adress]
    if(to_DB.panel_status == 0xff){
        to_DB.authorized = to_DB.panel_status
    }else if(((to_DB.panel_status & 0b00000100)>>2)!=0){
        let cell = to_DB.panel_status >> 4;
        
        machine.panel.operators.find(function (operator_info) {
            if(operator_info != null && operator_info.cell == cell){
                to_DB.authorized = config.RFID_list[operator_info.RFID].id
            }
        })
    }else{
        to_DB.authorized = 0;
    }
    
    to_DB.panel_offline = 0
    to_DB.no_button = 0
    if(machine.panel.authorization_tracking && (to_DB.panel_status==0xff || to_DB.authorized==0)) to_DB.idle = 0; //если отслеживание авторизации включено, простой не будет записываться если никто не авторизован
    if((((to_DB.panel_status & 0b00000100)>>2)==0)&& (to_DB.work==3)){
        console.log(`нет авторизации на ${machine.panel.adress}`);
        buttons.panel_indication_on_list.push(machine.panel.adress)
    }

    if(to_DB.panel_status!=0xff)
    {     
        to_DB.panel_online = 3   
        if(data.panel_lamp1[machine.panel.adress] & 0b00001000)
        {
            // console.log('нажата F');    
        }else
        {
            
            let mask = 0b00000001
            if(data.panel_lamp1[machine.panel.adress] & mask) to_DB.buttons = 1
            mask = mask << 1
            if(data.panel_lamp1[machine.panel.adress] & mask) to_DB.buttons = 2
            mask = mask << 1
            if(data.panel_lamp1[machine.panel.adress] & mask) to_DB.buttons = 3
            mask = mask << 2
            if(data.panel_lamp1[machine.panel.adress] & mask) to_DB.buttons = 4
            mask = mask << 1
            if(data.panel_lamp1[machine.panel.adress] & mask) to_DB.buttons = 5
            mask = mask << 1
            if(data.panel_lamp1[machine.panel.adress] & mask) to_DB.buttons = 6
            mask = mask << 1
            if(data.panel_lamp1[machine.panel.adress] & mask) to_DB.buttons = 10
            
            mask = 0b00000001
            if(data.panel_lamp2[machine.panel.adress] & mask) to_DB.buttons = 7
            mask = mask << 1
            if(data.panel_lamp2[machine.panel.adress] & mask) to_DB.buttons = 8
            mask = mask << 1
            if(data.panel_lamp2[machine.panel.adress] & mask) to_DB.buttons = 9



        }

        if(to_DB.buttons==0){                        //ни одна кнопка не нажата
            
        }else{                                          //хотя бы одна кнопка нажата
            
            
            if( buttons.work_time[machine.panel.adress]>60 ) { buttons.panel_indication_off_list.push(machine.panel.adress) }      //если рабочий режим больше минуты и нажата хотя бы одна кнопка, добавляем адресс панели в список на отключение
        }

    }else
    {
        to_DB.panel_offline = 3       
    }  


    buttons.panel_buttons_status[machine.adress] = to_DB.panel
    DB.write(to_DB)

    
    
    
}



//========================================
let check = function()
{
    
    let off_panel = buttons.panel_indication_off_list
    let on_panel = buttons.panel_indication_on_list
    buttons.panel_indication_off_list = []
    buttons.panel_indication_on_list = []
    return [off_panel,on_panel]
}

module.exports.start = start;
module.exports.type = type;
module.exports.check = check;
