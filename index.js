const fs = require("fs");
const http = require('http');

const streams = {};

const readOnlyRooms = [
  "announcements"
];

const allValidChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-";

const return404 = (resp) => {
  resp.writeHead(404, {'Content-Type': 'text/html'});
  resp.end(`
    <h1>404 Not Found</h1>
    <hr>
    <p>This page does not exist on the server.</p>
    <p>Please check your spelling.</p>
    `);
}

const sendMsg = ({name, msg, room}) => {
  if (typeof name !== "string" || typeof msg !== "string" || typeof room !== "string") {
    return {
      success: false,
      code: 400,
      status: "Invalid Request - Not string!"
    }
  } else if (name.length > 32) {
    // Name and message length should have been checked on client-side already, so this is just a fallback
    return {
      success: false,
      code: 400,
      status: "Name too long"
    }
  } else if (msg.length > 256) {
    return {
      success: false,
      code: 400,
      status: "Message too long"
    }
  } else if (!room || room.match(/[^a-zA-Z0-9\-]/)) {
    return {
      success: false,
      code: 400,
      status: "Invalid room"
    }
  }

  // All OK!
  // Below: CC BY-SA 4.0: https://stackoverflow.com/a/43370201
  try {
    if (!streams[room]) {
      try { fs.readFileSync(`chatlogs/${room}.txt`) }
      catch(e) { console.log(e); return { success: false, code: 404, status: "Room Not Found"}}
      const tempStream = fs.createWriteStream("chatlogs/" + room + ".txt", {flags: "a"});
      tempStream.end();
      streams[room] = fs.createWriteStream("chatlogs/" + room + ".txt", {flags:'a'});
    }
    streams[room].write(`\
${name}
${Date.now()}
${msg.split("\n").join(" ")}

`); // append a newline to the end so there's a one-line break between each message
    return {
      success: true,
      code: 200,
      status: "OK"
    }
  } catch {
    return {
      success: false,
      code: 500,
      status: "IDK :("
    }
  }
}

http.createServer(function (req, res) {
  if (req.url.startsWith("/chat/")) {
    console.log("Accessing a chat room: " + req.url);
    // This is the main interface page

    if (!req.url.match(/^\/chat\/[a-zA-Z0-9\-]+$/)) {
      res.writeHead(400, {"content-type": "text/html"});
      res.end("Invalid room name, click <a href=\"/chat\">here</a> to start a new room");
      return;
    }

    const chatRoomName = req.url.match(/^\/chat\/([a-zA-Z0-9\-]+)$/)[1];
    
    console.log(chatRoomName);
    if (!chatRoomName.match(/^[a-zA-Z0-9\-]+$/)) {
      res.writeHead(400);
      res.end();
      return;
    }

    try { fs.readFileSync(`chatlogs/${chatRoomName}.txt`); }
    catch(e) { return404(res); console.log("Chat room not found"); console.log(e); return; }

    fs.readFile("pages/interface.html", "utf8", (err, data) => {
      if (err) {
        console.log(err);
        res.writeHead(500, {"Content-Type": "text/html"});
        res.end(`
          <h1>500 Internal Server Error</h1>
          <hr>
          <p>The server encountered an error. Please try again later.</p>`);
      } else {
        data = data.split("{{chatRoomName}}").join(chatRoomName);
        res.writeHead(200, {"Content-Type": "text/html"});
        res.write(data);
        res.end();
      }
    })
  } else if (req.url === "/chat") {
    res.writeHead(200, {"content-type": "text/html"});
    let isFound = false;
    let ending = "error: no available chat room found, reload to try again";
    const randLength = 16;
    const maxPossibleTries = 15; // don't try more than this amount of times
    for (let counter=0; counter<maxPossibleTries; counter++) {
      let randStr = "";
      for (let i=0; i<randLength; i++) {
        randStr += allValidChars[Math.floor(Math.random() * allValidChars.length)];
      }
      try { fs.readFileSync(`chatlogs/${randStr}.txt`) }
      catch(e) {
        if (e.message.indexOf("ENOENT") !== -1) {
          // YIPPEE FILE DOES NOT EXIST
          console.log(counter);
          isFound = true;
          try {
            fs.writeFile(`chatlogs/${randStr}.txt`, "", ()=>{});
            ending = `<script>location.replace("/chat/${randStr}");</script>`;
            console.log(randStr);
            console.log(e);
            break;
          } catch(e) {
            ending = JSON.stringify(e);
          }
        } 
      }
    }
    res.end(ending);
  } else if (req.url.startsWith("/message")) {
    // Request to send message
    const urlObj = new URL(req.url, "https://example.com");
    const params = urlObj.searchParams;
    const name = params.get("name");
    const message = params.get("message");
    const room = params.get("room");

    console.log(`${name} ${message} ${room}`)

    if (!name || !message || !room) {
      res.writeHead(500);
      res.end("Required query parameters not found!");
    } else {
      if (readOnlyRooms.includes(room)) {
        res.writeHead(403, {"X-Error-Msg": "Read-only room!"});
        res.end("Read-only-room!");
      } else {
        let response = sendMsg({name: name, msg: message, room: room});
        res.writeHead(response.code, response.status, 
          response.success ? undefined : {"X-Error-Msg": response.status});
        console.log(`${name} - ${message} - ${room} - ${response.code} - ${response.status}`)
        res.end();
      }
    }
  } else if (req.url === "/log") {
    // Request for the chat logs
    const chatRoom = req.headers["x-schat-log-room"];
    if (!chatRoom) {
      return404(res);
    } else {
      fs.readFile(`chatlogs/${chatRoom}.txt`, "utf8", (err, data) => {
        if (err) {
          /* fs.writeFile(`chatlogs/${chatRoom}.txt`, "", "utf8", (err_inner, data_inner) => {
            if (err_inner) {
              console.log(err); */
              return404(res); /*
            } else {
              res.writeHead(200, {"content-type": "text/plain"});
              res.write("");
              res.end();
            }
          }); */
        } else {
          res.writeHead(200, {"content-type": "text/plain"});
          res.write(data);
          res.end();

          if (data.trim().split("\n\n").length > 100) {
            // If >100 messages in chat, we cut down
            const msgList = data.trim().split("\n\n");
            const newData = Array.from(msgList.slice(msgList.length-100));
            fs.writeFileSync(`chatlogs/${chatRoom}.txt`, newData.join("\n\n"));
          }
        }
      })
    }
  } else if (req.url === "/ip") {
    res.writeHead(200, {"Content-Type": "text/plain"});
    res.end(req.socket.remoteAddress);
  } else {
    res.writeHead(404, {'Content-Type': 'text/html'});
    res.end(`
      <h1>404 Not Found</h1>
      <hr>
      <p>This page does not exist on the server.</p>
      <p>Please check your spelling.</p>
      `);
  }
}).listen(8080);