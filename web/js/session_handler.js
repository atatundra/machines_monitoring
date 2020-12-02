const coockieParser = require('coockie-parser');
const session = require('express-session');
const {Pool} = require('pg');


module.exports = {
    createStore: function(){
        let config = {
            user: 'postgres',
            host: 'localhost',
            database: 'elektroautomatika',
            password: '6609049',
            port: 5432
          }
        return new Pool(config)
    }
}
