# SChat
SChat is a **s**imple **chat** interface that uses NodeJS to create publicly accessible chat rooms with randomly generated chat IDs.

## How to use
1. Download this repo
2. **Create a `chatlogs` folder in the same directory as `index.js`**
3. Run index.js
4. Go to `localhost:8080/chat` in your browser
5. Enjoy the chat room :)

## Notes
- All chats have the url `/chat/<CHAT_ID>`
- Going to `/chat` finds a new (untaken) CHAT_ID and directs the user to that room
- The logs of all the chats are stored in `chatlogs` folder on the server (create this folder yourself)
- Read-only rooms are supported - have a look at the source code of `index.js` and `interface.html`!
- This may or may not crash if too many requests are received (untested!)
