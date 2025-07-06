import express from 'express'
import { Server } from 'socket.io';
import path from 'path'
import { fileURLToPath } from 'url'


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const ADMIN = "Admin"
const app = express();

app.use(express.static(path.join(__dirname, "public")));

//state
const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray;
    }
}

const expressServer = app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
});

const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:5500", "http://127.0.0.1:5500"]
    }
})

io.on("connection", socket => {

    // Upon connection - only  to user
    socket.emit('message', buildMsg(ADMIN, "Welcome to Chat App!!!"));



    socket.on('enterRoom', ({ name, room }) => {
        //previous room;
        const previousRoom = getUser(socket.id)?.room;
        if (room) {
            socket.leave(previousRoom);
            io.to(previousRoom).emit('message', buildMsg(ADMIN, `${name} has left the room`));
        }

        const user = activateUser(socket.id, name, room);
        //cannot update previous room users list until after  the state update in activete user
        if (previousRoom) {
            io.to(previousRoom).emit('userList', { users: getUsersInRoom(previousRoom) });
        };

        //join new room
        socket.join(user.room);
        // to the user who joined the room;
        socket.emit('message', buildMsg(ADMIN, `You have joined ${user.room} chat room`));

        //to everone else
        socket.broadcast.emit('message', buildMsg(ADMIN, `${user.name} has joined the room`));

        // update userlist for new room
        io.to(user.room).emit('userList', {
            users: getUsersInRoom(user.room)
        })

        // update rooms for everyone
        io.emit('roomList', {
            rooms: getAllActiveRooms()
        })
    })

    // When user disconnects
    socket.on('disconnect', () => {
        const user = getUser(socket.id);
        userLeaveApp(socket.id);

        if (user) {
            io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has left the room`));
            io.to(user.room).emit('userList', {
                users: getUsersInRoom(user.room)
            })

            io.emit('roomList', {
                rooms: getAllActiveRooms()
            })
        }
    })

    // listening for message event
    socket.on("message", ({ name, text }) => {
        const room = getUser(socket.id)?.room;
        if (room) {
            io.to(room).emit('message', buildMsg(name, text))
        }
    })



    // listening for activity
    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room;

        if (room) {
            socket.broadcast.to(room).emit('activity', name)
        }

    })
});

function buildMsg(name, text) {
    return {
        name,
        text,
        time: new Intl.DateTimeFormat('default', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
        }).format(new Date())
    }
}

function activateUser(id, name, room) {
    const user = { id, name, room };
    UsersState.setUsers([...UsersState.users.filter(user => user.id !== id), user]);
    return user;
}

function userLeaveApp(id) {
    UsersState.users.filter(user => user.id !== id)
}


function getUser(id) {
    return UsersState.users.find(user => user.id === id);
}

function getUsersInRoom(room) {
    return UsersState.users.filter(user => user.room === room);
}

function getAllActiveRooms() {
    return Array.from( new Set(UsersState.users.map(user => user.room)))
}