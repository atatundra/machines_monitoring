const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const date = new Date();


const csvWriter = createCsvWriter({ path: '/mnt/1C/out.csv',
                                    header: [
                                        {id: 'time', title: 'Time'},
                                        {id: 'type', title: 'Type'},
                                        {id: 'quantity', title: 'Quantity'},
                                        {id: 'operator', title: 'Operator'},
                                        {id: 'code',     title: 'Code'},
                                    ],
                                    fieldDelimiter: ';',
                                    append: true                           })



let to_write = function(barcode)
{
    console.log();
    let splited = barcode.split(':')
    console.log(splited);
    if(splited[1]=='00000'){
        console.log('не введено колличество деталей');
    }else if(splited[3]==undefined){
        console.log('штрих-код не отсканирован');
    }else{
        csvWriter.writeRecords([{
            time:     `${date.getDate()}.${date.getMonth()+1}.${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`,
            type:     splited[0],
            quantity: splited[1],
            operator: splited[2],
            code:     splited[3]
        }])
    }
    
}

let RFID = createCsvWriter({ path: '/mnt/1C/RFID.csv',
                                    header: [
                                        {id: 'rfid', title: 'RFID'},
                                        {id: 'name', title: 'Name'},
                                    ],
                                    fieldDelimiter: ';',
                                    append: false                                })
                                    
 let RFID_write = function(list)
 {
    let records = []
    for(let id in list){
        records.push({ rfid: id, name: list[id]})
    }
    RFID.writeRecords(records)
}

module.exports.write = to_write
module.exports.RFID_write = RFID_write
