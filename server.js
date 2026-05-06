// ===== IMPORTS =====
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = "mysupersecretkey";


// ===== APP SETUP =====
const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server);


// ===== STATIC FILES =====
app.use(express.static("public"));


// ===== DATABASE =====
mongoose.connect("mongodb://127.0.0.1:27017/smarthome")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Error:", err));


// ===== SCHEMAS =====

// USER
const userSchema = new mongoose.Schema({
  username: String,
  password: String
});

// DEVICE
const deviceSchema = new mongoose.Schema({
  name: String,
  status: String,
  type: String,
  room: String,
  userId: mongoose.Schema.Types.ObjectId
});

// ROOM
const roomSchema = new mongoose.Schema({
  name: String,
  userId: mongoose.Schema.Types.ObjectId
});


// ===== MODELS =====
const User = mongoose.model("User", userSchema);
const Device = mongoose.model("Device", deviceSchema);
const Room = mongoose.model("Room", roomSchema);


// ===== AUTH ROUTES =====

// REGISTER
app.post("/register", async (req, res) => {

  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({
      message: "Username and password required"
    });
  }

  // PASSWORD VALIDATION
  const strongRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

  if (!strongRegex.test(password)) {
    return res.json({
      message: "Weak password"
    });
  }

  const exists = await User.findOne({ username });

  if (exists) {
    return res.json({
      message: "User already exists"
    });
  }

  const hashedPassword =
    await bcrypt.hash(password, 10);

  await User.create({
    username,
    password: hashedPassword
  });

  res.json({
    message: "User registered successfully"
  });
});


// LOGIN
app.post("/login", async (req, res) => {

  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user) {
    return res.json({
      message: "Invalid credentials"
    });
  }

  const valid =
    await bcrypt.compare(password, user.password);

  if (!valid) {
    return res.json({
      message: "Invalid credentials"
    });
  }

  const token = jwt.sign(
    { userId: user._id },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({ token });
});


// ===== SOCKET AUTH =====
io.use((socket, next) => {

  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error"));
  }

  try {

    const decoded =
      jwt.verify(token, JWT_SECRET);

    socket.userId = decoded.userId;

    next();

  } catch (err) {

    next(new Error("Authentication error"));
  }
});


// ===== SOCKET CONNECTION =====
io.on("connection", async (socket) => {

  console.log("User connected");


  // ===== SEND DEVICES =====
  const devices = await Device.find({
    userId: socket.userId
  });

  socket.emit("updateDevices", devices);

  // ===== SEND ROOMS =====
  const rooms = await Room.find({
    userId: socket.userId
  });

  socket.emit("updateRooms", rooms);


  // ===== TOGGLE DEVICE =====
  socket.on("toggleDevice", async (deviceName) => {

    const device = await Device.findOne({
      name: deviceName,
      userId: socket.userId
    });

    if (device) {

      device.status =
        device.status === "ON" ? "OFF" : "ON";

      await device.save();
    }

    const updatedDevices = await Device.find({
      userId: socket.userId
    });

    socket.emit("updateDevices", updatedDevices);
  });


  // ===== ADD DEVICE =====
  socket.on("addDevice", async (data) => {

    const { name, type, room } = data;

    if (!name || !type || !room) return;

    const exists = await Device.findOne({
      name: name,
      room: room,
      userId: socket.userId
    });

    if (!exists) {

      await Device.create({
        name,
        type,
        room,
        status: "OFF",
        userId: socket.userId
      });
    }

    const updatedDevices = await Device.find({
      userId: socket.userId
    });

    socket.emit("updateDevices", updatedDevices);
  });

// ===== ADD ROOM =====
socket.on("addRoom", async (roomName) => {

  if (!roomName) return;

  const exists = await Room.findOne({
    name: roomName,
    userId: socket.userId
  });

  if (!exists) {

    await Room.create({
      name: roomName,
      userId: socket.userId
    });
  }

  const updatedRooms = await Room.find({
    userId: socket.userId
  });

  socket.emit("updateRooms", updatedRooms);
});

  // ===== DELETE DEVICE =====
  socket.on("deleteDevice", async (deviceName) => {

    await Device.deleteOne({
      name: deviceName,
      userId: socket.userId
    });

    const updatedDevices = await Device.find({
      userId: socket.userId
    });

    socket.emit("updateDevices", updatedDevices);
  });


  // ===== ADD ROOM =====
  socket.on("addRoom", async (roomName) => {

    if (!roomName) return;

    const exists = await Room.findOne({
      name: roomName,
      userId: socket.userId
    });

    if (!exists) {

      await Room.create({
        name: roomName,
        userId: socket.userId
      });
    }

    const updatedRooms = await Room.find({
      userId: socket.userId
    });

    socket.emit("updateRooms", updatedRooms);
  });


  // ===== DISCONNECT =====
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

});


// ===== START SERVER =====
server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});