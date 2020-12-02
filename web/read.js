const fs = require('fs');

// let d = fs.readFileSync('./config.json');
// let config = JSON.parse(d)
module.exports.names = names;
module.exports.status = status;
module.exports.add = add_new_machine;
module.exports.edit = edit_machine;
module.exports.del = delete_machine;
module.exports.machine_info = machine_info;

function names() {
    let d = fs.readFileSync('./config.json');
    let config = JSON.parse(d)
    let machines = []
    let timers = []
    for (const machine of config.machines) {
        if(machine.panel != null) machine.panel_button = 'check_circle'
        machines.push(machine)
    }
    for (const timer of config.WDT) {
        timers.push(timer)
    }
    return {
            names:machines,
            wdt:timers
        };
}

function add_new_machine(req) {
    console.log(req);
    
    let d = fs.readFileSync('./config.json');
    let config = JSON.parse(d)
    
    if(req.panel=="null"){
        req.panel = null
    }else{
        req.panel = {adress: +req.panel}
    }
    if(req.group=="null") delete req.group
    delete req.oldName
    if(req.connect=="udp-mb"){
        req.adress = +req.adress
    }else if(req.connect=="eth"){
        req.adress = [req.ip,+req.port]
        delete req.ip
        delete req.port
    }
    
    req.name = req.name.replace(/ /g, '_')
    config.machines.push(req)

    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))
}

function edit_machine(req) {
    //console.log(req);
    let d = fs.readFileSync('./config.json');
    let config = JSON.parse(d)
    for(let [i,machine] of config.machines.entries()){
        if(machine.name == req.oldName) {
            delete req.oldName
            if(req.panel=="null"){
                req.panel = null
            }else{
                req.panel = {adress: +req.panel}
            }
            if(req.connect=="udp-mb"){
                req.adress = +req.adress
            }else if(req.connect=="eth"){
                req.adress = [req.ip,+req.port]
                delete req.ip
                delete req.port
            }
            config.machines[i] = req
            fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))

        }
    }
}

function status(current_status) {
    //console.log('status');
    //console.log(current_status);
    
    
    try {
        let online_devices = []
        for (const [i,device] of current_status.entries()){
            if(device!=0xff) online_devices.push(i)
        }
        return online_devices
        
    } catch (error) {
        console.log('error');
        
    }
   
}

function delete_machine(name) {
    let d = fs.readFileSync('./config.json');
    let config = JSON.parse(d)
    for(const [i,machine] of config.machines.entries()){
        if(machine.name==name) {
            console.log(`delete ${machine.name}`);
            delete config.machines.splice(i,i)
            fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))
        }
    }
    
}

process.on('message',function (m) {
    if(m.panel)console.log(m)
})


function machine_info(search_name){
    let d = fs.readFileSync('./config.json');
    let config = JSON.parse(d)
    for (let machine of config.machines){
        
        if(machine.name ==search_name) return machine;
    }
}



