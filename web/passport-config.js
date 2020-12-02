const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy
const DB = require('/opt/monitoring/write_to_DB.js')

// let users = async function () {
//   await DB.all_info()
//   .then(console.log)
// }

//console.log(users);
// users();
// let userDB ;




passport.serializeUser(function(user, done) {
    //console.log('Сереализация ', user);
    done(null, user.id);
  });
  
passport.deserializeUser(async function(id, done) {
    //console.log('Десереализация ', id);
    // const user = (userDB.id === id) ? userDB : false
    const user_auth = false
    let userDB = await DB.all_info()
    for (const user of userDB) {
      if(user.id === id) done(null, user);
    }

    // userDB.findById(id, function(err, user) {
    //   done(err, user);
    // });
    // done(null, user_auth);
 });


 passport.use(new LocalStrategy(
    async function(username, password, done) {
      let userDB = await DB.all_info()
      for (const user of userDB) {
        if(username === user.login){
          console.log(user);
          if(password === user.password){
            console.log(user);
            return done(null, user)
          }else{
            return done(null, false)
          }
        }
      }
    }
  ));