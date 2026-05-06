// ================= IMPORTS =================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


// ================= SECRET KEY =================

const JWT_SECRET = "mysupersecretkey";


// ================= EXPRESS APP =================

const app = express();

app.use(express.json());

app.use(express.static("public"));


// ================= HTTP SERVER =================

const server = http.createServer(app);


// ================= SOCKET.IO =================

const io = new Server(server, {

    cors: {
        origin: "*"
    }

});


// ================= DATABASE CONNECTION =================

mongoose.connect(process.env.MONGO_URI)

.then(() => {

    console.log("MongoDB Connected");

})

.catch((err) => {

    console.log("MongoDB Error:", err);

});


// ================= USER SCHEMA =================

const userSchema = new mongoose.Schema({

    username: String,

    password: String

});


// ================= DEVICE SCHEMA =================

const deviceSchema = new mongoose.Schema({

    name: String,

    status: String,

    type: String,

    room: String,

    userId: mongoose.Schema.Types.ObjectId

});


// ================= ROOM SCHEMA =================

const roomSchema = new mongoose.Schema({

    name: String,

    userId: mongoose.Schema.Types.ObjectId

});


// ================= MODELS =================

const User =
    mongoose.model("User", userSchema);

const Device =
    mongoose.model("Device", deviceSchema);

const Room =
    mongoose.model("Room", roomSchema);



// ======================================================
// ================= REGISTER ROUTE =====================
// ======================================================

app.post("/register", async (req, res) => {

    const { username, password } = req.body;


    // EMPTY CHECK

    if (!username || !password) {

        return res.json({

            message:
                "Username and password required"

        });

    }


    // STRONG PASSWORD CHECK

    const strongRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;


    if (!strongRegex.test(password)) {

        return res.json({

            message:
                "Weak password"

        });

    }


    // USER EXISTS CHECK

    const exists =
        await User.findOne({ username });


    if (exists) {

        return res.json({

            message:
                "User already exists"

        });

    }


    // HASH PASSWORD

    const hashedPassword =
        await bcrypt.hash(password, 10);


    // CREATE USER

    await User.create({

        username,

        password: hashedPassword

    });


    res.json({

        message:
            "User registered successfully"

    });

});



// ======================================================
// ================= LOGIN ROUTE ========================
// ======================================================

app.post("/login", async (req, res) => {

    const { username, password } = req.body;


    // FIND USER

    const user =
        await User.findOne({ username });


    if (!user) {

        return res.json({

            message:
                "Invalid credentials"

        });

    }


    // CHECK PASSWORD

    const valid =
        await bcrypt.compare(password, user.password);


    if (!valid) {

        return res.json({

            message:
                "Invalid credentials"

        });

    }


    // CREATE TOKEN

    const token = jwt.sign(

        { userId: user._id },

        JWT_SECRET,

        { expiresIn: "1h" }

    );


    res.json({ token });

});



// ======================================================
// ================= SOCKET AUTH ========================
// ======================================================

io.use((socket, next) => {

    const token =
        socket.handshake.auth.token;


    if (!token) {

        return next(
            new Error("Authentication error")
        );

    }


    try {

        const decoded =
            jwt.verify(token, JWT_SECRET);

        socket.userId =
            decoded.userId;

        next();

    }

    catch (err) {

        next(
            new Error("Authentication error")
        );

    }

});



// ======================================================
// ================= SOCKET CONNECTION ==================
// ======================================================

io.on("connection", async (socket) => {

    console.log("User connected");


    // ================= SEND DEVICES =================

    const devices =
        await Device.find({

            userId: socket.userId

        });

    socket.emit(
        "updateDevices",
        devices
    );


    // ================= SEND ROOMS =================

    const rooms =
        await Room.find({

            userId: socket.userId

        });

    socket.emit(
        "updateRooms",
        rooms
    );



    // ==================================================
    // ================= TOGGLE DEVICE ==================
    // ==================================================

    socket.on("toggleDevice", async (deviceName) => {

        const device =
            await Device.findOne({

                name: deviceName,

                userId: socket.userId

            });


        if (device) {

            device.status =
                device.status === "ON"
                ? "OFF"
                : "ON";

            await device.save();

        }


        const updatedDevices =
            await Device.find({

                userId: socket.userId

            });


        socket.emit(
            "updateDevices",
            updatedDevices
        );

    });



    // ==================================================
    // ================= ADD DEVICE =====================
    // ==================================================

    socket.on("addDevice", async (data) => {

        const { name, type, room } = data;


        if (!name || !type || !room)
            return;


        // CHECK EXISTING DEVICE

        const exists =
            await Device.findOne({

                name,
                room,

                userId: socket.userId

            });


        // CREATE DEVICE

        if (!exists) {

            await Device.create({

                name,

                type,

                room,

                status: "OFF",

                userId: socket.userId

            });

        }


        const updatedDevices =
            await Device.find({

                userId: socket.userId

            });


        socket.emit(
            "updateDevices",
            updatedDevices
        );

    });



    // ==================================================
    // ================= DELETE DEVICE ==================
    // ==================================================

    socket.on("deleteDevice", async (deviceName) => {

        await Device.deleteOne({

            name: deviceName,

            userId: socket.userId

        });


        const updatedDevices =
            await Device.find({

                userId: socket.userId

            });


        socket.emit(
            "updateDevices",
            updatedDevices
        );

    });



    // ==================================================
    // ================= ADD ROOM =======================
    // ==================================================

    socket.on("addRoom", async (roomName) => {

        if (!roomName) return;


        // CHECK EXISTING ROOM

        const exists =
            await Room.findOne({

                name: roomName,

                userId: socket.userId

            });


        // CREATE ROOM

        if (!exists) {

            await Room.create({

                name: roomName,

                userId: socket.userId

            });

        }


        const updatedRooms =
            await Room.find({

                userId: socket.userId

            });


        socket.emit(
            "updateRooms",
            updatedRooms
        );

    });



    // ================= DISCONNECT =================

    socket.on("disconnect", () => {

        console.log("User disconnected");

    });

});



// ======================================================
// ================= START SERVER =======================
// ======================================================

const PORT =
    process.env.PORT || 3000;


server.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );

});