const path = require('path')
const express = require('express')
const passport = require('passport')
const session = require('express-session')
// const RedisStore = require('connect-redis')(session)
const FileStore = require('session-file-store')(session)

const exphbs = require('express-handlebars')
const app = express()
const Router = require('./routes/router.js')
let server = require('http').Server(app);
let io = require('socket.io').listen(server);
const read = require('./read.js')
const EventEmitter = require('events')
const listen = new EventEmitter;
const fs = require('fs');
const bodyParser = require('body-parser')


server.listen(3005)
app.engine('.hbs', exphbs({
    defaultLayout: 'main',
    extname: '.hbs',
    layoutsDir: path.join(__dirname, 'views/layouts')
}))


let current_status;

process.on('message', message=>{
    //console.log(message);
    
    current_status = message.status;
})


io.on('connection', function (socket) {
    let d = fs.readFileSync('./config.json');
    let config = JSON.parse(d)
    console.log('connect');
    
    socket.on('command', function (command) { process.send(command) });

    socket.on('message',message=>{
        console.log(message)
        if(message.machine){
            for (let [index, machine] of config.machines.entries()){
                machine.index = index;
                if(machine.name ==message.machine) socket.emit('operators',machine)
                
            }
        }else if(message.name){
            console.log(message.name);
            
            for (let machine of config.machines){
                //machine.onlineDevices= read.status(current_status)
                if(machine.name ==message.name) socket.emit('info',machine);
                //if(machine.name ==message.name) socket.emit('info',{machine:machine,online:read.status(current_status)});
            }
        }else if(message.del){
            read.del(message.del)
            console.log(message.del);
        }else if(message.online){
            socket.emit('onlineDev', read.status(current_status))
        }
        
    })

    process.on('message',message=>{
        if(message.status){
            socket.emit('status',message.status)
        }else if(message.newRFID){
            console.log(message);
            socket.emit('RFID', message.newRFID)
        }else if(message.writeSucces){
            console.log('умпешно записано');
            config = message.writeSucces
            
            socket.emit('writeSucess',message.writeSucces);
        }else if(message.report){
            console.log('report');
            
            socket.emit('report', message.report)
        }
        
    })  

    socket.on('disconnect', function () {
        console.log('disconnect');
        io.emit('user disconnected');
        socket.disconnect(0);
      });
})

app.set('view engine', '.hbs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.urlencoded({extended:true}))





// app.use(bodyParser.json())

// let users = [
//     { username: 'admin', password:'6609049' }
// ]

// let sessionHandler = require('./js/session_handler')
// let store = sessionHandler.createStore()


app.use(session({
    store: new FileStore(),
    resave: false,
    saveUninitialized: false,
    secret: 'supersecret',
    cookie: {
        path:'/',
        httpOnly: true,
        maxAge: 60*60*1000
    }
}))

// require('./passport-config')
app.use(passport.initialize())
app.use(passport.session())

// app.post('/login',function(req, res, next) {
//     passport.authenticate('local', function(err, user, info) {
//       if (err) { return next(err); }
//       if (!user) { return res.send('не верный логин пароль'); }
//       req.logIn(user, function(err) {
//         if (err) { return next(err); }
//         return res.redirect('/');
//       });
//     })(req, res, next);
//   });

// const auth = (req, res, next) => {
//     if(req.isAuthenticated()){
//         next()
//     }else{
//         return res.redirect('login')
//     }

// }

// app.get('/', auth, (req,res)=>{
//     console.log('HOME');
//     res.render('home', {
//         title: 'Настройка',
//         names: read.names()
//     })
// })

// app.get('/login', (req,res)=>{
//     console.log('login');
//     res.render('login', {
//         title: 'login'
//     })
// })


app.use(Router)
