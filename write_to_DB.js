const {Pool} = require('pg');
const configDB = require('./configDB')
const pg = new Pool(configDB.postgres)
const pg_users = new Pool(configDB.users)
const fs = require('fs');
let write = function (to_DB)
{
  let creates ={

    machine : `CREATE TABLE IF NOT EXISTS ${to_DB.name}(
      date TIMESTAMPTZ not null,
      status        integer,
      work_time     integer,
      green_blink   integer,
      red_lamp      integer,
      no_light      integer,
      power         integer,
      offline       integer,
      authorized    integer,
      button1       integer,      
      panel_online  integer,
      panel_offline integer)` ,
  
    panels_status: `CREATE TABLE IF NOT EXISTS status_panel(
      date          TIMESTAMPTZ not null,
      panel_name    text,
      status        text
      )`,
  
    fist_write: `INSERT INTO status_panel(
      date ,
      panel_name
      )VALUES(
        NOW(),
      '${to_DB.adress}')`
  }
  
  
  let writes = {
    machine : `INSERT INTO ${to_DB.name}(
      date,
      status,
      work_time,
      green_blink,
      red_lamp,
      no_light,
      power,
      offline,
      authorized,
      button1,      
      panel_online,
      panel_offline
   )VALUES(
       NOW(),
     ${to_DB.color},
     ${to_DB.work},
     ${to_DB.setting},
     ${to_DB.emergency},
     ${to_DB.idle},
     ${to_DB.power},
     ${to_DB.offline},
     ${to_DB.authorized},
     ${to_DB.buttons},
     ${to_DB.panel_online},
     ${to_DB.panel_offline})`     
  }
  
  function err_check(err) {
    console.log(err);
    console.log(to_DB.record);
    
   if(err.code=='42P01'){
     console.log('42P01')
     console.log(creates.machine);
     console.log(to_DB);
     
     
     pg.query(creates.machine)
     .then(()=>pg.query(`SELECT create_hypertable('${to_DB.name}', 'date')`))
     
     
   }else if(err.code=='42703'){
     console.log('write to DB error 42703');
   }
   
  }

  pg.query(writes.machine)
  .catch((err)=>err_check(err))
}

async function users()
{
  let users = await pg_users.query('SELECT login FROM users_info')
  return users.rows
}

async function all_info()
{
  let users = await pg_users.query('SELECT * FROM users_info')
  return users.rows
}

async function new_user(req)
{
  console.log(req);
  let users = await pg_users.query('SELECT login FROM users_info')
  let check = true
  users.rows.forEach(function(item){ if(item.login==req.login) check = false })
  if(check != false){
    let add = await pg_users.query(`INSERT INTO users_info (login, password) VALUES ('${req.login}','${req.password}')`)
    return add
  }else{
    console.log('такой логин уже существует !!!');
  }
  
}

async function delete_user(req)
{
  console.log(req);
  await pg_users.query(`DELETE FROM users_info WHERE login = '${req}'`)
  .then(console.log)
  
  
}

async function drop_admin_password(req)
{
  let d = fs.readFileSync('./config.json');
  let config = JSON.parse(d)
  console.log(req);
  if(req.pin == config.admin_pin_code && req.new_password != ''){
    await pg_users.query(`UPDATE users_info SET password = '${req.new_password}' WHERE login = 'admin'`)
    return true
  }else{
    return false
  }
  
}

module.exports.write = write;
module.exports.users = users;
module.exports.all_info = all_info;
module.exports.new_user = new_user;
module.exports.delete_user = delete_user;
module.exports.drop_admin_password = drop_admin_password;