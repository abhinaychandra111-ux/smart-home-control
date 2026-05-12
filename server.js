// ======================================================
// ================= IMPORTS ============================
// ======================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");



// ======================================================
// ================= CONFIG =============================
// ======================================================

const app = express();

const server = http.createServer(app);

const io = new Server(server);

const PORT = process.env.PORT || 3000;

const JWT_SECRET = "mysupersecretkey";



// ======================================================
// ================= MIDDLEWARE =========================
// ======================================================

app.use(express.json());

app.use(express.static("public"));



// ======================================================
// ================= DATABASE ===========================
// ======================================================

mongoose.connect(

    process.env.MONGO_URI ||

    "mongodb://127.0.0.1:27017/smarthome"

)

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
// ================= ROOM SCHEMA ========================
// ======================================================

const roomSchema = new mongoose.Schema({

    name: String,

    userId: mongoose.Schema.Types.ObjectId

});



// ======================================================
// ================= DEVICE SCHEMA ======================
// ======================================================

const deviceSchema = new mongoose.Schema({

    name: String,

    status: {

        type: String,

        default: "OFF"

    },

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



    // POWER

    power: {

        type: Number,

        default: 0

    },



    // ENERGY

    totalEnergy: {

        type: Number,

        default: 0

    },



    // LAST ACTIVE

    lastOnTime: Date,



    userId: mongoose.Schema.Types.ObjectId

});



// ======================================================
// ================= AUTOMATION SCHEMA ==================
// ======================================================

const automationSchema = new mongoose.Schema({

    room: String,

    deviceName: String,

    action: String,

    time: String,

    userId: mongoose.Schema.Types.ObjectId

});



// ======================================================
// ================= LOG SCHEMA =========================
// ======================================================

const logSchema = new mongoose.Schema({

    action: String,

    device: String,

    room: String,

    time: String,

    userId: mongoose.Schema.Types.ObjectId

});



// ======================================================
// ================= MODELS =============================
// ======================================================

const User = mongoose.model(

    "User",

    userSchema

);

const Room = mongoose.model(

    "Room",

    roomSchema

);

const Device = mongoose.model(

    "Device",

    deviceSchema

);

const Automation = mongoose.model(

    "Automation",

    automationSchema

);

const Log = mongoose.model(

    "Log",

    logSchema

);



// ======================================================
// ================= REGISTER ===========================
// ======================================================

app.post(

"/register",

async (req, res) => {

    try {

        const {

            username,

            password

        } = req.body;



        if (!username || !password) {

            return res.json({

                message:
                "Username and password required"

            });

        }



        const strongRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;



        if (!strongRegex.test(password)) {

            return res.json({

                message:
                "Weak password"

            });

        }



        const exists =
        await User.findOne({

            username

        });



        if (exists) {

            return res.json({

                message:
                "User already exists"

            });

        }



        const hashedPassword =
        await bcrypt.hash(

            password,

            10

        );



        await User.create({

            username,

            password:
            hashedPassword

        });



        res.json({

            message:
            "User registered successfully"

        });

    }

    catch (err) {

        console.log(err);

        res.json({

            message:
            "Server error"

        });

    }

});



// ======================================================
// ================= LOGIN ==============================
// ======================================================

app.post(

"/login",

async (req, res) => {

    try {

        const {

            username,

            password

        } = req.body;



        const user =
        await User.findOne({

            username

        });



        if (!user) {

            return res.json({

                message:
                "Invalid credentials"

            });

        }



        const valid =
        await bcrypt.compare(

            password,

            user.password

        );



        if (!valid) {

            return res.json({

                message:
                "Invalid credentials"

            });

        }



        const token =
        jwt.sign(

            {

                userId:
                user._id

            },

            JWT_SECRET,

            {

                expiresIn:
                "1h"

            }

        );



        res.json({

            token

        });

    }

    catch (err) {

        console.log(err);

        res.json({

            message:
            "Server error"

        });

    }

});



// ======================================================
// ================= SOCKET AUTH ========================
// ======================================================

io.use((socket, next) => {

    const token =
    socket.handshake.auth.token;



    if (!token) {

        return next(

            new Error(
                "Authentication error"
            )

        );

    }



    try {

        const decoded =
        jwt.verify(

            token,

            JWT_SECRET

        );



        socket.userId =
        decoded.userId;



        next();

    }

    catch (err) {

        next(

            new Error(
                "Authentication error"
            )

        );

    }

});



// ======================================================
// ================= SOCKET CONNECTION ==================
// ======================================================

io.on(

"connection",

async (socket) => {

    console.log("User connected");



    // ==================================================
    // ================= USER ROOM ======================
    // ==================================================

    socket.join(

        socket.userId.toString()

    );



    // ==================================================
    // ================= INITIAL DATA ===================
    // ==================================================

    const devices =
    await Device.find({

        userId: socket.userId

    });



    const rooms =
    await Room.find({

        userId: socket.userId

    });



    const automations =
    await Automation.find({

        userId: socket.userId

    });



    const logs =
    await Log.find({

        userId: socket.userId

    })

    .sort({ _id: -1 })

    .limit(10);



    socket.emit(

        "updateDevices",

        devices

    );



    socket.emit(

        "updateRooms",

        rooms

    );



    socket.emit(

        "updateAutomations",

        automations

    );



    socket.emit(

        "updateLogs",

        logs

    );



    // ==================================================
    // ================= ADD ROOM =======================
    // ==================================================

    socket.on(

    "addRoom",

    async (roomName) => {

        try {

            if (!roomName)
                return;



            const exists =
            await Room.findOne({

                name: roomName,

                userId:
                socket.userId

            });



            if (!exists) {

                await Room.create({

                    name: roomName,

                    userId:
                    socket.userId

                });

            }



            const updatedRooms =
            await Room.find({

                userId:
                socket.userId

            });



            socket.emit(

                "updateRooms",

                updatedRooms

            );

        }

        catch (err) {

            console.log(err);

        }

    });




    // ==================================================
    // ================= DELETE ROOM ====================
    // ==================================================

    socket.on(

    "deleteRoom",

    async (roomName) => {

        try {

            await Room.deleteOne({

                name: roomName,

                userId:
                socket.userId

            });



            await Device.deleteMany({

                room: roomName,

                userId:
                socket.userId

            });



            const updatedRooms =
            await Room.find({

                userId:
                socket.userId

            });



            const updatedDevices =
            await Device.find({

                userId:
                socket.userId

            });



            socket.emit(

                "updateRooms",

                updatedRooms

            );



            socket.emit(

                "updateDevices",

                updatedDevices

            );

        }

        catch (err) {

            console.log(err);

        }

    });




    // ==================================================
    // ================= ADD DEVICE =====================
    // ==================================================

    socket.on(

    "addDevice",

    async (data) => {

        try {

            const {

                name,

                type,

                room

            } = data;



            if (

                !name ||

                !type ||

                !room

            ) return;



            const exists =
            await Device.findOne({

                name,

                room,

                userId:
                socket.userId

            });



            if (exists)
                return;



            let power = 0;



            if (type === "light")
                power = 10;

            if (type === "fan")
                power = 70;

            if (type === "ac")
                power = 1500;

            if (type === "tv")
                power = 120;



            await Device.create({

                name,

                type,

                room,

                power,

                status: "OFF",

                userId:
                socket.userId

            });



            const updatedDevices =
            await Device.find({

                userId:
                socket.userId

            });



            socket.emit(

                "updateDevices",

                updatedDevices

            );

        }

        catch (err) {

            console.log(err);

        }

    });




    // ==================================================
    // ================= DELETE DEVICE ==================
    // ==================================================

    socket.on(

    "deleteDevice",

    async (deviceName) => {

        try {

            await Device.deleteOne({

                name: deviceName,

                userId:
                socket.userId

            });



            const updatedDevices =
            await Device.find({

                userId:
                socket.userId

            });



            socket.emit(

                "updateDevices",

                updatedDevices

            );

        }

        catch (err) {

            console.log(err);

        }

    });




    // ==================================================
    // ================= TOGGLE DEVICE ==================
    // ==================================================

    socket.on(

    "toggleDevice",

    async (deviceName) => {

        try {

            const device =
            await Device.findOne({

                name: deviceName,

                userId:
                socket.userId

            });



            if (!device)
                return;



            // TURN ON

            if (device.status === "OFF") {

                device.status = "ON";

                device.lastOnTime =
                new Date();

            }



            // TURN OFF

            else {

                device.status = "OFF";



                if (device.lastOnTime) {

                    const now =
                    new Date();



                    const hoursUsed =

                    (now -
                    device.lastOnTime)

                    / (1000 * 60 * 60);



                    const energyUsed =

                    (device.power *
                    hoursUsed)

                    / 1000;



                    device.totalEnergy +=
                    energyUsed;

                }

            }



            await device.save();



            // LOG

            await Log.create({

                action:
                `Turned ${device.status}`,

                device:
                device.name,

                room:
                device.room,

                time:
                new Date()
                .toLocaleString(),

                userId:
                socket.userId

            });



            const updatedDevices =
            await Device.find({

                userId:
                socket.userId

            });



            const logs =
            await Log.find({

                userId:
                socket.userId

            })

            .sort({ _id: -1 })

            .limit(10);



            socket.emit(

                "updateDevices",

                updatedDevices

            );



            socket.emit(

                "updateLogs",

                logs

            );

        }

        catch (err) {

            console.log(err);

        }

    });




    // ==================================================
    // ================= BRIGHTNESS =====================
    // ==================================================

    socket.on(

    "changeBrightness",

    async (data) => {

        const device =
        await Device.findOne({

            name:
            data.deviceName,

            userId:
            socket.userId

        });



        if (device) {

            device.brightness =
            data.value;

            await device.save();

        }



        const updatedDevices =
        await Device.find({

            userId:
            socket.userId

        });



        socket.emit(

            "updateDevices",

            updatedDevices

        );

    });




    // ==================================================
    // ================= FAN SPEED ======================
    // ==================================================

    socket.on(

    "changeSpeed",

    async (data) => {

        const device =
        await Device.findOne({

            name:
            data.deviceName,

            userId:
            socket.userId

        });



        if (device) {

            device.speed =
            data.value;

            await device.save();

        }



        const updatedDevices =
        await Device.find({

            userId:
            socket.userId

        });



        socket.emit(

            "updateDevices",

            updatedDevices

        );

    });




    // ==================================================
    // ================= TEMPERATURE ====================
    // ==================================================

    socket.on(

    "changeTemperature",

    async (data) => {

        const device =
        await Device.findOne({

            name:
            data.deviceName,

            userId:
            socket.userId

        });



        if (device) {

            device.temperature =
            data.value;

            await device.save();

        }



        const updatedDevices =
        await Device.find({

            userId:
            socket.userId

        });



        socket.emit(

            "updateDevices",

            updatedDevices

        );

    });




    // ==================================================
    // ================= VOLUME =========================
    // ==================================================

    socket.on(

    "changeVolume",

    async (data) => {

        const device =
        await Device.findOne({

            name:
            data.deviceName,

            userId:
            socket.userId

        });



        if (device) {

            device.volume =
            data.value;

            await device.save();

        }



        const updatedDevices =
        await Device.find({

            userId:
            socket.userId

        });



        socket.emit(

            "updateDevices",

            updatedDevices

        );

    });




    // ==================================================
    // ================= ADD AUTOMATION =================
    // ==================================================

    socket.on(

    "addAutomation",

    async (data) => {

        try {

            const {

                room,

                deviceName,

                action,

                time

            } = data;



            if (

                !room ||

                !deviceName ||

                !action ||

                !time

            ) {

                return;

            }



            const exists =
            await Automation.findOne({

                room,

                deviceName,

                action,

                time,

                userId:
                socket.userId

            });



            if (exists)
                return;



            await Automation.create({

                room,

                deviceName,

                action,

                time,

                userId:
                socket.userId

            });



            const automations =
            await Automation.find({

                userId:
                socket.userId

            });



            socket.emit(

                "updateAutomations",

                automations

            );

        }

        catch (err) {

            console.log(err);

        }

    });




    // ==================================================
    // ================= DELETE AUTOMATION ==============
    // ==================================================

    socket.on(

    "deleteAutomation",

    async (automationId) => {

        try {

            await Automation.deleteOne({

                _id:
                automationId,

                userId:
                socket.userId

            });



            const automations =
            await Automation.find({

                userId:
                socket.userId

            });



            socket.emit(

                "updateAutomations",

                automations

            );

        }

        catch (err) {

            console.log(err);

        }

    });




    // ==================================================
    // ================= DISCONNECT =====================
    // ==================================================

    socket.on(

    "disconnect",

    () => {

        console.log(
            "User disconnected"
        );

    });

});



// ======================================================
// ================= AUTOMATION ENGINE ==================
// ======================================================

setInterval(

async () => {

    try {

        const now =
        new Date();



        const hours =
        String(now.getHours())
        .padStart(2, "0");



        const minutes =
        String(now.getMinutes())
        .padStart(2, "0");



        const currentTime =
        `${hours}:${minutes}`;



        console.log(
            "Checking:",
            currentTime
        );



        const automations =
        await Automation.find({

            time: currentTime

        });



        for (const rule of automations) {

            const device =
            await Device.findOne({

                name:
                rule.deviceName,

                room:
                rule.room,

                userId:
                rule.userId

            });



            if (!device)
                continue;



            // SAME STATE

            if (

                device.status ===
                rule.action

            ) continue;



            // TURN ON

            if (rule.action === "ON") {

                device.lastOnTime =
                new Date();

            }



            // TURN OFF

            if (

                rule.action === "OFF" &&

                device.lastOnTime

            ) {

                const now =
                new Date();



                const hoursUsed =

                (now -
                device.lastOnTime)

                / (1000 * 60 * 60);



                const energyUsed =

                (device.power *
                hoursUsed)

                / 1000;



                device.totalEnergy +=
                energyUsed;

            }



            device.status =
            rule.action;



            await device.save();



            // LOG

            await Log.create({

                action:
                `Automation turned ${rule.action}`,

                device:
                device.name,

                room:
                device.room,

                time:
                new Date()
                .toLocaleString(),

                userId:
                rule.userId

            });



            const updatedDevices =
            await Device.find({

                userId:
                rule.userId

            });



            const logs =
            await Log.find({

                userId:
                rule.userId

            })

            .sort({ _id: -1 })

            .limit(10);



            // REALTIME UPDATE

            io.to(

                rule.userId.toString()

            )

            .emit(

                "updateDevices",

                updatedDevices

            );



            io.to(

                rule.userId.toString()

            )

            .emit(

                "updateLogs",

                logs

            );



            console.log(
                "Automation executed"
            );

        }

    }

    catch (err) {

        console.log(
            "Automation error:",
            err
        );

    }

},

1000

);



// ======================================================
// ================= START SERVER =======================
// ======================================================

server.listen(

PORT,

() => {

    console.log(

        `Server running at http://localhost:${PORT}`

    );

}

);