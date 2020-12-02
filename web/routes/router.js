const {Router} = require('express')
const router = Router();
const read = require('../read.js')
const DB = require('/opt/monitoring/write_to_DB.js')
const fs = require('fs');
let d = fs.readFileSync('./config.json');
let config = JSON.parse(d)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));



// const session = require('express-session')

let current_status;

process.on('message',message=>{
    if(message.status){
        current_status = message.status.data
    } 
})

const auth = (req, res, next) => {
    if(req.isAuthenticated()){
        next()
    }else{
        return res.redirect('/login')
    }

}

router.get('/', auth, (req,res)=>{
    //console.log('HOME');
    res.render('home', {
        title: 'Настройка',
        devices: read.names(),
        login: req.user.login
    })
})


router.get('/add', auth, (req,res)=>{
    res.render('add',{
        title:'Новый станок',
        heading:'Новый станок',
        names: read.names(),
        online: read.status(current_status),
        connect_types: config.connections,
        groups: config.groups,
        add:"add",
        login: req.user.login
    })
})

router.post('/add', auth, async (req,res)=>{
    //console.log(req.body);
    read.add(req.body)
    res.redirect('/')
})

router.get('/add_user', auth, async (req,res)=>{
    if(req.user.login=='admin'){
        res.render('add_user',{
            title:'добавить нового пользователя',
            login: req.user.login        
        })
    }else{
        res.send('у вас нет доступа к данной странице')
    }
})

router.post('/add_user', auth, async (req,res)=>{
    await DB.new_user(req.body)

    // read.add(req.body)
    res.redirect('/admin')
})


router.get('/panel/:machineName', auth, (req,res)=>{
    //console.log(req.params.machineName);

    let machine = read.machine_info(req.params.machineName)
    //console.log(machine);
    
    res.render('panel',{
        title:'Панель',
        machineName: req.params.machineName,       
        machineAdress: machine.connect == 'udp-mb' ? machine.adress : machine.adress[0],
        login: req.user.login        
    }) 
})



router.get('/edit/:machineName', auth, (req,res)=>{
    //let machine = read.machine_info(req.params.machineName)
    //console.log(current_status)
    //let online = read.status(current_status)
    res.render('add',{
        title:'Редактирование', 
        heading: req.params.machineName, 
        online: read.status(current_status),
        connect_types: config.connections,
        groups: config.groups,
        add: "edit",
        login: req.user.login 
        //machineName: req.params.machineName,       
        //machineAdress: machine.adress          
    }) 
})

router.post('/edit', auth, async (req,res)=>{
    //console.log(req)
    //console.log(req.body);
    read.edit(req.body)
    res.redirect('/')
})

// router.get('/ventilation', (req,res)=>{
//     res.render('ventilation',{
//         title:'Вентиляция'
//     })
// })

// router.get('/ventilation', (req,res)=>{
//     res.render('ventilation',{
//         title:'Вентиляция'
//     })
// })


router.get('/login', (req,res)=>{
    console.log('login');
    res.render('login', {
        title: 'login'
    })
})

router.get('/forget', (req,res)=>{
    res.render('forget', {
        title: 'login'
    })
})

router.post('/forget', (req,res)=>{
    // console.log(req);
    if(req.body.username=='admin'){
        return res.redirect('/pin');
    }else{
        res.send('обратитесь к администратору')
    }
    
})

router.get('/pin', (req,res)=>{
    res.render('pin', {
        title: 'drop'
    })
})

router.post('/pin', async (req,res)=>{
    let drop = await DB.drop_admin_password(req.body)
    if(drop){
        // res.send('пароль успешно изменён')
        // await sleep(1000)
        res.redirect('/login')
    }else{
        res.send('ошибка')
    }
})

const passport = require('passport')
require('../passport-config')
// router.use(passport.initialize())
// router.use(passport.session())

router.post('/login',function(req, res, next) {
    passport.authenticate('local', function(err, user, info) {
      if (err) { return next(err); }
      if (!user) { return res.send('не верный логин пароль'); }
      req.logIn(user, function(err) {
        if (err) { return next(err); }
        return res.redirect('/');
      });
    })(req, res, next);
  });

router.get('/admin', auth, async (req,res)=>{
    //console.log(req.isAuthenticated());
    //console.log(req.user.login);
    if(req.user.login=='admin'){
        let users = await DB.users()
        res.render('admin', {
            title: 'admin',
            names: users,
            login: req.user.login
        })
    }else{
        res.send('у вас нет доступа к данной странице')
    }
})

router.get('/delete/:user', auth, async (req,res)=>{
    console.log('delete '+req.params.user);
    if(req.params.user != 'admin'){
        await DB.delete_user(req.params.user)
        res.redirect('/admin');
    }else{
        res.send('нельзя удалить администратора')
    }
})

router.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
  });

module.exports = router;
