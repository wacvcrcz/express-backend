# Real-Time Chat Application Backend

A production-ready real-time chat application backend built with Node.js, Express, Socket.io, and MongoDB.

## Features Implemented (Phase 1 MVP)

### ✅ Authentication & User Management
- User registration with email/password
- JWT-based authentication
- Profile management (display name, avatar, bio)
- Device registration for push notifications
- Online/offline presence tracking

### ✅ Real-Time Messaging
- WebSocket-based real-time communication via Socket.io
- Private and group chat rooms
- Message persistence in MongoDB
- Typing indicators
- Read receipts
- Message delivery confirmations

### ✅ Chat Room Management
- Create private chats (1-on-1)
- Create group chats
- Add/remove participants
- Leave rooms
- Room participant management

### ✅ Message Features
- Multiple content types (text, image, video, audio, file)
- Message replies
- Reactions (emoji)
- Message deletion
- Message history with pagination

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Real-Time:** Socket.io
- **Database:** MongoDB
- **Authentication:** JWT
- **Security:** Helmet, CORS, Rate Limiting, Bcrypt
- **Validation:** Express Validator

## Project Structure

```
express-backend/
├── config/
│   └── database.js          # MongoDB connection
├── controllers/
│   ├── authController.js    # Authentication logic
│   ├── roomController.js    # Room management
│   └── messageController.js # Message handling
├── middleware/
│   └── auth.js              # JWT authentication middleware
├── models/
│   ├── User.js              # User schema
│   ├── Room.js              # Room schema
│   └── Message.js           # Message schema
├── routes/
│   ├── authRoutes.js        # Auth endpoints
│   ├── roomRoutes.js        # Room endpoints
│   └── messageRoutes.js     # Message endpoints
├── utils/
│   └── socket.js            # Socket.io handlers
├── server.js                # Main server file
├── package.json
├── .env                     # Environment variables
├── .env.example             # Environment template
└── .gitignore
```

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/wacvcrcz/express-backend.git
   cd express-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your configuration:
   ```env
   NODE_ENV=development
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/chatapp
   JWT_SECRET=your-secret-key-here
   JWT_EXPIRES_IN=7d
   CLIENT_URL=http://localhost:3001
   ```

4. **Start MongoDB**
   ```bash
   # Using MongoDB locally
   mongod

   # Or using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

The server will start on `http://localhost:3000`

## API Endpoints

### Authentication

#### POST `/api/auth/register`
Register a new user

**Request:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "username": "john_doe",
      "email": "john@example.com",
      "profile": { ... }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### POST `/api/auth/login`
Login with email/password

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

#### GET `/api/auth/me`
Get current user profile (requires authentication)

#### PATCH `/api/auth/me`
Update user profile

#### POST `/api/auth/me/devices`
Register device for push notifications

#### POST `/api/auth/logout`
Logout user

### Rooms

#### POST `/api/rooms`
Create a new room

**Request (Group):**
```json
{
  "type": "group",
  "groupSettings": {
    "name": "Team Chat",
    "description": "Project discussion"
  },
  "participants": [
    { "userId": "user_id_1" },
    { "userId": "user_id_2" }
  ]
}
```

**Request (Private):**
```json
{
  "type": "private"
}
```

#### GET `/api/rooms`
Get all rooms for authenticated user

#### GET `/api/rooms/:roomId`
Get room details

#### POST `/api/rooms/private`
Create or get private chat with user

**Request:**
```json
{
  "userId": "user_id"
}
```

#### POST `/api/rooms/:roomId/participants`
Add participant to room (admin only)

#### DELETE `/api/rooms/:roomId/participants/:userId`
Remove participant from room

#### POST `/api/rooms/:roomId/leave`
Leave a room

### Messages

#### GET `/api/messages/:roomId/messages`
Get messages for a room

**Query params:**
- `limit` (default: 50) - Number of messages
- `before` - Cursor for pagination

#### POST `/api/messages/:roomId/messages`
Send a message

**Request:**
```json
{
  "content": {
    "type": "text",
    "text": "Hello everyone!"
  },
  "replyTo": "message_id" // optional
}
```

#### POST `/api/messages/mark-read`
Mark message as read

**Request:**
```json
{
  "roomId": "room_id",
  "messageId": "message_id"
}
```

#### POST `/api/messages/messages/:messageId/reactions`
Add reaction to message

**Request:**
```json
{
  "emoji": "👍"
}
```

#### DELETE `/api/messages/messages/:messageId/reactions/:emoji`
Remove reaction

#### DELETE `/api/messages/messages/:messageId`
Delete message (sender or admin only)

## WebSocket Events

### Client → Server

#### `auth:authenticate`
Authenticate WebSocket connection

**Payload:**
```javascript
{
  token: "jwt_token_here"
}
```

#### `message:send`
Send a message

**Payload:**
```javascript
{
  roomId: "room_id",
  content: {
    type: "text",
    text: "Hello!"
  },
  replyTo: "message_id" // optional
}
```

#### `message:read`
Mark message as read

**Payload:**
```javascript
{
  roomId: "room_id",
  messageId: "message_id"
}
```

#### `typing:start`
Start typing indicator

**Payload:**
```javascript
{
  roomId: "room_id"
}
```

#### `typing:stop`
Stop typing indicator

**Payload:**
```javascript
{
  roomId: "room_id"
}
```

#### `presence:update`
Update presence status

**Payload:**
```javascript
{
  status: "online" | "away" | "offline"
}
```

#### `room:join`
Join a room

**Payload:**
```javascript
{
  roomId: "room_id"
}
```

#### `room:leave`
Leave a room

**Payload:**
```javascript
{
  roomId: "room_id"
}
```

### Server → Client

#### `message:receive`
Receive a message

#### `message:delivered`
Message delivery confirmation

#### `message:read`
Read receipt notification

#### `typing:status`
Typing indicator status

#### `presence:changed`
User presence change

#### `error`
Error message

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/chatapp` |
| `JWT_SECRET` | JWT secret key | (required) |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `CLIENT_URL` | Client URL for CORS | `*` |

## Security Features

- ✅ JWT authentication
- ✅ Password hashing with bcrypt
- ✅ Rate limiting
- ✅ Helmet security headers
- ✅ CORS configuration
- ✅ Input validation
- ✅ SQL injection prevention (parameterized queries)

## Future Enhancements

See the full implementation roadmap in the architecture plan for upcoming features:

- Phase 2: Enhanced group messaging
- Phase 3: Read receipts & delivery tracking
- Phase 4: Ephemeral messages
- Phase 5: Push notifications
- Phase 6: Video/audio calls (WebRTC)
- Phase 7: Advanced features (reactions, replies, media)
- Phase 8: Security hardening
- Phase 9: Scalability & performance
- Phase 10: Testing & deployment

## Development

### Running tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

## License

ISC

## Author

wacvcrcz

## Repository

https://github.com/wacvcrcz/express-backend