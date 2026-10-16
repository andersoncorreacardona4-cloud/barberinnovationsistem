const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (HTML, CSS, JS, imágenes, manifiestos)
app.use(express.static(path.join(__dirname)));

// Conexión reutilizable a MongoDB Atlas (Serverless / Vercel friendly)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://andersoncorreacardona4_db_user:7MInK4js3yK8CUQb@barverinnovationsistem.hd0sfnq.mongodb.net/?retryWrites=true&w=majority&appName=barverinnovationsistem";

let isConnected = false;

async function connectDB() {
    if (isConnected && mongoose.connection.readyState === 1) return;
    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });
        isConnected = true;
        console.log("🟢 Conectado exitosamente a MongoDB Atlas en Vercel");
    } catch (err) {
        console.error("🔴 Error al conectar a MongoDB:", err);
    }
}

// Middleware para asegurar la conexión antes de procesar cualquier ruta
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// Esquema y Modelo de Barbería
const barberiaSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    direccion: { type: String },
    telefono: { type: String },
    pin: { type: String, required: true },
    fechaCreacion: { type: Date, default: Date.now }
});

const Barberia = mongoose.models.Barberia || mongoose.model('Barberia', barberiaSchema);

// Endpoint /ping
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// Ruta para registrar una nueva barbería
app.post('/api/barberias', async (req, res) => {
    try {
        const { nombre, direccion, telefono, pin } = req.body;
        
        if (!nombre || !pin) {
            return res.status(400).json({ success: false, error: 'El nombre y el PIN son obligatorios.' });
        }

        const nuevaBarberia = new Barberia({ nombre, direccion, telefono, pin });
        await nuevaBarberia.save();

        res.status(201).json({ 
            success: true, 
            message: 'Barbería registrada con éxito', 
            barberiaId: nuevaBarberia._id 
        });
    } catch (error) {
        console.error("Error en el registro de barbería:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor al registrar la barbería.' });
    }
});

// Ruta principal para el registro
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'registro.html'));
});

// Exportar app para las Serverless Functions de Vercel
module.exports = app;

// Escuchar en puerto solo en entorno de desarrollo local
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Servidor local corriendo en http://localhost:${PORT}`);
    });
}
