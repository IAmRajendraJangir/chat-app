const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:4200',
        methods: ['GET', 'POST']
    }
});

const users = new Map();
const socketUsers = new Map();
const messageReaders = new Map();
const MAX_TRACKED_MESSAGES = 1000;
const MAX_CHAT_HISTORY = 500;
const chatHistory = [];

function getOnlineUsers() {
    return Array.from(users.entries()).map(([userId, user]) => ({
        userId,
        username: user.username,
        gender: user.gender,
        age: user.age
    }));
}

io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    socket.on('register-user', ({ userId, username, gender, age }) => {
        if (!userId || !username?.trim() || !['Male', 'Female'].includes(gender) ||
            !Number.isInteger(age) || age < 18 || age > 99) {
            return;
        }

        const existingUser = users.get(userId);
        users.set(userId, {
            username: username.trim(),
            gender,
            age,
            sockets: existingUser?.sockets.add(socket.id) ?? new Set([socket.id])
        });
        socketUsers.set(socket.id, userId);
        socket.emit('chat-history', chatHistory);
        socket.emit('presence-snapshot', getOnlineUsers());
        io.emit('presence-change', {
            online: true,
            user: { userId, username: username.trim(), gender, age }
        });
    });

    socket.on('chat-message', (message) => {
        const userId = socketUsers.get(socket.id);
        const user = users.get(userId);
        if (!user || !message.text?.trim()) {
            return;
        }

        const chatMessage = {
            id: crypto.randomUUID(),
            userId,
            user: user.username,
            gender: user.gender,
            age: user.age,
            text: message.text.trim(),
            time: new Date(),
            readBy: 0
        };

        chatHistory.push(chatMessage);
        if (chatHistory.length > MAX_CHAT_HISTORY) {
            chatHistory.shift();
        }
        io.emit('chat-message', chatMessage);
    });

    socket.on('typing', (isTyping) => {
        const userId = socketUsers.get(socket.id);
        const user = users.get(userId);
        if (user) {
            socket.broadcast.emit('typing-update', {
                userId,
                username: user.username,
                gender: user.gender,
                age: user.age,
                isTyping: Boolean(isTyping)
            });
        }
    });

    socket.on('message-read', (messageId) => {
        const userId = socketUsers.get(socket.id);
        if (!userId || !messageId) {
            return;
        }

        let readers = messageReaders.get(messageId);
        if (!readers) {
            readers = new Set();
            messageReaders.set(messageId, readers);
            if (messageReaders.size > MAX_TRACKED_MESSAGES) {
                messageReaders.delete(messageReaders.keys().next().value);
            }
        }

        const previousCount = readers.size;
        readers.add(userId);
        if (readers.size !== previousCount) {
            const message = chatHistory.find(item => item.id === messageId);
            if (message) {
                message.readBy = readers.size;
            }
            io.emit('read-receipt', { messageId, readBy: readers.size });
        }
    });

    socket.on('disconnect', () => {
        const userId = socketUsers.get(socket.id);
        const user = users.get(userId);
        socketUsers.delete(socket.id);

        if (user) {
            user.sockets.delete(socket.id);
            if (user.sockets.size === 0) {
                users.delete(userId);
                io.emit('presence-change', {
                    online: false,
                    user: { userId, username: user.username, gender: user.gender, age: user.age }
                });
            }
        }

        console.log('User Disconnected:', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});