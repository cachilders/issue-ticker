const net = require('net');
const Client = require('./socket-client');
const { HOST, SOCKET_PORT } = process.env;

class Server {
  constructor() {
    this.port = SOCKET_PORT || 5501;
    this.host = HOST || 'localhost';
    this.clients = [];
  }

  start(callback) {
    let server = this;
    server.connection = net.createServer((socket) => {
      let client = new Client(socket);
      server.welcome(client);
      server.broadcast(`${client.name} is attached.`, client);
      server.clients.push(client);

      socket.on('data', (data) => { 
        server.broadcast(`${client.name}: ${data}`, client);
      });

      socket.on('end', () => {
        server.clients.splice(server.clients.indexOf(client), 1);
        server.broadcast(`${client.name} is detached.\n`);
      });
    });
    this.connection.listen(this.port, this.address);
    this.connection.on('listening', callback);
  }

  welcome(client) {
    client.receiveMessage(`Connected to feed at ${new Date()}`);
  }

  broadcast(message, clientSender) {
    this.clients.forEach((client) => {
      if (client === clientSender) return;
      client.receiveMessage(message);
    });
    console.log(message.replace(/\n+$/, ""));
  }  
}

module.exports = new Server();
