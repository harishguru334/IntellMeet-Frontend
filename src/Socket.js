import { io } from 'socket.io-client';

const socket = io('http://localhost:8000', {
  autoConnect: false // manually connect karenge meeting room mein
});

export default socket;