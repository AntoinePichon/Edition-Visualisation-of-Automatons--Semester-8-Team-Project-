//Initialisation des variables
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var fs = require('fs');
var save = 0;
var id = 0;
var lock; // false = graphe non bloqué, true = graphe bloqué
var active = Math.floor(Math.random()*5);
var random;
var saved_graph = [];
var upload_graph;
var current_graph_title;
var port = 4567;

//  Chargement du fichier index.html affiché au client
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/client.html');
});

// Répertoire public contenant les fichiers statiques à importer au HTML
app.use(express.static(__dirname + '/public/icons'));
app.use(express.static(__dirname + '/public/libraries'));
app.use(express.static(__dirname + '/public/main_js_file'));
app.use(express.static(__dirname + '/public/style'));

// Récupérer fichier .json stocké côté serveur
var path = "./Graphs/";
fs.readdir(path, function(err, items) {
  saved_graph = [];
  console.log('\n \n \n-------------------------------------- WELCOME ON AUTOVIZ INTERFACE --------------------------------------\n \n \n' + 'Existing graphs list :');
  for (var i=0; i<items.length; i++) {
    if (items[i].indexOf(".json") >= 0){
      saved_graph.push(items[i]);
      console.log('\n    - ' + items[i]);
    }
  }
  console.log('\n');
  console.log("You can connect to port " + port);
  console.log('\n');
});

// Chargement de socket.io
var io = require('socket.io').listen(server);
var j=0;

// Quand un client se connecte, on le note dans la console
io.sockets.on('connection', function (socket) {
  socket.emit('connect', 'Hello dear client! \nChoose a title for your graph !');
  socket.emit('message', socket.id);
  socket.emit('saved_graph',saved_graph);
  
  socket.on('new_client', function(){
    console.log('[SERVER] New client binded on port ' + port + ', id = ' + id + '\n');
    socket.id = id;
    socket.emit('id',id);
    id++;
  })


  // Mise en place d'un verrou pour protéger l'accès à un graphe déjà en cours d'édition
  // Si on reçoit un signal "sig_edit" on regarde la valeur de isLocked pour donner ou non l'accès en édition
  socket.on('ack_edit', function (sig_edit) {
    console.log('[SERVER] Client ' + socket.id + ' is asking for the edition token \n');
    if (lock == undefined) {
      socket.emit('nobody_edit', 'Edition allowed : you have the edition token');
      lock = socket.id;

/*    }else if(lock == socket.id){
      socket.emit('you_edit', 'You already have the edition');
*/    } else {
      socket.emit('already_edit','Edition refused : another client is editing this graph');
    }
    sig_edit = 0;
  });

  socket.on('return', function(sig_edit){
    console.log('[SERVER] Edition token free \n');
    lock = undefined;
  })

  //Update save quand on downloade le graphe
  socket.on('Graphe_save', function(blob){
    var Graphs = [];
    save = String(blob.content);
    console.log('[SERVER] Graph fully received (JSON file)\n');
    if(blob.new == 'yes') { 
      j = j+1;
    } fs.writeFile('./Graphs/Graph'+ j + '.json', blob.content);
    Graphs.push('Graph'+ j + '.json');
    // Récupérer fichier .json stocké côté serveur
    saved_graph = [];
    fs.readdir(path, function(err, items) {
      for (var i=0; i<items.length; i++) {
        if (items[i].indexOf(".json") >= 0){
          saved_graph.push(items[i]);
          console.log(items[i]);
        }
      }
      io.emit('update_saved_graph', saved_graph);
    });
  });
  
// Sauvegarde le graph en .json après demande du titre
  socket.on('new_graph', function(graph){
    var Graphs = [];
    current_graph_title = graph.title + '.json';
    save = 0;
    console.log('[SERVER] Graph saved (JSON file)\n');
    fs.writeFile('./Graphs/' + graph.title + '.json', graph.content);
    Graphs.push(graph.title + '.json');
    // Récupérer fichier .json stocké côté serveur
    saved_graph = [];
    fs.readdir(path, function(err, items) {
      for (var i=0; i<items.length; i++) {
        if (items[i].indexOf(".json") >= 0){
          saved_graph.push(items[i]);
          console.log(items[i]);
        }
      }
      io.emit('update_saved_graph', saved_graph);
    });
  });


  //Update save toutes les 5 sec pour les clients qui n'ont pas accès à l'édition
  // Save le graph toute les 5sec
  socket.on('Graphe_five', function(blob){
    save = String(blob);
    fs.writeFile('./Graphs/' + current_graph_title, blob);
    socket.broadcast.emit('Graphe_five', save);
    console.log('[SERVER] Graph broadcasted to others clients and saved \n');
  });

  // Lors d'un rafraichissement, charge save si != 0
  socket.on('Graphe_connect', function(blob) {
    if(save == 0){
      save = String(blob);
   } //console.log('[SERVER] Graph charged' + save);
    io.emit('Graphe_connect', {title: current_graph_title, blob:save});
  });

  socket.on('uploaded', function(blob){
    save = String(blob);
    console.log('[SERVER] Graph uploaded on server\n');
    io.emit('Graphe_connect', save);
  })

  /*  socket.on('play', function(play){
      if(play == true){
        random = setInterval( function(){
         active =  Math.floor(Math.random()*5);
         io.emit('changeActive', active);
       } , 1000 );
      }else if(play == false){
        clearInterval(random);
      }
    });
*/
  
  socket.on('upload_graph', function(file_name){
    current_graph_title = file_name;
    console.log('[SERVER] Uploading ' + file_name + '\n');
    fs.readFile('./Graphs/' + file_name, 'utf8', function (err, data) {
      if (err) throw err;
      upload_graph = data;
      console.log(upload_graph);
      io.emit('Graphe_connect', {title:file_name, blob:upload_graph});
    });
  });

  socket.on('get_graph', function(graph){
    var graph = save;
    socket.emit('get_graph', save);
  })

  socket.on('sendWord', function(testWord){
    var word=testWord;
    console.log(word);
    var tab = [];
    var activenodes= [];
    activenodes[0]=0;

    save1 = JSON.parse(save);
    save1.active = save1.init;
    for (var j=0; j<word.length; j++){

      var verif=0;
      console.log(save1.init + " Init");
      for (var i = 0; i < save1.edges.length; i++) {
        console.log(save1.active + " Active")
        if(save1.edges[i].source==save1.active && verif==0) {
      
          //if (save1.edges[i].transition==word.charAt(j)){
          var reg= new RegExp(String(save1.edges[i].transition),"i");
          // console.log('[SERVER] Character n°' + j + ' : ' + reg.test(word.charAt(j))); 
          if (reg.test(word.charAt(j))) {
            save1.active=save1.edges[i].target;
            tab[j]=word.charAt(j);
            activenodes[j+1]=save1.active;
            verif=1;
          }
        }
      };
      if (verif==0) {
        socket.emit('messageError',"Invalid word, please try another one");
        socket.emit('activenodes',{ 'activenodes': activenodes , 'color': 'red' });
        j=word.length;
      } 
      //ERREUR : NOEUD D'ERREUR : NOEUD À ID = -1 (TOUCHE POUR L'AJOUTER)
    };
    console.log('[SERVER] Regular expresion path activated nodes : ' + activenodes + '\n');
    if (tab.length==word.length) {

      if(save1.finals.indexOf(save1.active)!=-1){
      // console.log('[SERVER] Comparition done \n');
      socket.emit('activenodes',{ 'activenodes': activenodes , 'color': '#32CD32' });
    word="";
    }
    else{
      socket.emit('messageErrorFinal',"The last state is not a final state");
      socket.emit('activenodes',{ 'activenodes': activenodes , 'color': 'red' });
      word="";
    }
    }
  });
});

server.listen(port);
