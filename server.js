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


// ================= DATABASE =================

mongoose.connect(process.env.MONGO_URI)

.then(() => {

    console.log("MongoDB Connected");

})

.catch((err) => {

    console.log("MongoDB Error:", err);

});



// ======================================================
// ================= USER SCHEMA ========================
// ======================================================

const userSchema = new mongoose.Schema({

    username: String,

    password: String

});



// ======================================================
// ================= DEVICE SCHEMA ======================
// ======================================================

const deviceSchema = new mongoose.Schema({

    name: String,

    status: String,

    type: String,

    room: String,


    // LIGHT

    brightness: {

        type: Number,

        default: 50

    },


    // FAN

    speed: {

        type: String,

        default: "Medium"

    },


    // AC

    temperature: {

        type: Number,

        default: 24

    },


    // TV

    volume: {

        type: Number,

        default: 50

    },
power: {

    type: Number,

    default: 0

},

    userId: mongoose.Schema.Types.ObjectId

});



// ======================================================
// ================= ROOM SCHEMA ========================
// ======================================================

const roomSchema = new mongoose.Schema({

    name: String,

    userId: mongoose.Schema.Types.ObjectId

});

const automationSchema = new mongoose.Schema({

    room: String,

    deviceName: String,

    action: String,

    time: String,

    userId: mongoose.Schema.Types.ObjectId

});

const logSchema =
new mongoose.Schema({

    action: String,

    device: String,

    room: String,

    time: String,

    userId:
      mongoose.Schema.Types.ObjectId

});

// ======================================================
// ================= MODELS =============================
// ======================================================

const User =
    mongoose.model("User", userSchema);

const Device =
    mongoose.model("Device", deviceSchema);

const Room =
    mongoose.model("Room", roomSchema);

const Automation =
    mongoose.model("Automation",
    automationSchema);

    const Log =
mongoose.model("Log", logSchema
);

// ======================================================
// ================= REGISTER ===========================
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


    // PASSWORD STRENGTH

    const strongRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;


    if (!strongRegex.test(password)) {

        return res.json({

            message:
                "Weak password"

        });

    }


    // USER EXISTS

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
// ================= LOGIN ==============================
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


    // TOKEN

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


      


    // ==================================================
    // ================= SEND DEVICES ===================
    // ==================================================

    const devices =
        await Device.find({

            userId: socket.userId

        });

    socket.emit(
        "updateDevices",
        devices
    );



    // ==================================================
    // ================= SEND ROOMS =====================
    // ==================================================

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
        device.lastOnTime =
    new Date();

       await Log.create({

    action:
      `Turned ${device.status}`,

    device: device.name,

    room: device.room,

    time:
      new Date()
      .toLocaleString(),

    userId: socket.userId

}); 
const now =
    new Date();

const hoursUsed =
    (now - device.lastOnTime)
    / (1000 * 60 * 60);
        const updatedDevices =
            await Device.find({

                userId: socket.userId

            });


        socket.emit(
            "updateDevices",
            updatedDevices
        );

    });


const energyUsed =

(device.power * hoursUsed)
/ 1000;

    // ==================================================
    // ================= ADD DEVICE =====================
    // ==================================================

    socket.on("addDevice", async (data) => {

        const {
            name,
            type,
            room
        } = data;


        if (!name || !type || !room)
            return;


        const exists =
            await Device.findOne({

                name,
                room,

                userId: socket.userId

            });

let power = 0;

if (type === "light") {

    power = 10;

}

if (type === "fan") {

    power = 70;

}

if (type === "ac") {

    power = 1500;

}

if (type === "tv") {

    power = 120;

}

        if (!exists) {

            await Device.create({

                name,

                type,

                room,

                power,

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


        const exists =
            await Room.findOne({

                name: roomName,

                userId: socket.userId

            });


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




    // ==================================================
    // ================= DELETE ROOM ====================
    // ==================================================

    socket.on("deleteRoom", async (roomName) => {


        // DELETE ROOM

        await Room.deleteOne({

            name: roomName,

            userId: socket.userId

        });


        // DELETE DEVICES INSIDE ROOM

        await Device.deleteMany({

            room: roomName,

            userId: socket.userId

        });


        // UPDATED ROOMS

        const updatedRooms =
            await Room.find({

                userId: socket.userId

            });


        socket.emit(
            "updateRooms",
            updatedRooms
        );


        // UPDATED DEVICES

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
    // ================= ADDAUTOMATION ====================
    // ==================================================
 socket.on("addAutomation", async (data) => {

    await Automation.create({

        room: data.room,

        deviceName:
            data.deviceName,

        action: data.action,

        time: data.time,

        userId: socket.userId

    });

    const automations =
    await Automation.find({

        userId: socket.userId

    });

    socket.emit(
        "updateAutomations",
        automations
    );

});


 // ==================================================
    // ================= DELETEAUTOMATION ====================
socket.on(
"deleteAutomation",
async (automationId) => {

    await Automation.deleteOne({

        _id: automationId,

        userId: socket.userId

    });


    const automations =
    await Automation.find({

        userId: socket.userId

    });


    socket.emit(
        "updateAutomations",
        automations
    );

});
    // ==================================================
    // ================= BRIGHTNESS =====================
    // ==================================================

    socket.on("changeBrightness", async (data) => {

        const {
            deviceName,
            value
        } = data;


        const device =
            await Device.findOne({

                name: deviceName,

                userId: socket.userId

            });


        if (device) {

            device.brightness = value;

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
    // ================= FAN SPEED ======================
    // ==================================================

    socket.on("changeSpeed", async (data) => {

        const {
            deviceName,
            value
        } = data;


        const device =
            await Device.findOne({

                name: deviceName,

                userId: socket.userId

            });


        if (device) {

            device.speed = value;

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
    // ================= TEMPERATURE ====================
    // ==================================================

    socket.on("changeTemperature", async (data) => {

        const {
            deviceName,
            value
        } = data;


        const device =
            await Device.findOne({

                name: deviceName,

                userId: socket.userId

            });


        if (device) {

            device.temperature = value;

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
    // ================= TV VOLUME ======================
    // ==================================================

    socket.on("changeVolume", async (data) => {

        const {
            deviceName,
            value
        } = data;


        const device =
            await Device.findOne({

                name: deviceName,

                userId: socket.userId

            });


        if (device) {

            device.volume = value;

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
    // ================= DISCONNECT =====================
    // ==================================================

    socket.on("disconnect", () => {

        console.log("User disconnected");

    });
  const logs =
await Log.find({

    userId: socket.userId

})
.sort({ _id: -1 })
.limit(10);

socket.emit(
   "updateLogs",
   logs
);  

});


setInterval(async () => {

    // CURRENT TIME

    const now = new Date();

    const hours =
        String(now.getHours())
        .padStart(2, "0");

    const minutes =
        String(now.getMinutes())
        .padStart(2, "0");

    const currentTime =
        `${hours}:${minutes}`;


    // FIND MATCHING RULES

    const automations =
        await Automation.find({

            time: currentTime

        });


    // EXECUTE RULES

    for (const rule of automations) {

        const device =
            await Device.findOne({

                name: rule.deviceName,

                room: rule.room,

                userId: rule.userId

            });


        if (device) {

            device.status =
                rule.action;

            await device.save();

            const updatedDevices =
await Device.find({

});

io.emit(
   "updateDevices",
   updatedDevices
);

        }

    }

}, 60000);

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

